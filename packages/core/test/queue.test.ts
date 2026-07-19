import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApiClient, flushQueue, setQueueStore, pendingWrites, onQueueChange, setOfflineCache } from '../src/index.ts';

// In-memory fakes standing in for expo-secure-store + AsyncStorage.
function memStore(map = new Map<string, string>()) {
  return {
    get: async (k: string) => map.get(k) ?? null,
    set: (k: string, v: string) => { map.set(k, v); },
    clear: () => { map.clear(); },
  };
}

describe('offline write queue', () => {
  beforeEach(() => { setQueueStore(null); setOfflineCache(null); });

  test('postCollection queues on network failure and flushQueue replays', async () => {
    const calls: any[] = [];
    // fetch that always fails (simulate no signal)
    const failingFetch = async () => { throw new Error('network down'); };
    const api = createApiClient({ apiUrl: 'https://example.com', tokenStorage: memStore() });
    // @ts-ignore override fetch for the test
    (globalThis as any)._origFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = failingFetch;

    const res = await api.postCollection('snags', { title: 'Crack in wall' });
    assert.strictEqual(res._queued, true, 'should return queued marker');
    assert.strictEqual(pendingWrites(), 1, 'queue should hold 1 write');

    // Now signal returns: flushQueue hits a real (mock) endpoint.
    (globalThis as any).fetch = async (url: string, opts: any) => {
      calls.push({ url, opts });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const out = await flushQueue({ apiUrl: 'https://example.com', token: 'tok' });
    assert.strictEqual(out.ok, 1);
    assert.strictEqual(pendingWrites(), 0, 'queue drained after flush');
    assert.strictEqual(calls[0].url, 'https://example.com/api/snags');
    assert.strictEqual(JSON.parse(calls[0].opts.body).title, 'Crack in wall');

    (globalThis as any).fetch = (globalThis as any)._origFetch;
  });

  test('onQueueChange fires when writes enqueue', async () => {
    let fired = 0;
    const off = onQueueChange(() => { fired++; });
    const failingFetch = async () => { throw new Error('x'); };
    (globalThis as any)._origFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = failingFetch;
    const api = createApiClient({ apiUrl: 'https://e.com', tokenStorage: memStore() });
    await api.postCollection('tasks', { title: 'x' });
    off();
    (globalThis as any).fetch = (globalThis as any)._origFetch;
    assert.strictEqual(fired, 1, 'listener should fire on enqueue');
  });
});
