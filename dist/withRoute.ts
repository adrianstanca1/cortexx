import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from './requireAuth'
import { canWrite, canManage } from './rbac'

const ACTIVE_ORG_COOKIE = 'cortexx_active_org'

interface RouteSession {
  user?: {
    id?: string
    name?: string | null
    email?: string | null
    role?: string
    organizations?: Array<{ id: string; slug: string; name: string; role: string }>
  }
}

interface HandlerContext {
  req: NextRequest
  session: RouteSession
  userId: string
  role: string | null
  orgId: string | null
  orgSlug: string | null
  orgName: string | null
}

interface RouteOptions {
  requireOrg?: boolean
  /** Minimum role required. read = any authenticated user, write = member+, manage = admin+ */
  permission?: 'read' | 'write' | 'manage'
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
  return async (req: NextRequest): Promise<Response | NextResponse> => {
    const session = await requireAuth()
    if (session instanceof NextResponse) {
      return session
    }
    const userId = (session.user as { id?: string }).id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgs = (session as RouteSession).user?.organizations || []
    let active = orgs[0] || null
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
    const orgId = active?.id || null
    const orgSlug = active?.slug || null
    const orgName = active?.name || null
    // Per-org role takes precedence; fall back to legacy user-level role for
    // accounts that pre-date the organization model.
    const role = active?.role || (session as RouteSession).user?.role || null

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
      return await handler({ req, session: session as RouteSession, userId, role, orgId, orgSlug, orgName })
    } catch (err) {
      console.error(`[api] ${req.method} ${req.nextUrl.pathname}`, err)
      const message = err instanceof Error ? err.message : 'Internal server error'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }
}
