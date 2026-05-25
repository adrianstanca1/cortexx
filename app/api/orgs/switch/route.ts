import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const ACTIVE_ORG_COOKIE = 'cortexx_active_org'

/**
 * Switch the active organization for the current user. The user must be
 * a member of the target org; otherwise 403.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const __limited = await enforceRateLimit(req, 'write', (session.user as { id?: string }).id)
  if (__limited) return __limited
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 401 })

  let body: { organizationId?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : ''
  if (!organizationId) return NextResponse.json({ error: 'organizationId required' }, { status: 400 })

  const membership = await prisma.userOrganization.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { id: true },
  })
  if (!membership) return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 })

  const store = await cookies()
  store.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })

  return NextResponse.json({ ok: true })
}
