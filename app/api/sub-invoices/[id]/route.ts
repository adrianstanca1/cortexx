import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import costLedger from '@/lib/cost-ledger'
import { postSourceCost, voidSourceCost } from '@/lib/cost-ledger-server'

export const dynamic = 'force-dynamic'
const ALLOWED_STATUS = new Set(['received', 'approved', 'paid', 'disputed'])
const { subInvoicePosting } = costLedger

function financialGuard(role: string | null) { return !!role && canManage(role) }

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  const orgId = auth.orgId
  if (!financialGuard(auth.role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  try {
    const body = await req.json()
    const existing = await prisma.subInvoice.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const data: Record<string, unknown> = {}
    if (body.description !== undefined) data.description = body.description?.toString().trim() || null
    if (body.notes !== undefined) data.notes = body.notes?.toString().trim() || null

    if (body.purchaseOrderId !== undefined) {
      const purchaseOrderId = body.purchaseOrderId ? String(body.purchaseOrderId) : null
      if (purchaseOrderId) {
        const po = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, select: { id: true, projectId: true, costCodeId: true } })
        if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 400 })
        if (existing.projectId && po.projectId && existing.projectId !== po.projectId) return NextResponse.json({ error: 'Purchase order belongs to a different project' }, { status: 409 })
        if (body.costCodeId === undefined && po.costCodeId) data.costCodeId = po.costCodeId
      }
      data.purchaseOrderId = purchaseOrderId
    }
    if (body.costCodeId !== undefined) {
      const costCodeId = body.costCodeId ? String(body.costCodeId) : null
      if (costCodeId) {
        const code = await prisma.costCode.findUnique({ where: { id: costCodeId }, select: { id: true, archivedAt: true } })
        if (!code || code.archivedAt) return NextResponse.json({ error: 'Cost code not found or archived' }, { status: 400 })
      }
      data.costCodeId = costCodeId
    }
    if (body.status !== undefined) {
      const status = String(body.status)
      if (!ALLOWED_STATUS.has(status)) return NextResponse.json({ error: 'Invalid invoice status' }, { status: 400 })
      data.status = status
      if (status === 'paid' && !existing.paidAt) data.paidAt = new Date()
      if (status !== 'paid' && existing.paidAt) data.paidAt = null
    }

    const targetStatus = typeof data.status === 'string' ? data.status : existing.status
    if (['approved', 'paid'].includes(targetStatus) && !existing.projectId) return NextResponse.json({ error: 'Assign the invoice to a project before approval' }, { status: 409 })

    const invoice = await prisma.$transaction(async tx => {
      const updated = await tx.subInvoice.update({
        where: { id: params.id }, data,
        include: {
          subcontractor: { select: { id: true, name: true, trade: true, cisStatus: true } },
          project: { select: { id: true, name: true } },
          purchaseOrder: { select: { id: true, number: true, costCodeId: true } },
          costCode: { select: { id: true, code: true, name: true } },
        },
      })
      if (['approved', 'paid'].includes(updated.status) && updated.projectId) {
        const amounts = subInvoicePosting(updated as unknown as Record<string, unknown>)
        await postSourceCost(tx, {
          organizationId: orgId, projectId: updated.projectId, sourceType: 'sub_invoice', sourceId: updated.id,
          sourceReference: updated.number, description: `Subcontract invoice ${updated.number} · ${updated.subcontractor.name}`,
          netAmount: amounts.netAmount, vatAmount: amounts.vatAmount, grossAmount: amounts.grossAmount,
          costCodeId: updated.costCodeId, occurredAt: updated.invoiceDate, notes: updated.notes,
        })
      } else {
        await voidSourceCost(tx, orgId, 'sub_invoice', updated.id)
      }
      return updated
    })
    auditLog({ action: 'subInvoice.update', resourceType: 'SubInvoice', resourceId: invoice.id, metadata: { status: invoice.status, purchaseOrderId: invoice.purchaseOrderId, costCodeId: invoice.costCodeId }, ...requestMeta(req) })
    return NextResponse.json(invoice)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!financialGuard(auth.role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  try {
    const posted = await prisma.projectCostEntry.findFirst({ where: { sourceType: 'sub_invoice', sourceId: params.id, status: 'posted' }, select: { id: true } })
    if (posted) return NextResponse.json({ error: 'Approved/posted invoices are retained for audit; dispute the invoice before deletion' }, { status: 409 })
    await prisma.subInvoice.delete({ where: { id: params.id } })
    auditLog({ action: 'subInvoice.delete', resourceType: 'SubInvoice', resourceId: params.id, ...requestMeta(req) })
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
