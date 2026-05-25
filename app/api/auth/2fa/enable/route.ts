import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { verifyTotp, generateBackupCodes } from '@/lib/totp'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/** Verify a TOTP code against the staged secret and, if it matches,
 *  flip totpEnabledAt + generate one-time backup codes. Plaintext
 *  backup codes are returned ONCE so the user can save them. */
export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 401 })
  const __limited = await enforceRateLimit(req, 'auth', userId)
  if (__limited) return __limited

  let body: { code?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const code = typeof body.code === 'string' ? body.code : ''
  if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabledAt: true },
  })
  if (!user || !user.totpSecret) {
    return NextResponse.json({ error: 'No staged 2FA secret — call /api/auth/2fa/setup first', code: 'NO_SECRET' }, { status: 409 })
  }
  if (user.totpEnabledAt) {
    return NextResponse.json({ error: '2FA already enabled', code: 'ALREADY_ENABLED' }, { status: 409 })
  }

  if (!verifyTotp(user.totpSecret, code)) {
    return NextResponse.json({ error: 'Invalid code — try the next one your authenticator shows', code: 'INVALID_CODE' }, { status: 401 })
  }

  const { plain, hashed } = await generateBackupCodes()
  await prisma.user.update({
    where: { id: userId },
    data: { totpEnabledAt: new Date(), totpBackupCodes: hashed },
  })

  auditLog({
    organizationId: '',  // user-level event; org context is best-effort
    userId,
    action: 'auth.2fa.enable',
    resourceType: 'User',
    resourceId: userId,
    ...requestMeta(req),
  })

  return NextResponse.json({
    enabled: true,
    backupCodes: plain,
    notice: 'Save these backup codes somewhere safe. They are shown only once and each can be used once if you lose your authenticator.',
  })
}
