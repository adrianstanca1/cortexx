import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200
const ALLOWED_STATUS = new Set(['received', 'approved', 'paid', 'disputed'])

function cisRate(cisStatus: string): number {
  // HMRC CIS rates: gross = 0%, standard registered = 20%, unregistered/higher = 30%
  if (cisStatus === 'gross') return 0
  if (cisStatus === '30') return 0.30
  return 0.20
}

function compute(netAmount: number, vatRate: number, cisRatePct: number) {
  const vatAmount = netAmount * (vatRate / 100)
  // CIS withheld from NET only (not VAT)
  const cisAmount = netAmount * cisRatePct
  const grossAmount = netAmount + vatAmount
  const payableAmount = grossAmount - cisAmount
  return { vatAmount, cisAmount, grossAmount, payableAmount }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const subcontractorId = searchParams.get('subcontractorId')
    const take = Math.min(parseInt(searchParams.get('take') || '50') || 50, MAX_TAKE)

    const where = {
      ...(status && ALLOWED_STATUS.has(status) && { status }),
      ...(subcontractorId && { subcontractorId }),
    }
    const [invoices, pendingCount, totals] = await Promise.all([
      prisma.subInvoice.findMany({
        where,
        include: {
          subcontractor: { select: { id: true, name: true, trade: true, cisStatus: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: [{ status: 'asc' }, { invoiceDate: 'desc' }],
        take,
      }),
      prisma.subInvoice.count({ where: { ...where, status: { in: ['received', 'approved'] } } }),
      prisma.subInvoice.aggregate({
        where: { ...where, status: { in: ['received', 'approved'] } },
        _sum: { payableAmount: true, cisAmount: true },
      }),
    ])
    return NextResponse.json({
      invoices,
      pendingCount,
      pendingPayable: totals._sum.payableAmount || 0,
      pendingCisHeld: totals._sum.cisAmount || 0,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch sub-invoices' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const number = String(body.number || '').trim()
    if (!number) return NextResponse.json({ error: 'Invoice number is required' }, { status: 400 })
    const subcontractorId = String(body.subcontractorId || '').trim()
    if (!subcontractorId) return NextResponse.json({ error: 'Subcontractor is required' }, { status: 400 })

    const sub = await prisma.subcontractor.findUnique({ where: { id: subcontractorId }, select: { id: true, cisStatus: true } })
    if (!sub) return NextResponse.json({ error: 'Subcontractor not found' }, { status: 400 })

    if (body.projectId) {
      const p = await prisma.project.findUnique({ where: { id: body.projectId }, select: { id: true } })
      if (!p) return NextResponse.json({ error: 'Project not found' }, { status: 400 })
    }

    if (!body.invoiceDate) return NextResponse.json({ error: 'Invoice date is required' }, { status: 400 })
    const invoiceDate = new Date(body.invoiceDate)
    if (isNaN(invoiceDate.getTime())) return NextResponse.json({ error: 'Invalid invoice date' }, { status: 400 })

    const netAmount = Number(body.netAmount)
    if (isNaN(netAmount) || netAmount < 0) return NextResponse.json({ error: 'Net amount must be ≥ 0' }, { status: 400 })

    const vatRate = body.vatRate === undefined ? 20 : Number(body.vatRate)
    if (isNaN(vatRate) || vatRate < 0 || vatRate > 100) return NextResponse.json({ error: 'VAT 0-100' }, { status: 400 })

    const { vatAmount, cisAmount, grossAmount, payableAmount } = compute(netAmount, vatRate, cisRate(sub.cisStatus))
    const status = ALLOWED_STATUS.has(body.status) ? body.status : 'received'

    const invoice = await prisma.subInvoice.create({
      data: {
        number,
        subcontractorId,
        projectId: body.projectId || null,
        invoiceDate,
        description: body.description?.toString().trim() || null,
        netAmount,
        vatAmount,
        cisAmount,
        grossAmount,
        payableAmount,
        status,
        paidAt: status === 'paid' ? new Date() : null,
        notes: body.notes?.toString().trim() || null,
      },
      include: {
        subcontractor: { select: { id: true, name: true, trade: true, cisStatus: true } },
        project: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Duplicate invoice number for this subcontractor' }, { status: 409 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create sub-invoice' }, { status: 500 })
  }
}
