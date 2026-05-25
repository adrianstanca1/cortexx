import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const sp = req.nextUrl.searchParams
    const take = Math.min(parseInt(sp.get('take') || '50') || 50, MAX_TAKE)
    const skip = Math.max(0, parseInt(sp.get('skip') || '0') || 0)
    const items = await prisma.infraSnapshot.findMany({
      orderBy: { createdAt: 'desc' },
      take, skip,
    })
    const total = await prisma.infraSnapshot.count()
    return NextResponse.json({ items, total, hasMore: skip + items.length < total })
  } catch (error) {
    console.error(error)
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
    const item = await prisma.infraSnapshot.create({
      data: {
      ...(typeof body.recordedAt === 'string' && body.recordedAt ? { recordedAt: new Date(body.recordedAt) } : {}),
      ...(typeof body.cpuPercent === 'number' ? { cpuPercent: body.cpuPercent } : {}),
      ...(typeof body.memMb === 'number' ? { memMb: body.memMb } : {}),
      ...(typeof body.diskGb === 'number' ? { diskGb: body.diskGb } : {}),
      ...(typeof body.pgConnections === 'number' ? { pgConnections: body.pgConnections } : {}),
      },
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}
