import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron'
import { legacyPool } from '@/lib/legacyDb'

export const dynamic = 'force-dynamic'

/**
 * Hourly job: drop push subscriptions older than 90 days.
 *
 * The legacy push_subscriptions table has no last_used column, so we use
 * created_at as the staleness signal. Live delivery already prunes stale
 * 410/404 endpoints when sendPush runs; this is a safety net for endpoints
 * that simply went quiet without an error response.
 */
export async function POST(req: NextRequest) {
  const denied = requireCronAuth(req)
  if (denied) return denied

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)

  const result = await legacyPool.query(
    'DELETE FROM push_subscriptions WHERE created_at < $1',
    [cutoff],
  )

  return NextResponse.json({ pruned: result.rowCount ?? 0, cutoff: cutoff.toISOString() })
}

export async function GET() {
  return NextResponse.json({ ok: true, route: 'prune-push' })
}
