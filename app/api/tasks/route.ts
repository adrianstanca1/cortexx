import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { sendPush } from '@/lib/push'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const take = Math.min(parseInt(searchParams.get('take') || '100') || 100, MAX_TAKE)
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0') || 0)

    const where = { ...(projectId && { projectId }), ...(status && { status }) }
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
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
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
    const task = await prisma.task.create({
      data: {
        title: body.title.trim(),
        description: body.description?.trim() || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        dueTime: body.dueTime || null,
        status: body.status || 'todo',
        priority: body.priority || 'medium',
        category: body.category || null,
        projectId: body.projectId || null,
        assigneeId: body.assigneeId || null,
      },
      include: { project: true, assignee: true },
    })
    if (task.projectId) {
      prisma.activity.create({
        data: {
          projectId: task.projectId,
          actorName: actorName(auth),
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
    console.error(error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
