import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200
const ALLOWED_CIS = new Set(['gross', '20', '30'])
const EXPIRING_WINDOW_DAYS = 60

function expiryBucket(d: Date | null): 'valid' | 'expiring' | 'expired' | 'none' {
  if (!d) return 'none'
  const ms = d.getTime() - Date.now()
  if (ms < 0) return 'expired'
  if (ms < EXPIRING_WINDOW_DAYS * 86_400_000) return 'expiring'
  return 'valid'
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const archived = searchParams.get('archived') === 'true'
    const search = searchParams.get('search')?.trim()
    const trade = searchParams.get('trade')
    const take = Math.min(parseInt(searchParams.get('take') || '100') || 100, MAX_TAKE)

    const where = {
      ...(archived ? { archivedAt: { not: null } } : { archivedAt: null }),
      ...(trade && { trade }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { contactName: { contains: search, mode: 'insensitive' as const } },
          { trade: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }
    const subs = await prisma.subcontractor.findMany({
      where,
      orderBy: { name: 'asc' },
      take,
    })
    const enriched = subs.map(s => ({
      ...s,
      insuranceStatus: expiryBucket(s.insuranceExpiry),
      qualificationsStatus: expiryBucket(s.qualificationsExpiry),
    }))
    const alerts = enriched.filter(s => s.insuranceStatus === 'expired' || s.insuranceStatus === 'expiring' || s.qualificationsStatus === 'expired' || s.qualificationsStatus === 'expiring').length
    return NextResponse.json({ subs: enriched, alerts })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch subs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    let insuranceExpiry: Date | null = null
    if (body.insuranceExpiry) {
      const d = new Date(body.insuranceExpiry)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid insuranceExpiry' }, { status: 400 })
      insuranceExpiry = d
    }
    let qualificationsExpiry: Date | null = null
    if (body.qualificationsExpiry) {
      const d = new Date(body.qualificationsExpiry)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid qualificationsExpiry' }, { status: 400 })
      qualificationsExpiry = d
    }

    const sub = await prisma.subcontractor.create({
      data: {
        name,
        trade: body.trade?.toString().trim() || null,
        contactName: body.contactName?.toString().trim() || null,
        contactEmail: body.contactEmail?.toString().trim() || null,
        contactPhone: body.contactPhone?.toString().trim() || null,
        address: body.address?.toString().trim() || null,
        postcode: body.postcode?.toString().trim() || null,
        cisStatus: ALLOWED_CIS.has(body.cisStatus) ? body.cisStatus : '20',
        utrNumber: body.utrNumber?.toString().trim() || null,
        insuranceExpiry,
        qualificationsExpiry,
        notes: body.notes?.toString().trim() || null,
      },
    })
    return NextResponse.json(sub, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create subcontractor' }, { status: 500 })
  }
}
