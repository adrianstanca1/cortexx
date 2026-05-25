import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * Bulk approve / unapprove time entries.
 *
 * Body shape:
 *   { action: 'approve' | 'unapprove', ids?: string[], memberId?: string, week?: number, year?: number }
 *
 * If ids provided → updates those entries.
 * Otherwise if memberId+week+year provided → updates that member's week.
 * Otherwise if week+year only → updates all unapproved entries for that week.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const action = String(body.action || '')
    if (!['approve', 'unapprove'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve | unapprove' }, { status: 400 })
    }
    const approved = action === 'approve'

    let where: Record<string, unknown> = {}
    if (Array.isArray(body.ids) && body.ids.length > 0) {
      where = { id: { in: body.ids.filter((x: unknown) => typeof x === 'string').slice(0, 500) } }
    } else if (body.memberId && body.week && body.year) {
      where = { memberId: String(body.memberId), week: Number(body.week), year: Number(body.year), approved: !approved }
    } else if (body.week && body.year) {
      where = { week: Number(body.week), year: Number(body.year), approved: !approved }
    } else {
      return NextResponse.json({ error: 'Provide ids, or memberId+week+year, or week+year' }, { status: 400 })
    }

    const result = await prisma.timeEntry.updateMany({ where, data: { approved } })

    prisma.activity.create({
      data: {
        projectId: null,
        actorName: actorName(auth),
        actorType: 'human',
        action: `${approved ? 'approved' : 'unapproved'} ${result.count} time entr${result.count === 1 ? 'y' : 'ies'}`,
        iconType: 'check',
      },
    }).catch(() => {})

    return NextResponse.json({ updated: result.count, approved })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Bulk approve failed' }, { status: 500 })
  }
}
