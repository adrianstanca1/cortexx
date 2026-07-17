/**
 * Sentry helpers. Mirrors push/email/billing — initialised when SENTRY_DSN
 * is set, gracefully no-ops otherwise so the rest of the app keeps
 * working with error tracking disabled.
 *
 * Wire from instrumentation hooks (instrumentation.ts at the project
 * root) — they're called by Next.js once per server start.
 */
import * as Sentry from '@sentry/nextjs'

const DSN = process.env.SENTRY_DSN
const ENV = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'
const RELEASE = process.env.SENTRY_RELEASE || process.env.GITHUB_SHA?.slice(0, 7)

let initialized = false

export function isSentryConfigured(): boolean {
  return !!DSN
}

/** Initialise Sentry once per process. Called from instrumentation.ts. */
export function initSentry(side: 'server' | 'edge' | 'client'): void {
  if (initialized) return
  if (!DSN) return
  try {
    Sentry.init({
      dsn: DSN,
      environment: ENV,
      release: RELEASE,
      tracesSampleRate: 0.1,
      // Don't sample profile per-trace — keeps overhead low. Adjust if needed.
      profilesSampleRate: 0,
      // Scrub common PII before send. Server-only beforeSend.
      beforeSend(event) {
        try {
          if (event.request?.headers) {
            const h = event.request.headers as Record<string, string>
            delete h.authorization
            delete h.cookie
            delete h['x-vapid-private-key']
          }
          if (event.request?.cookies) delete event.request.cookies
          return event
        } catch {
          return event
        }
      },
    })
    initialized = true
    console.log(`[sentry] initialised (${side}, env=${ENV}, release=${RELEASE || 'n/a'})`)
  } catch (err) {
    console.warn('[sentry] init failed', err)
  }
}

/** Manually capture an exception with optional context. No-op when not configured. */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!DSN) return
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined)
  } catch {
    // swallow — sentry failures must never break the user request
  }
}
