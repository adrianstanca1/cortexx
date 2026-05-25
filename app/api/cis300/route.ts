import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200

interface LineItem {
  subcontractorId: string
  name: string
  utr: string | null
  cisStatus: string
  gross: number
  cis: number
  net: number
  materialsCost: number
}

/** Normalise an ISO-ish date string to the 6th of its month at UTC midnight.
 *  Returns null if input is unparseable. */
function normaliseTaxMonth(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 6, 0, 0, 0, 0))
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const sp = req.nextUrl.searchParams
    const take = Math.min(parseInt(sp.get('take') || '50') || 50, MAX_TAKE)
    const skip = Math.max(0, parseInt(sp.get('skip') || '0') || 0)
    const items = await prisma.cis300Return.findMany({
      orderBy: { taxMonth: 'desc' },
      take, skip,
    })
    const total = await prisma.cis300Return.count()
    return NextResponse.json({ items, total, hasMore: skip + items.length < total })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json().catch(() => ({}))
    const taxMonth = normaliseTaxMonth(body.taxMonth)
    if (!taxMonth) {
      return NextResponse.json({ error: 'taxMonth is required (ISO date string)' }, { status: 400 })
    }
    // Window is [taxMonth, taxMonth + 1 month).
    const windowEnd = new Date(Date.UTC(
      taxMonth.getUTCFullYear(),
      taxMonth.getUTCMonth() + 1,
      6, 0, 0, 0, 0,
    ))

    const invoices = await prisma.subInvoice.findMany({
      where: {
        invoiceDate: { gte: taxMonth, lt: windowEnd },
      },
      include: {
        subcontractor: {
          select: { id: true, name: true, utrNumber: true, cisStatus: true },
        },
      },
    })

    // Aggregate per subcontractor.
    const grouped = new Map<string, LineItem>()
    for (const inv of invoices) {
      const sub = inv.subcontractor
      if (!sub) continue
      const existing = grouped.get(sub.id)
      if (existing) {
        existing.gross += inv.grossAmount
        existing.cis += inv.cisAmount
        existing.net += inv.netAmount
      } else {
        grouped.set(sub.id, {
          subcontractorId: sub.id,
          name: sub.name,
          utr: sub.utrNumber,
          cisStatus: sub.cisStatus,
          gross: inv.grossAmount,
          cis: inv.cisAmount,
          net: inv.netAmount,
          materialsCost: 0,
        })
      }
    }

    const lineItems = Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name))
    const totalGross = lineItems.reduce((s, l) => s + l.gross, 0)
    const totalCis = lineItems.reduce((s, l) => s + l.cis, 0)
    const totalNet = lineItems.reduce((s, l) => s + l.net, 0)
    const subCount = lineItems.length

    // Find-then-update-or-create with P2002 retry. Two concurrent
    // POSTs for the same (org, taxMonth) used to both pass the
    // findFirst gate and the second 500'd on the [organizationId,
    // taxMonth] unique. Retry once on P2002 by falling through to
    // update via the existing row.
    let item
    const existing = await prisma.cis300Return.findFirst({ where: { taxMonth } })
    const data = {
      totalGross, totalCis, totalNet, subCount,
      lineItems: lineItems as unknown as object,
    }
    if (existing) {
      item = await prisma.cis300Return.update({ where: { id: existing.id }, data })
    } else {
      try {
        item = await prisma.cis300Return.create({ data: { taxMonth, ...data } })
      } catch (e) {
        const code = (e as { code?: string })?.code
        if (code !== 'P2002') throw e
        // Lost the race — refetch and update the row our peer just created
        const racer = await prisma.cis300Return.findFirst({ where: { taxMonth } })
        if (!racer) throw e
        item = await prisma.cis300Return.update({ where: { id: racer.id }, data })
      }
    }

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to compute return' }, { status: 500 })
  }
}
