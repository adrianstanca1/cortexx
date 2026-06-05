import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100
const ALLOWED_STATUS = new Set(['draft', 'sent', 'received', 'closed', 'cancelled'])

interface LineItem {
  description: string
  quantity: number
  unit?: string
  unitPrice: number
  total: number
}

function recalc(lineItems: LineItem[], vatRate: number) {
  const subtotal = lineItems.reduce((s, li) => s + (Number(li.total) || 0), 0)
  const vatAmount = subtotal * (vatRate / 100)
  return { subtotal, vatAmount, total: subtotal + vatAmount }
}

function validateLineItems(raw: unknown): LineItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(it => {
      if (!it || typeof it !== 'object') return null
      const o = it as Record<string, unknown>
      const description = String(o.description || '').trim()
      if (!description) return null
      const quantity = Number(o.quantity)
      const unitPrice = Number(o.unitPrice)
      if (isNaN(quantity) || isNaN(unitPrice)) return null
      const total = Number.isFinite(quantity * unitPrice) ? quantity * unitPrice : 0
      return { description, quantity, unit: o.unit ? String(o.unit) : undefined, unitPrice, total } as LineItem
    })
    .filter((x): x is LineItem => x !== null)
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
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
        include: { project: { select: { id: true, name: true } } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take,
      }),
      prisma.purchaseOrder.count({ where: { ...where, status: { in: ['draft', 'sent', 'received'] } } }),
      prisma.purchaseOrder.aggregate({
        where: { ...where, status: { in: ['sent', 'received'] } },
        _sum: { total: true },
      }),
    ])
    return NextResponse.json({
      pos,
      openCount,
      committedValue: committed._sum.total || 0,
    })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch POs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const supplier = String(body.supplier || '').trim()
    if (!supplier) return NextResponse.json({ error: 'Supplier is required' }, { status: 400 })

    let projectId: string | null = null
    if (body.projectId) {
      const p = await prisma.project.findUnique({ where: { id: body.projectId }, select: { id: true } })
      if (!p) return NextResponse.json({ error: 'Project not found' }, { status: 400 })
      projectId = p.id
    }

    const vatRate = body.vatRate === undefined ? 20 : Number(body.vatRate)
    if (isNaN(vatRate) || vatRate < 0 || vatRate > 100) {
      return NextResponse.json({ error: 'VAT rate must be 0-100' }, { status: 400 })
    }

    const lineItems = validateLineItems(body.lineItems)
    const { subtotal, vatAmount, total } = recalc(lineItems, vatRate)

    let expectedDelivery: Date | null = null
    if (body.expectedDelivery) {
      const d = new Date(body.expectedDelivery)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid expectedDelivery' }, { status: 400 })
      expectedDelivery = d
    }

    const last = await prisma.purchaseOrder.findFirst({ orderBy: { createdAt: 'desc' }, select: { number: true } })
    const parsed = last ? parseInt(last.number.split('-').pop() || '0', 10) : 0
    const lastNum = Number.isFinite(parsed) ? parsed : 0
    const number = `PO-${String(lastNum + 1).padStart(4, '0')}`

    const status = ALLOWED_STATUS.has(body.status) ? body.status : 'draft'

    const po = await prisma.purchaseOrder.create({
      data: {
        number,
        projectId,
        supplier,
        contactEmail: body.contactEmail?.toString().trim() || null,
        contactPhone: body.contactPhone?.toString().trim() || null,
        status,
        lineItems: lineItems as unknown as object,
        subtotal,
        vatRate,
        vatAmount,
        total,
        expectedDelivery,
        notes: body.notes?.toString().trim() || null,
        sentAt: status === 'sent' ? new Date() : null,
        receivedAt: status === 'received' ? new Date() : null,
        closedAt: status === 'closed' ? new Date() : null,
      },
      include: { project: { select: { id: true, name: true } } },
    })

    if (projectId) {
      prisma.activity.create({
        data: {
          projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `raised ${po.number}: ${supplier} (£${total.toFixed(2)})`,
          iconType: 'doc',
        },
      }).catch(() => {})
    }

    return NextResponse.json(po, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create PO' }, { status: 500 })
  }
}
