// @vitest-environment happy-dom
/* eslint-disable import/first -- vi.mock(...) declarations must precede
   the import they replace; the mocks keep expo-secure-store /
   expo-modules-core out of the import chain. */
/**
 * Regression test for the auth-refresh broadcast that ties every
 * `useAuth()` instance together.
 *
 * The bug this guards against: each `useAuth()` instance owns its own
 * `user` state. After a sign-in the `login` screen explicitly broadcasts
 * via `notifyAuthRefresh()` so siblings (CompanyProvider, etc.) re-fetch
 * and pick up the new session. The matching broadcast on logout was
 * missing — the screen that called `logout()` flipped to "signed out"
 * but every other `useAuth` instance kept showing the previous user
 * until it independently re-rendered. `hooks/use-auth.ts` now calls
 * `notifyAuthRefresh` from inside `logout()` so the contract is
 * symmetric. This file tests the underlying pub/sub primitive
 * directly — mounting React isn't worth it for a 3-line broadcast.
 *
 * Note: `@vitest-environment happy-dom` and the SecureStore mock below are
 * needed because `hooks/use-auth.ts` transitively imports
 * `lib/_core/auth.ts` which imports `expo-secure-store`. The pub/sub
 * helpers themselves don't touch SecureStore — the mocks just keep
 * the import chain loadable in a Node test context.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock the modules `hooks/use-auth.ts` imports at top level so the import
// chain doesn't pull in real expo-secure-store / expo-modules-core (which
// reference `__DEV__` and only load in a real RN runtime). The pub/sub
// helpers under test don't touch any of these — the mocks are scaffolding.
vi.mock('@/lib/_core/auth', () => ({
  getSessionToken: vi.fn(async () => null),
  setSessionToken: vi.fn(async () => undefined),
  removeSessionToken: vi.fn(async () => undefined),
  getUserInfo: vi.fn(async () => null),
  setUserInfo: vi.fn(async () => undefined),
  clearUserInfo: vi.fn(async () => undefined),
}));
vi.mock('@/lib/_core/api', () => ({
  logout: vi.fn(async () => undefined),
  getMe: vi.fn(async () => null),
}));

import {
  subscribeAuthRefresh,
  notifyAuthRefresh,
} from '@/hooks/use-auth';

describe('useAuth refresh broadcast', () => {
  it('notifyAuthRefresh invokes every subscribed listener with the same options', async () => {
    const calls: ({ silent?: boolean } | undefined)[] = [];
    const unsub1 = subscribeAuthRefresh(opts => { calls.push(opts); });
    const unsub2 = subscribeAuthRefresh(opts => { calls.push(opts); });

    await notifyAuthRefresh({ silent: true });

    expect(calls).toHaveLength(2);
    expect(calls.every(c => c?.silent === true)).toBe(true);

    unsub1();
    unsub2();
  });

  it('unsubscribe stops the listener from firing on subsequent broadcasts', async () => {
    let count = 0;
    const unsub = subscribeAuthRefresh(() => { count++; });
    unsub();
    await notifyAuthRefresh({ silent: true });
    expect(count).toBe(0);
  });

  it('awaits async listeners — login/logout flows can rely on completion', async () => {
    let resolved = false;
    const unsub = subscribeAuthRefresh(async () => {
      await new Promise(r => setTimeout(r, 20));
      resolved = true;
    });

    await notifyAuthRefresh({ silent: true });
    expect(resolved).toBe(true);

    unsub();
  });

  it('one listener throwing does not block other listeners', async () => {
    const calls: string[] = [];
    const unsubBad = subscribeAuthRefresh(() => {
      calls.push('bad');
      throw new Error('boom');
    });
    const unsubGood = subscribeAuthRefresh(() => {
      calls.push('good');
    });

    await notifyAuthRefresh({ silent: true });

    // Both listeners ran. The good one isn't starved by the bad one's throw,
    // which is what `Promise.all(map(catch))` in notifyAuthRefresh guarantees.
    expect(calls).toEqual(expect.arrayContaining(['bad', 'good']));

    unsubBad();
    unsubGood();
  });
});
