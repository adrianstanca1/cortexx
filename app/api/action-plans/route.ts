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
    const where = status ? { status } : undefined
    const items = await prisma.actionPlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take, skip,
    })
    const total = await prisma.actionPlan.count({ where })
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
    // Enum + linked-resource validation. linkedType/linkedId together
    // point to a parent record (snag/rfi/incident); only well-known
    // types are accepted so future-deleted-resource references don't
    // dangle.
    const ALLOWED_PRIORITY = new Set(['low', 'medium', 'high', 'critical'])
    const ALLOWED_STATUS = new Set(['open', 'in_progress', 'done', 'cancelled'])
    const ALLOWED_LINKED_TYPE = new Set(['snag', 'rfi', 'incident', 'inspection', 'meeting'])
    const linkedType = typeof body.linkedType === 'string' && ALLOWED_LINKED_TYPE.has(body.linkedType.trim())
      ? body.linkedType.trim() : null
    const linkedId = typeof body.linkedId === 'string' && body.linkedId.trim() ? body.linkedId.trim() : null
    if (linkedId && !linkedType) {
      return NextResponse.json({ error: 'linkedId requires a valid linkedType', code: 'LINKED_TYPE_REQUIRED' }, { status: 400 })
    }
    const item = await prisma.actionPlan.create({
      data: {
        title,
        ...(typeof body.description === 'string' ? { description: body.description.trim() } : {}),
        ...(typeof body.owner === 'string' ? { owner: body.owner.trim() } : {}),
        ...(typeof body.priority === 'string' && ALLOWED_PRIORITY.has(body.priority.trim()) ? { priority: body.priority.trim() } : {}),
        ...(typeof body.status === 'string' && ALLOWED_STATUS.has(body.status.trim()) ? { status: body.status.trim() } : {}),
        ...(typeof body.dueDate === 'string' && body.dueDate ? { dueDate: new Date(body.dueDate) } : {}),
        ...(linkedType ? { linkedType } : {}),
        ...(linkedId ? { linkedId } : {}),
      },
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}
