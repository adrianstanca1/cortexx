import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, 'auth')
  if (limited) return limited
  let body: { token?: unknown; password?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!/^[a-f0-9]{64}$/.test(token)) return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
  if (password.length < 8 || password.length > 200)
    return NextResponse.json({ error: 'Password must contain 8–200 characters' }, { status: 400 })
  const digest = createHash('sha256').update(token).digest('hex')
  try {
    const passwordHash = await bcrypt.hash(password, 12)
    const success = await prisma.$transaction(async tx => {
      const record = await tx.verificationToken.findUnique({ where: { token: digest } })
      if (!record || !record.identifier.startsWith('password-reset:') || record.expires <= new Date()) return false
      const consumed = await tx.verificationToken.deleteMany({
        where: { token: digest, identifier: record.identifier, expires: { gt: new Date() } },
      })
      if (consumed.count !== 1) return false
      const email = record.identifier.slice('password-reset:'.length)
      const updated = await tx.user.updateMany({
        where: { email }, data: { passwordHash, passwordChangedAt: new Date() },
      })
      if (updated.count !== 1) return false
      await tx.verificationToken.deleteMany({ where: { identifier: record.identifier } })
      return true
    })
    if (!success) return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error, { context: 'auth.password-reset.confirm' })
    return NextResponse.json({ error: 'Could not reset password' }, { status: 500 })
  }
}
