/**
 * Global tRPC error handling — converts an UNAUTHORIZED on any procedure
 * into a coordinated sign-out so the AuthGate (app/_layout.tsx) can route
 * the user back to /welcome. Pairs with the auth audit shipped in #76:
 * logout already broadcasts via notifyAuthRefresh and clears the
 * QueryClient cache + sync queue; this file is what triggers that flow
 * automatically when a JWT expires mid-session.
 *
 * Why this lives outside `lib/trpc.ts`:
 *   - the QueryClient instance is owned by `app/_layout.tsx`, not by the
 *     tRPC link factory, so we attach via cache subscriptions there.
 *   - the helpers below are pure-ish (detector + orchestrator) so they
 *     can be unit-tested without rendering React or constructing a real
 *     QueryClient.
 */
import type { QueryClient } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';

import * as Auth from '@/lib/_core/auth';
import { notifyAuthRefresh } from '@/hooks/use-auth';

/**
 * Procedure paths whose UNAUTHORIZED responses are NOT expired-session
 * signals and so must not trigger the session tear-down. tRPC v11
 * surfaces the procedure path on `data.path` in the error shape, which
 * is the discriminator we use below.
 *
 * Currently just `auth.login` — wrong-password and "no such email"
 * both throw UNAUTHORIZED to avoid email enumeration (see
 * `server/routers/index.ts auth.login`), but the user has no session
 * yet, so reacting by clearing the (non-existent) session is wrong:
 * it'd churn `queryClient.clear()` and fire a wasted `Api.getMe()`
 * every time someone mistypes their password.
 *
 * Add to this set deliberately. Most public procedures that need to
 * surface "you're not authenticated" should already use a non-
 * UNAUTHORIZED code (BAD_REQUEST, FORBIDDEN, etc.).
 */
const IGNORED_UNAUTHORIZED_PATHS: ReadonlySet<string> = new Set([
  'auth.login',
]);

/**
 * Tells whether an error returned from a tRPC query/mutation represents
 * "your session is no longer valid". Returns false for network errors,
 * 4xx/5xx that aren't UNAUTHORIZED, and UNAUTHORIZED responses from
 * procedures we've explicitly opted out of the auto-logout flow
 * (currently `auth.login` — wrong-password is UNAUTHORIZED but not a
 * session expiry). Only a definitive expired-session signal triggers
 * the sign-out flow.
 *
 * Exported so call sites can branch on it without the orchestration
 * (e.g. a "your session expired, sign in again" toast).
 */
export function isUnauthorizedError(err: unknown): boolean {
  if (err instanceof TRPCClientError) {
    // tRPC sets `data.code` to the TRPCError code from the server.
    // UNAUTHORIZED is what protectedProcedure throws for missing/invalid
    // sessions. `data.path` is the procedure name.
    const data = err.data as { code?: string; path?: string } | null | undefined;
    if (data?.code !== 'UNAUTHORIZED') return false;
    if (typeof data.path === 'string' && IGNORED_UNAUTHORIZED_PATHS.has(data.path)) {
      return false;
    }
    return true;
  }
  return false;
}

/**
 * Tear down the local session state in the same shape useAuth.logout()
 * does: drop the SecureStore token + cached user info, evict every
 * cached tRPC/TanStack Query result, then broadcast the change so every
 * `useAuth()` subscriber re-resolves and the AuthGate routes the user
 * to /welcome.
 *
 * Server-side cookie clearing is intentionally skipped here. The whole
 * reason this code path runs is the server REJECTED the request — its
 * cookie is already invalid. POSTing /api/auth/logout would just be
 * another 401.
 */
export async function handleAuthExpiry(queryClient: QueryClient): Promise<void> {
  await Auth.removeSessionToken();
  await Auth.clearUserInfo();
  queryClient.clear();
  await notifyAuthRefresh({ silent: true });
}

/**
 * Backstop window after a teardown completes during which additional
 * UNAUTHORIZED errors are absorbed silently. Defends against a single
 * misconfigured `enabled` gate looping the teardown: query 401s -->
 * `queryClient.clear()` --> query re-mounts --> 401 --> teardown again.
 * The `inFlight` guard only catches concurrent 401s during a single
 * teardown; the cooldown catches the next-iteration 401s after the
 * teardown resolves and `inFlight` clears. 2s is long enough to span
 * the React commit + query refetch cycle, short enough that a real
 * session re-expiring after re-auth still triggers fresh teardown.
 */
const EXPIRY_COOLDOWN_MS = 2000;

/**
 * Subscribe to the query and mutation caches; when any settles with an
 * UNAUTHORIZED error, run `handleAuthExpiry`. Returns an unsubscribe
 * function the caller (`app/_layout.tsx`) returns from its useEffect.
 *
 * The orchestrator is idempotent — multiple concurrent 401s on the
 * same expired session each fire it, but the underlying operations
 * (remove token, clear cache, broadcast) are all safe to repeat.
 */
export function installAuthErrorHandler(queryClient: QueryClient): () => void {
  let inFlight: Promise<void> | null = null;
  let cooldownUntil = 0;

  const handle = (error: unknown) => {
    if (!isUnauthorizedError(error)) return;
    // Coalesce a burst of 401s (e.g. a list screen with five parallel
    // queries that all expired) into a single tear-down.
    if (inFlight) return;
    // Absorb 401s that arrive in the cooldown window after a teardown
    // already ran — see EXPIRY_COOLDOWN_MS for why.
    if (Date.now() < cooldownUntil) return;
    inFlight = handleAuthExpiry(queryClient)
      .catch(err => {
        console.error('[trpc-error-handler] expiry orchestration failed:', err);
      })
      .finally(() => {
        cooldownUntil = Date.now() + EXPIRY_COOLDOWN_MS;
        inFlight = null;
      });
  };

  const unsubQuery = queryClient.getQueryCache().subscribe(event => {
    if (event.type === 'updated' && event.action.type === 'error') {
      handle(event.action.error);
    }
  });

  const unsubMutation = queryClient.getMutationCache().subscribe(event => {
    if (event.type === 'updated' && event.action.type === 'error') {
      handle(event.action.error);
    }
  });

  return () => {
    unsubQuery();
    unsubMutation();
  };
}
