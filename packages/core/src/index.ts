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

export type AuthUser = { id: string; email: string; role: string; name?: string };

export type ApiClientOptions = {
  apiUrl?: string;
  tokenStorage: {
    get: () => string | null | Promise<string | null>;
    set: (t: string) => void | Promise<void>;
    clear: () => void | Promise<void>;
  };
};

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
      return apiPost('/api/cisSubs', body);
    },
    postCollection(name: string, body: any): Promise<any> {
      return apiPost(`/api/${name}`, body);
    },
    async putCollection(name: string, id: string, body: any): Promise<any> {
      const t = await token();
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (t) headers['authorization'] = `Bearer ${t}`;
      const r = await fetch(`${API_URL}/api/${name}/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });
      if (r.status === 401) { await store.clear(); throw new Error('unauthorized'); }
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error((e as any).error || 'Update failed');
      }
      return r.json();
    },
    async lookupTickets(email: string): Promise<any[]> {
      const r = await apiPost('/api/support/tickets/lookup', { email });
      return Array.isArray(r) ? r : r.tickets || [];
    },
    apiGet,
    apiPost,
  };
}

// Default singleton (browser/localStorage)
export const api = createApiClient();

// Attach to window for the SPA's global-script loader (no bundler).
if (typeof window !== 'undefined') {
  (window as any).CortexCore = { createApiClient, api, API_URL: API_URL_FALLBACK };
}
