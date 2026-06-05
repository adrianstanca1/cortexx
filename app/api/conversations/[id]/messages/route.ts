import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const DEFAULT_TAKE = 200
const MAX_TAKE = 500
const MAX_BODY_CHARS = 4000

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  try {
    const sp = req.nextUrl.searchParams
    const take = Math.min(parseInt(sp.get('take') || String(DEFAULT_TAKE)) || DEFAULT_TAKE, MAX_TAKE)
    const before = sp.get('before')
    const after = sp.get('after')

    // Make sure the conversation exists (and is in scope) before listing
    // its messages — keeps the response honest for deleted/missing IDs.
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const where: { conversationId: string; createdAt?: { lt?: Date; gt?: Date } } = {
      conversationId: id,
    }
    // Guard `new Date(x)` — Invalid Date passed to Prisma surfaces as a
    // confusing 500 instead of a clean 400. Reject malformed cursors up
    // front so polling clients get an actionable error.
    if (before) {
      const d = new Date(before)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid `before` cursor' }, { status: 400 })
      where.createdAt = { ...(where.createdAt || {}), lt: d }
    }
    if (after) {
      const d = new Date(after)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid `after` cursor' }, { status: 400 })
      where.createdAt = { ...(where.createdAt || {}), gt: d }
    }

    const items = await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take,
    })
    return NextResponse.json({ items })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  const { id } = await params
  try {
    const body = await req.json().catch(() => ({}))
    const text = typeof body.body === 'string' ? body.body.trim() : ''
    if (!text) return NextResponse.json({ error: 'body is required' }, { status: 400 })
    if (text.length > MAX_BODY_CHARS) {
      return NextResponse.json({ error: `body must be ≤ ${MAX_BODY_CHARS} chars` }, { status: 400 })
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const user = auth.user as { id?: string; name?: string | null; email?: string | null }
    const authorId = user.id || 'unknown'
    const authorName = user.name || user.email || 'Unknown'

    const now = new Date()
    const item = await prisma.chatMessage.create({
      data: {
        conversationId: id,
        authorId,
        authorName,
        body: text,
        createdAt: now,
      },
    })
    // Bump lastMessageAt so the conversation floats to the top of the
    // index list. Best-effort: if it fails (e.g. row deleted mid-flight)
    // we still return the saved message.
    try {
      await prisma.conversation.update({
        where: { id },
        data: { lastMessageAt: now },
      })
    } catch {}

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to post' }, { status: 500 })
  }
}
