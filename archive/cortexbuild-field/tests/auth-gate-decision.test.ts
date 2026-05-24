import { describe, it, expect } from 'vitest';

import { decideAuthRoute, PUBLIC_FIRST_SEGMENTS } from '@/lib/auth-gate-decision';

/**
 * Pinned matrix for the root-level auth gate. The decision is the only
 * thing standing between an unauthenticated visitor and a guarded screen
 * (or vice versa, an authenticated user being shown the marketing page),
 * so it's worth being exhaustive — every combination of (auth state,
 * first segment) is covered.
 *
 * Public segments are the only ones an unauthenticated client may
 * render. Anything else redirects to /welcome.
 *
 * Within the public set, two sub-rules diverge for signed-in users:
 *   - `oauth` and `reset-password` pass through (mid-flow recovery
 *     routes that would break if we redirected authenticated callers)
 *   - everything else (welcome/login/register/onboard/forgot-password)
 *     bounces to /(tabs) so a real session isn't shadowed by marketing
 *     or recovery surfaces.
 */
describe('decideAuthRoute', () => {
  it('renders a loading shell while auth is resolving — never flashes guarded content', () => {
    expect(decideAuthRoute({ loading: true, hasUser: false, firstSegment: '(tabs)' }))
      .toEqual({ kind: 'loading' });
    expect(decideAuthRoute({ loading: true, hasUser: true, firstSegment: 'welcome' }))
      .toEqual({ kind: 'loading' });
  });

  describe('signed-out visitor', () => {
    it.each([...PUBLIC_FIRST_SEGMENTS])(
      'passes through public segment "%s" — must render without a session',
      (segment) => {
        expect(decideAuthRoute({ loading: false, hasUser: false, firstSegment: segment }))
          .toEqual({ kind: 'pass-through' });
      },
    );

    it.each([
      '(tabs)',
      'defects',
      'projects',
      'permits',
      'finance',
      'admin',
      'settings',
      'change-password', // protected — requires an active session
      undefined, // initial mount, segments not yet resolved — treat as guarded
    ])('redirects "%s" to /welcome — guarded surface must never render to anonymous visitors', (segment) => {
      expect(decideAuthRoute({ loading: false, hasUser: false, firstSegment: segment }))
        .toEqual({ kind: 'redirect', href: '/welcome' });
    });
  });

  describe('signed-in user', () => {
    it.each(['welcome', 'login', 'register', 'onboard', 'forgot-password'])(
      'redirects "%s" to /(tabs) — marketing/registration/recovery surfaces don\'t belong over a real session',
      (segment) => {
        expect(decideAuthRoute({ loading: false, hasUser: true, firstSegment: segment }))
          .toEqual({ kind: 'redirect', href: '/(tabs)' });
      },
    );

    it.each(['oauth', 'reset-password'])(
      'passes through "%s" — mid-flow recovery routes must not be hijacked by the gate',
      (segment) => {
        // oauth: applySessionAfterOAuth() runs notifyAuthRefresh
        //   (flipping hasUser) BEFORE its own router.replace — a redirect
        //   here would race the callback's success-tick.
        // reset-password: an authenticated device can still receive a
        //   reset link emailed to the same account; bouncing would force
        //   a sign-out before the rotation could land.
        expect(decideAuthRoute({ loading: false, hasUser: true, firstSegment: segment }))
          .toEqual({ kind: 'pass-through' });
      },
    );

    it.each(['(tabs)', 'defects', 'projects', 'permits', 'admin'])(
      'passes through guarded segment "%s" — that\'s where the user wants to be',
      (segment) => {
        expect(decideAuthRoute({ loading: false, hasUser: true, firstSegment: segment }))
          .toEqual({ kind: 'pass-through' });
      },
    );
  });

  it('PUBLIC_FIRST_SEGMENTS is the source of truth — adding a public route means updating this set', () => {
    // Pinned snapshot of the public surface. Bumping this requires a
    // deliberate edit, which is exactly the review prompt we want when
    // a new route gets exposed without auth.
    expect([...PUBLIC_FIRST_SEGMENTS].sort()).toEqual([
      'forgot-password',
      'login',
      'oauth',
      'onboard',
      'register',
      'reset-password',
      'welcome',
    ]);
  });
});
