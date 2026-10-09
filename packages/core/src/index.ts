// packages/core — shared CortexBuild Pro client + types.
// Framework-agnostic: works as ESM (Next.js / Expo) and as a browser global
// (the SPA loads packages/core via <script> and reads window.CortexCore).
//
// This is the SINGLE SOURCE OF TRUTH for the API client and shared domain types.

export * from './rbac';

const API_URL_FALLBACK = 'https://cortexbuildpro.tech';

let _memToken: string | null = null;
function defaultTokenStorage(): ApiClientOptions['tokenStorage'] {
  try {
    if (typeof localStorage !== 'undefined') return {
      get: () => localStorage.getItem('cb_token'),
      set: (t: string) => localStorage.setItem('cb_token', t),
      clear: () => localStorage.removeItem('cb_token'),
    };
  } catch { /* ignore */ }
  return { get: () => _memToken, set: (t: string) => { _memToken = t; }, clear: () => { _memToken = null; } };
}
let _store: ApiClientOptions['tokenStorage'] = defaultTokenStorage();
export function setTokenStorage(store: ApiClientOptions['tokenStorage']) { _store = store; }

// Offline data must never be shared between accounts or company workspaces.
let _offlineScope: string | null = null;
export function setOfflineScope(scope: string | null) { _offlineScope = scope; }
let _cache: { get: (k: string) => Promise<string | null>; set: (k: string, v: string) => Promise<void> } | null = null;
export function setOfflineCache(c: typeof _cache) { _cache = c; }
const _deniedCache = new Set<string>();
const _denialEpoch = new Map<string, number>();
function cacheKey(name: string, scope: string) { return 'cb_cache_' + scope + '_' + name; }
function denialVersion(name: string, scope: string | null) { return scope ? _denialEpoch.get(cacheKey(name, scope)) || 0 : 0; }
async function denyCached(name: string, scope: string | null) {
  if (!scope) return;
  const key = cacheKey(name, scope);
  // Guard the current process, including concurrent in-flight loads, then
  // persist invalidation so revoked rows cannot reappear after an app restart.
  _deniedCache.add(key);
  _denialEpoch.set(key, (_denialEpoch.get(key) || 0) + 1);
  try { await _cache?.set(key, 'null'); } catch { /* keep in-memory denial */ }
}
async function cacheGet(name: string, scope = _offlineScope): Promise<any[] | null> {
  if (!_cache || !scope || scope !== _offlineScope) return null;
  const key = cacheKey(name, scope);
  if (_deniedCache.has(key)) return null;
  try {
    const value = await _cache.get(key);
    if (scope !== _offlineScope || _deniedCache.has(key)) return null;
    if (!value) return null;
    const rows = JSON.parse(value);
    return Array.isArray(rows) ? rows : null;
  } catch { return null; }
}
async function cacheSet(name: string, rows: any[], scope = _offlineScope): Promise<void> {
  if (!_cache || !scope || scope !== _offlineScope) return;
  try { await _cache.set(cacheKey(name, scope), JSON.stringify(rows)); } catch { /* offline cache optional */ }
}

export type QueuedWrite = { id: string; method: 'POST' | 'PUT'; collection: string; body: any; rowId?: string; scope?: string };
let _queue: QueuedWrite[] = [];
let _queueStore: { get: (k: string) => Promise<string | null>; set: (k: string, v: string) => Promise<void> } | null = null;
let _queueListeners: (() => void)[] = [];
export function setQueueStore(s: typeof _queueStore, onLoad?: QueuedWrite[]) { _queueStore = s; if (onLoad) { _queue = onLoad; notifyQueue(); } }
function notifyQueue() { _queueListeners.forEach((l) => l()); }
export function onQueueChange(cb: () => void): () => void { _queueListeners.push(cb); return () => { _queueListeners = _queueListeners.filter((l) => l !== cb); }; }
export function pendingWrites(): number { return _queue.length; }
async function queuePersist() { if (_queueStore) try { await _queueStore.set('cb_queue', JSON.stringify(_queue)); } catch { /* ignore */ } }
async function enqueue(w: QueuedWrite) { _queue.push(w); await queuePersist(); notifyQueue(); }
async function dequeue(id: string) { _queue = _queue.filter((w) => w.id !== id); await queuePersist(); notifyQueue(); }

// An auto-sync tick and a manual retry must not replay the same queued POST
// simultaneously. Keep one shared replay promise until it settles.
let _flushInFlight: Promise<{ ok: number; failed: number }> | null = null;
export function flushQueue(opts?: { apiUrl?: string; token?: string | null }): Promise<{ ok: number; failed: number }> {
  if (_flushInFlight) return _flushInFlight;
  const run = replayQueue(opts).finally(() => { if (_flushInFlight === run) _flushInFlight = null; });
  _flushInFlight = run;
  return run;
}

