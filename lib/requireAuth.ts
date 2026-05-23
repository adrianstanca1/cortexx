import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from './auth'

/**
 * Returns the authenticated session or a 401 NextResponse.
 *
 * Usage in a route handler:
 *   const auth = await requireAuth()
 *   if (auth instanceof NextResponse) return auth
 *   // auth.user.id, auth.user.name, etc.
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return session
}

/**
 * Returns the actor name to use when logging activity:
 * session.user.name → session.user.email → 'User'
 */
export function actorName(session: { user?: { name?: string | null; email?: string | null } | null }): string {
  return session.user?.name?.trim() || session.user?.email?.split('@')[0] || 'User'
}
