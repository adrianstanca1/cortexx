import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100
const ALLOWED_TYPE = new Set(['positive', 'improvement', 'unsafe', 'near_miss'])
const ALLOWED_STATUS = new Set(['open', 'resolved'])

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const take = Math.min(parseInt(searchParams.get('take') || '50') || 50, MAX_TAKE)

    const where = {
      ...(projectId && { projectId }),
      ...(type && ALLOWED_TYPE.has(type) && { type }),
      ...(status && ALLOWED_STATUS.has(status) && { status }),
    }
    const [observations, openCount, unsafeOpenCount] = await Promise.all([
      prisma.observation.findMany({
        where,
        include: { project: { select: { id: true, name: true } } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take,
      }),
      prisma.observation.count({ where: { ...where, status: 'open' } }),
      prisma.observation.count({ where: { ...where, status: 'open', type: { in: ['unsafe', 'near_miss'] } } }),
    ])
    return NextResponse.json({ observations, openCount, unsafeOpenCount })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch observations' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return NextResponse.json({ error: 'Project is required' }, { status: 400 })

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 400 })

    const type = ALLOWED_TYPE.has(body.type) ? body.type : 'positive'

    const observation = await prisma.observation.create({
      data: {
        projectId,
        type,
        title,
        description: body.description?.toString().trim() || null,
        location: body.location?.toString().trim() || null,
        reportedBy: body.reportedBy?.toString().trim() || actorName(auth),
        photoUrl: typeof body.photoUrl === 'string' && body.photoUrl ? body.photoUrl : null,
        status: 'open',
      },
      include: { project: { select: { id: true, name: true } } },
    })

    prisma.activity.create({
      data: {
        projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `logged ${type.replace('_', ' ')} observation: ${title}`,
        iconType: type === 'unsafe' || type === 'near_miss' ? 'alert' : 'check',
      },
    }).catch(() => {})

    return NextResponse.json(observation, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create observation' }, { status: 500 })
  }
}
