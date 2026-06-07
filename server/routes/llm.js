// CortexBuild Pro — /api/llm
// Local LLM proxy. Talks to Ollama (default) on the same VPS, or any
// OpenAI-compatible runtime if OPENAI_COMPAT_BASE is set.
//
// Configure via server/.env:
//   LLM_RUNTIME=ollama        (default) | openai_compat
//   OLLAMA_BASE=http://localhost:11434
//   OLLAMA_MODEL=qwen2.5-coder:7b
//   OLLAMA_VISION_MODEL=llava
//   OPENAI_COMPAT_BASE=http://localhost:8080
//   OPENAI_COMPAT_MODEL=default
//
// No API keys. All inference stays on the box you control.

const express = require('express');
const router = express.Router();

const RUNTIME = process.env.LLM_RUNTIME || 'ollama';
const OLLAMA_BASE = (process.env.OLLAMA_BASE || 'http://localhost:11434').replace(/\/+$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'llava';
const OAI_BASE = (process.env.OPENAI_COMPAT_BASE || '').replace(/\/+$/, '');
const OAI_MODEL = process.env.OPENAI_COMPAT_MODEL || 'default';
const TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || '60000', 10);

function abortableFetch(url, opts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

function hasImages(messages) {
  return messages.some(m => Array.isArray(m.images) && m.images.length);
}

async function ollamaChat(messages) {
  const model = hasImages(messages) ? OLLAMA_VISION_MODEL : OLLAMA_MODEL;
  const r = await abortableFetch(OLLAMA_BASE + '/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    const err = new Error(`Ollama ${r.status}: ${body.slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  const j = await r.json();
  return (j && j.message && j.message.content) || '';
}

async function openaiCompatChat(messages) {
  const r = await abortableFetch(OAI_BASE + '/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: OAI_MODEL,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: false,
    }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    const err = new Error(`Runtime ${r.status}: ${body.slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  const j = await r.json();
  return (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
}

router.post('/llm', async (req, res) => {
  try {
    const messages = Array.isArray(req.body && req.body.messages) ? req.body.messages : null;
    if (!messages || !messages.length) return res.status(400).json({ error: 'messages[] required' });
    const text = RUNTIME === 'openai_compat' && OAI_BASE
      ? await openaiCompatChat(messages)
      : await ollamaChat(messages);
    res.json({ text, runtime: RUNTIME, model: hasImages(messages) ? OLLAMA_VISION_MODEL : OLLAMA_MODEL });
  } catch (e) {
    const status = e.status || (e.name === 'AbortError' ? 504 : 502);
    res.status(status).json({ error: e.message || 'LLM call failed' });
  }
});

router.get('/llm/health', async (_req, res) => {
  try {
    if (RUNTIME === 'openai_compat' && OAI_BASE) {
      const r = await abortableFetch(OAI_BASE + '/v1/models', { method: 'GET' });
      return res.json({ ok: r.ok, runtime: RUNTIME, base: OAI_BASE });
    }
    const r = await abortableFetch(OLLAMA_BASE + '/api/tags', { method: 'GET' });
    if (!r.ok) return res.status(502).json({ ok: false, runtime: 'ollama', base: OLLAMA_BASE });
    const j = await r.json();
    const models = (j.models || []).map(m => m.name);
    res.json({
      ok: true, runtime: 'ollama', base: OLLAMA_BASE,
      configuredModel: OLLAMA_MODEL,
      installed: models,
      ready: models.includes(OLLAMA_MODEL) || models.some(n => n.startsWith(OLLAMA_MODEL.split(':')[0])),
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

// Shared helper so other routes (e.g. the legacy /api/ai proxy) can reuse the
// same local-LLM path without re-implementing runtime selection.
async function chat(messages) {
  return RUNTIME === 'openai_compat' && OAI_BASE
    ? await openaiCompatChat(messages)
    : await ollamaChat(messages);
}

module.exports = router;
module.exports.chat = chat;