async function replayQueue(opts?: { apiUrl?: string; token?: string | null }): Promise<{ ok: number; failed: number }> {
  const snapshot = [..._queue]; let ok = 0; let failed = 0;
  const API_URL = opts?.apiUrl || API_URL_FALLBACK;
  for (const w of snapshot) try {
    // Legacy unscoped writes cannot be replayed safely across users; retain
    // them for manual recovery rather than injecting into another tenant.
    if (!_offlineScope || !w.scope || w.scope !== _offlineScope) { failed++; continue; }
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const t = opts?.token ?? await _store.get(); if (t) headers.authorization = `Bearer ${t}`;
    const r = await fetch(`${API_URL}/api/${w.collection}${w.rowId ? '/' + w.rowId : ''}`, { method: w.method, headers, body: JSON.stringify(w.body) });
    if (r.ok) { await dequeue(w.id); ok++; } else failed++;
  } catch { failed++; }
  return { ok, failed };
}

export type AuthUser = { id: string; email: string; role: string; name?: string };
export type ApiClientOptions = { apiUrl?: string; tokenStorage: { get: () => string | null | Promise<string | null>; set: (t: string) => void | Promise<void>; clear: () => void | Promise<void> } };
export type StreamEvent = { type: string; collection?: string; op?: string; id?: string; ts?: number };
let _streamListeners: ((e: StreamEvent) => void)[] = [];
let _streamController: AbortController | null = null;
let _streamTimer: ReturnType<typeof setTimeout> | null = null;

export function onStreamEvent(cb: (e: StreamEvent) => void): () => void { _streamListeners.push(cb); return () => { _streamListeners = _streamListeners.filter((f) => f !== cb); }; }
function emitStream(e: StreamEvent) { for (const f of _streamListeners) try { f(e); } catch { /* ignore */ } }
export function startStream(opts: { apiUrl: string; token: string }) {
  stopStream();
  const base = opts.apiUrl.replace(/\/$/, '');
  const connect = async () => {
    const ctrl = new AbortController(); _streamController = ctrl;
    try {
      const res = await fetch(`${base}/api/events/stream`, { headers: { Accept: 'text/event-stream', Authorization: `Bearer ${opts.token}` }, signal: ctrl.signal });
      if (!res.ok || !res.body) throw new Error('stream ' + res.status);
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) throw new Error('stream closed');
        buf += dec.decode(value, { stream: true }); const frames = buf.split('\n\n'); buf = frames.pop() || '';
        for (const frame of frames) { const line = frame.split('\n').find((l) => l.startsWith('data:')); if (!line) continue; try { emitStream({ ...JSON.parse(line.slice(5).trim()), ts: Date.now() }); } catch { /* ignore */ } }
      }
    } catch {
      if (!ctrl.signal.aborted) _streamTimer = setTimeout(connect, 4000);
    }
  };
  void connect();
}
export function stopStream() { try { _streamController?.abort(); } catch { /* ignore */ } _streamController = null; if (_streamTimer) clearTimeout(_streamTimer); _streamTimer = null; }

function httpFailure(message: string, status: number) {
  const error = new Error(message) as Error & { httpStatus?: number };
  error.httpStatus = status;
  return error;
}

function isHttpFailure(error: any) {
  return Number.isInteger(error?.httpStatus);
}

