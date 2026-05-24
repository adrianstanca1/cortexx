import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { clearQueue, countPending } from '../services/offlineQueue';
import { offlineFetch } from '../services/offlineFetch';

describe('offlineFetch', () => {
  beforeEach(async () => {
    await clearQueue();
    vi.restoreAllMocks();
  });

  it('passes through GETs even when offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 1 }) }));
    await offlineFetch('/api/tasks', { method: 'GET' });
    expect(global.fetch).toHaveBeenCalled();
  });

  it('queues POST when offline and returns queued sentinel', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const result = await offlineFetch('/api/daily-reports', {
      method: 'POST',
      body: JSON.stringify({ notes: 'test' }),
      headers: {},
    });
    expect(result.queued).toBe(true);
    expect(await countPending()).toBe(1);
  });

  it('calls fetch normally for POST when online', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 99 }) }));
    const result = await offlineFetch('/api/daily-reports', {
      method: 'POST',
      body: JSON.stringify({ notes: 'live' }),
    });
    expect(result.id).toBe(99);
    expect(await countPending()).toBe(0);
  });
});
