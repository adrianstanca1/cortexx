import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { enforceRateLimit } from '@/lib/rateLimit'
import { findAvailableSlug } from '@/lib/org'
import { issueMobileToken } from '@/lib/mobileAuth'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Mobile signup creates a workspace atomically: no orphaned account that cannot log in. */
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, 'auth')
  if (limited) return limited
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const workspaceName = typeof body.workspaceName === 'string' ? body.workspaceName.trim() : ''
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  if (password.length < 8 || password.length > 200)
    return NextResponse.json({ error: 'Password must contain 8–200 characters' }, { status: 400 })
  if (name.length > 100 || !workspaceName || workspaceName.length > 100)
    return NextResponse.json({ error: 'Company name is required (max 100 characters)' }, { status: 400 })

  try {
    const slug = await findAvailableSlug(workspaceName)
    const passwordHash = await bcrypt.hash(password, 12)
    const trialEndsAt = new Date(Date.now() + 14 * 86400000)
    const { user, organization } = await prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: { email, name: name || null, passwordHash },
        select: { id: true, email: true, name: true, passwordHash: true },
      })
      const organization = await tx.organization.create({
        data: { name: workspaceName, slug, plan: 'trial', trialEndsAt },
        select: { id: true, slug: true, name: true },
      })
      await tx.userOrganization.create({
        data: { userId: user.id, organizationId: organization.id, role: 'owner', personaRole: 'company_admin' },
      })
      return { user, organization }
    })
    const token = await issueMobileToken({
      userId: user.id, organizationId: organization.id, organizationRole: 'owner',
      email: user.email, name: user.name, appRole: 'company_admin', passwordHash: user.passwordHash,
    })
    return NextResponse.json({
      token,
      user: {
        id: user.id, email: user.email, name: user.name, role: 'company_admin',
        organizationRole: 'owner', organization,
        organizations: [{ ...organization, role: 'owner', personaRole: 'company_admin' }],
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return NextResponse.json({ error: 'Account or workspace already exists. Sign in if you already have an account.' }, { status: 409 })
    reportError(error, { context: 'mobile.auth.register' })
    return NextResponse.json({ error: 'Unable to create account at this time' }, { status: 500 })
  }
}
