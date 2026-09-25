import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { canWrite } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import procurementRfq from '@/lib/procurement-rfq'

export const dynamic = 'force-dynamic'
const ALLOWED_STATUS = new Set(['draft', 'submitted', 'approved', 'rejected', 'rfq_open', 'converted', 'cancelled'])
const { normalizeProcurementItems, money } = procurementRfq

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const projectId = searchParams.get('projectId')
    const requisitions = await prisma.procurementRequisition.findMany({
      where: {
        ...(projectId && { projectId }),
        ...(status && ALLOWED_STATUS.has(status) && { status }),
      },
      include: {
        project: { select: { id: true, name: true } },
        costCode: { select: { id: true, code: true, name: true } },
        rfqs: {
          select: {
            id: true, reference: true, status: true, dueAt: true,
            _count: { select: { quotes: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        purchaseOrder: { select: { id: true, number: true, status: true, total: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    })
    return NextResponse.json({ requisitions })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch requisitions' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited

  try {
    const body = await req.json()
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return NextResponse.json({ error: 'Project is required' }, { status: 400 })
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 400 })

    let costCodeId = body.costCodeId ? String(body.costCodeId) : null
    if (costCodeId) {
      const code = await prisma.costCode.findUnique({ where: { id: costCodeId }, select: { id: true, archivedAt: true } })
      if (!code || code.archivedAt) return NextResponse.json({ error: 'Cost code not found or archived' }, { status: 400 })
      costCodeId = code.id
    }

    const lineItems = normalizeProcurementItems(body.lineItems)
    if (!lineItems.length) return NextResponse.json({ error: 'At least one valid item is required' }, { status: 400 })
    const estimatedNet = money(lineItems.reduce((sum: number, row: { total?: number }) => sum + Number(row.total || 0), 0))

    let neededBy: Date | null = null
    if (body.neededBy) {
      const parsed = new Date(body.neededBy)
      if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: 'Invalid needed-by date' }, { status: 400 })
      neededBy = parsed
    }

    const last = await prisma.procurementRequisition.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { number: true },
    })
    const parsed = last ? parseInt(last.number.split('-').pop() || '0', 10) : 0
    const number = `REQ-${String((Number.isFinite(parsed) ? parsed : 0) + 1).padStart(4, '0')}`

    const requisition = await prisma.procurementRequisition.create({
      data: {
        number,
        projectId,
        costCodeId,
        requestedBy: actorName(auth.session),
        neededBy,
        lineItems: lineItems as unknown as object,
        estimatedNet,
        notes: body.notes?.toString().trim().slice(0, 2000) || null,
      },
      include: {
        project: { select: { id: true, name: true } },
        costCode: { select: { id: true, code: true, name: true } },
      },
    })

    auditLog({
      action: 'procurementRequisition.create',
      resourceType: 'ProcurementRequisition',
      resourceId: requisition.id,
      metadata: { projectId, costCodeId, estimatedNet, itemCount: lineItems.length },
      ...requestMeta(req),
    })
    return NextResponse.json(requisition, { status: 201 })
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'Requisition number conflict; retry the request' }, { status: 409 })
    }
    reportError(error)
    return NextResponse.json({ error: 'Failed to create requisition' }, { status: 500 })
  }
}
