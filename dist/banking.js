// CortexBuild Pro — Open Banking client (v1.3)
// TrueLayer-compatible. Connects to UK banks via OAuth, pulls real
// statement data into the same shape as the manual CSV path — so
// `CortexBankRec.autoMatch()` works without changes.
//
// Architecture (the honest version):
//   1. User taps "Connect bank" → opens TrueLayer hosted auth URL on
//      server (the API keys NEVER touch the client).
//   2. After consent, TrueLayer redirects to /api/banking/callback,
//      which exchanges the code for an access token, stores it server-side
//      (encrypted at rest), and redirects back to the app.
//   3. Frontend calls /api/banking/transactions → server-side proxies to
//      TrueLayer with the stored token, returns transactions in our shape.
//   4. Tokens refresh server-side automatically.
//
// No bank credentials EVER touch this client. We only see transactions.

(function () {
  if (window.CortexBanking) return;
  let API_BASE = function () {
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
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error('HTTP ' + r.status + ': ' + body.slice(0, 200));
    }
    return r.json();
  }
  async function connections() {
    try {
      return await req('/api/banking/connections');
    } catch (e) {
      return {
        connections: [],
        error: e.message
      };
    }
  }
  async function startConnect() {
    // Server returns the authorisation URL — client opens it
    const r = await req('/api/banking/connect');
    if (r.url) window.open(r.url, '_blank', 'noopener');
    return r;
  }
  async function disconnect(connectionId) {
    return req('/api/banking/disconnect', {
      method: 'POST',
      body: JSON.stringify({
        connectionId
      })
    });
  }
  async function pullTransactions(connectionId, opts) {
    const params = new URLSearchParams();
    if (connectionId) params.set('connection', connectionId);
    if (opts && opts.from) params.set('from', opts.from);
    if (opts && opts.to) params.set('to', opts.to);
    const r = await req('/api/banking/transactions' + (params.toString() ? '?' + params : ''));
    // r.transactions are already in the shape Bank Rec expects:
    // { date: ISO, desc: string, amount: number (positive = credit), raw: string }
    return r;
  }
  async function status() {
    try {
      const r = await req('/api/banking/status');
      return r;
    } catch (e) {
      return {
        available: false,
        error: e.message
      };
    }
  }
  window.CortexBanking = {
    connections,
    startConnect,
    disconnect,
    pullTransactions,
    status
  };
})();