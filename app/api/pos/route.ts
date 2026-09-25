import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { canWrite, canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100
const ALLOWED_STATUS = new Set([
  'draft', 'pending_approval', 'rejected', 'approved',
  'sent', 'part_received', 'received', 'closed', 'cancelled',
])
const COMMITTED_STATUS = ['approved', 'sent', 'part_received', 'received']

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

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const take = Math.min(parseInt(searchParams.get('take') || '50') || 50, MAX_TAKE)
    const where = {
      ...(projectId && { projectId }),
      ...(status && ALLOWED_STATUS.has(status) && { status }),
    }

    const [pos, openCount, committed] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          costCode: { select: { id: true, code: true, name: true } },
          supplierRef: { select: { id: true, name: true, category: true } },
          requisition: { select: { id: true, number: true, status: true } },
          supplierQuote: { select: { id: true, reference: true, rfq: { select: { id: true, reference: true } } } },
          goodsReceipts: {
            select: { id: true, deliveredAt: true, deliveryNote: true, receivedBy: true, netReceived: true, lineItems: true, notes: true, evidence: true },
            orderBy: { deliveredAt: 'desc' },
          },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take,
      }),
      prisma.purchaseOrder.count({
        where: {
          ...where,
          status: { in: ['draft', 'pending_approval', 'approved', 'sent', 'part_received', 'received'] },
        },
      }),
      prisma.purchaseOrder.aggregate({
        where: { ...where, status: { in: COMMITTED_STATUS } },
        _sum: { subtotal: true },
      }),
    ])

    return NextResponse.json({
      pos,
      openCount,
      committedValue: committed._sum.subtotal || 0,
    })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch POs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) {
    return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  }
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited

  try {
    const body = await req.json()
    const supplierId = body.supplierId ? String(body.supplierId) : null
    let supplier = String(body.supplier || '').trim()
    let contactEmail = body.contactEmail?.toString().trim() || null
    let contactPhone = body.contactPhone?.toString().trim() || null

    if (supplierId) {
      const linked = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { id: true, name: true, contactEmail: true, contactPhone: true, archivedAt: true },
      })
      if (!linked || linked.archivedAt) {
        return NextResponse.json({ error: 'Supplier not found or archived' }, { status: 400 })
      }
      supplier = linked.name
      contactEmail = contactEmail || linked.contactEmail
      contactPhone = contactPhone || linked.contactPhone
    }
    if (!supplier) return NextResponse.json({ error: 'Supplier is required' }, { status: 400 })

    let projectId: string | null = null
    if (body.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: String(body.projectId) },
        select: { id: true },
      })
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 400 })
      projectId = project.id
    }

    const vatRate = body.vatRate === undefined ? 20 : Number(body.vatRate)
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
      return NextResponse.json({ error: 'VAT rate must be 0-100' }, { status: 400 })
    }

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

    const lineItems = validateLineItems(body.lineItems)
    if (!lineItems.length) {
      return NextResponse.json({ error: 'At least one valid line item is required' }, { status: 400 })
    }
    const { subtotal, vatAmount, total } = recalc(lineItems, vatRate)

    let expectedDelivery: Date | null = null
    if (body.expectedDelivery) {
      const date = new Date(body.expectedDelivery)
      if (Number.isNaN(date.getTime())) {
        return NextResponse.json({ error: 'Invalid expectedDelivery' }, { status: 400 })
      }
      expectedDelivery = date
    }

    const last = await prisma.purchaseOrder.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { number: true },
    })
    const parsed = last ? parseInt(last.number.split('-').pop() || '0', 10) : 0
    const number = `PO-${String((Number.isFinite(parsed) ? parsed : 0) + 1).padStart(4, '0')}`

    const requestedStatus = ALLOWED_STATUS.has(body.status) ? String(body.status) : 'draft'
    const status =
      requestedStatus === 'approved' && canManage(auth.role || '')
        ? 'approved'
        : requestedStatus === 'pending_approval'
          ? 'pending_approval'
          : 'draft'
    const now = new Date()

    const po = await prisma.purchaseOrder.create({
      data: {
        number,
        projectId,
        costCodeId,
        supplierId,
        supplier,
        contactEmail,
        contactPhone,
        status,
        lineItems: lineItems as unknown as object,
        subtotal,
        vatRate,
        vatAmount,
        total,
        expectedDelivery,
        notes: body.notes?.toString().trim() || null,
        approvalRequestedAt: status === 'pending_approval' ? now : null,
        approvedAt: status === 'approved' ? now : null,
        approvedBy: status === 'approved' ? actorName(auth.session) : null,
      },
      include: {
        project: { select: { id: true, name: true } },
        costCode: { select: { id: true, code: true, name: true } },
        supplierRef: { select: { id: true, name: true, category: true } },
        requisition: { select: { id: true, number: true, status: true } },
        supplierQuote: { select: { id: true, reference: true, rfq: { select: { id: true, reference: true } } } },
        goodsReceipts: true,
      },
    })

    if (projectId) {
      prisma.activity.create({
        data: {
          projectId,
          actorName: actorName(auth.session),
          actorType: 'human',
          action: `raised ${po.number}: ${supplier} (£${total.toFixed(2)})`,
          iconType: 'doc',
        },
      }).catch(() => {})
    }

    auditLog({
      action: 'purchaseOrder.create',
      resourceType: 'PurchaseOrder',
      resourceId: po.id,
      metadata: { projectId, costCodeId, supplierId, status, subtotal },
      ...requestMeta(req),
    })

    return NextResponse.json(po, { status: 201 })
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'Purchase order number conflict; retry the request' }, { status: 409 })
    }
    reportError(error)
    return NextResponse.json({ error: 'Failed to create PO' }, { status: 500 })
  }
}
