import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import procurementRfq from '@/lib/procurement-rfq'

export const dynamic = 'force-dynamic'
const { alignQuoteItems, quoteTotals, compareSupplierQuotes } = procurementRfq

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
    const rfq = await prisma.procurementRfq.findUnique({
      where: { id: params.id },
      include: {
        requisition: { select: { id: true, lineItems: true } },
      },
    })
    if (!rfq) return NextResponse.json({ error: 'RFQ not found' }, { status: 404 })
    if (rfq.status !== 'sent') {
      return NextResponse.json({ error: 'Quotes can only be recorded while the RFQ is open' }, { status: 409 })
    }

    const supplierId = String(body.supplierId || '').trim()
    if (!supplierId) return NextResponse.json({ error: 'Supplier is required' }, { status: 400 })
    const invitedIds = Array.isArray(rfq.supplierIds) ? rfq.supplierIds.map(value => String(value)) : []
    if (!invitedIds.includes(supplierId)) {
      return NextResponse.json({ error: 'Supplier was not invited to this RFQ' }, { status: 409 })
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true, archivedAt: true },
    })
    if (!supplier || supplier.archivedAt) {
      return NextResponse.json({ error: 'Supplier not found or archived' }, { status: 400 })
    }

    let lineItems
    try {
      lineItems = alignQuoteItems(rfq.requisition.lineItems, body.lineItems)
    } catch (error) {
      const code = error instanceof Error ? error.message : 'INVALID_QUOTE'
      const message = code === 'QUOTE_LINES_MISMATCH'
        ? 'Quote must price every requisition line'
        : 'Every quoted line needs a positive unit price'
      return NextResponse.json({ error: message, code }, { status: 400 })
    }

    let totals
    try {
      totals = quoteTotals(lineItems, body.vatRate === undefined ? 20 : body.vatRate)
    } catch {
      return NextResponse.json({ error: 'VAT rate must be between 0 and 100' }, { status: 400 })
    }

    let leadDays: number | null = null
    if (body.leadDays !== undefined && body.leadDays !== null && body.leadDays !== '') {
      const value = Number(body.leadDays)
      if (!Number.isInteger(value) || value < 0 || value > 3650) {
        return NextResponse.json({ error: 'Lead time must be a whole number of days' }, { status: 400 })
      }
      leadDays = value
    }

    let validUntil: Date | null = null
    if (body.validUntil) {
      const parsed = new Date(body.validUntil)
      if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: 'Invalid quote validity date' }, { status: 400 })
      validUntil = parsed
    }

    const quote = await prisma.supplierQuote.upsert({
      where: { rfqId_supplierId: { rfqId: rfq.id, supplierId } },
      create: {
        rfqId: rfq.id,
        supplierId,
        reference: body.reference?.toString().trim().slice(0, 120) || null,
        status: 'received',
        lineItems: lineItems as unknown as object,
        ...totals,
        leadDays,
        validUntil,
        notes: body.notes?.toString().trim().slice(0, 2000) || null,
      },
      update: {
        reference: body.reference?.toString().trim().slice(0, 120) || null,
        status: 'received',
        lineItems: lineItems as unknown as object,
        ...totals,
        leadDays,
        validUntil,
        notes: body.notes?.toString().trim().slice(0, 2000) || null,
        receivedAt: new Date(),
        awardedAt: null,
      },
      include: {
        supplier: { select: { id: true, name: true, category: true, paymentTerms: true } },
      },
    })

    const quotes = await prisma.supplierQuote.findMany({
      where: { rfqId: rfq.id },
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { receivedAt: 'asc' },
    })

    auditLog({
      action: 'supplierQuote.record',
      resourceType: 'SupplierQuote',
      resourceId: quote.id,
      metadata: {
        rfqId: rfq.id,
        supplierId,
        netAmount: quote.netAmount,
        totalAmount: quote.totalAmount,
        leadDays,
      },
      ...requestMeta(req),
    })
    return NextResponse.json({
      quote,
      comparison: compareSupplierQuotes(quotes as unknown as any[]),
    })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to record supplier quote' }, { status: 500 })
  }
}
