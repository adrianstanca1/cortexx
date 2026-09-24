import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { canManage } from '@/lib/rbac'

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
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const orgRole = auth.role
  const appRole = auth.session.user?.role || ''
  const email = auth.session.user?.email?.trim() || ''
  const isAdmin = canManage(orgRole || '')
  if (!isAdmin && appRole !== 'project_manager') {
    return NextResponse.json({ error: 'Project Manager or Company Admin approval required' }, { status: 403 })
  }
  if (!isAdmin && !email) return NextResponse.json({ error: 'Linked user email required' }, { status: 403 })
  const __limited = await enforceRateLimit(req, 'write', auth.userId)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const action = String(body.action || '')
    if (!['approve', 'unapprove'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve | unapprove' }, { status: 400 })
    }
    const approved = action === 'approve'

    let where: Prisma.TimeEntryWhereInput = {}
    if (Array.isArray(body.ids) && body.ids.length > 0) {
      where = { id: { in: body.ids.filter((x: unknown) => typeof x === 'string').slice(0, 500) } }
    } else if (body.memberId && body.week && body.year) {
      where = { memberId: String(body.memberId), week: Number(body.week), year: Number(body.year), approved: !approved }
    } else if (body.week && body.year) {
      where = { week: Number(body.week), year: Number(body.year), approved: !approved }
    } else {
      return NextResponse.json({ error: 'Provide ids, or memberId+week+year, or week+year' }, { status: 400 })
    }

    if (!isAdmin) {
      where = { AND: [where, { project: { assignments: { some: { member: { email: { equals: email, mode: 'insensitive' } } } } } }] }
    }
    const result = await prisma.timeEntry.updateMany({ where, data: { approved } })

    prisma.activity.create({
      data: {
        projectId: null,
        actorName: actorName(auth.session),
        actorType: 'human',
        action: `${approved ? 'approved' : 'unapproved'} ${result.count} time entr${result.count === 1 ? 'y' : 'ies'}`,
        iconType: 'check',
      },
    }).catch(() => {})

    return NextResponse.json({ updated: result.count, approved })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Bulk approve failed' }, { status: 500 })
  }
}
