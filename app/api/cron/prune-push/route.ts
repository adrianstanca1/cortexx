import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireCronAuth } from '@/lib/cron'

export const dynamic = 'force-dynamic'

/**
 * Hourly job: drop push subscriptions inactive for > 90 days. Live
 * delivery already prunes stale 410/404 endpoints; this is a safety
 * net for endpoints that simply went quiet without an error response.
 */
export async function POST(req: NextRequest) {
  const denied = requireCronAuth(req)
  if (denied) return denied

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)

  const result = await prisma.pushSubscription.deleteMany({
    where: { lastUsed: { lt: cutoff } },
  })

  return NextResponse.json({ pruned: result.count, cutoff: cutoff.toISOString() })
}
