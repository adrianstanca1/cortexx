import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { generateSecret, renderQrPng } from '@/lib/totp'

export const dynamic = 'force-dynamic'

/**
 * Begin TOTP enrolment. Generates a fresh secret + QR code data URI;
 * the secret is staged on the User row but `totpEnabledAt` stays NULL
 * until /api/auth/2fa/enable verifies a code from the authenticator
 * app. That two-step pattern means a setup attempt that's abandoned
 * mid-flow never leaves 2FA half-enabled.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 401 })
  const __limited = await enforceRateLimit(req, 'auth', userId)
  if (__limited) return __limited

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, totpEnabledAt: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.totpEnabledAt) {
    return NextResponse.json({ error: '2FA already enabled — disable it first to re-enrol', code: 'ALREADY_ENABLED' }, { status: 409 })
  }

  const { base32, otpauthUrl } = generateSecret(user.email)
  const qrPng = await renderQrPng(otpauthUrl)

  // Stage the secret. Not yet active — verify step below flips
  // totpEnabledAt and generates backup codes.
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: base32 },
  })

  return NextResponse.json({ otpauthUrl, qrPng })
}
