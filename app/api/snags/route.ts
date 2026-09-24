import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'

import { withRoute } from '@/lib/withRoute'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100
const ALLOWED_STATUS = new Set(['open', 'in_progress', 'closed'])
const ALLOWED_PRIORITY = new Set(['low', 'medium', 'high', 'critical'])

async function GET_impl(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const take = Math.min(parseInt(searchParams.get('take') || '50') || 50, MAX_TAKE)
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0') || 0)

    const where = {
      ...(projectId && { projectId }),
      ...(status && ALLOWED_STATUS.has(status) && { status }),
      ...(priority && ALLOWED_PRIORITY.has(priority) && { priority }),
    }
    const [snags, total, openCount] = await Promise.all([
      prisma.snag.findMany({
        where,
        include: { project: { select: { id: true, name: true } } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take,
        skip,
      }),
      prisma.snag.count({ where }),
      prisma.snag.count({ where: { ...where, status: { not: 'closed' } } }),
    ])
    return NextResponse.json({ snags, total, openCount, hasMore: skip + snags.length < total })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch snags' }, { status: 500 })
  }
}

async function POST_impl(req: NextRequest, userId: string, session: { user?: { name?: string | null; email?: string | null } }) {
  const __limited = await enforceRateLimit(req, 'write', userId)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return NextResponse.json({ error: 'Project is required' }, { status: 400 })

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 400 })

    let dueDate: Date | null = null
    if (body.dueDate) {
      const d = new Date(body.dueDate)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 })
      dueDate = d
    }

    const priority = ALLOWED_PRIORITY.has(body.priority) ? body.priority : 'medium'
    const status = ALLOWED_STATUS.has(body.status) ? body.status : 'open'

    const snag = await prisma.snag.create({
      data: {
        title,
        description: body.description?.toString().trim() || null,
        location: body.location?.toString().trim() || null,
        priority,
        status,
        photoUrl: typeof body.photoUrl === 'string' && body.photoUrl ? body.photoUrl : null,
        dueDate,
        projectId,
        closedAt: status === 'closed' ? new Date() : null,
      },
      include: { project: { select: { id: true, name: true } } },
    })

    prisma.activity.create({
      data: {
        projectId: snag.projectId,
        actorName: actorName(session),
        actorType: 'human',
        action: `raised snag: ${snag.title}`,
        iconType: 'alert',
        detail: snag.location || null,
      },
    }).catch(() => {})

    return NextResponse.json(snag, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create snag' }, { status: 500 })
  }
}

export const GET = withRoute(({ req }) => GET_impl(req), { permission: 'read' })
export const POST = withRoute(({ req, userId, session }) => POST_impl(req, userId, session), { permission: 'write' })
