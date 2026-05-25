import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/** Disable 2FA. Requires the current password to prevent a hijacked
 *  session from silently removing the second factor. */
export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 401 })
  const __limited = enforceRateLimit(req, 'auth', userId)
  if (__limited) return __limited

  let body: { password?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const password = typeof body.password === 'string' ? body.password : ''
  if (!password) return NextResponse.json({ error: 'Password is required to disable 2FA' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, totpEnabledAt: true },
  })
  if (!user || !user.passwordHash) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (!user.totpEnabledAt) return NextResponse.json({ error: '2FA is not enabled' }, { status: 409 })

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return NextResponse.json({ error: 'Wrong password' }, { status: 401 })

  await prisma.user.update({
    where: { id: userId },
    data: { totpEnabledAt: null, totpSecret: null, totpBackupCodes: Prisma.JsonNull },
  })

  auditLog({
    organizationId: '',
    userId,
    action: 'auth.2fa.disable',
    resourceType: 'User',
    resourceId: userId,
    ...requestMeta(req),
  })

  return NextResponse.json({ disabled: true })
}
