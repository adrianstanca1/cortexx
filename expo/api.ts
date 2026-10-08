// Expo canonical API client. Native auth is issued by the Next/Prisma app
// (/api/mobile/auth/*); all construction data then uses the SAME endpoints as
// the web app. SecureStore remains the device-specific token backend.
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './theme';
import { createApiClient, setOfflineScope, stopStream as stopRealtimeStream } from '@cortexbuild/core';

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

type AuthResponse = { token: string; user: AuthUser };

async function publicPost(path: string, payload: Record<string, unknown>): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Could not reach Cortexx. Check your connection and try again.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(body?.error || (res.status === 429 ? 'Too many attempts. Please try again shortly.' : 'Server unavailable. Please try again.')) as Error & { code?: string };
    err.code = body?.code;
    throw err;
  }
  if (!body) throw new Error('Unexpected response from server.');
  return body;
}

async function persistSession(body: AuthResponse): Promise<AuthResponse> {
  if (!body?.token || !body?.user?.id) throw new Error('Invalid sign-in response.');
  await api.setToken(body.token);
  if ((await api.getToken()) !== body.token) throw new Error('Unable to save your secure session. Please try again.');
  setOfflineScope(body.user.id + '_' + (body.user.organization?.id || ''));
  return body;
}

export async function login(email: string, password: string, totp?: string, workspaceName?: string): Promise<AuthResponse> {
  return persistSession(await publicPost('/api/mobile/auth/login', { email: email.trim().toLowerCase(), password, ...(totp ? { totp } : {}), ...(workspaceName ? { workspaceName } : {}) }));
}

export async function switchWorkspace(organizationId: string): Promise<AuthResponse> {
  if (api.pendingWrites() > 0) throw new Error('Sync your pending offline changes before switching companies.');
  const result = await api.apiPost('/api/mobile/auth/switch', { organizationId }) as AuthResponse;
  stopRealtimeStream();
  return persistSession(result);
}

export async function registerAccount(data: { name: string; email: string; password: string; workspaceName: string }): Promise<AuthResponse> {
  return persistSession(await publicPost('/api/mobile/auth/register', data));
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  return publicPost('/api/auth/password-reset/request', { email: email.trim().toLowerCase() });
}

export async function getMe(): Promise<AuthUser | null> {
  if (!(await getToken())) { setOfflineScope(null); return null; }
  try {
    const body = await api.apiGet('/api/mobile/auth/me');
    const user = (body?.user || null) as AuthUser | null;
    if (!user) return null;
    setOfflineScope(user.id + '_' + (user.organization?.id || user.organizations?.[0]?.id || ''));
    const active = user.organizations?.[0];
    return {
      ...user,
      organizationRole: user.organizationRole || active?.role,
      organization: user.organization || (active ? { id: active.id, slug: active.slug, name: active.name } : undefined),
    };
  } catch (error: any) {
    // Only a rejected credential should log out an existing device.
    // Mobile networks frequently drop requests; preserve the session for retry.
    if (error?.message === 'unauthorized') { setOfflineScope(null); return null; }
    throw new Error('Cannot verify your session. Check your connection and retry.');
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
export const clearToken = async () => { setOfflineScope(null); await api.clearToken(); };

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
