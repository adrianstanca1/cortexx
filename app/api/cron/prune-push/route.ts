import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron'
import { prisma } from '@/lib/db'
import { bypassTenancy } from '@/lib/tenancy'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const denied = requireCronAuth(req)
  if (denied) return denied

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)

  try {
    const result = await bypassTenancy(() =>
      prisma.pushSubscription.deleteMany({
        where: { lastUsed: { lt: cutoff } },
      }),
    )
    return NextResponse.json({ pruned: result.count, cutoff: cutoff.toISOString() })
  } catch (error) {
    reportError(error, { context: 'cron.prune-push' })
    return NextResponse.json({ error: 'Push subscription prune failed' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: 'prune-push' })
}
