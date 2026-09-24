import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { canManage } from '@/lib/rbac'

import { withRoute } from '@/lib/withRoute'

export const dynamic = 'force-dynamic'

type TimeActor = { orgRole: string | null; appRole: string; email: string }

function canApproveTime(actor: TimeActor): boolean {
  return canManage(actor.orgRole || '') || actor.appRole === 'project_manager'
}

function timeReadScope(actor: TimeActor): Prisma.TimeEntryWhereInput {
  if (canManage(actor.orgRole || '')) return {}
  if (actor.appRole === 'operative') {
    return actor.email ? { member: { email: { equals: actor.email, mode: 'insensitive' } } } : { id: '__no_time_access__' }
  }
  if (actor.appRole === 'project_manager' || actor.appRole === 'foreman') {
    return actor.email ? { project: { assignments: { some: { member: { email: { equals: actor.email, mode: 'insensitive' } } } } } } : { id: '__no_time_access__' }
  }
  return {}
}


// ISO 8601 week number — week containing Thursday is week 1
function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { week, year: d.getUTCFullYear() }
}

async function GET_impl(req: NextRequest, actor: TimeActor) {
  try {
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('memberId')
    const weekParam = searchParams.get('week')
    const yearParam = searchParams.get('year')
    // approved=false → only unapproved; approved=true → only approved; omit → all
    const approvedParam = searchParams.get('approved')
    const approvedFilter = approvedParam === 'false' ? false : approvedParam === 'true' ? true : undefined
    // allWeeks=true → skip week/year filter (used for cross-week pending count)
    const allWeeks = searchParams.get('allWeeks') === 'true'

    const nowIso = isoWeek(new Date())
    const currentWeek = weekParam ? parseInt(weekParam) : nowIso.week
    const currentYear = yearParam ? parseInt(yearParam) : nowIso.year

    const filters: Prisma.TimeEntryWhereInput = {
      ...(memberId && { memberId }),
      ...(!allWeeks && { week: currentWeek, year: currentYear }),
      ...(approvedFilter !== undefined && { approved: approvedFilter }),
    }
    const entries = await prisma.timeEntry.findMany({
      where: { AND: [filters, timeReadScope(actor)] },
      include: { member: true, project: true },
      orderBy: { date: 'asc' },
    })

    // Group by member for timesheet view
    const byMember: Record<string, { member: typeof entries[0]['member'], entries: typeof entries, totalHours: number, approved: boolean }> = {}
    for (const entry of entries) {
      if (!byMember[entry.memberId]) {
        byMember[entry.memberId] = { member: entry.member, entries: [], totalHours: 0, approved: true }
      }
      byMember[entry.memberId].entries.push(entry)
      byMember[entry.memberId].totalHours += entry.hours
      if (!entry.approved) byMember[entry.memberId].approved = false
    }

    return NextResponse.json({ entries, byMember: Object.values(byMember), week: currentWeek, year: currentYear })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 })
  }
}

async function POST_impl(req: NextRequest, userId: string, actor: TimeActor) {
  const __limited = await enforceRateLimit(req, 'write', userId)
  if (__limited) return __limited
  try {
    const body = await req.json()
    if (body.approved === true && !canApproveTime(actor)) {
      return NextResponse.json({ error: 'Project Manager or Company Admin approval required' }, { status: 403 })
    }
    if (!body.memberId) {
      return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
    }
    if (!body.date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 })
    }
    if (body.hours === undefined || body.hours === null || !Number.isFinite(Number(body.hours)) || Number(body.hours) <= 0) {
      return NextResponse.json({ error: 'Hours must be a positive number' }, { status: 400 })
    }
    if (Number(body.hours) > 24) {
      return NextResponse.json({ error: 'Hours cannot exceed 24 per entry' }, { status: 400 })
    }
    const date = new Date(body.date)
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }
    // Field personas may only write time inside their assigned project scope.
    if (!canManage(actor.orgRole || '') && ['project_manager', 'foreman', 'operative'].includes(actor.appRole)) {
      if (!body.projectId || !actor.email) return NextResponse.json({ error: 'Assigned project is required for field time' }, { status: 403 })
      const assignedProject = await prisma.project.findFirst({
        where: { id: String(body.projectId), assignments: { some: { member: { email: { equals: actor.email, mode: 'insensitive' } } } } },
        select: { id: true },
      })
      if (!assignedProject) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 403 })
      const targetMember = await prisma.teamMember.findFirst({
        where: { id: String(body.memberId), ...(actor.appRole === 'operative' ? { email: { equals: actor.email, mode: 'insensitive' } } : { assignments: { some: { projectId: assignedProject.id } } }) },
        select: { id: true },
      })
      if (!targetMember) return NextResponse.json({ error: actor.appRole === 'operative' ? 'Operatives can only log their own time' : 'Team member is not assigned to this project' }, { status: 403 })
    }

    // Always derive week/year server-side from the date (don't trust client overrides)
    const { week, year } = isoWeek(date)
    const entry = await prisma.timeEntry.create({
      data: {
        memberId: body.memberId,
        projectId: body.projectId || null,
        date,
        hours: Number(body.hours),
        week,
        year,
        approved: canApproveTime(actor) ? (body.approved ?? false) : false,
      },
      include: { member: true, project: true },
    })
    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create time entry' }, { status: 500 })
  }
}

export const GET = withRoute(({ req, role, session }) => GET_impl(req, { orgRole: role, appRole: session.user?.role || '', email: session.user?.email?.trim() || '' }), { permission: 'read' })
export const POST = withRoute(({ req, userId, role, session }) => POST_impl(req, userId, { orgRole: role, appRole: session.user?.role || '', email: session.user?.email?.trim() || '' }), { permission: 'write' })
