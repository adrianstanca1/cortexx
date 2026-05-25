import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPE = new Set(['hot_work', 'confined_space', 'excavation', 'working_at_height', 'electrical', 'general'])
const ALLOWED_STATUS = new Set(['draft', 'active', 'expired', 'cancelled'])
const ALLOWED_RISK = new Set(['low', 'medium', 'high', 'critical'])

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
    const [permits, activeCount, expiringSoon] = await Promise.all([
      prisma.permit.findMany({
        where,
        include: { project: { select: { id: true, name: true } } },
        orderBy: [{ status: 'asc' }, { validTo: 'asc' }, { updatedAt: 'desc' }],
        take: 200,
      }),
      prisma.permit.count({ where: { ...where, status: 'active' } }),
      prisma.permit.count({
        where: { ...where, status: 'active', validTo: { lte: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3) } },
      }),
    ])
    return NextResponse.json({ permits, activeCount, expiringSoon })
  } catch (error) {
    console.error('[permits] GET failed:', error)
    return NextResponse.json({ error: 'Failed to fetch permits' }, { status: 500 })
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

    const type = ALLOWED_TYPE.has(body.type) ? body.type : 'general'
    const status = ALLOWED_STATUS.has(body.status) ? body.status : 'draft'
    const riskLevel = ALLOWED_RISK.has(body.riskLevel) ? body.riskLevel : 'medium'
    const validFrom = parseDate(body.validFrom)
    const validTo = parseDate(body.validTo)
    if (validFrom === undefined && body.validFrom) return NextResponse.json({ error: 'Invalid validFrom' }, { status: 400 })
    if (validTo === undefined && body.validTo) return NextResponse.json({ error: 'Invalid validTo' }, { status: 400 })
    if (validFrom && validTo && validTo < validFrom) {
      return NextResponse.json({ error: 'validTo must be on or after validFrom' }, { status: 400 })
    }

    const permit = await prisma.permit.create({
      data: {
        projectId,
        title: title.slice(0, 200),
        type,
        status,
        riskLevel,
        location: typeof body.location === 'string' && body.location ? body.location.slice(0, 200) : null,
        issuedBy: typeof body.issuedBy === 'string' && body.issuedBy ? body.issuedBy.slice(0, 100) : actorName(auth),
        issuedTo: typeof body.issuedTo === 'string' && body.issuedTo ? body.issuedTo.slice(0, 100) : null,
        validFrom: (validFrom ?? null) as Date | null,
        validTo: (validTo ?? null) as Date | null,
        conditions: typeof body.conditions === 'string' && body.conditions ? body.conditions.slice(0, 2000) : null,
        notes: typeof body.notes === 'string' && body.notes ? body.notes.slice(0, 1000) : null,
      },
      include: { project: { select: { id: true, name: true } } },
    })

    prisma.activity.create({
      data: {
        projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `raised permit: ${permit.title} (${permit.type.replace(/_/g, ' ')})`,
        iconType: 'alert',
      },
    }).catch(() => {})

    return NextResponse.json(permit, { status: 201 })
  } catch (error) {
    console.error('[permits] POST failed:', error)
    return NextResponse.json({ error: 'Failed to create permit' }, { status: 500 })
  }
}
