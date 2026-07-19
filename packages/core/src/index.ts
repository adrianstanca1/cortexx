// packages/core — shared CortexBuild Pro client + types.
// Framework-agnostic: works as ESM (Next.js / Expo) and as a browser global
// (the SPA loads packages/core via <script> and reads window.CortexCore).
//
// This is the SINGLE SOURCE OF TRUTH for:
//   - the API base URL resolution
//   - the typed REST client (auth, collections, projects, support tickets)
//   - shared domain types
// Apps import from here instead of re-implementing fetch calls.

const API_URL_FALLBACK = 'https://cortexbuildpro.com';

// ── Token storage ───────────────────────────────────────────────
// RN has no localStorage; default to in-memory so the app still runs.
// The Expo entry (AppEntry.native) overrides this with expo-secure-store
// so login persists securely across app restarts.
let _memToken: string | null = null;
function defaultTokenStorage(): ApiClientOptions['tokenStorage'] {
  try {
    if (typeof localStorage !== 'undefined') {
      return {
        get: () => localStorage.getItem('cb_token'),
        set: (t: string) => localStorage.setItem('cb_token', t),
        clear: () => localStorage.removeItem('cb_token'),
      };
    }
  } catch { /* ignore */ }
  return {
    get: () => _memToken,
    set: (t: string) => { _memToken = t; },
    clear: () => { _memToken = null; },
  };
}

export function setTokenStorage(store: { get: () => string | null | Promise<string | null>; set: (t: string) => void | Promise<void>; clear: () => void | Promise<void> }) {
  _store = store;
}

let _store: ApiClientOptions['tokenStorage'] = defaultTokenStorage();

