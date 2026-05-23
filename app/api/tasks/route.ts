import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')

    const tasks = await prisma.task.findMany({
      where: {
        ...(projectId && { projectId }),
        ...(status && { status }),
      },
      include: { project: true, assignee: true },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    })
    return NextResponse.json({ tasks })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 })
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
    // Log activity for project tasks (non-blocking)
    if (task.projectId) {
      prisma.activity.create({
        data: {
          projectId: task.projectId,
          actorName: 'You',
          actorType: 'human',
          action: `added task: ${task.title}`,
          iconType: 'check',
        },
      }).catch(() => {})
    }
    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
