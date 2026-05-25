import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { verifyTotp, verifyBackupCode } from '@/lib/totp'

export const dynamic = 'force-dynamic'

/** Verify a TOTP code OR a backup code for the current signed-in
 *  user. Used by the login-challenge step once we hook 2FA into the
 *  Auth.js v5 credentials flow (follow-up PR). For now, callable
 *  directly by clients that want to confirm a code works before
 *  shipping the full challenge flow.
 *
 *  Body: { code: string }  — 6-digit TOTP, or an unhashed backup code
 *  Returns: { ok: boolean, method: 'totp' | 'backup' }              */
export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 401 })
  const __limited = enforceRateLimit(req, 'auth', userId)
  if (__limited) return __limited

  let body: { code?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabledAt: true, totpBackupCodes: true },
  })
  if (!user || !user.totpEnabledAt || !user.totpSecret) {
    return NextResponse.json({ error: '2FA is not enabled', code: 'NOT_ENABLED' }, { status: 409 })
  }

  if (verifyTotp(user.totpSecret, code)) {
    return NextResponse.json({ ok: true, method: 'totp' })
  }

  // Try as backup code. Each one is single-use.
  const backupCodes = Array.isArray(user.totpBackupCodes) ? (user.totpBackupCodes as string[]) : []
  const idx = await verifyBackupCode(backupCodes, code)
  if (idx >= 0) {
    const remaining = backupCodes.slice(0, idx).concat(backupCodes.slice(idx + 1))
    await prisma.user.update({
      where: { id: userId },
      data: { totpBackupCodes: remaining },
    })
    return NextResponse.json({ ok: true, method: 'backup', backupCodesRemaining: remaining.length })
  }

  return NextResponse.json({ ok: false, error: 'Invalid code', code: 'INVALID_CODE' }, { status: 401 })
}
