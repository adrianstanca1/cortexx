/**
 * Pure routing rules for the root-level auth gate.
 *
 * Pulled out of `components/auth-gate.tsx` (which imports expo-router and
 * react-native primitives) so the matrix below can be exhaustively
 * unit-tested without pulling those in.
 */

/**
 * Top-level URL segments that don't require a session. Anything else
 * redirects unauthenticated traffic to `/welcome`.
 *
 * - `welcome`/`login`: marketing + email-password sign-in
 * - `oauth`: OAuth callback page (mid-flow; finishes its own redirect)
 * - `register`/`onboard`: new-account flows for first-time users
 * - `forgot-password`/`reset-password`: email-link recovery flow; the
 *   reset-link recipient is by definition signed-out, so the route
 *   has to render without a session.
 */
export const PUBLIC_FIRST_SEGMENTS = new Set([
  'welcome',
  'login',
  'oauth',
  'register',
  'onboard',
  'forgot-password',
  'reset-password',
]);

/**
 * Public segments that should ALSO render unchanged for an already
 * signed-in user, instead of being bounced to `/(tabs)`. These are
 * mid-flow recovery/handoff routes where redirecting an authenticated
 * caller would break the flow:
 *
 * - `oauth`: applySessionAfterOAuth() flips `hasUser` to true *before*
 *   its own router.replace fires; bouncing here races and skips the
 *   success-tick.
 * - `reset-password`: a user can be signed-in on this device while
 *   clicking a reset link emailed for the same account from another
 *   device. Bouncing them would force a sign-out before they could
 *   complete the rotation.
 */
const SIGNED_IN_PASS_THROUGH_SEGMENTS = new Set(['oauth', 'reset-password']);

export type AuthGateDecision =
  | { kind: 'pass-through' }
  | { kind: 'loading' }
  | { kind: 'redirect'; href: '/welcome' | '/(tabs)' };

/**
 * Decide what the gate should do given the current auth + route state.
 *
 *  - `loading` → render a centred spinner. Avoids a flash of public
 *    content for users who actually have a valid session.
 *  - signed out + non-public segment → redirect to `/welcome`.
 *  - signed in + on `oauth` / `reset-password` → pass through (see
 *    SIGNED_IN_PASS_THROUGH_SEGMENTS for why).
 *  - signed in + other public segment → redirect to `/(tabs)` so the
 *    marketing/recovery surface doesn't shadow a real session.
 *  - otherwise pass through.
 */
export function decideAuthRoute(opts: {
  loading: boolean;
  hasUser: boolean;
  firstSegment: string | undefined;
}): AuthGateDecision {
  const { loading, hasUser, firstSegment } = opts;
  if (loading) return { kind: 'loading' };
  const isPublic = PUBLIC_FIRST_SEGMENTS.has(firstSegment ?? '');
  if (!hasUser) {
    return isPublic ? { kind: 'pass-through' } : { kind: 'redirect', href: '/welcome' };
  }
  if (SIGNED_IN_PASS_THROUGH_SEGMENTS.has(firstSegment ?? '')) {
    return { kind: 'pass-through' };
  }
  if (isPublic) return { kind: 'redirect', href: '/(tabs)' };
  return { kind: 'pass-through' };
}
