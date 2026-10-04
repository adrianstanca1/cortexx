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
    conflicts: 'cortexx_sync_conflicts',
    lastPull: 'cortexx_last_pull',
  };
  // Default the API base to the current origin so the app works out-of-the-box
  // on its deployed domain (e.g. https://cortexbuildpro.tech). An explicit URL
  // set in Settings still wins and is persisted.
  let API = localStorage.getItem(LS.api)
    || (typeof window !== 'undefined' && window.location ? window.location.origin : '');
  let TOKEN = localStorage.getItem(LS.token) || '';
  let online = navigator.onLine;
  let sessionRevision = 0;
  let es = null;                 // EventSource
  const listeners = new Set();   // status subscribers

  const emit = (status) => listeners.forEach(fn => { try { fn(status()); } catch (e) {} });
  const toast = (m, t) => window.cortexxToast && window.cortexxToast(m, t);

  window.addEventListener('online', () => { online = true; resumeSync(); emit(status); });
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

  // Capture the destination and session before awaiting a request. A response
  // from a previous login must never invalidate the current account.
  async function api(method, path, body, useAuth = true) {
    const base = API;
    const token = TOKEN;
    const session = sessionRevision;
    if (!base) return null;
    try {
      const headers = { 'content-type': 'application/json' };
      if (useAuth && token) headers.authorization = 'Bearer ' + token;
      const r = await fetch(base + path, {
        method, headers, body: body == null ? undefined : JSON.stringify(body),
      });
      let payload = null;
      if (r.status !== 204) {
        try { payload = await r.json(); } catch (e) { payload = null; }
      }
      if (r.status === 401 && useAuth) {
        if (API === base && TOKEN === token && session === sessionRevision) invalidateAuth();
        return { ...(payload && typeof payload === 'object' ? payload : {}), __error: 401 };
      }
      if (!r.ok) return { ...(payload && typeof payload === 'object' ? payload : {}), __error: r.status };
      return r.status === 204 ? { ok: true } : payload;
    } catch (e) { return null; }
  }

  // ── Offline write queue ───────────────────────────────────
  // JWT claims identify a local storage partition only; the server remains
  // responsible for verifying the token. Partition by API, workspace AND user.
  function queueKey() {
    if (!TOKEN) return null;
    try {
      const payload = TOKEN.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const claims = JSON.parse(atob(payload));
      if (!claims.ws || !claims.uid) return null;
      return LS.queue + ':' + encodeURIComponent(API) + ':' +
        encodeURIComponent(claims.ws) + ':' + encodeURIComponent(claims.uid);
    } catch (e) { return null; }
  }
  // Never reuse the legacy global cursor: its owner cannot be established.
  // A fresh scoped pull is safer than skipping records on a shared device.
  function pullKey() {
    const key = queueKey();
    return key ? LS.lastPull + key.slice(LS.queue.length) : null;
  }
  function conflictKey(key = queueKey()) {
    return key ? LS.conflicts + key.slice(LS.queue.length) : null;
  }
  function lastPull() {
    const key = pullKey();
    return key ? localStorage.getItem(key) : null;
  }
  let pullRequest = 0;
  const readQueue = (key = queueKey()) => {
    try {
      const q = key ? JSON.parse(localStorage.getItem(key) || '[]') : [];
      return Array.isArray(q) ? q : [];
    } catch (e) { return []; }
  };
  const writeQueue = (q, key = queueKey()) => {
    if (!key) return false;
    try {
      // Never truncate pending work. Storage exhaustion must be visible.
      localStorage.setItem(key, JSON.stringify(q));
      return true;
    } catch (e) {
      toast('Unable to save changes for cloud sync — free device storage and retry.', 'error');
      return false;
    }
  };
  const readConflicts = (key = conflictKey()) => {
    try {
      const rows = key ? JSON.parse(localStorage.getItem(key) || '[]') : [];
      return Array.isArray(rows) ? rows : [];
    } catch (e) { return []; }
  };
  const writeConflicts = (rows, key = conflictKey()) => {
    if (!key) return false;
    try {
      localStorage.setItem(key, JSON.stringify(rows));
      return true;
    } catch (e) {
      toast('Unable to save sync conflicts — free device storage before continuing.', 'error');
      return false;
    }
  };
  const canonicalCollection = (collection) => collection === 'team_members' ? 'team' : collection;
  const sameRecord = (op, collection, id) =>
    canonicalCollection(op.collection) === canonicalCollection(collection) && String(op.id) === String(id);
  // Migrate the old unscoped queue only for the session present at startup.
  // With no known owner, preserve it rather than assigning it to the next login.
  const initialKey = queueKey();
  if (initialKey && localStorage.getItem(LS.queue)) {
    try {
      const old = JSON.parse(localStorage.getItem(LS.queue));
      if (Array.isArray(old) && writeQueue([...readQueue(initialKey), ...old], initialKey)) {
        localStorage.removeItem(LS.queue);
      }
    } catch (e) { /* retain legacy data for recovery */ }
  }
  let flushing = null;
  let writeRevision = 0;
  function activateCache() {
    sessionRevision++;
    pullRequest++; // Invalidate in-flight pulls, including sign-out/sign-in to the same account.
    if (window.Backend && window.Backend.activateScope) window.Backend.activateScope(queueKey());
  }
  function quarantineConflict(serverConflict, key) {
    if (!serverConflict || serverConflict.collection == null || serverConflict.id == null) return false;
    const current = readQueue(key);
    const matching = current.filter(op => sameRecord(op, serverConflict.collection, serverConflict.id));
    if (!matching.length) return false;
    const last = matching[matching.length - 1];
    const local = last.op === 'delete' ? null : (last.data || null);
    const cKey = conflictKey(key);
    if (!cKey) return false;
    const existing = readConflicts(cKey);
    const recordKey = `${canonicalCollection(serverConflict.collection)}:${String(serverConflict.id)}`;
    const entry = {
      key: recordKey,
      collection: canonicalCollection(serverConflict.collection),
      id: String(serverConflict.id),
      baseVersion: Number(serverConflict.baseVersion) || 0,
      currentVersion: Number(serverConflict.currentVersion) || 0,
      local,
      remote: serverConflict.remote == null ? null : serverConflict.remote,
      operations: matching,
      detectedAt: new Date().toISOString(),
    };
    const nextConflicts = [...existing.filter(row => row && row.key !== recordKey), entry];
    if (!writeConflicts(nextConflicts, cKey)) return false;
    const remaining = current.filter(op => !sameRecord(op, serverConflict.collection, serverConflict.id));
    if (!writeQueue(remaining, key)) {
      writeConflicts(existing, cKey);
      return false;
    }
    writeRevision++;
    toast('Sync conflict needs review — your offline change was kept safely.', 'error');
    emit(status);
    return true;
  }
  activateCache();
  async function flushQueue() {
    if (!API || !TOKEN || !online || !queueKey()) return;
    if (flushing) return flushing;
    const key = queueKey();
    const token = TOKEN;
    const work = async () => {
      while (online && TOKEN === token && queueKey() === key) {
        const batch = readQueue(key).slice(0, 1000);
        if (!batch.length) return;
        const res = await api('POST', '/api/sync/bulk', { ops: batch });
        if (TOKEN !== token || queueKey() !== key) return;
        if (res && res.__error === 409 && res.error === 'sync_conflict' && res.conflict) {
          if (!quarantineConflict(res.conflict, key)) return;
          continue;
        }
        // A count alone cannot identify which operations succeeded on an old
        // server. Only remove a fully acknowledged batch; retries are idempotent.
        if (!res || res.__error || res.ok !== true || res.applied !== batch.length) return;
        const current = readQueue(key);
        // Preserve writes appended during the request and refuse to discard a
        // prefix changed by another tab.
        if (JSON.stringify(current.slice(0, batch.length)) !== JSON.stringify(batch)) return;
        if (!writeQueue(current.slice(batch.length), key)) return;
        writeRevision++;
        emit(status);
      }
    };
    flushing = work();
    try { await flushing; } finally {
      flushing = null;
      if (TOKEN && queueKey() !== key) flushQueue();
    }
  }

  // Refresh after replay so a device also sees edits made elsewhere while it
  // was offline. A superseded session must not schedule a new account's pull.
  async function resumeSync() {
    const session = sessionRevision;
    try {
      await flushQueue();
      if (online && session === sessionRevision) await window.cortexxCloud.pull();
    } catch (e) {
      toast('Cloud refresh could not finish — please retry sync.', 'error');
    }
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
      conflicts: readConflicts().length,
      lastPull: lastPull() || null,
    };
  }

  window.cortexxCloud = {
    status,
    onStatus(fn) { listeners.add(fn); fn(status()); return () => listeners.delete(fn); },

    setApi(url) {
      closeStream();
      API = (url || '').replace(/\/$/, '');
      localStorage.setItem(LS.api, API);
      activateCache();
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
      activateCache();
      if (r.user && window.Backend) try { window.Backend.db.user.updateSync({ name: r.user.name, email: r.user.email, role: r.user.role }); } catch (e) {}
      toast('Signed in to cloud', 'success');
      // Always tear down any prior account's stream before (re)opening, so a
      // second sign-in on a shared device can't keep listening on account A's SSE.
      closeStream();
      flushQueue().then(() => this.pull());
      if (localStorage.getItem(LS.live) === '1') openStream();
      emit(status);
      return true;
    },
    signOut() { TOKEN = ''; localStorage.removeItem(LS.token); closeStream(); activateCache(); emit(status); },

    // ── Live sync toggle ────────────────────────────────────
    setLive(on) {
      localStorage.setItem(LS.live, on ? '1' : '0');
      if (on) openStream(); else closeStream();
      emit(status);
    },

    conflicts() {
      return readConflicts().map(row => ({ ...row, operations: Array.isArray(row.operations) ? [...row.operations] : [] }));
    },
    async resolveConflict(recordKey, strategy) {
      if (!['mine', 'cloud'].includes(strategy)) return false;
      const cKey = conflictKey();
      const qKey = queueKey();
      if (!cKey || !qKey) return false;
      const rows = readConflicts(cKey);
      const conflict = rows.find(row => row && row.key === recordKey);
      if (!conflict) return false;
      const remaining = rows.filter(row => !row || row.key !== recordKey);
      const resolvedId = conflict.local?.id ?? conflict.remote?.id ?? conflict.id;

      if (strategy === 'cloud') {
        if (!writeConflicts(remaining, cKey)) return false;
        if (window.Backend && window.Backend.applyConflictResolution) {
          window.Backend.applyConflictResolution(conflict.collection, resolvedId, conflict.remote || null);
        }
        writeRevision++;
        emit(status);
        toast('Cloud version kept', 'success');
        return true;
      }

      const baseVersion = Number(conflict.currentVersion) || 0;
      const local = conflict.local == null
        ? null
        : { ...conflict.local, id: resolvedId, _syncVersion: baseVersion + 1, _rev: Date.now() };
      const op = local == null ? 'delete' : (conflict.remote == null ? 'create' : 'update');
      const q = readQueue(qKey);
      const next = [...q, {
        collection: conflict.collection,
        op,
        id: resolvedId,
        ...(local == null ? {} : { data: local }),
        baseVersion,
      }];
      if (!writeQueue(next, qKey)) return false;
      if (!writeConflicts(remaining, cKey)) {
        writeQueue(q, qKey);
        return false;
      }
      if (window.Backend && window.Backend.applyConflictResolution) {
        window.Backend.applyConflictResolution(conflict.collection, resolvedId, local);
      }
      writeRevision++;
      emit(status);
      toast('Your version queued to sync', 'success');
      await flushQueue();
      return true;
    },

    // ── Data ────────────────────────────────────────────────
    async pull() {
      const token = TOKEN;
      const base = API;
      const key = pullKey();
      if (!token || !key) return null;
      const request = ++pullRequest;
      if (flushing) await flushing;
      if (TOKEN !== token || API !== base || request !== pullRequest) return null;
      const revision = writeRevision;
      const since = localStorage.getItem(key) || '';
      const r = await api('GET', '/api/sync/pull?since=' + encodeURIComponent(since));
      if (TOKEN === token && API === base && request === pullRequest && revision === writeRevision && r && r.collections) {
        const conflictOps = readConflicts().map(row => ({
          collection: row.collection,
          op: row.local == null ? 'delete' : 'update',
          id: row.local?.id ?? row.remote?.id ?? row.id,
          ...(row.local == null ? {} : { data: row.local }),
        }));
        if (window.Backend && window.Backend.mergeRemote) {
          window.Backend.mergeRemote(r.collections, {
            fullSnapshot: r.fullSnapshot === true,
            pending: [...readQueue(), ...conflictOps],
          });
        }
        if (r.at) localStorage.setItem(key, r.at);
        emit(status);
        return r.collections;
      }
      return null;
    },
    // Mirror a single create/update/delete to the cloud (queues when offline
    // OR when an online attempt fails, so writes are never silently dropped).
    async push(collection, op, id, data, meta = {}) {
      if (!API || !TOKEN) return;
      const key = queueKey();
      if (!key) { toast('Please sign in again before syncing changes.', 'error'); return; }
      const q = readQueue(key);
      writeRevision++;
      q.push({
        collection,
        op,
        id,
        ...(data == null ? {} : { data }),
        ...(Number.isInteger(meta.baseVersion) && meta.baseVersion >= 0 ? { baseVersion: meta.baseVersion } : {}),
      });
      if (!writeQueue(q, key)) return;
      emit(status);
      await flushQueue();
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
  if (API && TOKEN) {
    if (localStorage.getItem(LS.live) === '1') openStream();
    if (online) resumeSync();
  }
})();
