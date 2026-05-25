import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

interface RouteParams { params: Promise<{ token: string }> }

/** GET — fetch invite details (public — needed by the accept page) */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { token } = await params
  const invite = await prisma.organizationInvite.findUnique({
    where: { token },
    include: { organization: { select: { id: true, slug: true, name: true } } },
  })
  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (invite.acceptedAt) return NextResponse.json({ error: 'Invite already accepted', code: 'ALREADY_ACCEPTED' }, { status: 410 })
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invite expired', code: 'EXPIRED' }, { status: 410 })
  }

  return NextResponse.json({
    invite: {
      organizationName: invite.organization.name,
      organizationSlug: invite.organization.slug,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    },
  })
}

/** POST — accept the invite. Requires the user to be signed in with the
 * matching email address. Atomic: creates the membership + marks the invite
 * accepted in one transaction. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = (session.user as { id?: string }).id
  const userEmail = (session.user as { email?: string }).email?.toLowerCase()
  if (!userId || !userEmail) return NextResponse.json({ error: 'No user id' }, { status: 401 })

  const { token } = await params
  const invite = await prisma.organizationInvite.findUnique({ where: { token } })
  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (invite.acceptedAt) return NextResponse.json({ error: 'Already accepted', code: 'ALREADY_ACCEPTED' }, { status: 410 })
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Expired', code: 'EXPIRED' }, { status: 410 })
  }
  if (invite.email.toLowerCase() !== userEmail) {
    return NextResponse.json({ error: 'This invite is for a different email address', code: 'EMAIL_MISMATCH' }, { status: 403 })
  }

  await prisma.$transaction(async (tx) => {
    // Upsert membership — if the user was previously a member, restore.
    await tx.userOrganization.upsert({
      where: { userId_organizationId: { userId, organizationId: invite.organizationId } },
      create: { userId, organizationId: invite.organizationId, role: invite.role },
      update: { role: invite.role },
    })
    await tx.organizationInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    })
  })

  auditLog({
    organizationId: invite.organizationId,
    userId,
    action: 'invite.accept',
    resourceType: 'OrganizationInvite',
    resourceId: invite.id,
    metadata: { role: invite.role },
    ...requestMeta(req),
  })

  return NextResponse.json({ ok: true, organizationId: invite.organizationId })
}
