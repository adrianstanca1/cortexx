import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { sendPush } from '@/lib/push'
import { reportError } from '@/lib/errors'
import { canManage } from '@/lib/rbac'

import { withRoute } from '@/lib/withRoute'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100

async function GET_impl(req: NextRequest, session: { user?: { email?: string | null; role?: string } }) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const take = Math.min(parseInt(searchParams.get('take') || '100') || 100, MAX_TAKE)
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0') || 0)

    const appRole = session.user?.role || ''
    const email = session.user?.email?.trim() || ''
    const assignmentScoped = ['project_manager', 'foreman'].includes(appRole)
    const operativeScoped = appRole === 'operative'
    const personaWhere: Prisma.TaskWhereInput = assignmentScoped
      ? (email ? { OR: [
          { project: { assignments: { some: { member: { email: { equals: email, mode: 'insensitive' } } } } } },
          { assignee: { email: { equals: email, mode: 'insensitive' } } },
        ] } : { id: '__no_assigned_task__' })
      : operativeScoped
        ? (email ? { assignee: { email: { equals: email, mode: 'insensitive' } } } : { id: '__no_assigned_task__' })
        : {}
    const where: Prisma.TaskWhereInput = { ...(projectId && { projectId }), ...(status && { status }), ...personaWhere }
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: { project: true, assignee: true, _count: { select: { comments: true } } },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        take,
        skip,
      }),
      prisma.task.count({ where }),
    ])
    return NextResponse.json({ tasks, total, hasMore: skip + tasks.length < total })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

async function POST_impl(req: NextRequest, userId: string, orgRole: string | null, session: { user?: { name?: string | null; email?: string | null; role?: string } }) {
  const __limited = await enforceRateLimit(req, 'write', userId)
  if (__limited) return __limited
  try {
    const body = await req.json()
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 })
    }
    if (body.dueTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(body.dueTime))) {
      return NextResponse.json({ error: 'dueTime must be HH:MM (00:00–23:59)' }, { status: 400 })
    }
    if (body.dueDate && isNaN(Date.parse(String(body.dueDate)))) {
      return NextResponse.json({ error: 'dueDate must be a valid date' }, { status: 400 })
    }

    const appRole = session.user?.role || ''
    const email = session.user?.email?.trim() || ''
    const fieldRole = ['project_manager', 'foreman', 'operative'].includes(appRole)
    const projectId = body.projectId || null
    let assigneeId = body.assigneeId || null
    if (!canManage(orgRole || '') && fieldRole) {
      if (!projectId || !email) return NextResponse.json({ error: 'Assigned project is required for field task creation' }, { status: 403 })
      const assignedProject = await prisma.project.findFirst({
        where: { id: projectId, assignments: { some: { member: { email: { equals: email, mode: 'insensitive' } } } } },
        select: { id: true },
      })
      if (!assignedProject) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 403 })

      if (appRole === 'operative') {
        const self = await prisma.teamMember.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } })
        if (!self) return NextResponse.json({ error: 'Linked team member required' }, { status: 403 })
        if (assigneeId && assigneeId !== self.id) return NextResponse.json({ error: 'Operatives can only create tasks for themselves' }, { status: 403 })
        assigneeId = self.id
      } else if (assigneeId) {
        const projectMember = await prisma.teamMember.findFirst({ where: { id: assigneeId, assignments: { some: { projectId } } }, select: { id: true } })
        if (!projectMember) return NextResponse.json({ error: 'Assignee must belong to the selected project' }, { status: 400 })
      }
    }

    const task = await prisma.task.create({
      data: {
        title: body.title.trim(),
        description: body.description?.trim() || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        dueTime: body.dueTime || null,
        status: body.status || 'todo',
        priority: body.priority || 'medium',
        category: body.category || null,
        projectId,
        assigneeId,
      },
      include: { project: true, assignee: true },
    })
    if (task.projectId) {
      prisma.activity.create({
        data: {
          projectId: task.projectId,
          actorName: actorName(session),
          actorType: 'human',
          action: `added task: ${task.title}`,
          iconType: 'check',
        },
      }).catch(() => {})
    }

    // Notify the assignee if they have a matching User (matched on email) and
    // an active push subscription. Best effort — never blocks the response.
    if (task.assignee?.email && (task.priority === 'critical' || task.priority === 'high' || task.dueDate)) {
      prisma.user.findUnique({ where: { email: task.assignee.email }, select: { id: true } })
        .then(user => {
          if (!user) return
          return sendPush({
            userId: user.id,
            category: 'tasks',
            payload: {
              title: `📋 ${task.priority === 'critical' ? 'Urgent task' : 'New task'}`,
              body: `${task.title}${task.project?.name ? ` · ${task.project.name}` : ''}`,
              url: '/tasks',
              tag: `task-${task.id}`,
            },
          })
        })
        .catch(() => {})
    }

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

export const GET = withRoute(({ req, session }) => GET_impl(req, session), { permission: 'read' })
export const POST = withRoute(({ req, userId, role, session }) => POST_impl(req, userId, role, session), { permission: 'write' })
