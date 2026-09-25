import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { canWrite } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import procurementControl from '@/lib/procurement-control'

export const dynamic = 'force-dynamic'
const { receiptValue } = procurementControl
const RECEIVABLE_STATUS = new Set(['sent', 'part_received'])

export async function GET(
  _req: NextRequest,
  { params: paramsP }: { params: Promise<{ id: string }> },
) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth

  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: params.id },
      select: { id: true, number: true },
    })
    if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })

    const receipts = await prisma.goodsReceipt.findMany({
      where: { purchaseOrderId: params.id },
      orderBy: { deliveredAt: 'desc' },
    })
    return NextResponse.json({
      receipts,
      netReceived: receipts.reduce((sum, row) => sum + row.netReceived, 0),
    })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch goods receipts' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params: paramsP }: { params: Promise<{ id: string }> },
) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  if (!canWrite(auth.role || '')) {
    return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  }
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited

  try {
    const body = await req.json()
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: params.id },
      include: {
        goodsReceipts: { select: { lineItems: true } },
        project: { select: { id: true } },
      },
    })
    if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    if (!RECEIVABLE_STATUS.has(po.status)) {
      return NextResponse.json({ error: 'PO must be sent before goods can be received' }, { status: 409 })
    }

    let deliveredAt = new Date()
    if (body.deliveredAt) {
      deliveredAt = new Date(body.deliveredAt)
      if (Number.isNaN(deliveredAt.getTime())) {
        return NextResponse.json({ error: 'Invalid deliveredAt' }, { status: 400 })
      }
    }

    const valuation = receiptValue(
      Array.isArray(po.lineItems) ? po.lineItems : [],
      body.lineItems,
      po.goodsReceipts,
    )
    const receivedBy = body.receivedBy?.toString().trim() || actorName(auth.session)

    const result = await prisma.$transaction(async tx => {
      const receipt = await tx.goodsReceipt.create({
        data: {
          purchaseOrderId: po.id,
          deliveryNote: body.deliveryNote?.toString().trim() || null,
          deliveredAt,
          receivedBy,
          lineItems: valuation.lineItems as unknown as object,
          netReceived: valuation.netReceived,
          notes: body.notes?.toString().trim() || null,
          organizationId: auth.orgId,
        },
      })
      const updated = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: valuation.fullyReceived ? 'received' : 'part_received',
          receivedAt: valuation.fullyReceived ? deliveredAt : null,
        },
      })
      return { receipt, po: updated }
    })

    if (po.projectId) {
      prisma.activity.create({
        data: {
          projectId: po.projectId,
          actorName: receivedBy,
          actorType: 'human',
          action: `${valuation.fullyReceived ? 'received' : 'part-received'} ${po.number} delivery`,
          detail: result.receipt.deliveryNote || undefined,
          iconType: 'check',
        },
      }).catch(() => {})
    }

    auditLog({
      action: 'goodsReceipt.create',
      resourceType: 'GoodsReceipt',
      resourceId: result.receipt.id,
      metadata: {
        purchaseOrderId: po.id,
        purchaseOrderNumber: po.number,
        netReceived: valuation.netReceived,
        fullyReceived: valuation.fullyReceived,
      },
      ...requestMeta(req),
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    if (['PO_HAS_NO_LINE_ITEMS', 'RECEIPT_LINES_REQUIRED', 'INVALID_LINE_INDEX', 'INVALID_RECEIPT_QUANTITY', 'OVER_RECEIPT'].includes(code)) {
      const message = code === 'OVER_RECEIPT'
        ? 'Received quantity exceeds the outstanding PO quantity'
        : 'Invalid goods receipt lines'
      return NextResponse.json({ error: message, code }, { status: 409 })
    }
    reportError(error)
    return NextResponse.json({ error: 'Failed to record delivery' }, { status: 500 })
  }
}
