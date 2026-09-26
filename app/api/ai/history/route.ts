import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const MAX_LIMIT = 100

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.orgId) return NextResponse.json({ error: 'No organization', code: 'NO_ORG' }, { status: 403 })

  try {
    const raw = Number.parseInt(req.nextUrl.searchParams.get('limit') || '50', 10)
    const limit = Math.min(Math.max(Number.isFinite(raw) ? raw : 50, 1), MAX_LIMIT)

    const rows = await prisma.aiHistory.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userMsg: true,
        aiReply: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      history: rows.map(row => ({
        id: row.id,
        user_msg: row.userMsg,
        ai_reply: row.aiReply,
        created_at: row.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    reportError(error, { context: 'ai.history.list' })
    return NextResponse.json({ error: 'Failed to load AI history' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.orgId) return NextResponse.json({ error: 'No organization', code: 'NO_ORG' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited

  try {
    const result = await prisma.aiHistory.deleteMany({ where: { userId: auth.userId } })
    return NextResponse.json({ deleted: result.count })
  } catch (error) {
    reportError(error, { context: 'ai.history.clear' })
    return NextResponse.json({ error: 'Failed to clear AI history' }, { status: 500 })
  }
}
