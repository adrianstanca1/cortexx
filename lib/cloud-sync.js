// Cortexx — cloud sync adapter (v1.1)
// Connects the localStorage-backed Backend to the real API:
//   • password + magic-link auth
//   • live realtime stream (SSE) → toasts + Backend refresh
//   • pull-on-connect + offline write queue replay
// Include AFTER backend.js in Cortexx.html. Everything degrades to
// local-only when there's no API configured or the device is offline.

(function () {
  const LS = {
    api: 'cortexx_api_url',
    token: 'cortexx_token',
    live: 'cortexx_live_sync',
    queue: 'cortexx_sync_queue',
    lastPull: 'cortexx_last_pull',
  };
  // Default the API base to the current origin so the app works out-of-the-box
  // on its deployed domain (e.g. https://cortexbuildpro.com). An explicit URL
  // set in Settings still wins and is persisted.
  let API = localStorage.getItem(LS.api)
    || (typeof window !== 'undefined' && window.location ? window.location.origin : '');
  let TOKEN = localStorage.getItem(LS.token) || '';
  let online = navigator.onLine;
  let es = null;                 // EventSource
  const listeners = new Set();   // status subscribers

  const emit = (status) => listeners.forEach(fn => { try { fn(status()); } catch (e) {} });
  const toast = (m, t) => window.cortexxToast && window.cortexxToast(m, t);

  window.addEventListener('online', () => { online = true; flushQueue(); emit(status); });
  window.addEventListener('offline', () => { online = false; emit(status); });

  // ── Shared core client (monorepo packages/core) ──────────
  // Delegate generic REST to the single source of truth in packages/core,
  // but bind it to the SPA's OWN token storage (LS.token = 'cortexx_token')
  // and API URL so existing sessions keep working unchanged. Falls back to a
  // local fetch shim if CortexCore didn't load (e.g. script blocked).
  let core = null;
  try {
    if (window.CortexCore && window.CortexCore.createApiClient) {
      core = window.CortexCore.createApiClient({
        apiUrl: API || window.CortexCore.API_URL,
        tokenStorage: {
          get: () => TOKEN,
          set: (t) => { TOKEN = t; if (t) try { localStorage.setItem(LS.token, t); } catch (e) {} },
          clear: () => { TOKEN = ''; try { localStorage.removeItem(LS.token); } catch (e) {} },
        },
      });
    }
  } catch (e) { core = null; }

  // Clear the session when the server rejects our token, so the UI stops
  // claiming "signed in" and prompts a fresh sign-in (queued writes survive
  // and replay after re-auth via flushQueue()).
  function invalidateAuth() {
    if (!TOKEN) return;
    TOKEN = '';
    try { localStorage.removeItem(LS.token); } catch (e) {}
    if (core) try { core.clearToken(); } catch (e) {}
    closeStream();
    toast('Session expired — please sign in again', 'error');
    emit(status);
  }

  // Generic REST call. Delegates to CortexCore.apiGet/apiPost when available
  // (same fetch/URL/401 semantics as packages/core); otherwise a local shim.
  // Returns { __error: <status> } on non-2xx, or null on network failure.
  async function api(method, path, body, useAuth = true) {
    if (!API) return null;
    if (core && (method === 'GET')) {
      try { return await core.apiGet(path); }
      catch (e) { if (e && e.message === 'unauthorized') { invalidateAuth(); return { __error: 401 }; } return null; }
    }
    if (core && method !== 'GET') {
      try { return body ? await core.apiPost(path, body) : await core.apiGet(path); }
      catch (e) { if (e && e.message === 'unauthorized') { invalidateAuth(); return { __error: 401 }; } return null; }
    }
    // Fallback (no CortexCore): inline fetch, identical semantics.
    try {
      const headers = { 'content-type': 'application/json' };
      if (useAuth && TOKEN) headers.authorization = 'Bearer ' + TOKEN;
      const r = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
      if (r.status === 401 && useAuth) { invalidateAuth(); return { __error: 401 }; }
      if (!r.ok) return { __error: r.status };
      return await r.json();
    } catch (e) { return null; }
  }

  // ── Offline write queue ───────────────────────────────────
  const QUEUE_CAP = 10000;
  const readQueue = () => { try { return JSON.parse(localStorage.getItem(LS.queue) || '[]'); } catch (e) { return []; } };
  const writeQueue = (q) => {
    try {
      if (q.length > QUEUE_CAP) {
        // Extended offline use overflowed the queue — warn rather than silently
        // dropping the oldest writes with no user-visible signal.
        toast('Offline changes exceed ' + QUEUE_CAP + ' — oldest may not sync. Reconnect soon.', 'error');
      }
      localStorage.setItem(LS.queue, JSON.stringify(q.slice(-QUEUE_CAP)));
    } catch (e) {}
  };
  async function flushQueue() {
    if (!API || !TOKEN || !online) return;
    const q = readQueue();
    if (!q.length) return;
    const res = await api('POST', '/api/sync/bulk', { ops: q });
    if (res && !res.__error) { writeQueue([]); emit(status); }
  }

  // ── Realtime stream (SSE) ─────────────────────────────────
  function openStream() {
    if (!API || !TOKEN || es) return;
    try {
      es = new EventSource(`${API}/api/stream?token=${encodeURIComponent(TOKEN)}`);
      es.onmessage = (ev) => {
        let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg.type === 'portal_message') toast(`New client message · ${msg.client || ''}`, 'info');
        else if (msg.type === 'portal_approval') toast(`Quote approved · ${msg.client || ''}`, 'success');
        else if (msg.type === 'change' && window.Backend && window.Backend.pullRemote) window.Backend.pullRemote(msg.collection);
        window.dispatchEvent(new CustomEvent('cortexx-remote', { detail: msg }));
      };
      es.onerror = () => { /* browser auto-reconnects */ };
    } catch (e) {}
  }
  function closeStream() { if (es) { es.close(); es = null; } }

  // ── Public status object ──────────────────────────────────
  function status() {
    return {
      configured: !!API,
      authed: !!TOKEN,
      online,
      live: localStorage.getItem(LS.live) === '1' && !!es,
      apiUrl: API,
      queued: readQueue().length,
      lastPull: localStorage.getItem(LS.lastPull) || null,
    };
  }

  window.cortexxCloud = {
    status,
    onStatus(fn) { listeners.add(fn); fn(status()); return () => listeners.delete(fn); },

    setApi(url) {
      API = (url || '').replace(/\/$/, '');
      localStorage.setItem(LS.api, API);
      // Rebind core to the new base URL (createApiClient captures apiUrl once).
      if (core && window.CortexCore && window.CortexCore.createApiClient) {
        try {
          core = window.CortexCore.createApiClient({
            apiUrl: API || window.CortexCore.API_URL,
            tokenStorage: {
              get: () => TOKEN,
              set: (t) => { TOKEN = t; if (t) try { localStorage.setItem(LS.token, t); } catch (e) {} },
              clear: () => { TOKEN = ''; try { localStorage.removeItem(LS.token); } catch (e) {} },
            },
          });
        } catch (e) { core = null; }
      }
      emit(status);
    },

    async health() { const h = await api('GET', '/api/health', null, false); return !!(h && h.status === 'ok'); },

    // ── Auth ────────────────────────────────────────────────
    async register(email, password, name, company) {
      const r = await api('POST', '/api/auth/register', { email, password, name, company }, false);
      if (r && r.token) { return this._authed(r); }
      toast(r && r.error ? ('Sign-up failed — ' + r.error) : 'Sign-up failed — try again', 'error');
      return false;
    },
    async loginPassword(email, password) {
      const r = await api('POST', '/api/auth/login', { email, password }, false);
      if (r && r.token) { return this._authed(r); }
      toast('Sign-in failed — check your details', 'error'); return false;
    },
    async requestMagic(email) {
      const r = await api('POST', '/api/auth/magic/request', { email }, false);
      if (r && (r.ok || r.sent)) { toast('Magic link sent — check your email', 'success'); return r.devLink || true; }
      toast('Could not send magic link', 'error'); return false;
    },
    async verifyMagic(token) {
      const r = await api('POST', '/api/auth/magic/verify', { token }, false);
      if (r && r.token) return this._authed(r);
      toast('Magic link invalid or expired', 'error'); return false;
    },
    _authed(r) {
      TOKEN = r.token; localStorage.setItem(LS.token, TOKEN);
      if (core) try { core.setToken(r.token); } catch (e) {}
      if (r.user && window.Backend) try { window.Backend.db.user.update({ name: r.user.name, email: r.user.email }); } catch (e) {}
      toast('Signed in to cloud', 'success');
      // Always tear down any prior account's stream before (re)opening, so a
      // second sign-in on a shared device can't keep listening on account A's SSE.
      closeStream();
      this.pull();
      flushQueue();
      if (localStorage.getItem(LS.live) === '1') openStream();
      emit(status);
      return true;
    },
    signOut() { TOKEN = ''; localStorage.removeItem(LS.token); closeStream(); emit(status); },

    // ── Live sync toggle ────────────────────────────────────
    setLive(on) {
      localStorage.setItem(LS.live, on ? '1' : '0');
      if (on) openStream(); else closeStream();
      emit(status);
    },

    // ── Data ────────────────────────────────────────────────
    async pull() {
      const since = localStorage.getItem(LS.lastPull) || '';
      const r = await api('GET', '/api/sync/pull?since=' + encodeURIComponent(since));
      if (r && r.collections) {
        if (window.Backend && window.Backend.mergeRemote) window.Backend.mergeRemote(r.collections);
        if (r.at) localStorage.setItem(LS.lastPull, r.at);
        emit(status);
        return r.collections;
      }
      return null;
    },
    // Mirror a single create/update/delete to the cloud (queues when offline
    // OR when an online attempt fails, so writes are never silently dropped).
    async push(collection, op, id, data) {
      if (!API || !TOKEN) return;
      const item = { collection, op, id, data };
      const enqueue = () => { const q = readQueue(); q.push(item); writeQueue(q); emit(status); };
      if (!online) { enqueue(); return; }
      let res;
      if (op === 'create' || op === 'update') res = await api(op === 'create' ? 'POST' : 'PUT', `/api/${collection}${op === 'update' ? '/' + id : ''}`, data);
      else if (op === 'delete') res = await api('DELETE', `/api/${collection}/${id}`);
      // Network error (null) or any server error (incl. 401) → keep the write in
      // the queue so it replays on reconnect or after re-auth (flushQueue).
      if (res === null || (res && res.__error)) enqueue();
    },

    // ── Portal inbox (server-backed) ────────────────────────
    async portalInbox() { const r = await api('GET', '/api/portal-inbox'); return Array.isArray(r) ? r : []; },

    // ── v1.7 server-side intelligence ───────────────────────
    // Returns authoritative metrics computed server-side from the canonical
    // store. Pass a domain (scheduling|financial|tender|procurement|quality|
    // hs|client) for one, or omit for the full CEO-briefing payload. Falls
    // back to null when not configured/authed so callers use local compute.
    async intelligence(domain) {
      if (!API || !TOKEN) return null;
      const r = await api('GET', '/api/intelligence' + (domain ? '/' + domain : ''));
      if (!r || r.__error) return null;
      return domain ? r.data : r.domains;
    },
  };

  // Auto-resume a live session on load.
  if (API && TOKEN && localStorage.getItem(LS.live) === '1') { openStream(); flushQueue(); }
})();
