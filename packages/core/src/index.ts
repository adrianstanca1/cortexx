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

export type AuthUser = { id: string; email: string; role: string; name?: string };

export type ApiClientOptions = {
  apiUrl?: string;
  tokenStorage?: {
    get: () => string | null | Promise<string | null>;
    set: (t: string) => void | Promise<void>;
    clear: () => void | Promise<void>;
  };
};

export function createApiClient(opts: ApiClientOptions = {}) {
  const API_URL = opts.apiUrl || API_URL_FALLBACK;
  const store =
    opts.tokenStorage ||
    (typeof localStorage !== 'undefined'
      ? {
          get: () => localStorage.getItem('cb_token'),
          set: (t: string) => localStorage.setItem('cb_token', t),
          clear: () => localStorage.removeItem('cb_token'),
        }
      : { get: () => null, set: () => {}, clear: () => {} });

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
    async getProjects(): Promise<any[]> {
      const d = await apiGet('/api/projects?limit=100');
      return Array.isArray(d) ? d : d.rows || [];
    },
    async getCollection(name: string, limit = 100): Promise<any[]> {
      const d = await apiGet(`/api/${name}?limit=${limit}`);
      return Array.isArray(d) ? d : [];
    },
    postCollection(name: string, body: any): Promise<any> {
      return apiPost(`/api/${name}`, body);
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
