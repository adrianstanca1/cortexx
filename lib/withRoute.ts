import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from './requireAuth'
import { canWrite, canManage } from './rbac'
import { runWithOrg, getCurrentOrg } from './tenancy'
import { resolvePersona } from './persona'

const ACTIVE_ORG_COOKIE = 'cortexx_active_org'

interface RouteSession {
  user?: {
    id?: string
    name?: string | null
    email?: string | null
    role?: string
    organizations?: Array<{ id: string; slug: string; name: string; role: string; personaRole?: string }>
  }
}

interface HandlerContext {
  req: NextRequest
  session: RouteSession
  userId: string
  role: string | null
  personaRole: string | null
  orgId: string | null
  orgSlug: string | null
  orgName: string | null
  /**
   * Framework-decoded dynamic route params, forwarded from the route
   * handler's second argument. Next.js decodes each segment, so handlers
   * must read ids from here — never re-parse req.nextUrl.pathname, whose
   * segments stay percent-encoded (a request for /api/tags/%63123 would
   * otherwise pass '%63123' to Prisma instead of 'c123').
   *
   * Typed as plain strings: every route wrapped in withRoute today uses
   * single-segment params, which are always strings. (Next.js types
   * params as string | string[] to cover catch-all routes; the wrapper
   * narrows at the one boundary below rather than forcing every handler
   * to narrow. A future catch-all route must not rely on withRoute params.)
   */
  params: Record<string, string>
}

interface RouteOptions {
  requireOrg?: boolean
  /** Minimum role required. read = any authenticated user, write = member+, manage = admin+ */
  permission?: 'read' | 'write' | 'manage'
}

/**
 * Decode one path segment taken from `req.nextUrl.pathname`.
 *
 * Next.js decodes dynamic route parameters for the framework `params`
 * argument, but `nextUrl.pathname` keeps percent-encoding — so a handler
 * that parses its id out of the pathname must decode the segment exactly
 * once, or an encoded id (e.g. `/api/risks/%63123`) reaches Prisma as
 * `%63123` and 404s instead of matching `c123`. Malformed encodings fall
 * back to the raw segment so the lookup 404s instead of throwing.
 *
 * Generic over the input so `string` stays `string` (and `undefined`
 * stays `undefined`): decoding never changes whether a segment is present.
 */
export function decodePathSegment<T extends string | undefined>(segment: T): T {
  if (segment === undefined) return segment
  try {
    return decodeURIComponent(segment) as T
  } catch {
    return segment
  }
}

/**
 * Wraps an API route with auth/org context and RBAC checks.
 * Returns consistent 401/403 JSON responses and provides a typed
 * context object to the handler.
 */
export function withRoute(
  handler: (ctx: HandlerContext) => Promise<Response | NextResponse> | Response | NextResponse,
  { requireOrg = true, permission = 'read' }: RouteOptions = {}
) {
  return async (req: NextRequest, context?: { params?: Promise<Record<string, string | string[]>> }): Promise<Response | NextResponse> => {
    const session = await requireAuth()
    if (session instanceof NextResponse) {
      return session
    }
    const userId = (session.user as { id?: string }).id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgs = (session as RouteSession).user?.organizations || []
    // requireAuth has already verified the active workspace. In particular,
    // its mobile bearer org must not be replaced by the first membership or
    // by a stale web cookie on a shared device.
    const verifiedOrgId = getCurrentOrg()?.organizationId
    let active = (verifiedOrgId ? orgs.find(o => o.id === verifiedOrgId) : null) || orgs[0] || null
    if (!verifiedOrgId) {
      try {
        const cookieValue = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value
        if (cookieValue) active = orgs.find(o => o.id === cookieValue) || active
      } catch { /* no browser cookie available */ }
    }
    const orgId = active?.id || null
    const orgSlug = active?.slug || null
    const orgName = active?.name || null
    // Per-org role takes precedence; fall back to legacy user-level role for
    // accounts that pre-date the organization model.
    const role = active?.role || null
    const personaRole = active ? resolvePersona(active.personaRole, (session as RouteSession).user?.role, active.role) : ((session as RouteSession).user?.role || null)
    if (personaRole && (session as RouteSession).user) (session as RouteSession).user!.role = personaRole

    if (requireOrg && !orgId) {
      return NextResponse.json({ error: 'Organisation context required' }, { status: 400 })
    }

    if (permission === 'write' && (!role || !canWrite(role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (permission === 'manage' && (!role || !canManage(role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
      // Next.js 15 passes params as a promise; await it once here so
      // handlers always see the decoded object ({} when absent). The cast
      // is the single-segment narrowing documented on HandlerContext.
      const params = ((await context?.params) ?? {}) as Record<string, string>
      const invoke = () => handler({ req, session: session as RouteSession, userId, role, personaRole, orgId, orgSlug, orgName, params })
      return orgId
        ? await runWithOrg({ organizationId: orgId, userId, role }, invoke)
        : await invoke()
    } catch (err) {
      console.error(`[api] ${req.method} ${req.nextUrl.pathname}`, err)
      const message = err instanceof Error ? err.message : 'Internal server error'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }
}
