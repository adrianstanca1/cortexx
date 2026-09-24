import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import { canManage } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

type TimeActor = { orgRole: string | null; appRole: string; email: string }

function timeActor(auth: Exclude<Awaited<ReturnType<typeof requireOrg>>, NextResponse>): TimeActor {
  return { orgRole: auth.role, appRole: auth.session.user?.role || '', email: auth.session.user?.email?.trim() || '' }
}

function canApproveTime(actor: TimeActor): boolean {
  return canManage(actor.orgRole || '') || actor.appRole === 'project_manager'
}

function entryScope(id: string, actor: TimeActor): Prisma.TimeEntryWhereInput {
  if (canManage(actor.orgRole || '')) return { id }
  if (actor.appRole === 'operative') return actor.email ? { id, member: { email: { equals: actor.email, mode: 'insensitive' } } } : { id: '__no_time_access__' }
  if (actor.appRole === 'project_manager' || actor.appRole === 'foreman') {
    return actor.email ? { id, project: { assignments: { some: { member: { email: { equals: actor.email, mode: 'insensitive' } } } } } } : { id: '__no_time_access__' }
  }
  return { id }
}

async function ensureTargetProject(actor: TimeActor, projectId: string | null, memberId: string): Promise<string | null> {
  if (canManage(actor.orgRole || '') || !['project_manager', 'foreman', 'operative'].includes(actor.appRole)) return null
  if (!projectId || !actor.email) return 'Assigned project is required for field time'
  const project = await prisma.project.findFirst({
    where: { id: projectId, assignments: { some: { member: { email: { equals: actor.email, mode: 'insensitive' } } } } },
    select: { id: true },
  })
  if (!project) return 'Project not found or not assigned'
  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, ...(actor.appRole === 'operative' ? { email: { equals: actor.email, mode: 'insensitive' } } : { assignments: { some: { projectId } } }) },
    select: { id: true },
  })
  if (!member) return actor.appRole === 'operative' ? 'Operatives can only edit their own time' : 'Team member is not assigned to this project'
  return null
}


export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  try {
    const actor = timeActor(auth)
    const entry = await prisma.timeEntry.findFirst({
      where: entryScope(params.id, actor),
      include: { member: true, project: true },
    })
    if (!entry) return NextResponse.json({ error: 'Time entry not found' }, { status: 404 })
    return NextResponse.json(entry)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch time entry' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const actor = timeActor(auth)
  try {
    const existing = await prisma.timeEntry.findFirst({ where: entryScope(params.id, actor), select: { id: true, memberId: true, projectId: true, approved: true } })
    if (!existing) return NextResponse.json({ error: 'Time entry not found or not accessible' }, { status: 404 })
    if (existing.approved && !canApproveTime(actor)) {
      return NextResponse.json({ error: 'Approved time can only be changed by Project Manager or Company Admin' }, { status: 403 })
    }
    const body = await req.json()
    if (body.approved !== undefined && !canApproveTime(actor)) {
      return NextResponse.json({ error: 'Project Manager or Company Admin approval required' }, { status: 403 })
    }
    if (body.hours !== undefined) {
      const h = Number(body.hours)
      if (isNaN(h) || h <= 0 || h > 24) {
        return NextResponse.json({ error: 'Hours must be > 0 and ≤ 24' }, { status: 400 })
      }
    }
    const targetProjectId = body.projectId !== undefined ? (body.projectId || null) : existing.projectId
    const accessError = await ensureTargetProject(actor, targetProjectId, existing.memberId)
    if (accessError) return NextResponse.json({ error: accessError }, { status: 403 })
    const entry = await prisma.timeEntry.update({
      where: { id: params.id },
      data: {
        ...(body.hours !== undefined && { hours: Number(body.hours) }),
        ...(body.approved !== undefined && { approved: body.approved }),
        ...(body.projectId !== undefined && { projectId: body.projectId }),
      },
      include: { member: true, project: true },
    })
    return NextResponse.json(entry)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const actor = timeActor(auth)
  try {
    const entry = await prisma.timeEntry.findFirst({
      where: entryScope(params.id, actor),
      select: { hours: true, projectId: true, approved: true, member: { select: { name: true } } },
    })
    if (!entry) return NextResponse.json({ error: 'Time entry not found' }, { status: 404 })
    if (entry.approved && !canApproveTime(actor)) {
      return NextResponse.json({ error: 'Approved time can only be deleted by Project Manager or Company Admin' }, { status: 403 })
    }
    await prisma.timeEntry.delete({ where: { id: params.id } })
    auditLog({
      action: 'timeEntry.delete',
      resourceType: 'TimeEntry',
      resourceId: params.id,
      ...requestMeta(req),
    })
    prisma.activity.create({
      data: {
        projectId: entry.projectId,
        actorName: actorName(auth.session),
        actorType: 'human',
        action: `deleted ${entry.hours}h time entry for ${entry.member?.name || 'member'}`,
        iconType: 'trash',
      },
    }).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete time entry' }, { status: 500 })
  }
}
