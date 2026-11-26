import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { reportError } from '@/lib/errors'
import { withRoute } from '@/lib/withRoute'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const org = await requireOrg()
  if (org instanceof NextResponse) return org
  const auth = org.session
  try {
    const comments = await prisma.comment.findMany({
      where: { taskId: params.id },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ comments })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 })
  }
}

export const POST = withRoute(async ({ req, session, userId, orgId, orgSlug, orgName, role, personaRole }) => {
  const __segments = req.nextUrl.pathname.split('/').filter(Boolean)
  const params = { id: __segments[2] }
  try {
    const body = await req.json()
    const text = String(body.body || '').trim().slice(0, 2000)
    if (!text) {
      return NextResponse.json({ error: 'Comment body is required' }, { status: 400 })
    }
    const authorId = (session.user as { id?: string }).id || 'unknown'

    // Look up task to find projectId for activity log
    const task = await prisma.task.findUnique({ where: { id: params.id }, select: { projectId: true, title: true } })
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    const comment = await prisma.comment.create({
      data: {
        taskId: params.id,
        projectId: task.projectId,
        authorId,
        authorName: actorName(session),
        body: text,
      },
    })

    if (task.projectId) {
      prisma.activity.create({
        data: {
          projectId: task.projectId,
          actorName: actorName(session),
          actorType: 'human',
          action: `commented on: ${task.title}`,
          detail: text.slice(0, 100),
          iconType: 'check',
        },
      }).catch(() => {})
    }

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }

}, { permission: 'write' })