export function createApiClient(opts: Partial<ApiClientOptions> = {}) {
  const API_URL = opts.apiUrl || API_URL_FALLBACK; const store = opts.tokenStorage || _store;
  const token = async () => await store.get();
  async function apiGet(path: string): Promise<any> {
    const t = await token();
    const r = await fetch(`${API_URL}${path}`, { headers: t ? { authorization: `Bearer ${t}` } : {} });
    if (r.status === 401) { await store.clear(); throw new Error('unauthorized'); }
    if (!r.ok) {
      const detail = await r.json().catch(() => ({}));
      throw httpFailure((detail as any)?.error || 'Request failed', r.status);
    }
    return r.json();
  }

  // The server caps collection pages at 100. Read subsequent pages only when
  // the response explicitly advertises hasMore; older unpaged routes still work.
  // Bounded for mobile memory, request rate and accidentally misbehaving servers.
  async function readPagedCollection(path: string, key: string, maxRows: number): Promise<any[]> {
    const rows: any[] = [];
    const target = Math.min(Math.max(1, Math.floor(maxRows)), 1000);
    let offset = 0;
    for (let page = 0; page < 10 && rows.length < target; page++) {
      const take = Math.min(100, target - rows.length);
      const separator = path.includes('?') ? '&' : '?';
      const data = await apiGet(`${path}${separator}take=${take}&skip=${offset}`);
      const slice = Array.isArray(data) ? data : (data?.rows ?? data?.[key]);
      if (!Array.isArray(slice)) throw httpFailure(`Unexpected ${key} response`, 502);
      rows.push(...slice);
      offset += slice.length;
      if (!data?.hasMore || !slice.length) break;
    }
    return rows;
  }
  async function apiPost(path: string, body: any): Promise<any> {
    const t = await token(); const r = await fetch(`${API_URL}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify(body) });
    if (r.status === 401) { await store.clear(); throw new Error('unauthorized'); }
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw httpFailure((e as any).error || 'Create failed', r.status); }
    return r.json();
  }
  return {
    API_URL, getToken: token, setToken: (t: string) => store.set(t), clearToken: () => store.clear(),
    async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
      const r = await fetch(`${API_URL}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as any).error || 'Login failed'); }
      const d = await r.json(); if (!d.token) throw new Error('No token returned'); await store.set(d.token); return d;
    },
    async logout() { await store.clear(); },
    async getMe(): Promise<AuthUser | null> { try { const d = await apiGet('/api/auth/me'); return (d && (d.user || d)) as AuthUser; } catch { return null; } },
    async getProjects(): Promise<any[]> {
      const scope = _offlineScope;
      const version = denialVersion('projects', scope);
      try {
        const rows = await readPagedCollection('/api/projects', 'projects', 1000);
        if (scope !== _offlineScope) throw new Error('Workspace changed during project loading');
        if (version !== denialVersion('projects', scope)) throw httpFailure('Project access changed during loading', 403);
        await cacheSet('projects', rows, scope);
        if (scope !== _offlineScope) throw new Error('Workspace changed during project loading');
        if (version !== denialVersion('projects', scope)) {
          await denyCached('projects', scope);
          throw httpFailure('Project access changed during loading', 403);
        }
        if (scope) _deniedCache.delete(cacheKey('projects', scope));
        return rows;
      } catch (error: any) {
        if (error?.message === 'unauthorized' || error?.httpStatus === 403) await denyCached('projects', scope);
        if (error?.message === 'unauthorized' || isHttpFailure(error) || scope !== _offlineScope) throw error;
        const cached = await cacheGet('projects', scope);
        if (cached) return cached;
        throw error;
      }
    },
    async getCollection(name: string, limit = 100): Promise<any[]> {
      const scope = _offlineScope;
      const version = denialVersion(name, scope);
      const responseKey: Record<string, string> = {
        timeentries: 'entries', checkins: 'checkins', safety: 'incidents', team: 'team',
        documents: 'documents', receipts: 'receipts', 'equipment-checks': 'checks',
        'field-constraints': 'constraints', 'field-handovers': 'handovers', 'field-production': 'logs',
      };
      try {
        const rows = await readPagedCollection(`/api/${encodeURIComponent(name)}`, responseKey[name] || name, limit);
        if (scope !== _offlineScope) throw new Error('Workspace changed during collection loading');
        if (version !== denialVersion(name, scope)) throw httpFailure('Collection access changed during loading', 403);
        await cacheSet(name, rows, scope);
        if (scope !== _offlineScope) throw new Error('Workspace changed during collection loading');
        if (version !== denialVersion(name, scope)) {
          await denyCached(name, scope);
          throw httpFailure('Collection access changed during loading', 403);
        }
        if (scope) _deniedCache.delete(cacheKey(name, scope));
        return rows;
      } catch (error: any) {
        if (error?.message === 'unauthorized' || error?.httpStatus === 403) await denyCached(name, scope);
        if (error?.message === 'unauthorized' || isHttpFailure(error) || scope !== _offlineScope) throw error;
        const cached = await cacheGet(name, scope);
        if (cached) return cached.slice(0, Math.min(1000, Math.max(1, Math.floor(limit))));
        throw error;
      }
    },
    postCollection(name: string, body: any): Promise<any> { return apiPost(`/api/${name}`, body).catch(async (e: any) => { if (e?.message === 'unauthorized' || isHttpFailure(e)) throw e; const id = 'cw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); await enqueue({ id, method: 'POST', collection: name, body, scope: _offlineScope || undefined }); return { id, _queued: true, ...body }; }); },
    async putCollection(name: string, id: string, body: any): Promise<any> {
      const t = await token(); const headers: Record<string, string> = { 'content-type': 'application/json' }; if (t) headers.authorization = `Bearer ${t}`;
      try { const r = await fetch(`${API_URL}/api/${name}/${id}`, { method: 'PUT', headers, body: JSON.stringify(body) }); if (r.status === 401) { await store.clear(); throw new Error('unauthorized'); } if (!r.ok) { const e = await r.json().catch(() => ({})); throw httpFailure((e as any).error || 'Update failed', r.status); } return r.json(); }
      catch (e: any) { if (e?.message === 'unauthorized' || isHttpFailure(e)) throw e; const qid = 'cw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); await enqueue({ id: qid, method: 'PUT', collection: name, rowId: id, body, scope: _offlineScope || undefined }); return { id, _queued: true, ...body }; }
    },
    apiGet, apiPost, onQueueChange, pendingWrites, flushQueue, startStream, stopStream, onStreamEvent,
  };
}

export const api = createApiClient();
if (typeof window !== 'undefined') (window as any).CortexCore = { createApiClient, api, API_URL: API_URL_FALLBACK };
