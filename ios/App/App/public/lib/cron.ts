/**
 * Cron endpoint guard. Each /api/cron/* route invokes `requireCronAuth(req)`
 * before doing real work. The CRON_SECRET env var must match the
 * `Authorization: Bearer <secret>` header; otherwise 401.
 *
 * In production, systemd timers (or any external scheduler) call these
 * endpoints with the shared secret. See docs/v1-completion-plan.md §4.3.
 */
import { NextRequest, NextResponse } from 'next/server'

export function requireCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Fail closed: no secret configured → no cron until ops sets it.
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  const header = req.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match || match[1].trim() !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
