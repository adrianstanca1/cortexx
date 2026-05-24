import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from './auth'
import { MULTITENANT_ENFORCED } from './org'
import type { SessionOrgMembership } from './auth'

const ACTIVE_ORG_COOKIE = 'cortexx_active_org'

/**
 * Returns the authenticated session or a 401 NextResponse.
 *
 * Usage in a route handler:
 *   const session = await requireAuth()
 *   if (session instanceof NextResponse) return session
 *   // session.user.id, session.user.name, etc.
 */
export async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  const orgs = ((session.user as { organizations?: SessionOrgMembership[] }).organizations) || []

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
