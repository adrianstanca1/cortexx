import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const userId = (auth.user as { id?: string }).id
  const limited = await enforceRateLimit(req, 'auth', userId)
  if (limited) return limited
  try {
    const body = await req.json()
    const current = String(body.currentPassword || '')
    const next = String(body.newPassword || '')

    if (next.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
    }
    if (next.length > 200) {
      return NextResponse.json({ error: 'Password too long' }, { status: 400 })
    }
    if (current === next) {
      return NextResponse.json({ error: 'New password must be different from current' }, { status: 400 })
    }

    const userId = (auth.user as { id?: string }).id
    if (!userId) {
      return NextResponse.json({ error: 'Session missing user id' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const ok = await bcrypt.compare(current, user.passwordHash)
    if (!ok) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }

    const passwordHash = await bcrypt.hash(next, 12)
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 })
  }
}
