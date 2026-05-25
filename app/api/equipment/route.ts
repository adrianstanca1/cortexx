import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200
const ALLOWED_OWNERSHIP = new Set(['owned', 'hired'])
const ALLOWED_STATUS = new Set(['in_service', 'in_yard', 'in_service_centre', 'out_of_service'])
const SERVICE_WINDOW_DAYS = 30

function serviceBucket(d: Date | null): 'ok' | 'soon' | 'overdue' | 'none' {
  if (!d) return 'none'
  const ms = d.getTime() - Date.now()
  if (ms < 0) return 'overdue'
  if (ms < SERVICE_WINDOW_DAYS * 86_400_000) return 'soon'
  return 'ok'
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const archived = searchParams.get('archived') === 'true'
    const search = searchParams.get('search')?.trim()
    const take = Math.min(parseInt(searchParams.get('take') || '100') || 100, MAX_TAKE)

    const where = {
      ...(archived ? { archivedAt: { not: null } } : { archivedAt: null }),
      ...(status && ALLOWED_STATUS.has(status) && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { code: { contains: search, mode: 'insensitive' as const } },
          { serial: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }
    const items = await prisma.equipment.findMany({
      where,
      orderBy: { name: 'asc' },
      take,
    })
    const enriched = items.map(e => ({ ...e, serviceBucket: serviceBucket(e.nextServiceAt) }))
    const alerts = enriched.filter(e => e.serviceBucket === 'overdue' || e.serviceBucket === 'soon').length
    return NextResponse.json({ equipment: enriched, alerts })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch equipment' }, { status: 500 })
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

    let lastServicedAt: Date | null = null
    if (body.lastServicedAt) {
      const d = new Date(body.lastServicedAt)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid lastServicedAt' }, { status: 400 })
      lastServicedAt = d
    }
    let nextServiceAt: Date | null = null
    if (body.nextServiceAt) {
      const d = new Date(body.nextServiceAt)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid nextServiceAt' }, { status: 400 })
      nextServiceAt = d
    }

    const equipment = await prisma.equipment.create({
      data: {
        name,
        code: body.code?.toString().trim() || null,
        category: body.category?.toString().trim() || null,
        serial: body.serial?.toString().trim() || null,
        ownership: ALLOWED_OWNERSHIP.has(body.ownership) ? body.ownership : 'owned',
        hireCompany: body.hireCompany?.toString().trim() || null,
        location: body.location?.toString().trim() || null,
        status: ALLOWED_STATUS.has(body.status) ? body.status : 'in_yard',
        lastServicedAt,
        nextServiceAt,
        notes: body.notes?.toString().trim() || null,
      },
    })
    return NextResponse.json(equipment, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create equipment' }, { status: 500 })
  }
}
