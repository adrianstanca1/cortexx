import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const task = await prisma.task.update({
      where: { id: params.id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
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

    // Auto-recalculate project progress when task status changes
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
  try {
    await prisma.task.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
