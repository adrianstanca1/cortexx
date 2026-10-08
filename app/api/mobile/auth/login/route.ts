import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { findAvailableSlug } from '@/lib/org'
import { reportError } from '@/lib/errors'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { enforceRateLimit } from '@/lib/rateLimit'
import { issueMobileToken } from '@/lib/mobileAuth'
import { verifyTotp } from '@/lib/totp'
import { resolvePersona } from '@/lib/persona'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, 'auth')
  if (limited) return limited

  let body: { email?: unknown; password?: unknown; organizationId?: unknown; totp?: unknown; workspaceName?: unknown }
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
    const workspaceName = typeof body.workspaceName === 'string' ? body.workspaceName.trim() : ''
    if (!workspaceName) {
      return NextResponse.json({
        error: 'Your account needs a workspace. Create a company workspace to continue.',
        code: 'NO_ORG',
      }, { status: 403 })
    }
    if (workspaceName.length > 100) return NextResponse.json({ error: 'Company name is too long' }, { status: 400 })
    try {
      const slug = await findAvailableSlug(workspaceName)
      const trialEndsAt = new Date(Date.now() + 14 * 86400000)
      const organization = await prisma.$transaction(async tx => {
        const created = await tx.organization.create({ data: { name: workspaceName, slug, plan: 'trial', trialEndsAt } })
        await tx.userOrganization.create({
          data: { userId: user.id, organizationId: created.id, role: 'owner', personaRole: 'company_admin' },
        })
        return created
      })
      const token = await issueMobileToken({
        userId: user.id, organizationId: organization.id, organizationRole: 'owner',
        email: user.email, name: user.name, appRole: 'company_admin', passwordHash: user.passwordHash,
      })
      const summary = { id: organization.id, slug: organization.slug, name: organization.name }
      return NextResponse.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: 'company_admin',
          organizationRole: 'owner', organization: summary,
          organizations: [{ ...summary, role: 'owner', personaRole: 'company_admin' }],
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json({ error: 'Company name is already in use. Choose another name.' }, { status: 409 })
      }
      reportError(error, { context: 'mobile.auth.onboard' })
      return NextResponse.json({ error: 'Unable to create workspace' }, { status: 500 })
    }
  }

  const requestedOrgId = typeof body.organizationId === 'string' ? body.organizationId : ''
  const membership = (requestedOrgId && user.organizations.find(m => m.organizationId === requestedOrgId)) || user.organizations[0]
  if (!membership) return NextResponse.json({ error: 'Organization access denied' }, { status: 403 })
  const personaRole = resolvePersona(membership.personaRole, user.role, membership.role)

  const token = await issueMobileToken({
    userId: user.id,
    organizationId: membership.organizationId,
    organizationRole: membership.role,
    email: user.email,
    name: user.name,
    appRole: personaRole,
    passwordHash: user.passwordHash,
  })

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: personaRole,
      organizationRole: membership.role,
      organization: membership.organization,
      organizations: user.organizations.map(m => ({ ...m.organization, role: m.role, personaRole: resolvePersona(m.personaRole, user.role, m.role) })),
    },
  })
}