// ── Offline cache (last-known-good collections) ───────────────
// Used by the Expo app so lists work with no signal. Safe no-op elsewhere.
let _cache: { get: (k: string) => Promise<string | null>; set: (k: string, v: string) => Promise<void> } | null = null;
export function setOfflineCache(c: { get: (k: string) => Promise<string | null>; set: (k: string, v: string) => Promise<void> } | null) {
  _cache = c;
}
async function cacheGet(name: string): Promise<any[] | null> {
  if (!_cache) return null;
  try { const v = await _cache.get('cb_cache_' + name); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function cacheSet(name: string, rows: any[]): Promise<void> {
  if (!_cache) return;
  try { await _cache.set('cb_cache_' + name, JSON.stringify(rows)); } catch { /* ignore */ }
}

// ── Offline write queue ────────────────────────────────────────
// Mutations (create/update) that fail due to no signal are persisted
// here and replayed when flushQueue() runs (e.g. on network return).
// A listener lets the UI show a "syncing N" badge.
export type QueuedWrite = {
  id: string; method: 'POST' | 'PUT'; collection: string; body: any; rowId?: string;
};
let _queue: QueuedWrite[] = [];
let _queueStore: { get: (k: string) => Promise<string | null>; set: (k: string, v: string) => Promise<void> } | null = null;
let _queueListeners: (() => void)[] = [];
export function setQueueStore(s: { get: (k: string) => Promise<string | null>; set: (k: string, v: string) => Promise<void> } | null, onLoad?: QueuedWrite[]) {
  _queueStore = s;
  if (onLoad) { _queue = onLoad; notifyQueue(); }
}
function notifyQueue() { _queueListeners.forEach((l) => l()); }
export function onQueueChange(cb: () => void): () => void {
  _queueListeners.push(cb);
  return () => { _queueListeners = _queueListeners.filter((l) => l !== cb); };
}
export function pendingWrites(): number { return _queue.length; }
async function queuePersist() {
  if (!_queueStore) return;
  try { await _queueStore.set('cb_queue', JSON.stringify(_queue)); } catch { /* ignore */ }
}
async function enqueue(w: QueuedWrite): Promise<void> {
  _queue.push(w);
  await queuePersist();
  notifyQueue();
}
async function dequeue(id: string): Promise<void> {
  _queue = _queue.filter((w) => w.id !== id);
  await queuePersist();
  notifyQueue();
}
// Replay queued writes once a connection is available.
export async function flushQueue(opts?: { apiUrl?: string; token?: string | null }): Promise<{ ok: number; failed: number }> {
  if (_queue.length === 0) return { ok: 0, failed: 0 };
  const API_URL = opts?.apiUrl || API_URL_FALLBACK;
  let ok = 0; let failed = 0;
  const snapshot = [..._queue];
  for (const w of snapshot) {
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      const t = opts?.token ?? (await _store.get());
      if (t) headers['authorization'] = `Bearer ${t}`;
      const r = await fetch(`${API_URL}/api/${w.collection}${w.rowId ? '/' + w.rowId : ''}`, {
        method: w.method, headers, body: JSON.stringify(w.body),
      });
      if (r.ok) { await dequeue(w.id); ok++; }
      else failed++;
    } catch { failed++; }
  }
  return { ok, failed };
}

export type AuthUser = { id: string; email: string; role: string; name?: string };

export type ApiClientOptions = {
  apiUrl?: string;
  tokenStorage: {
    get: () => string | null | Promise<string | null>;
    set: (t: string) => void | Promise<void>;
    clear: () => void | Promise<void>;
  };
};

// ── Realtime stream (SSE) ─────────────────────────────────
// Subscribes to /api/stream (Server-Sent Events) and surfaces live
// 'change' events (job/task/invoice created/updated) to the UI. Works in
// RN/Expo via fetch + ReadableStream reader (no EventSource polyfill needed).
export type StreamEvent = { type: string; collection?: string; op?: string; id?: string; ts?: number };
let _streamListeners: ((e: StreamEvent) => void)[] = [];
let _streamController: AbortController | null = null;
let _streamTimer: any = null;
let _streamToken: string | null = null;
let _streamUrl = '';

export function onStreamEvent(cb: (e: StreamEvent) => void): () => void {
  _streamListeners.push(cb);
  return () => { _streamListeners = _streamListeners.filter((f) => f !== cb); };
}
function emitStream(e: StreamEvent) { for (const f of _streamListeners) { try { f(e); } catch { /* ignore */ } } }

export function startStream(opts: { apiUrl: string; token: string }) {
  stopStream();
  _streamUrl = (opts.apiUrl || '').replace(/\/$/, '');
  _streamToken = opts.token;
  const connect = async () => {
    if (!_streamUrl || !_streamToken) return;
    const ctrl = new AbortController();
    _streamController = ctrl;
    try {
      const res = await fetch(`${_streamUrl}/api/stream?token=${encodeURIComponent(_streamToken)}`, {
        headers: { Accept: 'text/event-stream' }, signal: ctrl.signal,
      });
      if (!res.ok || !res.body) { throw new Error('stream ' + res.status); }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) throw new Error('stream closed');
        buf += dec.decode(value, { stream: true });
        const frames = buf.split('\n\n');
        buf = frames.pop() || '';
        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          try { emitStream({ ...JSON.parse(line.slice(5).trim()), ts: Date.now() }); } catch { /* ignore */ }
        }
        await pump();
      };
      await pump();
    } catch (e: any) {
      if (ctrl.signal.aborted) return;
      _streamTimer = setTimeout(connect, 4000); // reconnect
    }
  };
  connect();
}

export function stopStream() {
  try { _streamController?.abort(); } catch { /* ignore */ }
  _streamController = null;
  if (_streamTimer) { clearTimeout(_streamTimer); _streamTimer = null; }
}

