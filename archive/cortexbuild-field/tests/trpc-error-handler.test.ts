// @vitest-environment happy-dom
/* eslint-disable import/first -- vi.mock(...) declarations must precede
   the import they replace; the mocks keep expo-secure-store /
   expo-modules-core out of the import chain. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCClientError } from '@trpc/client';

// Mock the runtime deps `lib/trpc-error-handler.ts` calls into. The
// helper module imports `@/lib/_core/auth` (SecureStore) and
// `@/hooks/use-auth` (notifyAuthRefresh, useQueryClient) at the top —
// none of those are exercised by the helper's logic, but they have to
// load. The /lib/_core/auth mock also keeps expo-secure-store /
// expo-modules-core out of the import chain (no __DEV__ surprises).
vi.mock('@/lib/_core/auth', () => ({
  removeSessionToken: vi.fn(async () => undefined),
  clearUserInfo: vi.fn(async () => undefined),
  getSessionToken: vi.fn(async () => null),
  setSessionToken: vi.fn(async () => undefined),
  setUserInfo: vi.fn(async () => undefined),
  getUserInfo: vi.fn(async () => null),
}));
vi.mock('@/lib/_core/api', () => ({
  logout: vi.fn(async () => undefined),
  getMe: vi.fn(async () => null),
}));

import * as Auth from '@/lib/_core/auth';
import {
  isUnauthorizedError,
  handleAuthExpiry,
  installAuthErrorHandler,
} from '@/lib/trpc-error-handler';

describe('isUnauthorizedError', () => {
  it('returns true for TRPCClientError with data.code === UNAUTHORIZED', () => {
    // Construct via the public ctor — TRPCClientError shape from a real
    // failed call is what we care about here.
    const err = new TRPCClientError('Not authenticated.');
    (err as unknown as { data: { code: string } }).data = { code: 'UNAUTHORIZED' };
    expect(isUnauthorizedError(err)).toBe(true);
  });

  it('returns false for TRPCClientError with a different code (FORBIDDEN, BAD_REQUEST, etc.)', () => {
    const cases = ['FORBIDDEN', 'BAD_REQUEST', 'NOT_FOUND', 'INTERNAL_SERVER_ERROR'];
    for (const code of cases) {
      const err = new TRPCClientError('rejected');
      (err as unknown as { data: { code: string } }).data = { code };
      expect(isUnauthorizedError(err), `code=${code}`).toBe(false);
    }
  });

  it('returns false for TRPCClientError with no data shape (network blip, parse failure)', () => {
    const err = new TRPCClientError('fetch failed');
    expect(isUnauthorizedError(err)).toBe(false);
  });

  it('returns false for plain Error / fetch errors / strings — not our concern', () => {
    expect(isUnauthorizedError(new Error('boom'))).toBe(false);
    expect(isUnauthorizedError(new TypeError('fetch failed'))).toBe(false);
    expect(isUnauthorizedError('UNAUTHORIZED')).toBe(false);
    expect(isUnauthorizedError(null)).toBe(false);
    expect(isUnauthorizedError(undefined)).toBe(false);
  });

  it('returns false for UNAUTHORIZED from auth.login — wrong-password is not a session expiry', () => {
    // Bugbot finding on PR #80: auth.login throws UNAUTHORIZED for
    // wrong credentials AND for unknown emails (deliberately
    // indistinguishable to avoid email enumeration). The user has
    // no session yet, so reacting by clearing one would just churn
    // queryClient + fire a wasted Api.getMe(). The detector skips
    // auth.login (and any other path on the IGNORED list).
    const err = new TRPCClientError('Invalid email or password.');
    (err as unknown as { data: { code: string; path: string } }).data = {
      code: 'UNAUTHORIZED',
      path: 'auth.login',
    };
    expect(isUnauthorizedError(err)).toBe(false);
  });

  it('still returns true for UNAUTHORIZED from protected procedures (real session expiry)', () => {
    // Sanity check — the path field doesn't accidentally swallow
    // UNAUTHORIZED on every call.
    const err = new TRPCClientError('Not authenticated.');
    (err as unknown as { data: { code: string; path: string } }).data = {
      code: 'UNAUTHORIZED',
      path: 'projects.list',
    };
    expect(isUnauthorizedError(err)).toBe(true);
  });
});

describe('handleAuthExpiry', () => {
  it('runs the full tear-down: token + user info + queryClient.clear() + notifyAuthRefresh', async () => {
    const clear = vi.fn();
    const queryClient = { clear } as unknown as Parameters<typeof handleAuthExpiry>[0];

    await handleAuthExpiry(queryClient);

    expect(Auth.removeSessionToken).toHaveBeenCalledOnce();
    expect(Auth.clearUserInfo).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledOnce();
    // notifyAuthRefresh is the broadcast — we don't assert on it directly
    // here because verifying the broadcast already lives in
    // tests/use-auth-broadcast.test.ts, and that wiring is the same
    // module-level pub/sub. handleAuthExpiry just AWAITs it.
  });
});

describe('installAuthErrorHandler', () => {
  type FakeCache = {
    subscribers: ((event: any) => void)[];
    subscribe(fn: (event: any) => void): () => void;
    emitError(error: unknown): void;
  };

  function makeCache(): FakeCache {
    const subscribers: ((event: any) => void)[] = [];
    return {
      subscribers,
      subscribe(fn) {
        subscribers.push(fn);
        return () => {
          const i = subscribers.indexOf(fn);
          if (i >= 0) subscribers.splice(i, 1);
        };
      },
      emitError(error: unknown) {
        for (const s of subscribers) {
          s({ type: 'updated', action: { type: 'error', error } });
        }
      },
    };
  }

  function makeFakeClient() {
    const queryCache = makeCache();
    const mutationCache = makeCache();
    const clear = vi.fn();
    const client = {
      getQueryCache: () => queryCache,
      getMutationCache: () => mutationCache,
      clear,
    } as any;
    return { client, queryCache, mutationCache, clear };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes to both query and mutation caches; ignores non-UNAUTHORIZED errors', async () => {
    const { client, queryCache, mutationCache, clear } = makeFakeClient();
    installAuthErrorHandler(client);

    expect(queryCache.subscribers).toHaveLength(1);
    expect(mutationCache.subscribers).toHaveLength(1);

    queryCache.emitError(new Error('network blip'));
    mutationCache.emitError(new Error('parse fail'));
    // Let any (non-)microtasks settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(clear).not.toHaveBeenCalled();
    expect(Auth.removeSessionToken).not.toHaveBeenCalled();
  });

  it('runs the tear-down on a query-cache UNAUTHORIZED', async () => {
    const { client, queryCache, clear } = makeFakeClient();
    installAuthErrorHandler(client);

    const err = new TRPCClientError('Not authenticated.');
    (err as unknown as { data: { code: string } }).data = { code: 'UNAUTHORIZED' };

    queryCache.emitError(err);
    // handleAuthExpiry awaits async ops — drain a couple of microtask ticks.
    await new Promise(r => setTimeout(r, 0));

    expect(Auth.removeSessionToken).toHaveBeenCalledOnce();
    expect(Auth.clearUserInfo).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledOnce();
  });

  it('runs the tear-down on a mutation-cache UNAUTHORIZED', async () => {
    const { client, mutationCache, clear } = makeFakeClient();
    installAuthErrorHandler(client);

    const err = new TRPCClientError('Not authenticated.');
    (err as unknown as { data: { code: string } }).data = { code: 'UNAUTHORIZED' };

    mutationCache.emitError(err);
    await new Promise(r => setTimeout(r, 0));

    expect(clear).toHaveBeenCalledOnce();
  });

  it('coalesces concurrent 401s into a single tear-down (in-flight guard)', async () => {
    const { client, queryCache, clear } = makeFakeClient();
    installAuthErrorHandler(client);

    const err = new TRPCClientError('Not authenticated.');
    (err as unknown as { data: { code: string } }).data = { code: 'UNAUTHORIZED' };

    // Five queries 401 simultaneously (a list screen with parallel fans).
    queryCache.emitError(err);
    queryCache.emitError(err);
    queryCache.emitError(err);
    queryCache.emitError(err);
    queryCache.emitError(err);
    await new Promise(r => setTimeout(r, 0));

    // Tear-down should run ONCE, not five times. removeSessionToken /
    // clearUserInfo / queryClient.clear() are all idempotent, but
    // running them in parallel five times spams the console with
    // notifyAuthRefresh churn; coalescing is the cleaner contract.
    expect(clear).toHaveBeenCalledOnce();
    expect(Auth.removeSessionToken).toHaveBeenCalledOnce();
  });

  it('absorbs 401 bursts after a tear-down completes (cooldown backstop)', async () => {
    // Defence in depth against the bug fixed in commit a69c6e7: a single
    // protected query with a misconfigured `enabled` gate (e.g.
    // `!!currentCompany?.id` when CompanyProvider seeds a mock default)
    // refires post-`queryClient.clear()`, hits 401, and triggers another
    // teardown — an infinite loop. The `inFlight` guard only coalesces
    // CONCURRENT 401s during a single teardown; once the teardown
    // resolves, `inFlight = null` and the next 401 starts fresh. The
    // cooldown closes that window: for ~2s after a teardown completes,
    // additional 401s are absorbed silently. A real session that
    // re-expires after re-login still triggers fresh teardown once the
    // window passes.
    const { client, queryCache, clear } = makeFakeClient();
    installAuthErrorHandler(client);

    const err = new TRPCClientError('Not authenticated.');
    (err as unknown as { data: { code: string } }).data = { code: 'UNAUTHORIZED' };

    // First 401 — teardown should run.
    queryCache.emitError(err);
    await new Promise(r => setTimeout(r, 0));
    expect(clear, 'first 401 runs the teardown').toHaveBeenCalledOnce();

    // Burst of 5 more 401s spread over the next 800ms. The looping
    // bug emits ~3/s — this is more aggressive. None should trigger
    // a fresh teardown because the cooldown is still active.
    for (let i = 0; i < 5; i += 1) {
      await new Promise(r => setTimeout(r, 150));
      queryCache.emitError(err);
    }
    await new Promise(r => setTimeout(r, 0));
    expect(clear, 'cooldown absorbs the burst').toHaveBeenCalledOnce();
    expect(Auth.removeSessionToken).toHaveBeenCalledOnce();

    // Wait past the cooldown window (default 2000ms — total elapsed
    // wall time at this point is ~750ms inside the burst, plus this
    // 1500ms top-up). A new 401 should now legitimately re-tear-down.
    await new Promise(r => setTimeout(r, 1500));
    queryCache.emitError(err);
    await new Promise(r => setTimeout(r, 0));
    expect(clear, 'a fresh 401 after the cooldown re-runs the teardown').toHaveBeenCalledTimes(2);
  });

  it('returns a cleanup that unsubscribes from both caches', () => {
    const { client, queryCache, mutationCache } = makeFakeClient();
    const cleanup = installAuthErrorHandler(client);

    expect(queryCache.subscribers).toHaveLength(1);
    expect(mutationCache.subscribers).toHaveLength(1);

    cleanup();

    expect(queryCache.subscribers).toHaveLength(0);
    expect(mutationCache.subscribers).toHaveLength(0);
  });
});
