import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const ALLOWED_CATEGORY = new Set(['operational', 'financial', 'schedule', 'safety', 'quality', 'environmental'])
const ALLOWED_STATUS = new Set(['open', 'mitigated', 'accepted', 'closed'])

function clamp1to5(v: unknown): number {
  const n = Number(v)
  if (!isFinite(n)) return 3
  return Math.max(1, Math.min(5, Math.round(n)))
}

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(v as string); return isNaN(d.getTime()) ? undefined : d
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const category = searchParams.get('category')

    const where = {
      ...(projectId && { projectId }),
      ...(status && ALLOWED_STATUS.has(status) && { status }),
      ...(category && ALLOWED_CATEGORY.has(category) && { category }),
    }
    const [risks, openCount, highSeverityCount] = await Promise.all([
      prisma.risk.findMany({
        where,
        include: { project: { select: { id: true, name: true } } },
        orderBy: [{ status: 'asc' }, { score: 'desc' }],
        take: 200,
      }),
      prisma.risk.count({ where: { ...where, status: 'open' } }),
      prisma.risk.count({ where: { ...where, status: { not: 'closed' }, score: { gte: 15 } } }),
    ])
    return NextResponse.json({ risks, openCount, highSeverityCount })
  } catch (error) {
    console.error('[risks] GET failed:', error)
    return NextResponse.json({ error: 'Failed to fetch risks' }, { status: 500 })
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

    const category = ALLOWED_CATEGORY.has(body.category) ? body.category : 'operational'
    const likelihood = clamp1to5(body.likelihood)
    const impact = clamp1to5(body.impact)
    const score = likelihood * impact
    const reviewBy = parseDate(body.reviewBy)
    if (reviewBy === undefined && body.reviewBy) return NextResponse.json({ error: 'Invalid reviewBy' }, { status: 400 })

    const risk = await prisma.risk.create({
      data: {
        projectId,
        title: title.slice(0, 200),
        category,
        likelihood,
        impact,
        score,
        mitigation: typeof body.mitigation === 'string' && body.mitigation ? body.mitigation.slice(0, 2000) : null,
        owner: typeof body.owner === 'string' && body.owner ? body.owner.slice(0, 100) : actorName(auth),
        status: 'open',
        reviewBy: (reviewBy ?? null) as Date | null,
        notes: typeof body.notes === 'string' && body.notes ? body.notes.slice(0, 2000) : null,
      },
      include: { project: { select: { id: true, name: true } } },
    })

    prisma.activity.create({
      data: {
        projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `logged ${score >= 15 ? 'HIGH' : ''} risk: ${risk.title} (${likelihood}×${impact}=${score})`,
        iconType: score >= 15 ? 'alert' : 'check',
      },
    }).catch(() => {})

    return NextResponse.json(risk, { status: 201 })
  } catch (error) {
    console.error('[risks] POST failed:', error)
    return NextResponse.json({ error: 'Failed to create risk' }, { status: 500 })
  }
}
