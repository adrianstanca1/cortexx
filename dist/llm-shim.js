// CortexBuild Pro — LLM shim
// ─────────────────────────────────────────────────────────────────────
// Replaces the third-party `window.claude.complete` entry point with a
// LOCAL-FIRST router that requires no API key and runs entirely on
// infrastructure you control:
//
//   Tier 1 — Server LLM   POST {API_BASE}/api/llm  (proxies to Ollama or
//                         any OpenAI-compatible local runtime on your VPS)
//   Tier 2 — In-browser   WebLLM (Llama-3.2-1B, WebGPU) via existing
//                         CortexLocalAgent — runs fully on-device
//   Tier 3 — Deterministic  CortexLocalAgent.respond() — never fails
//
// In the Anthropic prototype environment, `window.claude.complete` is
// already provided; we DETECT that and leave it alone unless the user
// explicitly opts in to local mode via `CortexLLM.useLocal()` or a URL
// flag (`?local=1` or stored pref `cortexx_llm_mode = 'local'`).
//
// All ~30 existing call sites in the app keep working unchanged.
//
// Public API:
//   await window.claude.complete({ messages: [...] }) → string
//   CortexLLM.useLocal()        // force local
//   CortexLLM.useCloud()        // force native (no-op if not available)
//   CortexLLM.status()          // { mode, tier, hasWebLLM, hasServer }
//   CortexLLM.setApiBase(url)   // for production deployment
// ─────────────────────────────────────────────────────────────────────

