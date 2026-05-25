import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const comments = await prisma.comment.findMany({
      where: { taskId: params.id },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ comments })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const text = String(body.body || '').trim().slice(0, 2000)
    if (!text) {
      return NextResponse.json({ error: 'Comment body is required' }, { status: 400 })
    }
    const authorId = (auth.user as { id?: string }).id || 'unknown'

    // Look up task to find projectId for activity log
    const task = await prisma.task.findUnique({ where: { id: params.id }, select: { projectId: true, title: true } })
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    const comment = await prisma.comment.create({
      data: {
        taskId: params.id,
        projectId: task.projectId,
        authorId,
        authorName: actorName(auth),
        body: text,
      },
    })

    if (task.projectId) {
      prisma.activity.create({
        data: {
          projectId: task.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `commented on: ${task.title}`,
          detail: text.slice(0, 100),
          iconType: 'check',
        },
      }).catch(() => {})
    }

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }
}
