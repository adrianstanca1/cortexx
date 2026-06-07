/**
 * Organization (tenant) helpers.
 *
 * Phase 1 of the v1.0 multi-tenancy migration. While the codemod is rolling
 * out across the 120+ routes, these helpers keep the boilerplate minimal and
 * consistent.
 *
 * Until every route is migrated, `MULTITENANT_ENFORCED` defaults to false —
 * helpers still attach orgId when present but don't reject requests that
 * arrive without one. Flipping the flag in production happens once the
 * codemod + cross-org test suite are both green.
 */
import { cookies } from 'next/headers'
import { prisma } from './db'

export const MULTITENANT_ENFORCED = process.env.MULTITENANT_ENFORCED === 'true'

const ACTIVE_ORG_COOKIE = 'cortexx_active_org'

export interface OrgContext {
  organizationId: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  organization: {
    id: string
    slug: string
    name: string
    plan: string
  }
}

/**
 * Resolve the active org for a signed-in user. Returns null when the user
 * has no memberships yet (first-login, pre-onboarding) or the cookie points
 * at an org they're no longer a member of.
 */
export async function getActiveOrg(userId: string): Promise<OrgContext | null> {
  const memberships = await prisma.userOrganization.findMany({
    where: { userId },
    include: {
      organization: { select: { id: true, slug: true, name: true, plan: true } },
    },
    orderBy: { joinedAt: 'asc' },
  })
  if (memberships.length === 0) return null

  let preferred: typeof memberships[number] | undefined
  try {
    const store = await cookies()
    const cookieValue = store.get(ACTIVE_ORG_COOKIE)?.value
    if (cookieValue) preferred = memberships.find(m => m.organizationId === cookieValue)
  } catch {
    // Not in a request context (e.g. seed / cron); fall through to the
    // first-membership default.
  }
  const chosen = preferred || memberships[0]

  return {
    organizationId: chosen.organizationId,
    role: chosen.role as OrgContext['role'],
    organization: chosen.organization,
  }
}

/**
 * Set the active organization cookie. Caller must verify membership before
 * calling — this is a low-level helper.
 */
export async function setActiveOrg(organizationId: string): Promise<void> {
  const store = await cookies()
  store.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
}

/** Slugify a workspace name into an org slug. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'workspace'
}

/**
 * Generate a URL-safe org slug, with a counter suffix on collision.
 * Returns the available slug after at most 50 collision retries.
 */
export async function findAvailableSlug(base: string): Promise<string> {
  const seed = slugify(base)
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? seed : `${seed}-${i + 1}`
    const exists = await prisma.organization.findUnique({ where: { slug: candidate }, select: { id: true } })
    if (!exists) return candidate
  }
  return `${seed}-${Date.now().toString(36)}`
}
