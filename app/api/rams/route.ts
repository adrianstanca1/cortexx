import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPE = new Set(['rams', 'risk_assessment', 'method_statement'])
const ALLOWED_STATUS = new Set(['draft', 'active', 'expired', 'archived'])

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(v as string)
  return isNaN(d.getTime()) ? undefined : d
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    const where = {
      ...(projectId && { projectId }),
      ...(status && ALLOWED_STATUS.has(status) && { status }),
      ...(type && ALLOWED_TYPE.has(type) && { type }),
    }
    const [docs, activeCount, dueForReview] = await Promise.all([
      prisma.rams.findMany({
        where,
        include: { project: { select: { id: true, name: true } } },
        orderBy: [{ status: 'asc' }, { reviewBy: 'asc' }, { updatedAt: 'desc' }],
        take: 200,
      }),
      prisma.rams.count({ where: { ...where, status: 'active' } }),
      prisma.rams.count({
        where: { ...where, status: 'active', reviewBy: { lte: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14) } },
      }),
    ])
    return NextResponse.json({ docs, activeCount, dueForReview })
  } catch (error) {
    console.error('[rams] GET failed:', error)
    return NextResponse.json({ error: 'Failed to fetch RAMS docs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return NextResponse.json({ error: 'Project is required' }, { status: 400 })

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 400 })

    const type = ALLOWED_TYPE.has(body.type) ? body.type : 'rams'
    const status = ALLOWED_STATUS.has(body.status) ? body.status : 'draft'
    const reviewBy = parseDate(body.reviewBy)
    if (reviewBy === undefined && body.reviewBy) return NextResponse.json({ error: 'Invalid reviewBy' }, { status: 400 })

    const doc = await prisma.rams.create({
      data: {
        projectId,
        title: title.slice(0, 200),
        type,
        status,
        hazards: typeof body.hazards === 'string' && body.hazards ? body.hazards.slice(0, 4000) : null,
        controls: typeof body.controls === 'string' && body.controls ? body.controls.slice(0, 4000) : null,
        ppe: typeof body.ppe === 'string' && body.ppe ? body.ppe.slice(0, 1000) : null,
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
        action: `added ${type === 'rams' ? 'RAMS' : type.replace('_', ' ')}: ${doc.title}`,
        iconType: 'doc',
      },
    }).catch(() => {})

    return NextResponse.json(doc, { status: 201 })
  } catch (error) {
    console.error('[rams] POST failed:', error)
    return NextResponse.json({ error: 'Failed to create RAMS doc' }, { status: 500 })
  }
}
