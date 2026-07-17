import * as SecureStore from 'expo-secure-store';
import { API_URL } from './theme';

const TOKEN_KEY = 'cb_token';

export async function getToken(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; }
}
export async function setToken(t: string): Promise<void> {
  try { await SecureStore.setItemAsync(TOKEN_KEY, t); } catch {}
}
export async function clearToken(): Promise<void> {
  try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch {}
}

export type AuthUser = { id: string; email: string; role: string; name?: string };

export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const r = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error === 'invalid credentials' ? 'Invalid email or password.' : (e.error || 'Login failed'));
  }
  const d = await r.json();
  if (!d.token) throw new Error('No token returned');
  await setToken(d.token);
  return d;
}

export async function getProjects(): Promise<any[]> {
  const d = await apiGet(`/api/projects?limit=100`);
  return Array.isArray(d) ? d : (d.rows || []);
}

export async function apiGet(path: string): Promise<any> {
  const token = await getToken();
  const r = await fetch(`${API_URL}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (r.status === 401) { await clearToken(); throw new Error('unauthorized'); }
  if (!r.ok) throw new Error('Request failed');
  return r.json();
}

export async function apiPost(path: string, body: any): Promise<any> {
  const token = await getToken();
  const r = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (r.status === 401) { await clearToken(); throw new Error('unauthorized'); }
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || 'Create failed');
  }
  return r.json();
}

export async function getCollection(name: string, limit = 100): Promise<any[]> {
  const d = await apiGet(`/api/${name}?limit=${limit}`);
  return Array.isArray(d) ? d : [];
}
export async function postCollection(name: string, body: any): Promise<any> {
  return apiPost(`/api/${name}`, body);
}
