import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200
const ALLOWED_VEHICLE = new Set(['car', 'van', 'motorbike'])

function isoMonthRange(monthParam: string | null) {
  if (!monthParam) return null
  const m = monthParam.match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  const year = parseInt(m[1])
  const month = parseInt(m[2]) - 1
  const start = new Date(Date.UTC(year, month, 1))
  const end = new Date(Date.UTC(year, month + 1, 1))
  return { start, end }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('memberId')
    const approved = searchParams.get('approved')
    const month = isoMonthRange(searchParams.get('month'))
    const take = Math.min(parseInt(searchParams.get('take') || '100') || 100, MAX_TAKE)

    const where = {
      ...(memberId && { memberId }),
      ...(approved === 'true' && { approved: true }),
      ...(approved === 'false' && { approved: false }),
      ...(month && { date: { gte: month.start, lt: month.end } }),
    }
    const [entries, totals] = await Promise.all([
      prisma.mileageEntry.findMany({
        where,
        include: { member: { select: { id: true, name: true } } },
        orderBy: { date: 'desc' },
        take,
      }),
      prisma.mileageEntry.aggregate({
        where,
        _sum: { miles: true, amount: true },
      }),
    ])
    return NextResponse.json({
      entries,
      totals: {
        miles: totals._sum.miles || 0,
        amount: totals._sum.amount || 0,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch mileage' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const fromAddress = String(body.fromAddress || '').trim()
    if (!fromAddress) return NextResponse.json({ error: 'From address is required' }, { status: 400 })
    const toAddress = String(body.toAddress || '').trim()
    if (!toAddress) return NextResponse.json({ error: 'To address is required' }, { status: 400 })

    const miles = Number(body.miles)
    if (isNaN(miles) || miles <= 0) return NextResponse.json({ error: 'Miles must be > 0' }, { status: 400 })
    if (miles > 2000) return NextResponse.json({ error: 'Miles unreasonably large' }, { status: 400 })

    if (!body.date) return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    const date = new Date(body.date)
    if (isNaN(date.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })

    if (body.memberId) {
      const m = await prisma.teamMember.findUnique({ where: { id: body.memberId }, select: { id: true } })
      if (!m) return NextResponse.json({ error: 'Member not found' }, { status: 400 })
    }

    const ratePence = body.ratePence === undefined ? 45 : Number(body.ratePence)
    if (isNaN(ratePence) || ratePence < 0 || ratePence > 200) {
      return NextResponse.json({ error: 'Rate must be 0-200 pence' }, { status: 400 })
    }

    const vehicleType = ALLOWED_VEHICLE.has(body.vehicleType) ? body.vehicleType : 'car'
    const amount = (miles * ratePence) / 100

    const entry = await prisma.mileageEntry.create({
      data: {
        memberId: body.memberId || null,
        date,
        fromAddress,
        toAddress,
        fromPostcode: body.fromPostcode?.toString().trim() || null,
        toPostcode: body.toPostcode?.toString().trim() || null,
        miles,
        vehicleType,
        purpose: body.purpose?.toString().trim() || null,
        ratePence,
        amount,
        approved: body.approved === true,
        notes: body.notes?.toString().trim() || null,
      },
      include: { member: { select: { id: true, name: true } } },
    })
    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create mileage entry' }, { status: 500 })
  }
}
