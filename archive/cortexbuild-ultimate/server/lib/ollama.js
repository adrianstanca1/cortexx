/**
 * server/lib/ollama.js
 * Shared Ollama HTTP helpers — embedding + chat — extracted from search.js
 */
const https = require('https');
const http  = require('http');

const OLLAMA_HOST    = process.env.OLLAMA_HOST    || 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text:latest';
const LLM_MODEL      = process.env.LLM_MODEL      || process.env.OLLAMA_MODEL || 'qwen3.5:latest';

function buildRequest(path, body, timeout = 30000) {
  const url    = new URL(OLLAMA_HOST + path);
  const isHttps = url.protocol === 'https:';
  const lib    = isHttps ? https : http;
  const port   = url.port || (isHttps ? 443 : 11434);

  const req = lib.request({
    hostname: url.hostname,
    port,
    path,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    timeout,
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => { /* resolved by caller */ });
  });

  req.on('error',  e => { /* resolved as null by caller */ });
  req.on('timeout', () => { req.destroy(); });

  return { req, data: '' };
}

/** Fetch a 1024-dim embedding vector from Ollama /api/embeddings */
async function getEmbedding(text) {
  return new Promise(resolve => {
    const body = JSON.stringify({ model: EMBEDDING_MODEL, prompt: text });
    const { req } = buildRequest('/api/embeddings', body, 30000);

    let data = '';
    req.on('response', res => {
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)?.embedding || null); }
        catch { resolve(null); }
      });
    });
    req.on('error',   () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

/** Cosine similarity between two 1024-dim vectors */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

/** Stream a chat completion from Ollama /api/chat */
async function streamChat(messages, signal) {
  const body = JSON.stringify({ model: LLM_MODEL, messages, stream: true });
  const url    = new URL(OLLAMA_HOST + '/api/chat');
  const isHttps = url.protocol === 'https:';
  const lib    = isHttps ? https : http;
  const port   = url.port || (isHttps ? 443 : 11434);

  return new Promise((resolve, reject) => {
    const req = lib.request({
      hostname: url.hostname,
      port,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      res.on('data', c => { /* streamed to caller via callback */ });
      res.on('end', () => resolve());
    });
    req.on('error', e => { if (!signal?.aborted) reject(e); });
    if (signal) signal.addEventListener('abort', () => { req.destroy(); reject(new Error('aborted')); });
    req.write(body);
    req.end();
  });
}

module.exports = { getEmbedding, cosineSimilarity, streamChat, OLLAMA_HOST, LLM_MODEL, EMBEDDING_MODEL };
