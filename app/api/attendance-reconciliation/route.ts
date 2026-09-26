import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import attendance from '@/lib/attendance-reconciliation'

export const dynamic = 'force-dynamic'

const { buildAttendanceReconciliation, isoWeek, isoWeekRange } = attendance

type ManagerActor = { orgRole: string | null; appRole: string; email: string }

function actorFrom(auth: Exclude<Awaited<ReturnType<typeof requireOrg>>, NextResponse>): ManagerActor {
  return {
    orgRole: auth.role,
    appRole: auth.personaRole || auth.session.user?.role || '',
    email: auth.session.user?.email?.trim() || '',
  }
}

function canReconcile(actor: ManagerActor) {
  return canManage(actor.orgRole || '') || actor.appRole === 'project_manager'
}

function assignedProjectFilter(actor: ManagerActor): Prisma.ProjectWhereInput {
  if (canManage(actor.orgRole || '')) return {}
  if (actor.appRole === 'project_manager' && actor.email) {
    return { assignments: { some: { member: { email: { equals: actor.email, mode: 'insensitive' } } } } }
  }
  return { id: '__no_project_access__' }
}

function parseWeek(req: NextRequest) {
  const current = isoWeek(new Date())
  const weekRaw = req.nextUrl.searchParams.get('week')
  const yearRaw = req.nextUrl.searchParams.get('year')
  const week = weekRaw ? Number(weekRaw) : current.week
  const year = yearRaw ? Number(yearRaw) : current.year
  if (!Number.isInteger(week) || week < 1 || week > 53 || !Number.isInteger(year) || year < 2000 || year > 2100) return null
  return { week, year, ...isoWeekRange(week, year) }
}

