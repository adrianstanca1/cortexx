import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { canWrite, canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import procurementRfq from '@/lib/procurement-rfq'

export const dynamic = 'force-dynamic'
const { normalizeProcurementItems, money, canTransitionRequisition } = procurementRfq
const EDITABLE = new Set(['draft', 'rejected'])
const SYSTEM_STATUSES = new Set(['rfq_open', 'converted'])

export async function PUT(
  req: NextRequest,
  { params: paramsP }: { params: Promise<{ id: string }> },
) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited

  try {
    const body = await req.json()
    const existing = await prisma.procurementRequisition.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Requisition not found' }, { status: 404 })

    const manager = canManage(auth.role || '')
    const data: Record<string, unknown> = {}
    const commercialKeys = ['costCodeId', 'neededBy', 'lineItems', 'notes']
    if (commercialKeys.some(key => body[key] !== undefined) && !EDITABLE.has(existing.status)) {
      return NextResponse.json({ error: 'Submitted requisitions are immutable; reject or create a new revision' }, { status: 409 })
    }

    if (body.costCodeId !== undefined) {
      const costCodeId = body.costCodeId ? String(body.costCodeId) : null
      if (costCodeId) {
        const code = await prisma.costCode.findUnique({ where: { id: costCodeId }, select: { id: true, archivedAt: true } })
        if (!code || code.archivedAt) return NextResponse.json({ error: 'Cost code not found or archived' }, { status: 400 })
      }
      data.costCodeId = costCodeId
    }
    if (body.neededBy !== undefined) {
      if (body.neededBy) {
        const parsed = new Date(body.neededBy)
        if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: 'Invalid needed-by date' }, { status: 400 })
        data.neededBy = parsed
      } else data.neededBy = null
    }
    if (body.notes !== undefined) data.notes = body.notes?.toString().trim().slice(0, 2000) || null
    if (body.lineItems !== undefined) {
      const lineItems = normalizeProcurementItems(body.lineItems)
      if (!lineItems.length) return NextResponse.json({ error: 'At least one valid item is required' }, { status: 400 })
      data.lineItems = lineItems as unknown as object
      data.estimatedNet = money(lineItems.reduce((sum: number, row: { total?: number }) => sum + Number(row.total || 0), 0))
    }

    if (body.status !== undefined) {
      const status = String(body.status)
      if (SYSTEM_STATUSES.has(status)) {
        return NextResponse.json({ error: 'Use the RFQ or award workflow for this status' }, { status: 409 })
      }
      if (!canTransitionRequisition(existing.status, status, manager)) {
        return NextResponse.json({ error: `Transition ${existing.status} → ${status} is not permitted` }, { status: 409 })
      }
      const now = new Date()
      data.status = status
      if (status === 'submitted') data.submittedAt = now
      if (status === 'approved') {
        data.approvedAt = now
        data.approvedBy = actorName(auth.session)
        data.rejectedAt = null
        data.rejectionReason = null
      }
      if (status === 'rejected') {
        data.rejectedAt = now
        data.rejectionReason = body.rejectionReason?.toString().trim().slice(0, 500) || 'Approval rejected'
      }
      if (status === 'draft') {
        data.submittedAt = null
        data.approvedAt = null
        data.approvedBy = null
        data.rejectedAt = null
        data.rejectionReason = null
      }
    }

    const requisition = await prisma.procurementRequisition.update({
      where: { id: params.id },
      data,
      include: {
        project: { select: { id: true, name: true } },
        costCode: { select: { id: true, code: true, name: true } },
        rfqs: { select: { id: true, reference: true, status: true, dueAt: true } },
        purchaseOrder: { select: { id: true, number: true, status: true, total: true } },
      },
    })

    auditLog({
      action: 'procurementRequisition.update',
      resourceType: 'ProcurementRequisition',
      resourceId: requisition.id,
      metadata: { fromStatus: existing.status, toStatus: requisition.status, estimatedNet: requisition.estimatedNet },
      ...requestMeta(req),
    })
    return NextResponse.json(requisition)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update requisition' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params: paramsP }: { params: Promise<{ id: string }> },
) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  try {
    const existing = await prisma.procurementRequisition.findUnique({ where: { id: params.id }, select: { id: true, status: true } })
    if (!existing) return NextResponse.json({ error: 'Requisition not found' }, { status: 404 })
    if (!EDITABLE.has(existing.status)) return NextResponse.json({ error: 'Submitted requisitions are retained for audit' }, { status: 409 })
    await prisma.procurementRequisition.delete({ where: { id: params.id } })
    auditLog({
      action: 'procurementRequisition.delete',
      resourceType: 'ProcurementRequisition',
      resourceId: params.id,
      metadata: { status: existing.status },
      ...requestMeta(req),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete requisition' }, { status: 500 })
  }
}
