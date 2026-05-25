import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { getCurrentOrg } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

/**
 * List the members + roles for the CURRENT active organisation. Convenience
 * wrapper over /api/orgs/[id]/members for clients that only want the active
 * workspace — they don't have to thread the org id through every request.
 *
 * Uses the AsyncLocalStorage org context that requireAuth sets up. Falls
 * back to the user's first membership if no active-org cookie was present.
 */
export async function GET() {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const ctx = getCurrentOrg()
  if (!ctx?.organizationId) return NextResponse.json({ members: [] })

  const memberships = await prisma.userOrganization.findMany({
    where: { organizationId: ctx.organizationId },
    include: { user: { select: { id: true, email: true, name: true, image: true, updatedAt: true } } },
    orderBy: { joinedAt: 'asc' },
  })
  return NextResponse.json({
    members: memberships.map(m => ({
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      image: m.user.image,
      role: m.role,
      joinedAt: m.joinedAt,
      lastSeenAt: m.user.updatedAt,
    })),
  })
}
