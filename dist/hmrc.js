// CortexBuild Pro — HMRC submit client (v1.3)
// Drives the multi-step HMRC submission flow from the client.
// Server does the heavy lifting (auth, envelope, XML); we orchestrate the poll.

(function () {
  if (window.CortexHMRC) return;
  const API_BASE = function () {
    try {
      return (localStorage.getItem('cortexx_llm_api_base') || localStorage.getItem('cortexx_api_url') || '').replace(/\/+$/, '');
    } catch (e) {
      return '';
    }
  }();
  function authHeaders() {
    const h = {
      'content-type': 'application/json'
    };
    try {
      const t = localStorage.getItem('cortexx_token');
      if (t) h.authorization = 'Bearer ' + t;
    } catch (e) {}
    return h;
  }
  async function req(path, opts) {
    opts = opts || {};
    const r = await fetch(API_BASE + path, Object.assign({
      credentials: 'include',
      headers: Object.assign(authHeaders(), opts.headers || {})
    }, opts));
    const body = await r.text();
    if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + body.slice(0, 200));
    try {
      return JSON.parse(body);
    } catch (e) {
      return {
        raw: body
      };
    }
  }
  async function status() {
    try {
      return await req('/api/hmrc/status');
    } catch (e) {
      return {
        configured: false,
        error: e.message
      };
    }
  }
  async function submitCIS300(irEnvelope, periodEnd) {
    return req('/api/hmrc/cis300/submit', {
      method: 'POST',
      body: JSON.stringify({
        irEnvelope,
        periodEnd
      })
    });
  }
  async function checkStatus(correlationId) {
    return req('/api/hmrc/cis300/status?correlationId=' + encodeURIComponent(correlationId));
  }

  // Drives the full poll loop until the response is final.
  // onUpdate({ phase, attempt, elapsed, result }) is called on every change.
  async function pollUntilDone(correlationId, opts) {
    const interval = opts && opts.interval || 5;
    const maxAttempts = opts && opts.maxAttempts || 24; // 24 × 5s ≈ 2 min
    const onUpdate = opts && opts.onUpdate || (() => {});
    const t0 = Date.now();
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, interval * 1000));
      const result = await checkStatus(correlationId);
      onUpdate({
        phase: result.status,
        attempt,
        elapsed: Math.round((Date.now() - t0) / 1000),
        result
      });
      if (result.status === 'accepted' || result.status === 'rejected') return result;
    }
    throw new Error('Timed out after ' + maxAttempts + ' poll attempts');
  }
  async function history() {
    try {
      return await req('/api/hmrc/cis300/history');
    } catch (e) {
      return {
        submissions: [],
        error: e.message
      };
    }
  }
  async function discard(correlationId) {
    return req('/api/hmrc/cis300/submission?correlationId=' + encodeURIComponent(correlationId), {
      method: 'DELETE'
    });
  }
  window.CortexHMRC = {
    status,
    submitCIS300,
    checkStatus,
    pollUntilDone,
    history,
    discard
  };
})();