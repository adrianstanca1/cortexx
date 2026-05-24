/**
 * Tests for the offline sync queue.
 *
 * History: an earlier revision of this file reimplemented `isNetworkOnline`,
 * `shouldShowBanner`, and the replay-request shape inline and tested those
 * stubs — so the tests passed even when `lib/sync-queue.tsx` was broken.
 * This file now imports those helpers directly from the module so a
 * regression in the real code fails the suite.
 *
 * The actual `SyncQueueProvider` (React component, NetInfo listeners,
 * AsyncStorage round-trip, retry timer) is not exercised here because
 * vitest is configured for a Node environment with no React renderer or
 * happy-dom. Adding a full provider mount would mean pulling in
 * react-native-testing-library + happy-dom + the RN runtime — out of scope
 * for this pass. The pure helpers below are what the provider's behaviour
 * is built out of.
 */
import { describe, it, expect, vi } from 'vitest';

import {
  isNetworkOnline,
  shouldShowSyncBanner,
  buildSyncReplayRequest,
  classifyReplayResponse,
  tailForRequeueAfterAuthAbort,
  STORAGE_KEY,
  MAX_RETRIES,
  RETRY_DELAY_MS,
  type SyncStatus,
} from '@/lib/sync-queue';

// Mock the runtime deps that `lib/sync-queue.tsx` imports at the top level
// so the file can load in a Node-only test env. None of these are exercised
// by the helpers we test below.
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

