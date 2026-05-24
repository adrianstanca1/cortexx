import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { enqueue, clearQueue, countPending } from '../services/offlineQueue';
import { runSync } from '../services/syncService';

describe('syncService', () => {
  beforeEach(async () => { await clearQueue(); vi.restoreAllMocks(); });

  it('replays pending entries and removes them on 2xx', async () => {
    await enqueue({ method: 'POST', url: '/api/daily-reports', body: '{"foo":1}', headers: {} });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) }));
    await runSync();
    expect(await countPending()).toBe(0);
  });

  it('increments retries on 5xx', async () => {
    await enqueue({ method: 'POST', url: '/api/x', body: '{}', headers: {} });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    await runSync();
    expect(await countPending()).toBe(1); // still pending (retries < 5)
  });

  it('dispatches sync-complete event after run', async () => {
    const handler = vi.fn();
    window.addEventListener('sync-complete', handler);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }));
    await runSync();
    window.removeEventListener('sync-complete', handler);
    expect(handler).toHaveBeenCalled();
  });
});
