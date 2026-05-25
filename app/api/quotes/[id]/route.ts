import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

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

// Match the collection route's cap. See quotes/route.ts.
const MAX_QUOTE_LINE_ITEMS = 500

function validateLineItems(raw: unknown): LineItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .slice(0, MAX_QUOTE_LINE_ITEMS)
    .map(it => {
      if (!it || typeof it !== 'object') return null
      const o = it as Record<string, unknown>
      const description = String(o.description || '').trim()
      if (!description) return null
      const quantity = Number(o.quantity)
      const unitPrice = Number(o.unitPrice)
      if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return null
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

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: { customer: { select: { id: true, name: true, contactName: true, contactEmail: true } } },
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ quote })
}

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.quote.findUnique({
      where: { id: params.id },
      select: { status: true, sentAt: true, acceptedAt: true, rejectedAt: true, lineItems: true, vatRate: true },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (body.title !== undefined && !String(body.title).trim()) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = String(body.title).trim()
    if (body.description !== undefined) data.description = body.description?.toString().trim() || null
    if (body.customerName !== undefined) data.customerName = String(body.customerName).trim()
    if (body.terms !== undefined) data.terms = body.terms?.toString().trim() || null

    if (body.vatRate !== undefined) {
      const v = Number(body.vatRate)
      if (isNaN(v) || v < 0 || v > 100) return NextResponse.json({ error: 'VAT rate must be 0-100' }, { status: 400 })
      data.vatRate = v
    }

    if (body.lineItems !== undefined) {
      data.lineItems = validateLineItems(body.lineItems) as unknown as object
    }

    // Always recompute if either lineItems or vatRate changed
    if (body.lineItems !== undefined || body.vatRate !== undefined) {
      const items = body.lineItems !== undefined
        ? (data.lineItems as LineItem[])
        : (Array.isArray(existing.lineItems) ? (existing.lineItems as unknown as LineItem[]) : [])
      const vatRate = data.vatRate !== undefined ? Number(data.vatRate) : existing.vatRate
      const totals = recalc(items, vatRate)
      data.subtotal = totals.subtotal
      data.vatAmount = totals.vatAmount
      data.total = totals.total
    }

    if (body.validUntil !== undefined) {
      if (body.validUntil) {
        const d = new Date(body.validUntil)
        if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid validUntil' }, { status: 400 })
        data.validUntil = d
      } else data.validUntil = null
    }

    if (body.status !== undefined && ALLOWED_STATUS.has(body.status)) {
      data.status = body.status
      if (body.status === 'sent' && !existing.sentAt) data.sentAt = new Date()
      if (body.status === 'accepted' && !existing.acceptedAt) data.acceptedAt = new Date()
      if (body.status === 'rejected' && !existing.rejectedAt) data.rejectedAt = new Date()
      if (body.status === 'draft') {
        data.sentAt = null
        data.acceptedAt = null
        data.rejectedAt = null
      }
    }

    const quote = await prisma.quote.update({
      where: { id: params.id },
      data,
      include: { customer: { select: { id: true, name: true } } },
    })
    return NextResponse.json(quote)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    await prisma.quote.delete({ where: { id: params.id } })
    auditLog({
      action: 'quote.delete',
      resourceType: 'Quote',
      resourceId: params.id,
      ...requestMeta(req),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete quote' }, { status: 500 })
  }
}
