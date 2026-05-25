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
    const status = sp.get('status')
    const severity = sp.get('severity')
    const where: { status?: string; severity?: string } = {}
    if (status) where.status = status
    if (severity) where.severity = severity
    const hasWhere = status || severity
    const items = await prisma.conflict.findMany({
      where: hasWhere ? where : undefined,
      orderBy: { createdAt: 'desc' },
      take, skip,
    })
    const total = await prisma.conflict.count({ where: hasWhere ? where : undefined })
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
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    const item = await prisma.conflict.create({
      data: {
        title,
        ...(typeof body.description === 'string' ? { description: body.description.trim() } : {}),
        ...(typeof body.projectId === 'string' ? { projectId: body.projectId.trim() } : {}),
        ...(typeof body.parties === 'string' ? { parties: body.parties.trim() } : {}),
        ...(typeof body.severity === 'string' ? { severity: body.severity.trim() } : {}),
        ...(typeof body.status === 'string' ? { status: body.status.trim() } : {}),
        ...(typeof body.owner === 'string' ? { owner: body.owner.trim() } : {}),
        ...(typeof body.raisedAt === 'string' && body.raisedAt ? { raisedAt: new Date(body.raisedAt) } : {}),
      },
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}
