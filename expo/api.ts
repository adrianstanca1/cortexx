// Expo canonical API client. Native auth is issued by the Next/Prisma app
// (/api/mobile/auth/*); all construction data then uses the SAME endpoints as
// the web app. SecureStore remains the device-specific token backend.
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './theme';
import { createApiClient } from '@cortexbuild/core';

const TOKEN_KEY = 'cb_token';

export const api = createApiClient({
  apiUrl: API_URL,
  tokenStorage: {
    get: async () => { try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; } },
    set: async (t: string) => { try { await SecureStore.setItemAsync(TOKEN_KEY, t); } catch {} },
    clear: async () => { try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch {} },
  },
});

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  organizationRole?: string;
  organization?: { id: string; slug: string; name: string };
  organizations?: Array<{ id: string; slug: string; name: string; role: string; personaRole?: string }>;
};

export async function login(email: string, password: string, totp?: string): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_URL}/api/mobile/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, ...(totp ? { totp } : {}) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error || 'Login failed') as Error & { code?: string };
    err.code = body?.code;
    throw err;
  }
  if (!body?.token) throw new Error('No token returned');
  await api.setToken(body.token);
  return body;
}

export async function getMe(): Promise<AuthUser | null> {
  try {
    const body = await api.apiGet('/api/mobile/auth/me');
    const user = (body?.user || null) as AuthUser | null;
    if (!user) return null;
    const active = user.organizations?.[0];
    return {
      ...user,
      organizationRole: user.organizationRole || active?.role,
      organization: user.organization || (active ? { id: active.id, slug: active.slug, name: active.name } : undefined),
    };
  } catch {
    await api.clearToken();
    return null;
  }
}

export const getProjects = () => api.getProjects();
export const getCollection = (name: string, limit?: number) => api.getCollection(name, limit);
export const postCollection = (name: string, body: any) => api.postCollection(name, body);
export const putCollection = (name: string, id: string, body: any) => api.putCollection(name, id, body);
export const apiGet = (path: string) => api.apiGet(path);
export const apiPost = (path: string, body: any) => api.apiPost(path, body);
export async function apiPatch(path: string, body: any) {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (res.status === 401) { await clearToken(); throw new Error('unauthorized'); }
  if (!res.ok) throw new Error(payload?.error || 'Update failed');
  return payload;
}
export const onQueueChange = api.onQueueChange;
export const pendingWrites = api.pendingWrites;
export const flushQueue = api.flushQueue;
export const startStream = api.startStream;
export const stopStream = api.stopStream;
export const onStreamEvent = api.onStreamEvent;
export const getToken = api.getToken;
export const setToken = api.setToken;
export const clearToken = api.clearToken;

export const postCisSub = (body: any): Promise<any> => api.postCollection('cisSubs', body);

export async function uploadNativeFile(input: { uri: string; name: string; mimeType: string }) {
  const token = await getToken();
  if (!token) throw new Error('unauthorized');
  const form = new FormData();
  form.append('file', { uri: input.uri, name: input.name, type: input.mimeType } as any);
  const res = await fetch(`${API_URL}/api/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) { await clearToken(); throw new Error('unauthorized'); }
  if (!res.ok) throw new Error(body?.error || 'Upload failed');
  return body as { url: string; name: string; size: number; mimeType: string; originalName?: string | null };
}

export async function getCurrentTeamMember(): Promise<any | null> {
  const [user, team] = await Promise.all([getMe(), getCollection('team', 500)]);
  if (!user?.email) return null;
  return (team as any[]).find(m => String(m.email || '').toLowerCase() === user.email.toLowerCase()) || null;
}
