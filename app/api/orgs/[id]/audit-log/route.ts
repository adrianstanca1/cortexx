import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200

interface RouteParams { params: Promise<{ id: string }> }

/** Audit-log list for the org. Admin+ only. Paginated via take/skip. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 401 })
  const { id: organizationId } = await params

  const membership = await prisma.userOrganization.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  })
  if (!membership || !canManage(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp = req.nextUrl.searchParams
  const take = Math.min(parseInt(sp.get('take') || '100') || 100, MAX_TAKE)
  const skip = Math.max(0, parseInt(sp.get('skip') || '0') || 0)
  const action = sp.get('action')
  const resourceType = sp.get('resourceType')

  const where: { organizationId: string; action?: { startsWith: string }; resourceType?: string } = { organizationId }
  if (action) where.action = { startsWith: action }
  if (resourceType) where.resourceType = resourceType

  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.auditEvent.count({ where }),
  ])

  // Enrich with actor name (best-effort; auditEvents persist even if user
  // is later deleted, in which case actorName falls back to the userId).
  const userIds = Array.from(new Set(events.map(e => e.userId).filter(Boolean) as string[]))
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const usersById = new Map(users.map(u => [u.id, u]))

  return NextResponse.json({
    events: events.map(e => ({
      ...e,
      actor: e.userId
        ? (usersById.get(e.userId) || { id: e.userId, name: null, email: 'deleted user' })
        : null,
    })),
    total,
    hasMore: skip + events.length < total,
  })
}
