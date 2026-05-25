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
    const items = await prisma.siteReview.findMany({
      orderBy: { createdAt: 'desc' },
      take, skip,
    })
    const total = await prisma.siteReview.count()
    return NextResponse.json({ items, total, hasMore: skip + items.length < total })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json().catch(() => ({}))
    const item = await prisma.siteReview.create({
      data: {
      ...(typeof body.projectId === 'string' ? { projectId: body.projectId.trim() } : {}),
      ...(typeof body.kind === 'string' ? { kind: body.kind.trim() } : {}),
      ...(typeof body.reviewer === 'string' ? { reviewer: body.reviewer.trim() } : {}),
      ...(typeof body.score === 'number' ? { score: body.score } : {}),
      ...(typeof body.findings === 'string' ? { findings: body.findings.trim() } : {}),
      ...(typeof body.heldAt === 'string' && body.heldAt ? { heldAt: new Date(body.heldAt) } : {}),
      },
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}
