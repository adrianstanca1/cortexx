import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set(['draft', 'sent', 'received', 'closed', 'cancelled'])

interface LineItem { description: string; quantity: number; unit?: string; unitPrice: number; total: number }

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

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.purchaseOrder.findUnique({
      where: { id: params.id },
      select: { status: true, lineItems: true, vatRate: true, sentAt: true, receivedAt: true, closedAt: true },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (body.supplier !== undefined) data.supplier = String(body.supplier).trim()
    if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail?.toString().trim() || null
    if (body.contactPhone !== undefined) data.contactPhone = body.contactPhone?.toString().trim() || null
    if (body.notes !== undefined) data.notes = body.notes?.toString().trim() || null
    if (body.vatRate !== undefined) {
      const v = Number(body.vatRate)
      if (isNaN(v) || v < 0 || v > 100) return NextResponse.json({ error: 'VAT 0-100' }, { status: 400 })
      data.vatRate = v
    }
    if (body.lineItems !== undefined) data.lineItems = validateLineItems(body.lineItems) as unknown as object
    if (body.lineItems !== undefined || body.vatRate !== undefined) {
      const items = body.lineItems !== undefined
        ? (data.lineItems as LineItem[])
        : (Array.isArray(existing.lineItems) ? (existing.lineItems as unknown as LineItem[]) : [])
      const vatRate = data.vatRate !== undefined ? Number(data.vatRate) : existing.vatRate
      const t = recalc(items, vatRate)
      data.subtotal = t.subtotal
      data.vatAmount = t.vatAmount
      data.total = t.total
    }
    if (body.expectedDelivery !== undefined) {
      if (body.expectedDelivery) {
        const d = new Date(body.expectedDelivery)
        if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid expectedDelivery' }, { status: 400 })
        data.expectedDelivery = d
      } else data.expectedDelivery = null
    }
    if (body.status !== undefined && ALLOWED_STATUS.has(body.status)) {
      data.status = body.status
      if (body.status === 'sent' && !existing.sentAt) data.sentAt = new Date()
      if (body.status === 'received' && !existing.receivedAt) data.receivedAt = new Date()
      if (body.status === 'closed' && !existing.closedAt) data.closedAt = new Date()
      if (body.status === 'draft') {
        data.sentAt = null
        data.receivedAt = null
        data.closedAt = null
      }
    }

    const po = await prisma.purchaseOrder.update({
      where: { id: params.id },
      data,
      include: { project: { select: { id: true, name: true } } },
    })
    return NextResponse.json(po)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update PO' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    await prisma.purchaseOrder.delete({ where: { id: params.id } })
    auditLog({
      action: 'purchaseOrder.delete',
      resourceType: 'PurchaseOrder',
      resourceId: params.id,
      ...requestMeta(req),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
