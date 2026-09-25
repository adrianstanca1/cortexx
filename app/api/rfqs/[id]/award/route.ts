import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
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
    const quoteId = String(body.quoteId || '').trim()
    if (!quoteId) return NextResponse.json({ error: 'Select a supplier quote' }, { status: 400 })
    const now = new Date()

    const purchaseOrder = await prisma.$transaction(async tx => {
      const rfq = await tx.procurementRfq.findUnique({
        where: { id: params.id },
        include: {
          requisition: {
            include: {
              project: { select: { id: true, name: true } },
              purchaseOrder: { select: { id: true, number: true } },
            },
          },
          quotes: {
            include: {
              supplier: {
                select: {
                  id: true, name: true, contactEmail: true, contactPhone: true,
                  archivedAt: true,
                },
              },
            },
          },
        },
      })
      if (!rfq) throw new Error('RFQ_NOT_FOUND')
      if (!['sent', 'closed'].includes(rfq.status)) throw new Error('RFQ_NOT_OPEN')
      if (rfq.requisition.purchaseOrder) throw new Error('REQUISITION_ALREADY_CONVERTED')

      const quote = rfq.quotes.find(row => row.id === quoteId)
      if (!quote || quote.status !== 'received') throw new Error('QUOTE_NOT_AVAILABLE')
      if (quote.supplier.archivedAt) throw new Error('SUPPLIER_ARCHIVED')
      if (!Array.isArray(quote.lineItems) || quote.lineItems.length === 0 || quote.netAmount <= 0) {
        throw new Error('QUOTE_NOT_PRICED')
      }

      const last = await tx.purchaseOrder.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { number: true },
      })
      const parsed = last ? parseInt(last.number.split('-').pop() || '0', 10) : 0
      const number = `PO-${String((Number.isFinite(parsed) ? parsed : 0) + 1).padStart(4, '0')}`
      const expectedDelivery = quote.leadDays === null
        ? null
        : new Date(now.getTime() + quote.leadDays * 24 * 60 * 60 * 1000)

      const po = await tx.purchaseOrder.create({
        data: {
          number,
          projectId: rfq.requisition.projectId,
          costCodeId: rfq.requisition.costCodeId,
          requisitionId: rfq.requisition.id,
          supplierQuoteId: quote.id,
          supplierId: quote.supplier.id,
          supplier: quote.supplier.name,
          contactEmail: quote.supplier.contactEmail,
          contactPhone: quote.supplier.contactPhone,
          status: 'approved',
          lineItems: quote.lineItems as unknown as object,
          subtotal: quote.netAmount,
          vatRate: quote.vatRate,
          vatAmount: quote.vatAmount,
          total: quote.totalAmount,
          expectedDelivery,
          approvedAt: now,
          approvedBy: actorName(auth.session),
          notes: `Awarded from ${rfq.reference}${quote.reference ? ` · supplier quote ${quote.reference}` : ''}`,
        },
        include: {
          project: { select: { id: true, name: true } },
          costCode: { select: { id: true, code: true, name: true } },
          supplierRef: { select: { id: true, name: true, category: true } },
        },
      })

      await tx.supplierQuote.update({
        where: { id: quote.id },
        data: { status: 'awarded', awardedAt: now },
      })
      await tx.supplierQuote.updateMany({
        where: { rfqId: rfq.id, id: { not: quote.id }, status: 'received' },
        data: { status: 'not_selected' },
      })
      await tx.procurementRfq.update({
        where: { id: rfq.id },
        data: { status: 'awarded', closedAt: now },
      })
      await tx.procurementRequisition.update({
        where: { id: rfq.requisition.id },
        data: { status: 'converted' },
      })
      await tx.activity.create({
        data: {
          projectId: rfq.requisition.projectId,
          actorName: actorName(auth.session),
          actorType: 'human',
          action: `awarded ${rfq.reference} to ${quote.supplier.name} as ${po.number}`,
          detail: `£${quote.totalAmount.toFixed(2)} including VAT`,
          iconType: 'doc',
        },
      })
      return po
    })

    auditLog({
      action: 'procurementRfq.award',
      resourceType: 'ProcurementRfq',
      resourceId: params.id,
      metadata: {
        quoteId,
        purchaseOrderId: purchaseOrder.id,
        purchaseOrderNumber: purchaseOrder.number,
        supplierId: purchaseOrder.supplierId,
        total: purchaseOrder.total,
      },
      ...requestMeta(req),
    })
    return NextResponse.json({ purchaseOrder }, { status: 201 })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    const known: Record<string, string> = {
      RFQ_NOT_FOUND: 'RFQ not found',
      RFQ_NOT_OPEN: 'RFQ is not open for award',
      REQUISITION_ALREADY_CONVERTED: 'This requisition already has a purchase order',
      QUOTE_NOT_AVAILABLE: 'Supplier quote is not available for award',
      SUPPLIER_ARCHIVED: 'Supplier is archived',
      QUOTE_NOT_PRICED: 'Supplier quote has no valid priced lines',
    }
    if (known[code]) return NextResponse.json({ error: known[code], code }, { status: code === 'RFQ_NOT_FOUND' ? 404 : 409 })
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'Purchase order number conflict; retry the award' }, { status: 409 })
    }
    reportError(error)
    return NextResponse.json({ error: 'Failed to award RFQ' }, { status: 500 })
  }
}
