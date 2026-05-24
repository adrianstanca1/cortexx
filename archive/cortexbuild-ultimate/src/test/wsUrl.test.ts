import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildWebSocketUrl } from '../lib/wsUrl';

describe('buildWebSocketUrl', () => {
  const original = import.meta.env.VITE_WS_URL;

  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { protocol: 'https:', host: 'www.example.com' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    (import.meta.env as { VITE_WS_URL?: string }).VITE_WS_URL = original;
  });

  it('defaults to same host wss + path', () => {
    (import.meta.env as { VITE_WS_URL?: string }).VITE_WS_URL = '';
    expect(buildWebSocketUrl('/ws')).toBe('wss://www.example.com/ws');
  });

  it('honors full wss URL', () => {
    (import.meta.env as { VITE_WS_URL?: string }).VITE_WS_URL = 'wss://api.example.com';
    expect(buildWebSocketUrl('/ws')).toBe('wss://api.example.com/ws');
  });
});
