// CortexBuild Admin — API client + session
// Talks to /api/admin/* when a server is reachable; otherwise the console runs
// entirely on the local store (AdminStore). All methods degrade gracefully:
// a network failure never throws into the UI — it returns { offline:true }.

(function () {
  'use strict';
  const SESSION_KEY = 'cortexx_admin_session';
  const API_BASE = (window.CORTEX_API_BASE || '') + '/api/admin';

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; }
  }
  function setSession(s) {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  }

  async function call(path, opts) {
    const s = getSession();
    const headers = { 'Content-Type': 'application/json' };
    if (s && s.token) headers.Authorization = 'Bearer ' + s.token;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try {
      const r = await fetch(API_BASE + path, { ...opts, headers, signal: ctrl.signal });
      clearTimeout(timer);
      if (r.status === 401) { return { unauthorized: true }; }
      // A real CortexBuild API always returns JSON. If we get a 404 or an
      // HTML error page (static host with no backend), treat it as "no server"
      // so the console can fall back to its local store.
      const ctype = r.headers.get('content-type') || '';
      if (r.status === 404 || !ctype.includes('application/json')) {
        return { offline: true };
      }
      const data = await r.json().catch(() => null);
      if (data === null) return { offline: true };
      if (!r.ok) return { error: data.error || ('HTTP ' + r.status) };
      return { data };
    } catch (e) {
      clearTimeout(timer);
      return { offline: true };
    }
  }

  window.AdminAPI = {
    SESSION_KEY,
    getSession, setSession,
    isAuthed() { const s = getSession(); return !!(s && (s.token || s.local)); },
    mode() { const s = getSession(); return s && s.local ? 'local' : (s && s.token ? 'live' : 'none'); },

    // Login: try the server; on network failure, allow a local demo session so
    // the console is usable standalone (clearly flagged as local-only).
    async login(email, password) {
      const res = await call('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (res.data && res.data.token) {
        setSession({ token: res.data.token, email: res.data.email, role: res.data.role, local: false });
        return { ok: true, mode: 'live' };
      }
      if (res.offline) {
        // No server reachable — local demo gate (any email + password "cortexbuild").
        if (password === 'cortexbuild') {
          setSession({ email: email || 'admin@cortexbuildpro.com', role: 'platform_admin', local: true });
          return { ok: true, mode: 'local' };
        }
        return { ok: false, error: 'Server unreachable. Use the local password to continue offline.' };
      }
      return { ok: false, error: (res.error === 'invalid_credentials' ? 'Incorrect email or password' : res.error) || 'Login failed' };
    },
    logout() { setSession(null); },

    // Probe whether the live API is reachable + authorized.
    async probe() {
      const s = getSession();
      if (!s || s.local || !s.token) return 'local';
      const res = await call('/metrics', { method: 'GET' });
      if (res.data) return 'live';
      if (res.unauthorized) return 'unauthorized';
      return 'offline';
    },

    // Data accessors (used when mode === 'live'; views fall back to AdminStore otherwise)
    metrics: () => call('/metrics', { method: 'GET' }),
    workspaces: () => call('/workspaces', { method: 'GET' }),
    createWorkspace: (b) => call('/workspaces', { method: 'POST', body: JSON.stringify(b) }),
    patchWorkspace: (id, b) => call('/workspaces/' + id, { method: 'PATCH', body: JSON.stringify(b) }),
    deleteWorkspace: (id) => call('/workspaces/' + id, { method: 'DELETE' }),
    users: () => call('/users', { method: 'GET' }),
    patchUser: (id, b) => call('/users/' + id, { method: 'PATCH', body: JSON.stringify(b) }),
    audit: () => call('/audit', { method: 'GET' }),
  };
})();
