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
    const items = await prisma.reminder.findMany({
      orderBy: { createdAt: 'desc' },
      take, skip,
    })
    const total = await prisma.reminder.count()
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
    const item = await prisma.reminder.create({
      data: {
      ...(typeof body.title === 'string' ? { title: body.title.trim() } : {}),
      ...(typeof body.dueAt === 'string' && body.dueAt ? { dueAt: new Date(body.dueAt) } : {}),
      ...(typeof body.memberId === 'string' ? { memberId: body.memberId.trim() } : {}),
      ...(typeof body.done === 'boolean' ? { done: body.done } : {}),
      ...(typeof body.notes === 'string' ? { notes: body.notes.trim() } : {}),
      },
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}
