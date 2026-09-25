import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params: paramsP }: { params: Promise<{ id: string }> },
) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canManage(auth.role || '')) {
    return NextResponse.json({ error: 'Company Admin permission required' }, { status: 403 })
  }
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited

  try {
    const body = await req.json()
    const requisition = await prisma.procurementRequisition.findUnique({
      where: { id: params.id },
      include: { rfqs: { select: { id: true, status: true } } },
    })
    if (!requisition) return NextResponse.json({ error: 'Requisition not found' }, { status: 404 })
    if (!['approved', 'rfq_open'].includes(requisition.status)) {
      return NextResponse.json({ error: 'Requisition must be approved before an RFQ can be issued' }, { status: 409 })
    }

    const supplierIds: string[] = Array.from(new Set<string>(
      (Array.isArray(body.supplierIds) ? body.supplierIds : [])
        .map((value: unknown) => String(value || '').trim())
        .filter((value: string) => value.length > 0),
    )).slice(0, 20)
    if (!supplierIds.length) return NextResponse.json({ error: 'Select at least one supplier' }, { status: 400 })

    const suppliers = await prisma.supplier.findMany({
      where: { id: { in: supplierIds }, archivedAt: null },
      select: { id: true, name: true, contactEmail: true },
    })
    if (suppliers.length !== supplierIds.length) {
      return NextResponse.json({ error: 'One or more suppliers are missing or archived' }, { status: 400 })
    }

    let dueAt: Date | null = null
    if (body.dueAt) {
      const parsed = new Date(body.dueAt)
      if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: 'Invalid RFQ due date' }, { status: 400 })
      dueAt = parsed
    }

    const last = await prisma.procurementRfq.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { reference: true },
    })
    const parsed = last ? parseInt(last.reference.split('-').pop() || '0', 10) : 0
    const reference = `RFQ-${String((Number.isFinite(parsed) ? parsed : 0) + 1).padStart(4, '0')}`
    const now = new Date()

    const rfq = await prisma.$transaction(async tx => {
      const created = await tx.procurementRfq.create({
        data: {
          requisitionId: requisition.id,
          reference,
          status: 'sent',
          supplierIds,
          dueAt,
          notes: body.notes?.toString().trim().slice(0, 2000) || null,
          sentAt: now,
        },
        include: {
          requisition: {
            include: {
              project: { select: { id: true, name: true } },
              costCode: { select: { id: true, code: true, name: true } },
            },
          },
          quotes: { include: { supplier: true } },
        },
      })
      if (requisition.status === 'approved') {
        await tx.procurementRequisition.update({
          where: { id: requisition.id },
          data: { status: 'rfq_open' },
        })
      }
      return created
    })

    auditLog({
      action: 'procurementRfq.issue',
      resourceType: 'ProcurementRfq',
      resourceId: rfq.id,
      metadata: { requisitionId: requisition.id, reference, supplierIds, dueAt: dueAt?.toISOString() || null },
      ...requestMeta(req),
    })
    return NextResponse.json({ rfq, invitedSuppliers: suppliers }, { status: 201 })
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'RFQ reference conflict; retry the request' }, { status: 409 })
    }
    reportError(error)
    return NextResponse.json({ error: 'Failed to issue RFQ' }, { status: 500 })
  }
}
