import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200
const EXPIRING_WINDOW_DAYS = 60

function bucket(expiry: Date | null): 'valid' | 'expiring' | 'expired' | 'no_expiry' {
  if (!expiry) return 'no_expiry'
  const ms = expiry.getTime() - Date.now()
  if (ms < 0) return 'expired'
  if (ms < EXPIRING_WINDOW_DAYS * 86_400_000) return 'expiring'
  return 'valid'
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('memberId')
    const type = searchParams.get('type')
    const status = searchParams.get('status') // valid | expiring | expired
    const take = Math.min(parseInt(searchParams.get('take') || '100') || 100, MAX_TAKE)

    const certs = await prisma.certification.findMany({
      where: {
        ...(memberId && { memberId }),
        ...(type && { type }),
      },
      include: { member: { select: { id: true, name: true, role: true } } },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
      take,
    })

    const enriched = certs.map(c => ({ ...c, statusBucket: bucket(c.expiryDate) }))
    const filtered = status ? enriched.filter(c => c.statusBucket === status) : enriched

    const counts = {
      valid: enriched.filter(c => c.statusBucket === 'valid').length,
      expiring: enriched.filter(c => c.statusBucket === 'expiring').length,
      expired: enriched.filter(c => c.statusBucket === 'expired').length,
      total: enriched.length,
    }

    return NextResponse.json({ certifications: filtered, counts })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch certifications' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const holderName = String(body.holderName || '').trim()
    if (!holderName) return NextResponse.json({ error: 'Holder name is required' }, { status: 400 })
    const type = String(body.type || '').trim()
    if (!type) return NextResponse.json({ error: 'Type is required' }, { status: 400 })

    let issuedDate: Date | null = null
    if (body.issuedDate) {
      const d = new Date(body.issuedDate)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid issuedDate' }, { status: 400 })
      issuedDate = d
    }
    let expiryDate: Date | null = null
    if (body.expiryDate) {
      const d = new Date(body.expiryDate)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid expiryDate' }, { status: 400 })
      expiryDate = d
    }

    if (body.memberId) {
      const m = await prisma.teamMember.findUnique({ where: { id: body.memberId }, select: { id: true } })
      if (!m) return NextResponse.json({ error: 'Member not found' }, { status: 400 })
    }

    const cert = await prisma.certification.create({
      data: {
        memberId: body.memberId || null,
        holderName,
        type,
        number: body.number?.toString().trim() || null,
        issuedDate,
        expiryDate,
        notes: body.notes?.toString().trim() || null,
      },
      include: { member: { select: { id: true, name: true, role: true } } },
    })
    return NextResponse.json(cert, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create certification' }, { status: 500 })
  }
}
