import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const sp = req.nextUrl.searchParams
    const take = Math.min(parseInt(sp.get('take') || '50') || 50, MAX_TAKE)
    const skip = Math.max(0, parseInt(sp.get('skip') || '0') || 0)
    const items = await prisma.wasteEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take, skip,
    })
    const total = await prisma.wasteEntry.count()
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
    const item = await prisma.wasteEntry.create({
      data: {
      ...(typeof body.projectId === 'string' ? { projectId: body.projectId.trim() } : {}),
      ...(typeof body.wasteType === 'string' ? { wasteType: body.wasteType.trim() } : {}),
      ...(typeof body.weightKg === 'number' ? { weightKg: body.weightKg } : {}),
      ...(typeof body.carrier === 'string' ? { carrier: body.carrier.trim() } : {}),
      ...(typeof body.ticketNumber === 'string' ? { ticketNumber: body.ticketNumber.trim() } : {}),
      ...(typeof body.occurredAt === 'string' && body.occurredAt ? { occurredAt: new Date(body.occurredAt) } : {}),
      ...(typeof body.disposalSite === 'string' ? { disposalSite: body.disposalSite.trim() } : {}),
      },
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}