describe('isNetworkOnline (cold-start contract)', () => {
  it('returns false when isConnected is false (regardless of reachability)', () => {
    expect(isNetworkOnline({ isConnected: false, isInternetReachable: true })).toBe(false);
    expect(isNetworkOnline({ isConnected: false, isInternetReachable: null })).toBe(false);
    expect(isNetworkOnline({ isConnected: false, isInternetReachable: false })).toBe(false);
  });

  it('treats isInternetReachable=null as ONLINE (cold-start fix)', () => {
    // Regression: NetInfo emits isInternetReachable=null on cold start while
    // the reachability probe is in flight. The original logic treated null
    // as offline, which made the offline banner flash for ~1s on every app
    // launch. This test is the contract that fix is permanent.
    expect(isNetworkOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
  });

  it('returns true when both flags are positive', () => {
    expect(isNetworkOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
  });

  it('returns false when reachability is explicitly false (genuinely offline)', () => {
    expect(isNetworkOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
  });
});

describe('shouldShowSyncBanner', () => {
  it.each<[SyncStatus, number, boolean]>([
    ['online', 0, false],
    ['online', 5, false], // never show banner when online, even with backlog
    ['offline', 0, false], // nothing pending — no banner
    ['offline', 2, true],
    ['syncing', 3, true],
    ['error', 1, true],
  ])('status=%s, pending=%d → %s', (status, pending, expected) => {
    expect(shouldShowSyncBanner(status, pending)).toBe(expected);
  });
});

describe('tailForRequeueAfterAuthAbort', () => {
  it('omits tail items with retries >= MAX_RETRIES (same rule as replay loop head)', () => {
    const parsed = [
      { id: 'a', type: 't', payload: {}, createdAt: '', retries: 0 },
      { id: 'b', type: 't', payload: {}, createdAt: '', retries: MAX_RETRIES },
      { id: 'c', type: 't', payload: {}, createdAt: '', retries: MAX_RETRIES - 1 },
    ] as const;
    const tail = tailForRequeueAfterAuthAbort(
      [...parsed],
      0,
    );
    expect(tail.map(m => m.id)).toEqual(['c']);
  });

  it('returns empty when there is nothing after the auth index', () => {
    const parsed = [
      { id: 'a', type: 't', payload: {}, createdAt: '', retries: 0 },
    ];
    expect(tailForRequeueAfterAuthAbort(parsed, 0)).toEqual([]);
  });
});

describe('buildSyncReplayRequest', () => {
  it('targets /api/trpc/sync.replay relative to the API base', () => {
    const r = buildSyncReplayRequest('https://api.example.com', {
      type: 'defects.create',
      payload: { title: 'Crack' },
    });
    expect(r.url).toBe('https://api.example.com/api/trpc/sync.replay');
  });

  it('strips a trailing slash from the base URL (idempotent)', () => {
    const r = buildSyncReplayRequest('https://api.example.com/', {
      type: 'defects.create',
      payload: {},
    });
    expect(r.url).toBe('https://api.example.com/api/trpc/sync.replay');
  });

  it('wraps the mutation in the tRPC superjson `json` envelope', () => {
    const r = buildSyncReplayRequest('https://api.example.com', {
      type: 'checkIn.create',
      payload: { projectId: 7, lat: 51.5 },
    });
    expect(JSON.parse(r.body)).toEqual({
      json: { type: 'checkIn.create', payload: { projectId: 7, lat: 51.5 } },
    });
  });
});

describe('module constants', () => {
  it('STORAGE_KEY is namespaced (avoid collisions with other AsyncStorage users)', () => {
    expect(STORAGE_KEY).toBe('cortexbuild:sync_queue');
  });

  it('MAX_RETRIES is bounded — pending mutations must eventually drop', () => {
    expect(MAX_RETRIES).toBeGreaterThan(0);
    expect(MAX_RETRIES).toBeLessThanOrEqual(10);
  });

  it('RETRY_DELAY_MS is conservative — avoids hot loops on persistent failures', () => {
    expect(RETRY_DELAY_MS).toBeGreaterThanOrEqual(1000);
  });
});

/**
 * The replay decision tree is what stops a worker from losing queued
 * data when their JWT expires while items wait. The classifier is the
 * pure function that decides which bucket each HTTP response goes to;
 * the replay loop in sync-queue.tsx then handles each bucket.
 */
describe('classifyReplayResponse', () => {
  it('null status (fetch threw — DNS / offline / abort) → transient', () => {
    expect(classifyReplayResponse(null)).toBe('transient');
  });

  it('2xx → success (drop from queue)', () => {
    expect(classifyReplayResponse(200)).toBe('success');
    expect(classifyReplayResponse(201)).toBe('success');
    expect(classifyReplayResponse(204)).toBe('success');
  });

  it('401 / 403 → auth (HOLD without bumping retries)', () => {
    // Critical: this is what prevents the silent-data-loss bug where a
    // worker stays offline overnight, JWT expires, and reconnect drops
    // all queued items after MAX_RETRIES of 401s.
    expect(classifyReplayResponse(401)).toBe('auth');
    expect(classifyReplayResponse(403)).toBe('auth');
  });

  it('other 4xx → permanent (drop, retrying never helps)', () => {
    // 400 / 404 / 422 / 429 are the typical validation/route/rate cases.
    // 429 is debatable — Expo treats it as transient, but our offline
    // queue is for save-on-network-failure, not rate-limit smoothing,
    // so dropping is the right behaviour here.
    expect(classifyReplayResponse(400)).toBe('permanent');
    expect(classifyReplayResponse(404)).toBe('permanent');
    expect(classifyReplayResponse(422)).toBe('permanent');
    expect(classifyReplayResponse(429)).toBe('permanent');
  });

  it('5xx → transient (server hiccup, retry counts)', () => {
    expect(classifyReplayResponse(500)).toBe('transient');
    expect(classifyReplayResponse(502)).toBe('transient');
    expect(classifyReplayResponse(503)).toBe('transient');
    expect(classifyReplayResponse(504)).toBe('transient');
  });

  it('weird statuses default to transient (safer than permanent on the unknown)', () => {
    expect(classifyReplayResponse(0)).toBe('transient');
    expect(classifyReplayResponse(199)).toBe('transient');
    expect(classifyReplayResponse(600)).toBe('transient');
  });

  // Phase 3.7 — conflict / row_deleted body inspection.
  it('classifies HTTP 200 + body.result.status="conflict" as "conflict"', () => {
    const body = { result: { status: 'conflict' as const } };
    expect(classifyReplayResponse(200, body)).toBe('conflict');
  });

  it('classifies HTTP 200 + body.result.status="row_deleted" as "row_deleted"', () => {
    const body = { result: { status: 'row_deleted' as const } };
    expect(classifyReplayResponse(200, body)).toBe('row_deleted');
  });

  it('still classifies HTTP 200 with no special body as "success"', () => {
    expect(classifyReplayResponse(200, { result: { status: 'success' as const } })).toBe('success');
    expect(classifyReplayResponse(200, undefined)).toBe('success');
    expect(classifyReplayResponse(200, {})).toBe('success');
  });

  it('still classifies 401 as "auth" regardless of body', () => {
    const body = { result: { status: 'conflict' as const } };
    expect(classifyReplayResponse(401, body)).toBe('auth');
  });

  it('still classifies 5xx as "transient" regardless of body', () => {
    const body = { result: { status: 'conflict' as const } };
    expect(classifyReplayResponse(503, body)).toBe('transient');
  });
});
