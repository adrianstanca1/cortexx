import { randomBytes, createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { enforceRateLimit } from '@/lib/rateLimit'
import { isEmailConfigured, sendEmail } from '@/lib/email'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const generic = { message: 'If the address belongs to an account, a password-reset link will be sent.' }

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, 'auth')
  if (limited) return limited
  let body: { email?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: 'Password reset email is temporarily unavailable. Contact support.' }, { status: 503 })
  }
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } })
    // Do not distinguish registered from unregistered email addresses.
    if (!user?.passwordHash) return NextResponse.json(generic)
    const token = randomBytes(32).toString('hex')
    const digest = createHash('sha256').update(token).digest('hex')
    const identifier = 'password-reset:' + email
    await prisma.$transaction(async tx => {
      await tx.verificationToken.deleteMany({ where: { identifier } })
      await tx.verificationToken.create({
        data: { identifier, token: digest, expires: new Date(Date.now() + 30 * 60 * 1000) },
      })
    })
    const resetUrl = new URL('/reset-password', 'https://cortexbuildpro.tech')
    resetUrl.searchParams.set('token', token)
    const url = resetUrl.toString()
    const result = await sendEmail({
      to: email, subject: 'Reset your Cortexx password',
      text: 'Reset your Cortexx password using this link (valid for 30 minutes):\n' + url + '\n\nIf you did not request this, ignore the message.',
      html: '<p>We received a request to reset your Cortexx password.</p>' +
        '<p><a href="' + url + '">Reset your password</a> (expires in 30 minutes).</p>' +
        '<p>If you did not request this, you can safely ignore this message.</p>',
    })
    if (result.delivered < 1) {
      await prisma.verificationToken.deleteMany({ where: { token: digest } })
      reportError(new Error('Password reset email delivery failed: ' + (result.error || 'provider unavailable')), { context: 'auth.password-reset.request' })
    }
    return NextResponse.json(generic)
  } catch (error) {
    reportError(error, { context: 'auth.password-reset.request' })
    return NextResponse.json({ error: 'Unable to process password reset' }, { status: 500 })
  }
}