export function createApiClient(opts: Partial<ApiClientOptions> = {}) {
  const API_URL = opts.apiUrl || API_URL_FALLBACK;
  const store = opts.tokenStorage || _store;

  async function token(): Promise<string | null> {
    return await store.get();
  }

  async function apiGet(path: string): Promise<any> {
    const t = await token();
    const r = await fetch(`${API_URL}${path}`, {
      headers: t ? { authorization: `Bearer ${t}` } : {},
    });
    if (r.status === 401) {
      await store.clear();
      throw new Error('unauthorized');
    }
    if (!r.ok) throw new Error('Request failed');
    return r.json();
  }

  async function apiPost(path: string, body: any): Promise<any> {
    const t = await token();
    const r = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(t ? { authorization: `Bearer ${t}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (r.status === 401) {
      await store.clear();
      throw new Error('unauthorized');
    }
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error((e as any).error || 'Create failed');
    }
    return r.json();
  }

  return {
    API_URL,
    getToken: token,
    setToken: (t: string) => store.set(t),
    clearToken: () => store.clear(),
    async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
      const r = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error === 'invalid credentials' ? 'Invalid email or password.' : (e as any).error || 'Login failed');
      }
      const d = await r.json();
      if (!d.token) throw new Error('No token returned');
      await store.set(d.token);
      return d;
    },
    async logout() {
      await store.clear();
    },
    async getMe(): Promise<AuthUser | null> {
      try {
        const d = await apiGet('/api/auth/me');
        return (d && (d.user || d)) as AuthUser;
      } catch {
        return null;
      }
    },
    async getProjects(): Promise<any[]> {
      const d = await apiGet('/api/projects?limit=100');
      return Array.isArray(d) ? d : d.rows || [];
    },
    async getCollection(name: string, limit = 100): Promise<any[]> {
      try {
        const d = await apiGet(`/api/${name}?limit=${limit}`);
        const rows = Array.isArray(d) ? d : [];
        await cacheSet(name, rows);
        return rows;
      } catch (e: any) {
        if (e?.message === 'unauthorized') throw e;
        const cached = await cacheGet(name);
        if (cached) {
          const err: any = new Error('offline-cache');
          err.cached = cached;
          err.message = 'No signal — showing last saved data';
          throw err;
        }
        throw e;
      }
    },
    async postCisSub(body: any): Promise<any> {
      try { return await apiPost('/api/cisSubs', body); }
      catch (e: any) {
        if (e?.message === 'unauthorized') throw e;
        const id = 'cw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        await enqueue({ id, method: 'POST', collection: 'cisSubs', body });
        return { id, _queued: true, ...body };
      }
    },
    postCollection(name: string, body: any): Promise<any> {
      return apiPost(`/api/${name}`, body).catch(async (e: any) => {
        if (e?.message === 'unauthorized') throw e;
        const id = 'cw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        await enqueue({ id, method: 'POST', collection: name, body });
        return { id, _queued: true, ...body };
      });
    },
    async putCollection(name: string, id: string, body: any): Promise<any> {
      const t = await token();
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (t) headers['authorization'] = `Bearer ${t}`;
      try {
        const r = await fetch(`${API_URL}/api/${name}/${id}`, {
          method: 'PUT', headers, body: JSON.stringify(body),
        });
        if (r.status === 401) { await store.clear(); throw new Error('unauthorized'); }
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any).error || 'Update failed'); }
        return r.json();
      } catch (e: any) {
        if (e?.message === 'unauthorized') throw e;
        const qid = 'cw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        await enqueue({ id: qid, method: 'PUT', collection: name, rowId: id, body });
        return { id, _queued: true, ...body };
      }
    },
    async lookupTickets(email: string): Promise<any[]> {
      const r = await apiPost('/api/support/tickets/lookup', { email });
      return Array.isArray(r) ? r : r.tickets || [];
    },
    apiGet,
    apiPost,
    onQueueChange,
    pendingWrites,
    flushQueue,
    startStream,
    stopStream,
    onStreamEvent,
  };
}

// Default singleton (browser/localStorage)
export const api = createApiClient();

// Attach to window for the SPA's global-script loader (no bundler).
if (typeof window !== 'undefined') {
  (window as any).CortexCore = { createApiClient, api, API_URL: API_URL_FALLBACK };
}
