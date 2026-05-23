import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: { project: true, assignee: true, _count: { select: { comments: true } } },
    })
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    return NextResponse.json(task)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    if (body.title !== undefined && !String(body.title).trim()) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    }
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

    const projectId = task.projectId
    if (body.status !== undefined && projectId) {
      const allTasks = await prisma.task.findMany({ where: { projectId }, select: { status: true } })
      const total = allTasks.length
      const done = allTasks.filter(t => t.status === 'done').length
      const progress = total > 0 ? Math.round((done / total) * 100) : 0
      await prisma.project.update({ where: { id: projectId }, data: { progress } })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const task = await prisma.task.findUnique({ where: { id: params.id }, select: { title: true, projectId: true } })
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    await prisma.task.delete({ where: { id: params.id } })
    prisma.activity.create({
      data: {
        projectId: task.projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `deleted task: ${task.title}`,
        iconType: 'trash',
      },
    }).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
