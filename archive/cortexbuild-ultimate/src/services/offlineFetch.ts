import { getToken } from '../lib/auth-storage';
import { enqueue } from './offlineQueue';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function offlineFetch(
  path: string,
  options: RequestInit = {}
): Promise<Record<string, unknown>> {
  const method = (options.method ?? 'GET').toUpperCase();
  const token = getToken();
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  // Always attempt GETs via network; writes only go through if online
  if (!WRITE_METHODS.has(method) || navigator.onLine) {
    const url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : '/' + path}`;
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeader, ...(options.headers as Record<string, string> ?? {}) },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error((err as { message: string }).message || 'Request failed');
    }
    return res.json();
  }

  // Offline write — enqueue
  await enqueue({
    method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: path.startsWith('/') ? path : `/${path}`,
    body: (options.body as string) ?? '{}',
    headers: { 'Content-Type': 'application/json', ...authHeader } as Record<string, string>,
  });
  window.dispatchEvent(new CustomEvent('queue-updated'));
  return { queued: true, message: 'Saved — will sync when online' };
}
