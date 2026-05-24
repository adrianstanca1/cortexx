import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100
const ALLOWED_STATUS = new Set(['draft', 'sent', 'accepted', 'rejected'])

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
      return {
        description,
        quantity,
        unit: o.unit ? String(o.unit) : undefined,
        unitPrice,
        total,
      } as LineItem
    })
    .filter((x): x is LineItem => x !== null)
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')
    const take = Math.min(parseInt(searchParams.get('take') || '50') || 50, MAX_TAKE)

    const where = {
      ...(status && ALLOWED_STATUS.has(status) && { status }),
      ...(customerId && { customerId }),
    }
    const [quotes, openValue] = await Promise.all([
      prisma.quote.findMany({
        where,
        include: { customer: { select: { id: true, name: true } } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take,
      }),
      prisma.quote.aggregate({
        where: { status: { in: ['draft', 'sent'] } },
        _sum: { total: true },
      }),
    ])
    return NextResponse.json({
      quotes,
      openValue: openValue._sum.total || 0,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    let customerId: string | null = null
    let customerName = String(body.customerName || '').trim()
    if (body.customerId) {
      const c = await prisma.customer.findUnique({ where: { id: body.customerId }, select: { id: true, name: true } })
      if (!c) return NextResponse.json({ error: 'Customer not found' }, { status: 400 })
      customerId = c.id
      if (!customerName) customerName = c.name
    }
    if (!customerName) return NextResponse.json({ error: 'Customer name or customerId is required' }, { status: 400 })

    const vatRate = body.vatRate === undefined ? 20 : Number(body.vatRate)
    if (isNaN(vatRate) || vatRate < 0 || vatRate > 100) {
      return NextResponse.json({ error: 'VAT rate must be 0-100' }, { status: 400 })
    }

    const lineItems = validateLineItems(body.lineItems)
    const { subtotal, vatAmount, total } = recalc(lineItems, vatRate)

    let validUntil: Date | null = null
    if (body.validUntil) {
      const d = new Date(body.validUntil)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid validUntil' }, { status: 400 })
      validUntil = d
    }

    // Sequential QTE number — global (not per-customer)
    const last = await prisma.quote.findFirst({ orderBy: { createdAt: 'desc' }, select: { number: true } })
    const lastNum = last ? parseInt(last.number.split('-').pop() || '0') : 0
    const number = `QTE-${String(lastNum + 1).padStart(4, '0')}`

    const status = ALLOWED_STATUS.has(body.status) ? body.status : 'draft'

    const quote = await prisma.quote.create({
      data: {
        number,
        customerId,
        customerName,
        title,
        description: body.description?.toString().trim() || null,
        lineItems: lineItems as unknown as object,
        subtotal,
        vatRate,
        vatAmount,
        total,
        validUntil,
        status,
        terms: body.terms?.toString().trim() || null,
        sentAt: status === 'sent' ? new Date() : null,
      },
      include: { customer: { select: { id: true, name: true } } },
    })
    return NextResponse.json(quote, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create quote' }, { status: 500 })
  }
}