function dayRange(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const start = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== date) return null
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const actor = actorFrom(auth)
  if (!canReconcile(actor)) return NextResponse.json({ error: 'Project Manager or Company Admin access required' }, { status: 403 })
  try {
    const range = parseWeek(req)
    if (!range) return NextResponse.json({ error: 'Invalid ISO week/year' }, { status: 400 })
    const projectId = req.nextUrl.searchParams.get('projectId')?.trim() || null
    const projectFilter: Prisma.ProjectWhereInput = { ...assignedProjectFilter(actor), ...(projectId ? { id: projectId } : {}) }

    const [checkins, timeEntries] = await Promise.all([
      prisma.siteCheckIn.findMany({
        where: { checkedInAt: { gte: range.start, lt: range.end }, project: projectFilter },
        include: {
          member: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { checkedInAt: 'asc' },
        take: 2000,
      }),
      prisma.timeEntry.findMany({
        where: { date: { gte: range.start, lt: range.end }, project: projectFilter },
        include: {
          member: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { date: 'asc' },
        take: 2000,
      }),
    ])

    const rows = buildAttendanceReconciliation({ checkins, timeEntries })
    const exceptions = rows.filter(row => row.status === 'exception')
    return NextResponse.json({
      week: range.week,
      year: range.year,
      rows,
      exceptions,
      summary: {
        totalDays: rows.length,
        matched: rows.length - exceptions.length,
        exceptions: exceptions.length,
        missingCheckout: exceptions.filter(row => row.issues.includes('missing_checkout')).length,
        missingTime: exceptions.filter(row => row.issues.includes('missing_time')).length,
        variance: exceptions.filter(row => row.issues.includes('variance')).length,
        timeWithoutAttendance: exceptions.filter(row => row.issues.includes('time_without_attendance')).length,
      },
    })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to reconcile attendance and time' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const actor = actorFrom(auth)
  if (!canReconcile(actor)) return NextResponse.json({ error: 'Project Manager or Company Admin access required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited

  try {
    const body = await req.json()
    const memberId = String(body.memberId || '').trim()
    const projectId = String(body.projectId || '').trim()
    const date = String(body.date || '').trim()
    if (!memberId || !projectId || !date) return NextResponse.json({ error: 'memberId, projectId and date are required' }, { status: 400 })
    const range = dayRange(date)
    if (!range) return NextResponse.json({ error: 'Date must be YYYY-MM-DD' }, { status: 400 })

    const project = await prisma.project.findFirst({
      where: { id: projectId, ...assignedProjectFilter(actor) },
      select: { id: true, name: true },
    })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 403 })

    const member = await prisma.teamMember.findFirst({
      where: {
        id: memberId,
        ...(actor.appRole === 'project_manager' && !canManage(actor.orgRole || '') ? { assignments: { some: { projectId } } } : {}),
      },
      select: { id: true, name: true },
    })
    if (!member) return NextResponse.json({ error: 'Team member is not assigned to this project' }, { status: 403 })

    const result = await prisma.$transaction(async tx => {
      const [checkins, timeEntries] = await Promise.all([
        tx.siteCheckIn.findMany({
          where: { memberId, projectId, checkedInAt: { gte: range.start, lt: range.end } },
          include: { member: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
          orderBy: { checkedInAt: 'asc' },
        }),
        tx.timeEntry.findMany({
          where: { memberId, projectId, date: { gte: range.start, lt: range.end } },
          include: { member: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
          orderBy: { date: 'asc' },
        }),
      ])
      const row = buildAttendanceReconciliation({ checkins, timeEntries })[0]
      if (!row || row.observedHours <= 0) throw new Error('NO_COMPLETED_ATTENDANCE')
      if (row.openCheckins > 0) throw new Error('OPEN_CHECKIN')
      if (row.approvedAny) throw new Error('APPROVED_TIME')
      if (row.timeEntryIds.length > 1) throw new Error('SPLIT_TIME')

      const { week, year } = isoWeek(range.start)
      const previousHours = row.loggedHours
      const entry = timeEntries[0]
        ? await tx.timeEntry.update({ where: { id: timeEntries[0].id }, data: { hours: row.observedHours, approved: false }, include: { member: true, project: true } })
        : await tx.timeEntry.create({
            data: { memberId, projectId, date: range.start, hours: row.observedHours, week, year, approved: false },
            include: { member: true, project: true },
          })
      return { entry, row, previousHours }
    })

    auditLog({
      organizationId: auth.orgId || undefined,
      userId: auth.userId || undefined,
      action: 'attendance.reconcile',
      resourceType: 'TimeEntry',
      resourceId: result.entry.id,
      metadata: {
        memberId,
        projectId,
        date,
        observedHours: result.row.observedHours,
        previousLoggedHours: result.previousHours,
        newLoggedHours: result.entry.hours,
        checkinIds: result.row.checkinIds,
      },
      ...requestMeta(req),
    })
    prisma.activity.create({
      data: {
        projectId,
        actorName: actorName(auth.session),
        actorType: 'human',
        action: `reconciled attendance for ${member.name}`,
        detail: JSON.stringify({ type: 'attendance_reconciliation', date, observedHours: result.row.observedHours, previousLoggedHours: result.previousHours, timeEntryId: result.entry.id }),
        iconType: 'check',
      },
    }).catch(() => {})

    return NextResponse.json({ entry: result.entry, approved: false, source: 'site_attendance' })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NO_COMPLETED_ATTENDANCE') return NextResponse.json({ error: 'No completed site attendance exists for this day' }, { status: 409 })
      if (error.message === 'OPEN_CHECKIN') return NextResponse.json({ error: 'Check out from site before reconciling hours' }, { status: 409 })
      if (error.message === 'APPROVED_TIME') return NextResponse.json({ error: 'Unapprove the existing time entry before reconciling it' }, { status: 409 })
      if (error.message === 'SPLIT_TIME') return NextResponse.json({ error: 'Multiple time entries exist for this day; review them manually' }, { status: 409 })
    }
    reportError(error)
    return NextResponse.json({ error: 'Failed to apply attendance hours' }, { status: 500 })
  }
}
