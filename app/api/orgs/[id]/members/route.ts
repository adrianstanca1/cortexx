import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

interface RouteParams { params: Promise<{ id: string }> }

/** GET — list members + roles for the org. */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 401 })
  const { id: organizationId } = await params

  const myMembership = await prisma.userOrganization.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  })
  if (!myMembership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const memberships = await prisma.userOrganization.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, email: true, name: true, image: true } } },
    orderBy: { joinedAt: 'asc' },
  })
  return NextResponse.json({
    members: memberships.map(m => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      image: m.user.image,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
    canManage: canManage(myMembership.role),
  })
}
