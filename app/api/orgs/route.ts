import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { findAvailableSlug } from '@/lib/org'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * List the orgs the current user is a member of.
 */
export async function GET() {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 401 })

  const memberships = await prisma.userOrganization.findMany({
    where: { userId },
    include: {
      organization: { select: { id: true, slug: true, name: true, plan: true, trialEndsAt: true } },
    },
    orderBy: { joinedAt: 'asc' },
  })
  return NextResponse.json({
    organizations: memberships.map(m => ({
      ...m.organization,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
  })
}

/**
 * Create a new organization. The creator becomes the owner.
 * Used by the post-signup onboarding flow.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const __limited = await enforceRateLimit(req, 'write', (session.user as { id?: string }).id)
  if (__limited) return __limited
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 401 })

  let body: { name?: unknown; slug?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 })
  if (name.length > 100) return NextResponse.json({ error: 'Workspace name too long (max 100)' }, { status: 400 })

  const slugBase = typeof body.slug === 'string' && body.slug.trim() ? body.slug : name
  const slug = await findAvailableSlug(slugBase)

  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + 14)

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: { slug, name, plan: 'trial', trialEndsAt },
    })
    await tx.userOrganization.create({
      data: { userId, organizationId: created.id, role: 'owner' },
    })
    return created
  })

  const meta = requestMeta(req)
  auditLog({
    organizationId: org.id,
    userId,
    action: 'organization.create',
    resourceType: 'Organization',
    resourceId: org.id,
    metadata: { name, slug },
    ...meta,
  })

  return NextResponse.json({ organization: { id: org.id, slug: org.slug, name: org.name, plan: org.plan } }, { status: 201 })
}
