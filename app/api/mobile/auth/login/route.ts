import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { enforceRateLimit } from '@/lib/rateLimit'
import { issueMobileToken } from '@/lib/mobileAuth'
import { verifyTotp } from '@/lib/totp'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, 'auth')
  if (limited) return limited

  let body: { email?: unknown; password?: unknown; organizationId?: unknown; totp?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      organizations: {
        include: { organization: { select: { id: true, slug: true, name: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  })
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  if (user.totpEnabledAt && user.totpSecret) {
    const code = typeof body.totp === 'string' ? body.totp.replace(/\s+/g, '') : ''
    if (!code) return NextResponse.json({ error: 'Two-factor code required', code: 'TOTP_REQUIRED' }, { status: 401 })
    if (!verifyTotp(user.totpSecret, code)) return NextResponse.json({ error: 'Invalid two-factor code', code: 'TOTP_INVALID' }, { status: 401 })
  }

  if (user.organizations.length === 0) {
    return NextResponse.json({ error: 'No organization assigned', code: 'NO_ORG' }, { status: 403 })
  }

  const requestedOrgId = typeof body.organizationId === 'string' ? body.organizationId : ''
  const membership = (requestedOrgId && user.organizations.find(m => m.organizationId === requestedOrgId)) || user.organizations[0]
  if (!membership) return NextResponse.json({ error: 'Organization access denied' }, { status: 403 })

  const token = await issueMobileToken({
    userId: user.id,
    organizationId: membership.organizationId,
    organizationRole: membership.role,
    email: user.email,
    name: user.name,
    appRole: user.role,
  })

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationRole: membership.role,
      organization: membership.organization,
      organizations: user.organizations.map(m => ({ ...m.organization, role: m.role })),
    },
  })
}
