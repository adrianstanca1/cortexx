import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import { canManage, canWrite } from '@/lib/rbac'
import { runWithOrg } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }
type OrgAuth = Exclude<Awaited<ReturnType<typeof requireOrg>>, NextResponse>

function appRole(auth: OrgAuth): string { return (auth.session.user as { role?: string })?.role || '' }
function email(auth: OrgAuth): string { return (auth.session.user as { email?: string | null })?.email?.trim() || '' }

function taskAccessWhere(id: string, auth: OrgAuth): Prisma.TaskWhereInput {
  if (canManage(auth.role || '')) return { id }
  const role = appRole(auth)
  const mail = email(auth)
  if (!mail) return { id: '__no_accessible_task__' }
  if (role === 'project_manager' || role === 'foreman') {
    return { id, project: { assignments: { some: { member: { email: { equals: mail, mode: 'insensitive' } } } } } }
  }
  if (role === 'operative') return { id, assignee: { email: { equals: mail, mode: 'insensitive' } } }
  return { id }
}

async function assignedProject(projectId: string, auth: OrgAuth): Promise<boolean> {
  if (canManage(auth.role || '')) return true
  const mail = email(auth)
  if (!mail) return false
  return !!(await prisma.project.findFirst({ where: { id: projectId, assignments: { some: { member: { email: { equals: mail, mode: 'insensitive' } } } } }, select: { id: true } }))
}

async function assigneeBelongsToProject(assigneeId: string, projectId: string): Promise<boolean> {
  return !!(await prisma.teamMember.findFirst({ where: { id: assigneeId, assignments: { some: { projectId } } }, select: { id: true } }))
}

async function scoped<T>(auth: Exclude<Awaited<ReturnType<typeof requireOrg>>, NextResponse>, fn: () => Promise<T>) {
  return runWithOrg({ organizationId: auth.orgId, userId: auth.userId ?? null, role: auth.role }, fn)
}

export async function GET(_req: NextRequest, { params: paramsP }: RouteParams) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const params = await paramsP
  return scoped(auth, async () => {
    try {
      const task = await prisma.task.findFirst({
        where: taskAccessWhere(params.id, auth),
        include: { project: true, assignee: true, _count: { select: { comments: true } } },
      })
      if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      return NextResponse.json(task)
    } catch (error) {
      reportError(error)
      return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
    }
  })
}

export async function PUT(req: NextRequest, { params: paramsP }: RouteParams) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  const params = await paramsP
  return scoped(auth, async () => {
    try {
      if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
      const existing = await prisma.task.findFirst({ where: taskAccessWhere(params.id, auth), select: { id: true, projectId: true, assigneeId: true } })
      if (!existing) return NextResponse.json({ error: 'Task not found or not assigned' }, { status: 404 })
      const body = await req.json()
      const role = appRole(auth)
      if (!canManage(auth.role || '') && role === 'operative') {
        const keys = Object.keys(body).filter(key => body[key] !== undefined)
        if (keys.some(key => key !== 'status')) return NextResponse.json({ error: 'Operatives can only update task status' }, { status: 403 })
      }
      const targetProjectId = body.projectId !== undefined ? body.projectId : existing.projectId
      if (!canManage(auth.role || '') && (role === 'project_manager' || role === 'foreman')) {
        if (!targetProjectId || !(await assignedProject(String(targetProjectId), auth))) return NextResponse.json({ error: 'Target project is not assigned' }, { status: 403 })
        if (role === 'foreman' && body.projectId !== undefined && body.projectId !== existing.projectId) return NextResponse.json({ error: 'Foremen cannot move tasks between projects' }, { status: 403 })
        if (body.assigneeId && !(await assigneeBelongsToProject(String(body.assigneeId), String(targetProjectId)))) return NextResponse.json({ error: 'Assignee must belong to the selected project' }, { status: 400 })
      }
      if (body.title !== undefined && !String(body.title).trim()) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      if (body.dueTime !== undefined && body.dueTime !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(body.dueTime))) {
        return NextResponse.json({ error: 'dueTime must be HH:MM (00:00–23:59)' }, { status: 400 })
      }
      if (body.dueDate !== undefined && body.dueDate !== null && isNaN(Date.parse(String(body.dueDate)))) {
        return NextResponse.json({ error: 'dueDate must be a valid date' }, { status: 400 })
      }
      const task = await prisma.task.update({
        where: { id: params.id },
        data: {
          ...(body.title !== undefined && { title: String(body.title).trim() }),
          ...(body.description !== undefined && { description: body.description ? String(body.description).trim() : null }),
          ...(body.status !== undefined && { status: body.status }),
          ...(body.priority !== undefined && { priority: body.priority }),
          ...(body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
          ...(body.dueTime !== undefined && { dueTime: body.dueTime }),
          ...(body.assigneeId !== undefined && { assigneeId: body.assigneeId }),
          ...(body.projectId !== undefined && { projectId: body.projectId }),
          ...(body.category !== undefined && { category: body.category }),
        },
        include: { project: true, assignee: true },
      })

      if (body.status !== undefined && task.projectId) {
        const allTasks = await prisma.task.findMany({ where: { projectId: task.projectId }, select: { status: true } })
        const total = allTasks.length
        const done = allTasks.filter(t => t.status === 'done').length
        const progress = total > 0 ? Math.round((done / total) * 100) : 0
        await prisma.project.update({ where: { id: task.projectId }, data: { progress } })
      }
      return NextResponse.json(task)
    } catch (error) {
      reportError(error)
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }
  })
}

export async function DELETE(req: NextRequest, { params: paramsP }: RouteParams) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const params = await paramsP
  return scoped(auth, async () => {
    try {
      const role = appRole(auth)
      if (!canManage(auth.role || '') && role !== 'project_manager') return NextResponse.json({ error: 'Company Admin or Project Manager permission required to delete tasks' }, { status: 403 })
      const task = await prisma.task.findFirst({ where: taskAccessWhere(params.id, auth), select: { title: true, projectId: true } })
      if (!task) return NextResponse.json({ error: 'Task not found or not assigned' }, { status: 404 })
      await prisma.task.delete({ where: { id: params.id } })
      auditLog({ action: 'task.delete', resourceType: 'Task', resourceId: params.id, ...requestMeta(req) })
      prisma.activity.create({
        data: { projectId: task.projectId, actorName: actorName(auth.session), actorType: 'human', action: `deleted task: ${task.title}`, iconType: 'trash' },
      }).catch(() => {})
      return NextResponse.json({ success: true })
    } catch (error) {
      reportError(error)
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
    }
  })
}
