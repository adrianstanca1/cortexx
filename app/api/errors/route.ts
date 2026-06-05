import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { captureException, isSentryConfigured } from '@/lib/sentry'

export const dynamic = 'force-dynamic'

/**
 * Lightweight client-error sink. Always logs to stdout (captured by pm2 →
 * systemd journal); also forwards to Sentry when SENTRY_DSN is set.
 *
 * Body: { message: string, stack?: string, url?: string, componentStack?: string }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json().catch(() => ({}))
    const message = String(body.message || '').slice(0, 500)
    const url = String(body.url || '').slice(0, 500)
    const stack = String(body.stack || '').slice(0, 4000)
    const componentStack = String(body.componentStack || '').slice(0, 2000)
    const user = actorName(auth)
    const ua = req.headers.get('user-agent')?.slice(0, 200)

    // Sanitise BEFORE logging to stdout. pm2 logs ship to the
    // vps-exec-logs branch (PUBLIC), so anything we print here is
    // world-readable. Strip query strings (which often carry customer
    // names / emails in routing), hash the actor, and skip the UA.
    const stripQuery = (u: string) => { try { const x = new URL(u, 'https://x'); return x.pathname.slice(0, 200) } catch { return '' } }
    const safeUrl = stripQuery(url)
    const userHash = user ? `u${createHash('sha256').update(user).digest('hex').slice(0, 8)}` : 'anon'

    console.error('[client-error]', JSON.stringify({
      user: userHash, url: safeUrl, message, stack,
      at: new Date().toISOString(),
    }))

    // Sentry gets the full context (it's a private destination with the
    // user's own credentials, not a public log branch).
    if (isSentryConfigured() && message) {
      const err = new Error(message)
      if (stack) err.stack = stack
      captureException(err, { user, url, componentStack, ua, source: 'client' })
    }

    return NextResponse.json({ logged: true })
  } catch {
    return NextResponse.json({ error: 'log failed' }, { status: 500 })
  }
}
