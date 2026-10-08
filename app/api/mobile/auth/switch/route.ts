import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { bearerToken, issueMobileToken } from '@/lib/mobileAuth'
import { resolvePersona } from '@/lib/persona'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Switch workspaces for an existing mobile account without changing identity. */
export async function POST(req: NextRequest) {
  // Browser cookies alone must never mint a native JWT. A valid mobile bearer
  // session is mandatory and requireAuth checks its signature and membership.
  if (!bearerToken(req.headers.get('authorization')))
    return NextResponse.json({ error: 'Mobile sign-in required' }, { status: 401 })
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limited = await enforceRateLimit(req, 'write', userId)
  if (limited) return limited
  let body: { organizationId?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : ''
  if (!organizationId) return NextResponse.json({ error: 'Select a company workspace' }, { status: 400 })
  const membership = await prisma.userOrganization.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: {
      organization: { select: { id: true, slug: true, name: true } },
      user: { select: { id: true, email: true, name: true, role: true, passwordHash: true } },
    },
  })
  if (!membership) return NextResponse.json({ error: 'Company workspace access denied' }, { status: 403 })
  const personaRole = resolvePersona(membership.personaRole, membership.user.role, membership.role)
  const token = await issueMobileToken({
    userId, organizationId, organizationRole: membership.role,
    email: membership.user.email, name: membership.user.name,
    appRole: personaRole, passwordHash: membership.user.passwordHash,
  })
  const organizations = await prisma.userOrganization.findMany({
    where: { userId },
    include: { organization: { select: { id: true, slug: true, name: true } } },
    orderBy: { joinedAt: 'asc' },
  })
  return NextResponse.json({ token, user: {
    id: userId, email: membership.user.email, name: membership.user.name,
    role: personaRole, organizationRole: membership.role,
    organization: membership.organization,
    organizations: organizations.map(m => ({
      ...m.organization, role: m.role,
      personaRole: resolvePersona(m.personaRole, membership.user.role, m.role),
    })),
  } })
}
