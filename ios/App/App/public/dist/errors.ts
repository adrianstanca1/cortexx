import { captureException, isSentryConfigured } from './sentry'

/**
 * Report a route-handler error to BOTH stdout (pm2 → journal for
 * post-mortem) AND Sentry (live alerting + grouping). Use this in
 * `catch` blocks where we then return a 5xx — previously most routes
 * called `console.error(error)` alone, so prod 5xx errors were
 * invisible in Sentry.
 *
 * If Sentry isn't configured (no SENTRY_DSN), this is a strict
 * superset of console.error — no behaviour change.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  console.error(error)
  if (isSentryConfigured()) {
    try {
      captureException(error instanceof Error ? error : new Error(String(error)), context)
    } catch { /* never let error reporting itself crash a handler */ }
  }
}
