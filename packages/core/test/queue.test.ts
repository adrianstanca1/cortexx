import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createApiClient, flushQueue, setQueueStore, pendingWrites, onQueueChange, setOfflineCache, setOfflineScope } from '../src/index.ts';

// In-memory fakes standing in for expo-secure-store + AsyncStorage.
function memStore(map = new Map<string, string>()) {
  return {
    get: async (k: string) => map.get(k) ?? null,
    set: (k: string, v: string) => { map.set(k, v); },
    clear: () => { map.clear(); },
  };
}

describe('offline write queue', () => {
  beforeEach(() => { setQueueStore(null, []); setOfflineCache(null); setOfflineScope('userA_orgA'); });

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


test('offline writes cannot replay under another company or account', async () => {
  const oldFetch = globalThis.fetch;
  const api = createApiClient({ apiUrl: 'https://example.com', tokenStorage: memStore() });
  try {
    setQueueStore(null, []);
    setOfflineScope('userA_orgA');
    globalThis.fetch = async () => { throw new Error('offline'); };
    await api.postCollection('snags', { title: 'Private tenant A snag' });
    assert.strictEqual(pendingWrites(), 1);
    setOfflineScope('userA_orgB');
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response('{}', { status: 200 }); };
    const blocked = await flushQueue({ token: 'tenantB', apiUrl: 'https://example.com' });
    assert.strictEqual(blocked.ok, 0);
    assert.strictEqual(calls, 0, 'must never POST another company offline data');
    setOfflineScope('userA_orgA');
    const recovered = await flushQueue({ token: 'tenantA', apiUrl: 'https://example.com' });
    assert.strictEqual(recovered.ok, 1);
  } finally {
    globalThis.fetch = oldFetch;
    setQueueStore(null, []);
    setOfflineScope(null);
  }
});

test('legacy offline writes without tenant context are not silently replayed', async () => {
  setQueueStore(null, [{ id: 'old', method: 'POST', collection: 'snags', body: { title: 'old' } }]);
  setOfflineScope('newUser_newOrg');
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error('legacy write should not send'); };
    const res = await flushQueue({ token: 'PLACEHOLDER_TOKEN', apiUrl: 'https://example.com' });
    assert.strictEqual(res.ok, 0);
    assert.strictEqual(res.failed, 1);
    assert.strictEqual(pendingWrites(), 1);
  } finally {
    globalThis.fetch = oldFetch;
    setQueueStore(null, []);
    setOfflineScope(null);
  }
});

test('simultaneous manual and background sync never double-submit a queued write', async () => {
  const originalFetch = globalThis.fetch;
  const api = createApiClient({ apiUrl: 'https://example.com', tokenStorage: memStore() });
  let release: (() => void) | undefined;
  let sent = 0;
  try {
    setQueueStore(null, []);
    setOfflineScope('userA_orgA');
    globalThis.fetch = async () => { throw new Error('offline'); };
    await api.postCollection('field-events', { title: 'Site safety note' });
    assert.strictEqual(pendingWrites(), 1);

    globalThis.fetch = async () => {
      sent++;
      await new Promise<void>((resolve) => { release = resolve; });
      return new Response('{}', { status: 200 });
    };
    const foreground = flushQueue({ token: 'tenant-A', apiUrl: 'https://example.com' });
    const background = flushQueue({ token: 'tenant-A', apiUrl: 'https://example.com' });
    assert.strictEqual(sent, 1, 'one write request while both sync calls overlap');
    release?.();
    const [a, b] = await Promise.all([foreground, background]);
    assert.deepStrictEqual(a, { ok: 1, failed: 0 });
    assert.deepStrictEqual(b, a);
    assert.strictEqual(sent, 1, 'single server write after replay completes');
    assert.strictEqual(pendingWrites(), 0);
  } finally {
    release?.();
    globalThis.fetch = originalFetch;
    setQueueStore(null, []);
    setOfflineScope(null);
  }
});

test('a failed shared replay unlocks later retries', async () => {
  const originalFetch = globalThis.fetch;
  const api = createApiClient({ apiUrl: 'https://example.com', tokenStorage: memStore() });
  try {
    setQueueStore(null, []);
    setOfflineScope('userA_orgA');
    globalThis.fetch = async () => { throw new Error('offline'); };
    await api.postCollection('snags', { title: 'Re-test retry' });
    const missed = await flushQueue({ token: 'tenant-A', apiUrl: 'https://example.com' });
    assert.deepStrictEqual(missed, { ok: 0, failed: 1 });
    assert.strictEqual(pendingWrites(), 1);
    globalThis.fetch = async () => new Response('{}', { status: 200 });
    const recovered = await flushQueue({ token: 'tenant-A', apiUrl: 'https://example.com' });
    assert.deepStrictEqual(recovered, { ok: 1, failed: 0 });
    assert.strictEqual(pendingWrites(), 0);
  } finally {
    globalThis.fetch = originalFetch;
    setQueueStore(null, []);
    setOfflineScope(null);
  }
});
