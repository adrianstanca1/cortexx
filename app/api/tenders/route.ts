import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { canManageTenders, tenderWhere } from '@/lib/tenderAccess'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set(['draft', 'submitted', 'won', 'lost', 'withdrawn'])

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(v as string)
  return isNaN(d.getTime()) ? undefined : d
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canManageTenders(auth)) return NextResponse.json({ error: 'Company commercial admin required' }, { status: 403 })
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const where = {
      ...tenderWhere(auth),
      ...(status && ALLOWED_STATUS.has(status) && { status }),
    }
    const [tenders, draftCount, openValueAgg] = await Promise.all([
      prisma.tender.findMany({
        where,
        include: { project: { select: { id: true, name: true } } },
        orderBy: [{ status: 'asc' }, { deadline: 'asc' }, { updatedAt: 'desc' }],
        take: 200,
      }),
      prisma.tender.count({ where: { ...tenderWhere(auth), status: 'draft' } }),
      prisma.tender.aggregate({
        _sum: { totalValue: true },
        where: { ...tenderWhere(auth), status: { in: ['draft', 'submitted'] } },
      }),
    ])
    return NextResponse.json({
      tenders,
      draftCount,
      pipelineValue: openValueAgg._sum.totalValue ?? 0,
    })
  } catch (error) {
    reportError(error, { context: 'tenders.list' })
    return NextResponse.json({ error: 'Failed to fetch tenders' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canManageTenders(auth)) return NextResponse.json({ error: 'Company commercial admin required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  try {
    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return NextResponse.json({ error: 'Invalid tender input' }, { status: 400 })
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    let projectId: string | null = null
    if (body.projectId) {
      projectId = String(body.projectId).trim() || null
      if (projectId) {
        const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: auth.orgId! }, select: { id: true } })
        if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 400 })
      }
    }

    const status = ALLOWED_STATUS.has(body.status) ? body.status : 'draft'
    const deadline = parseDate(body.deadline)
    if (deadline === undefined && body.deadline) return NextResponse.json({ error: 'Invalid deadline' }, { status: 400 })

    const totalValueRaw = Number(body.totalValue ?? 0)
    if (!isFinite(totalValueRaw) || totalValueRaw < 0 || totalValueRaw > 1_000_000_000) {
      return NextResponse.json({ error: 'Invalid totalValue' }, { status: 400 })
    }

    const tender = await prisma.tender.create({
      data: {
        projectId,
        organizationId: auth.orgId!,
        title: title.slice(0, 200),
        clientName: typeof body.clientName === 'string' && body.clientName ? body.clientName.slice(0, 200) : null,
        status,
        totalValue: totalValueRaw,
        deadline: (deadline ?? null) as Date | null,
        submittedAt: status === 'submitted' ? new Date() : null,
        decidedAt: status === 'won' || status === 'lost' ? new Date() : null,
        notes: typeof body.notes === 'string' && body.notes ? body.notes.slice(0, 2000) : null,
      },
      include: { project: { select: { id: true, name: true } } },
    })

    if (projectId) {
      prisma.activity.create({
        data: {
          projectId,
          actorName: actorName(auth.session),
          actorType: 'human',
          action: `added tender: ${tender.title}`,
          iconType: 'doc',
        },
      }).catch(() => {})
    }

    auditLog({ action: 'tender.create', resourceType: 'Tender', resourceId: tender.id,
      userId: auth.userId, ...requestMeta(req) })
    return NextResponse.json(tender, { status: 201 })
  } catch (error) {
    reportError(error, { context: 'tenders.create' })
    return NextResponse.json({ error: 'Failed to create tender' }, { status: 500 })
  }
}
