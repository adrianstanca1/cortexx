import procurementControl from '@/lib/procurement-control'

type ProcurementDb = {
  purchaseOrder: { findFirst(args: any): Promise<any> }
  subInvoice: { aggregate(args: any): Promise<any> }
}
const { evaluateThreeWayMatch } = procurementControl

export async function purchaseOrderMatch(
  db: ProcurementDb,
  organizationId: string,
  purchaseOrderId: string,
  invoiceNet: number,
  excludeInvoiceId?: string,
) {
  const [po, approved] = await Promise.all([
    db.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, organizationId },
      include: { goodsReceipts: { select: { netReceived: true } } },
    }),
    db.subInvoice.aggregate({
      where: {
        organizationId,
        purchaseOrderId,
        status: { in: ['approved', 'paid'] },
        ...(excludeInvoiceId && { id: { not: excludeInvoiceId } }),
      },
      _sum: { netAmount: true },
    }),
  ])

  if (!po) throw new Error('PURCHASE_ORDER_NOT_FOUND')

  const receivedNet = po.goodsReceipts.reduce((sum: number, row: { netReceived: number }) => sum + row.netReceived, 0)
  const match = evaluateThreeWayMatch({
    orderedNet: po.subtotal,
    receivedNet,
    previousApprovedNet: approved._sum.netAmount || 0,
    invoiceNet,
  })

  return {
    ...match,
    purchaseOrderId: po.id,
    purchaseOrderNumber: po.number,
    purchaseOrderStatus: po.status,
  }
}

export function throwThreeWayMismatch(match: { status: string }) {
  const error = new Error('THREE_WAY_MATCH_FAILED') as Error & {
    code?: string
    match?: unknown
  }
  error.code = 'THREE_WAY_MATCH_FAILED'
  error.match = match
  throw error
}
