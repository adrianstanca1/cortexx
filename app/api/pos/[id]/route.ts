import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { canWrite, canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import procurementControl from '@/lib/procurement-control'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set([
  'draft', 'pending_approval', 'rejected', 'approved',
  'sent', 'part_received', 'received', 'closed', 'cancelled',
])
const EDITABLE_STATUS = new Set(['draft', 'rejected'])
const { canTransitionPurchaseOrder } = procurementControl

interface LineItem {
  description: string
  quantity: number
  unit?: string
  unitPrice: number
  total: number
}

function recalc(lineItems: LineItem[], vatRate: number) {
  const subtotal = lineItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
  const vatAmount = subtotal * (vatRate / 100)
  return { subtotal, vatAmount, total: subtotal + vatAmount }
}

function validateLineItems(raw: unknown): LineItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map(item => {
    if (!item || typeof item !== 'object') return null
    const value = item as Record<string, unknown>
    const description = String(value.description || '').trim()
    const quantity = Number(value.quantity)
    const unitPrice = Number(value.unitPrice)
    if (!description || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return null
    return {
      description,
      quantity,
      unit: value.unit ? String(value.unit) : undefined,
      unitPrice,
      total: quantity * unitPrice,
    } as LineItem
  }).filter((item): item is LineItem => item !== null)
}

export async function PUT(
  req: NextRequest,
  { params: paramsP }: { params: Promise<{ id: string }> },
) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) {
    return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  }
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited

  try {
    const body = await req.json()
    const existing = await prisma.purchaseOrder.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const manager = canManage(auth.role || '')
    const data: Record<string, unknown> = {}
    const commercialFields = [
      'supplier', 'supplierId', 'contactEmail', 'contactPhone',
      'notes', 'costCodeId', 'vatRate', 'lineItems', 'expectedDelivery',
    ]
    const modifiesCommercial = commercialFields.some(key => body[key] !== undefined)
    if (modifiesCommercial && !EDITABLE_STATUS.has(existing.status)) {
      return NextResponse.json({
        error: 'Approved or issued POs are immutable; revise via a new draft instead',
      }, { status: 409 })
    }

    if (body.supplierId !== undefined) {
      const supplierId = body.supplierId ? String(body.supplierId) : null
      if (supplierId) {
        const supplier = await prisma.supplier.findUnique({
          where: { id: supplierId },
          select: { id: true, name: true, contactEmail: true, contactPhone: true, archivedAt: true },
        })
        if (!supplier || supplier.archivedAt) {
          return NextResponse.json({ error: 'Supplier not found or archived' }, { status: 400 })
        }
        data.supplierId = supplier.id
        data.supplier = supplier.name
        if (body.contactEmail === undefined) data.contactEmail = supplier.contactEmail
        if (body.contactPhone === undefined) data.contactPhone = supplier.contactPhone
      } else {
        data.supplierId = null
      }
    }

    if (body.supplier !== undefined) {
      const supplier = String(body.supplier).trim()
      if (!supplier) return NextResponse.json({ error: 'Supplier is required' }, { status: 400 })
      data.supplier = supplier
    }
    if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail?.toString().trim() || null
    if (body.contactPhone !== undefined) data.contactPhone = body.contactPhone?.toString().trim() || null
    if (body.notes !== undefined) data.notes = body.notes?.toString().trim() || null

    if (body.costCodeId !== undefined) {
      const costCodeId = body.costCodeId ? String(body.costCodeId) : null
      if (costCodeId) {
        const code = await prisma.costCode.findUnique({
          where: { id: costCodeId },
          select: { id: true, archivedAt: true },
        })
        if (!code || code.archivedAt) {
          return NextResponse.json({ error: 'Cost code not found or archived' }, { status: 400 })
        }
      }
      data.costCodeId = costCodeId
    }

    if (body.vatRate !== undefined) {
      const vatRate = Number(body.vatRate)
      if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
        return NextResponse.json({ error: 'VAT 0-100' }, { status: 400 })
      }
      data.vatRate = vatRate
    }

    if (body.lineItems !== undefined) {
      const items = validateLineItems(body.lineItems)
      if (!items.length) {
        return NextResponse.json({ error: 'At least one valid line item is required' }, { status: 400 })
      }
      data.lineItems = items as unknown as object
    }

    if (body.lineItems !== undefined || body.vatRate !== undefined) {
      const items = body.lineItems !== undefined
        ? data.lineItems as unknown as LineItem[]
        : Array.isArray(existing.lineItems)
          ? existing.lineItems as unknown as LineItem[]
          : []
      const vatRate = data.vatRate !== undefined ? Number(data.vatRate) : existing.vatRate
      Object.assign(data, recalc(items, vatRate))
    }

    if (body.expectedDelivery !== undefined) {
      if (body.expectedDelivery) {
        const date = new Date(body.expectedDelivery)
        if (Number.isNaN(date.getTime())) {
          return NextResponse.json({ error: 'Invalid expectedDelivery' }, { status: 400 })
        }
        data.expectedDelivery = date
      } else {
        data.expectedDelivery = null
      }
    }

    if (body.status !== undefined) {
      const status = String(body.status)
      if (!ALLOWED_STATUS.has(status)) {
        return NextResponse.json({ error: 'Invalid PO status' }, { status: 400 })
      }
      if (!canTransitionPurchaseOrder(existing.status, status, manager)) {
        return NextResponse.json({
          error: `Transition ${existing.status} → ${status} is not permitted`,
        }, { status: 409 })
      }

      const now = new Date()
      data.status = status
      if (status === 'pending_approval') data.approvalRequestedAt = now
      if (status === 'approved') {
        const approvalSubtotal = data.subtotal !== undefined ? Number(data.subtotal) : existing.subtotal
        if (approvalSubtotal <= 0) {
          return NextResponse.json({ error: 'Cannot approve a zero-value PO' }, { status: 409 })
        }
        data.approvedAt = now
        data.approvedBy = actorName(auth.session)
        data.rejectedAt = null
        data.rejectionReason = null
      }
      if (status === 'rejected') {
        data.rejectedAt = now
        data.rejectionReason = body.rejectionReason?.toString().trim() || 'Approval rejected'
      }
      if (status === 'sent' && !existing.sentAt) data.sentAt = now
      if (status === 'closed' && !existing.closedAt) data.closedAt = now
      if (status === 'draft') {
        data.approvalRequestedAt = null
        data.approvedAt = null
        data.approvedBy = null
        data.rejectedAt = null
        data.rejectionReason = null
        data.sentAt = null
        data.closedAt = null
      }
    }

    const po = await prisma.purchaseOrder.update({
      where: { id: params.id },
      data,
      include: {
        project: { select: { id: true, name: true } },
        costCode: { select: { id: true, code: true, name: true } },
        supplierRef: { select: { id: true, name: true, category: true } },
        requisition: { select: { id: true, number: true, status: true } },
        supplierQuote: { select: { id: true, reference: true, rfq: { select: { id: true, reference: true } } } },
        goodsReceipts: { orderBy: { deliveredAt: 'desc' } },
      },
    })

    auditLog({
      action: 'purchaseOrder.update',
      resourceType: 'PurchaseOrder',
      resourceId: po.id,
      metadata: {
        fromStatus: existing.status,
        toStatus: po.status,
        supplierId: po.supplierId,
        costCodeId: po.costCodeId,
      },
      ...requestMeta(req),
    })

    return NextResponse.json(po)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update PO' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params: paramsP }: { params: Promise<{ id: string }> },
) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) {
    return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  }
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited

  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    })
    if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!EDITABLE_STATUS.has(po.status)) {
      return NextResponse.json({ error: 'Issued POs are retained for audit; cancel them instead' }, { status: 409 })
    }

    await prisma.purchaseOrder.delete({ where: { id: params.id } })
    auditLog({
      action: 'purchaseOrder.delete',
      resourceType: 'PurchaseOrder',
      resourceId: params.id,
      metadata: { status: po.status },
      ...requestMeta(req),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