(function () {
  if (window.CortexLLM) return;
  var API_BASE = function () {
    try {
      var saved = localStorage.getItem('cortexx_llm_api_base');
      if (saved) return saved.replace(/\/+$/, '');
    } catch (e) {}
    // Same-origin /api by default — matches deploy.sh / docker-compose
    return '';
  }();
  var MODE = function () {
    try {
      var qs = new URLSearchParams(location.search);
      if (qs.get('local') === '1') return 'local';
      if (qs.get('cloud') === '1') return 'cloud';
      var saved = localStorage.getItem('cortexx_llm_mode');
      if (saved === 'local' || saved === 'cloud' || saved === 'auto') return saved;
    } catch (e) {}
    // Default: 'auto' — use whatever's present (prototype env keeps Claude;
    // production deploy with no Claude entry point uses local).
    return 'auto';
  }();
  var TIMEOUT_MS = 30000;
  var SERVER_PROBE_MS = 3500; // fail fast when server LLM unreachable so we can fall through
  var lastTier = null;

  // ── Tier 1: Server LLM (Ollama proxy on your VPS) ──────────────────
  function isMultimodal(messages) {
    try {
      return messages.some(function (m) {
        return Array.isArray(m.content) && m.content.some(function (p) {
          return p && p.type === 'image';
        });
      });
    } catch (e) {
      return false;
    }
  }
  function normaliseForServer(messages) {
    // Convert Anthropic-style messages to a plain shape the server can
    // pass to Ollama or any OpenAI-compatible runtime.
    return messages.map(function (m) {
      if (typeof m.content === 'string') return {
        role: m.role,
        content: m.content
      };
      // Multimodal: concatenate text parts and pull images out
      var text = '',
        images = [];
      (m.content || []).forEach(function (p) {
        if (!p) return;
        if (p.type === 'text') text += (text ? '\n' : '') + p.text;else if (p.type === 'image' && p.source && p.source.type === 'base64') {
          images.push(p.source.data);
        }
      });
      var out = {
        role: m.role,
        content: text
      };
      if (images.length) out.images = images; // Ollama vision (llava) supports this
      return out;
    });
  }
  async function serverComplete(messages) {
    try {
      var ctrl = new AbortController();
      var timer = setTimeout(function () {
        ctrl.abort();
      }, SERVER_PROBE_MS);
      var llmHeaders = {
        'content-type': 'application/json'
      };
      try {
        var tk = localStorage.getItem('cortexx_token');
        if (tk) llmHeaders.authorization = 'Bearer ' + tk;
      } catch (e) {}
      var r = await fetch(API_BASE + '/api/llm', {
        method: 'POST',
        headers: llmHeaders,
        body: JSON.stringify({
          messages: normaliseForServer(messages)
        }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!r.ok) return null;
      var j = await r.json();
      return j && (j.text || j.message || j.content) || null;
    } catch (e) {
      return null;
    }
  }

  // ── Tier 2: WebLLM (via existing CortexLocalAgent) ─────────────────
  async function webllmComplete(messages) {
    var agent = window.CortexLocalAgent;
    if (!agent || !agent.status) return null;
    var st = agent.status();
    if (!st.webllm) return null; // not loaded yet — caller can opt in via Settings
    // Flatten messages into a single user prompt (WebLLM Llama 1B isn't multimodal)
    if (isMultimodal(messages)) return null;
    var combined = messages.map(function (m) {
      var c = typeof m.content === 'string' ? m.content : '';
      return (m.role === 'system' ? '[system] ' : m.role === 'user' ? '' : '[' + m.role + '] ') + c;
    }).join('\n\n');
    try {
      var res = await agent.respond(combined);
      return typeof res === 'string' && res.trim() ? res : null;
    } catch (e) {
      return null;
    }
  }

  // ── The shim itself ────────────────────────────────────────────────
  async function complete(opts) {
    var messages = opts && opts.messages || [];

    // Server LLM (preferred for production)
    var fromServer = await serverComplete(messages);
    if (fromServer) {
      lastTier = 'server';
      return fromServer;
    }

    // Local WebLLM
    var fromLocal = await webllmComplete(messages);
    if (fromLocal) {
      lastTier = 'webllm';
      return fromLocal;
    }

    // Deterministic last-resort: extract any text from the last user message,
    // hand it to the deterministic engine. Callers all wrap this in try/catch
    // and have their own JSON-failure fallbacks, so a usable string is enough.
    try {
      var last = messages[messages.length - 1] || {};
      var q = typeof last.content === 'string' ? last.content : (last.content || []).filter(function (p) {
        return p && p.type === 'text';
      }).map(function (p) {
        return p.text;
      }).join(' ');
      if (window.CortexLocalAgent) {
        // Prefer the deterministic engine directly — calling .respond() here
        // would re-enter window.claude.complete (the shim) and loop.
        var det = typeof CortexLocalAgent.localReason === 'function' ? CortexLocalAgent.localReason(q) : null;
        if (typeof det === 'string' && det.trim()) {
          lastTier = 'deterministic';
          return det;
        }
      }
    } catch (e) {}
    throw new Error('LLM unavailable: no local tier responded');
  }

  // ── Install ────────────────────────────────────────────────────────
  var nativeClaude = window.claude;
  var nativeComplete = nativeClaude && nativeClaude.complete;
  function installShim() {
    window.claude = window.claude || {};
    window.claude.complete = complete;
  }
  function restoreNative() {
    if (nativeClaude && nativeComplete) {
      window.claude = nativeClaude;
      window.claude.complete = nativeComplete;
    }
  }

  // Decide based on MODE
  if (MODE === 'local') installShim();else if (MODE === 'cloud') {/* keep native if present */} else {
    // 'auto'
    if (!nativeComplete) installShim(); // no native: install local
    // else: native is present (prototype env) — leave it
  }
  window.CortexLLM = {
    useLocal: function () {
      try {
        localStorage.setItem('cortexx_llm_mode', 'local');
      } catch (e) {}
      installShim();
    },
    useCloud: function () {
      try {
        localStorage.setItem('cortexx_llm_mode', 'cloud');
      } catch (e) {}
      restoreNative();
    },
    useAuto: function () {
      try {
        localStorage.setItem('cortexx_llm_mode', 'auto');
      } catch (e) {}
      if (!nativeComplete) installShim();else restoreNative();
    },
    setApiBase: function (url) {
      API_BASE = String(url || '').replace(/\/+$/, '');
      try {
        localStorage.setItem('cortexx_llm_api_base', API_BASE);
      } catch (e) {}
    },
    status: function () {
      var st = window.CortexLocalAgent && window.CortexLocalAgent.status && window.CortexLocalAgent.status() || {};
      return {
        mode: MODE,
        active: window.claude && window.claude.complete === complete ? 'shim' : 'native',
        lastTier: lastTier,
        hasNative: !!nativeComplete,
        hasWebLLM: !!st.webllm,
        hasWebGPU: !!st.webgpu,
        apiBase: API_BASE || '(same-origin)'
      };
    },
    complete: complete // exposed for testing
  };
})();