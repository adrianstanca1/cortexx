import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * Lightweight client-error sink. Logs to stdout (captured by pm2 → systemd
 * journal). Not a full APM but enough to spot patterns in production.
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

    console.error('[client-error]', JSON.stringify({
      user,
      url,
      message,
      stack,
      componentStack,
      ua: req.headers.get('user-agent')?.slice(0, 200),
      at: new Date().toISOString(),
    }))

    return NextResponse.json({ logged: true })
  } catch {
    return NextResponse.json({ error: 'log failed' }, { status: 500 })
  }
}
