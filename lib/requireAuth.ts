import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from './auth'
import { prisma } from './db'
import { MULTITENANT_ENFORCED } from './org'
import { reportError } from './errors'
import { setOrgContext } from './tenancy'
import type { SessionOrgMembership } from './auth'

const ACTIVE_ORG_COOKIE = 'cortexx_active_org'

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
    setOrgContext({ organizationId: active.id, userId, role: active.role })
  }

  return session
}

/**
 * Returns the auth session + resolved active organization, or a NextResponse
 * error (401 / 403). Until MULTITENANT_ENFORCED is flipped on in production,
 * requests without an organization return null in `orgId` instead of 403 —
 * routes can opt in to scoping by passing the orgId through to their queries
 * when it exists.
 */
export async function requireOrg() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  } catch {
    // Not in a request context — fall through.
  }

  // Thread the org into the async context so the Prisma tenancy extension
  // can auto-scope every query for the rest of this request.
  setOrgContext({ organizationId: active.id, userId: userId ?? null, role: active.role })

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
