import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

interface RouteParams { params: Promise<{ id: string }> }

/**
 * Single-org detail. Returns the org row + member count + safe billing
 * fields for the /settings/organization billing section. Caller must be
 * a member; admins+ get the full plan/trial/subscriptionStatus picture.
 *
 * NEVER returns Stripe IDs — those are infra detail, not user-facing.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 401 })
  const { id } = await params

  const membership = await prisma.userOrganization.findUnique({
    where: { userId_organizationId: { userId, organizationId: id } },
    select: { role: true },
  })
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const organization = await prisma.organization.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      plan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      createdAt: true,
      _count: { select: { members: true } },
    },
  })
  if (!organization) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ organization })
}
