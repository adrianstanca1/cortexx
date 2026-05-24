import { describe, it, expect, beforeEach } from 'vitest';
import { enqueue, dequeueAll, countPending, markSynced, markFailed } from '../services/offlineQueue';

// vitest uses happy-dom which has IDB — use fake-indexeddb for isolation
import 'fake-indexeddb/auto';

describe('offlineQueue', () => {
  beforeEach(async () => {
    const { clearQueue } = await import('../services/offlineQueue');
    await clearQueue();
  });

  it('enqueues a request and counts it', async () => {
    await enqueue({ method: 'POST', url: '/api/daily-reports', body: '{}', headers: {} });
    expect(await countPending()).toBe(1);
  });

  it('dequeueAll returns FIFO order', async () => {
    await enqueue({ method: 'POST', url: '/api/a', body: '{}', headers: {} });
    await enqueue({ method: 'PUT', url: '/api/b', body: '{}', headers: {} });
    const items = await dequeueAll();
    expect(items[0].url).toBe('/api/a');
    expect(items[1].url).toBe('/api/b');
  });

  it('markSynced removes entry', async () => {
    await enqueue({ method: 'POST', url: '/api/x', body: '{}', headers: {} });
    const [item] = await dequeueAll();
    await markSynced(item.id!);
    expect(await countPending()).toBe(0);
  });

  it('markFailed sets status to failed', async () => {
    await enqueue({ method: 'POST', url: '/api/y', body: '{}', headers: {} });
    const [item] = await dequeueAll();
    await markFailed(item.id!);
    const remaining = await dequeueAll(); // dequeueAll returns only pending
    expect(remaining).toHaveLength(0);
  });
});
