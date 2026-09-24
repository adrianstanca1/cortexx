import { NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { auth } from './auth'
import { prisma } from './db'
import { MULTITENANT_ENFORCED } from './org'
import { reportError } from './errors'
import { beginOrgContext } from './tenancy'
import type { SessionOrgMembership } from './auth'
import { bearerToken, verifyMobileToken } from './mobileAuth'

const ACTIVE_ORG_COOKIE = 'cortexx_active_org'

async function mobileBearerSession(orgContext: { organizationId: string | null; userId: string | null; role: string | null }) {
  let token: string | null = null
  try { token = bearerToken((await headers()).get('authorization')) } catch { return null }
  if (!token) return null

  try {
    const claims = await verifyMobileToken(token)
    const membership = await prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: claims.sub, organizationId: claims.orgId } },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } },
        organization: { select: { id: true, slug: true, name: true } },
      },
    })
    if (!membership || membership.user.email.toLowerCase() !== claims.email.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const org = {
      id: membership.organization.id,
      slug: membership.organization.slug,
      name: membership.organization.name,
      role: membership.role,
    } satisfies SessionOrgMembership
    const session = {
      user: {
        id: membership.user.id,
        email: membership.user.email,
        name: membership.user.name,
        role: membership.user.role,
        organizations: [org],
      },
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }
    Object.assign(orgContext, { organizationId: org.id, userId: membership.user.id, role: membership.role })
    return session
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

/**
 * When the JWT carries `orgs: []`, hit the DB once to confirm the user
 * really has no memberships before falling through. The JWT loader in
 * lib/auth.ts swallows DB errors and caches an empty list — without
 * this fallback, one bad sign-in permanently breaks every owned-model
 * route for the rest of the 30-day token lifetime.
 */
async function refetchOrgsFromDb(userId: string): Promise<SessionOrgMembership[]> {
  try {
    const memberships = await prisma.userOrganization.findMany({
      where: { userId },
      include: { organization: { select: { id: true, slug: true, name: true } } },
      orderBy: { joinedAt: 'asc' },
    })
    return memberships.map(m => ({
      id: m.organization.id,
      slug: m.organization.slug,
      name: m.organization.name,
      role: m.role,
    }))
  } catch (error) {
    reportError(error, { context: 'requireAuth.refetchOrgsFromDb', userId })
    return []
  }
}

/**
 * Returns the authenticated session or a 401 NextResponse.
 *
 * Usage in a route handler:
 *   const session = await requireAuth()
 *   if (session instanceof NextResponse) return session
 *   // session.user.id, session.user.name, etc.
 *
 * SIDE EFFECT (intentional, transparent to callers): when the user has
 * an active organization, threads it into the AsyncLocalStorage that
 * powers the Prisma tenancy extension. Every Prisma query for an owned
 * model in the rest of this request will auto-filter by organizationId
 * without the route handler doing anything explicit. This is what lets
 * the 120+ existing routes opt in to multi-tenancy without a codemod.
 */
export async function requireAuth() {
  const orgContext = beginOrgContext()
  const mobile = await mobileBearerSession(orgContext)
  if (mobile) return mobile

  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as { id?: string }).id || null
  let orgs = ((session.user as { organizations?: SessionOrgMembership[] }).organizations) || []
  if (orgs.length === 0 && userId) {
    orgs = await refetchOrgsFromDb(userId)
  }

  if (orgs.length > 0) {
    let active = orgs[0]
    try {
      const store = await cookies()
      const cookieValue = store.get(ACTIVE_ORG_COOKIE)?.value
      if (cookieValue) {
        const match = orgs.find(o => o.id === cookieValue)
        if (match) active = match
      }
    } catch { /* not in a request context */ }
    Object.assign(orgContext, { organizationId: active.id, userId, role: active.role })
  }

  return session
}

/**
 * Returns the auth session + resolved active organization, or a NextResponse
 * error (401 / 403). Web sessions and native bearer sessions both establish
 * the same request-scoped organization context used by the Prisma tenancy
 * extension.
 */
export async function requireOrg() {
  const orgContext = beginOrgContext()
  const mobile = await mobileBearerSession(orgContext)
  let session

  if (mobile) {
    if (mobile instanceof NextResponse) return mobile
    session = mobile
  } else {
    session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const userId = (session.user as { id?: string }).id
  let orgs = ((session.user as { organizations?: SessionOrgMembership[] }).organizations) || []
  if (orgs.length === 0 && userId) {
    orgs = await refetchOrgsFromDb(userId)
  }

  if (orgs.length === 0) {
    if (MULTITENANT_ENFORCED) {
      return NextResponse.json({ error: 'No organization', code: 'NO_ORG' }, { status: 403 })
    }
    return { session, userId, orgId: null as string | null, role: null as string | null }
  }

  let active = orgs[0]
  try {
    const store = await cookies()
    const cookieValue = store.get(ACTIVE_ORG_COOKIE)?.value
    if (cookieValue) {
      const match = orgs.find(o => o.id === cookieValue)
      if (match) active = match
    }
  } catch { /* native bearer requests have no cookie requirement */ }

  Object.assign(orgContext, { organizationId: active.id, userId: userId ?? null, role: active.role })

  return {
    session,
    userId,
    orgId: active.id,
    orgSlug: active.slug,
    orgName: active.name,
    role: active.role,
  }
}

/**
 * Returns the actor name to use when logging activity:
 * session.user.name → session.user.email → 'User'
 */
export function actorName(session: { user?: { name?: string | null; email?: string | null } | null }): string {
  return session.user?.name?.trim() || session.user?.email?.split('@')[0] || 'User'
}
