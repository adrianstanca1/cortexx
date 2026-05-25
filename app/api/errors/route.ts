import { NextRequest, NextResponse } from 'next/server'
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
  const __limited = enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json().catch(() => ({}))
    const message = String(body.message || '').slice(0, 500)
    const url = String(body.url || '').slice(0, 500)
    const stack = String(body.stack || '').slice(0, 4000)
    const componentStack = String(body.componentStack || '').slice(0, 2000)
    const user = actorName(auth)
    const ua = req.headers.get('user-agent')?.slice(0, 200)

    console.error('[client-error]', JSON.stringify({
      user, url, message, stack, componentStack, ua,
      at: new Date().toISOString(),
    }))

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
