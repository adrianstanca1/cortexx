/**
 * WebSocket URL for the API. Default: same host as the SPA (nginx proxies `/ws`).
 *
 * Set `VITE_WS_URL` when the WS endpoint is not same-origin:
 * - Full URL: `wss://api.example.com` or `ws://localhost:3001`
 * - Host only: `api.example.com:443` (scheme follows page: https → wss)
 */
export function buildWebSocketUrl(path = '/ws'): string {
  const raw = (import.meta.env.VITE_WS_URL ?? '').trim();
  const p = path.startsWith('/') ? path : `/${path}`;
  if (raw) {
    if (raw.startsWith('wss://') || raw.startsWith('ws://')) {
      const base = raw.replace(/\/$/, '');
      return `${base}${p}`;
    }
    const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${raw}${p}`;
  }
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost';
  return `${protocol}//${host}${p}`;
}
