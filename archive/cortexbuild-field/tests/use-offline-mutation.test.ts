/**
 * Tests for `useOfflineMutation` — the helper that wraps a tRPC mutation
 * so a network failure enqueues the payload for later replay instead of
 * surfacing an error to the user.
 *
 * The hook itself uses `useSyncQueue` (a React context). We don't need a
 * full React renderer here — we can call the returned `mutateAsync`
 * directly by manually constructing the inputs the hook would receive.
 * To do that we expose the queue context via mock and verify the
 * enqueue/no-enqueue branches.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useOfflineMutation, isQueued } from '@/lib/use-offline-mutation';

// Mock @react-native-async-storage and NetInfo so importing sync-queue.tsx
// doesn't blow up in node.
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
  },
}));
vi.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: vi.fn(async () => ({ isConnected: true, isInternetReachable: true })),
    addEventListener: vi.fn(() => () => {}),
  },
}));
vi.mock('@/constants/oauth', () => ({ getApiBaseUrl: () => 'https://api.test' }));
vi.mock('@/lib/_core/auth', () => ({ getSessionToken: vi.fn(async () => null) }));

// Mock the SyncQueue context so we can drive `status` and capture enqueue.
const enqueueSpy = vi.fn(async () => {});
let mockStatus: 'online' | 'offline' | 'syncing' | 'error' = 'online';
vi.mock('@/lib/sync-queue', () => ({
  useSyncQueue: () => ({
    status: mockStatus,
    enqueue: enqueueSpy,
    queue: [],
    pendingCount: 0,
    lastSyncedAt: null,
    clearQueue: async () => {},
    replayNow: async () => {},
  }),
}));

beforeEach(() => {
  enqueueSpy.mockClear();
  mockStatus = 'online';
});

afterEach(() => {
  vi.clearAllMocks();
});

function makeMutation<TInput, TOutput>(
  impl: (input: TInput) => Promise<TOutput>,
) {
  return {
    mutateAsync: vi.fn(impl),
    isPending: false,
    isError: false,
    error: null as unknown,
    reset: vi.fn(),
  };
}

describe('useOfflineMutation', () => {
  it('online + happy path: returns the underlying result, does NOT enqueue', async () => {
    const mutation = makeMutation(async (_in: { x: number }) => ({ ok: true, value: 42 }));
    const helper = useOfflineMutation(mutation, 'defects.create');

    const result = await helper.mutateAsync({ x: 1 });
    expect(isQueued(result)).toBe(false);
    expect(result).toEqual({ ok: true, value: 42 });
    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it('queue says offline → skips network attempt, enqueues immediately', async () => {
    mockStatus = 'offline';
    const mutation = makeMutation(async (_in: { x: number }) => ({ shouldNotFire: true } as any));
    const helper = useOfflineMutation(mutation, 'defects.create');

    const result = await helper.mutateAsync({ x: 1 });
    expect(isQueued(result)).toBe(true);
    expect(result).toEqual({ queued: true, type: 'defects.create' });
    // The underlying mutation must NOT have been called — saves a 30s
    // timeout on a fully offline device.
    expect(mutation.mutateAsync).not.toHaveBeenCalled();
    expect(enqueueSpy).toHaveBeenCalledWith('defects.create', { x: 1 });
  });

  it('online but network fails (Failed to fetch) → enqueues, returns queued', async () => {
    const mutation = makeMutation(async (_in: any) => {
      const err: any = new Error('Request failed');
      err.cause = { name: 'TypeError', message: 'Failed to fetch' };
      throw err;
    });
    const helper = useOfflineMutation(mutation, 'incidents.create');

    const result = await helper.mutateAsync({ companyId: 1 });
    expect(isQueued(result)).toBe(true);
    expect(enqueueSpy).toHaveBeenCalledWith('incidents.create', { companyId: 1 });
  });

  it('online + non-network error (BAD_REQUEST etc) → re-throws, does NOT enqueue', async () => {
    // Validation errors must NOT be enqueued — a malformed payload would
    // never succeed on retry, so silently queueing it would hide the bug.
    const mutation = makeMutation(async (_in: any) => {
      const err: any = new Error('Invalid input');
      err.data = { code: 'BAD_REQUEST' };
      throw err;
    });
    const helper = useOfflineMutation(mutation, 'defects.create');

    await expect(helper.mutateAsync({ bad: true })).rejects.toMatchObject({
      message: 'Invalid input',
    });
    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it('online + Network request failed (RN message) → enqueues', async () => {
    const mutation = makeMutation(async () => {
      throw new Error('Network request failed');
    });
    const helper = useOfflineMutation(mutation, 'checkins.create');

    const result = await helper.mutateAsync({ workerName: 'Alice' });
    expect(isQueued(result)).toBe(true);
    expect(enqueueSpy).toHaveBeenCalled();
  });

  it('passes through reactive state (isPending) so spinner gating still works', () => {
    const mutation = makeMutation(async () => ({}));
    mutation.isPending = true;
    const helper = useOfflineMutation(mutation, 'defects.create');
    expect(helper.isPending).toBe(true);
  });
});

describe('isQueued type guard', () => {
  it('narrows correctly for queued results', () => {
    const queued = { queued: true as const, type: 'x' };
    if (isQueued(queued)) {
      expect(queued.type).toBe('x');
    } else {
      throw new Error('expected queued to be detected');
    }
  });

  it('returns false for normal results', () => {
    expect(isQueued({ id: 1, foo: 'bar' })).toBe(false);
    expect(isQueued(null as any)).toBe(false);
    expect(isQueued(undefined as any)).toBe(false);
  });
});
