import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { canManage } from '@/lib/rbac'
import { sendEmail, inviteTemplate } from '@/lib/email'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = new Set(['admin', 'member', 'viewer'])

interface RouteParams { params: Promise<{ id: string }> }

/** GET — list pending invites for the org (admin+ only). */
export async function GET(_req: NextRequest, { params }: RouteParams) {
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

  const invites = await prisma.organizationInvite.findMany({
    where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ invites })
}

/** POST — issue an invite (admin+ only). */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 401 })
  const { id: organizationId } = await params

  const membership = await prisma.userOrganization.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: { organization: { select: { id: true, name: true } } },
  })
  if (!membership || !canManage(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { email?: unknown; role?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }
  const role = typeof body.role === 'string' && ALLOWED_ROLES.has(body.role) ? body.role : 'member'

  // Reject if the email is already a member of this org.
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existingUser) {
    const existingMembership = await prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: existingUser.id, organizationId } },
      select: { id: true },
    })
    if (existingMembership) {
      return NextResponse.json({ error: 'Already a member' }, { status: 409 })
    }
  }

  const token = crypto.randomBytes(24).toString('base64url')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const invite = await prisma.organizationInvite.create({
    data: { organizationId, email, role, token, expiresAt, invitedById: userId },
  })

  const acceptUrl = `${process.env.NEXTAUTH_URL || 'https://cortexbuildpro.com'}/invite/${token}`
  const tmpl = inviteTemplate({
    inviterName: actorName(session),
    organizationName: membership.organization.name,
    acceptUrl,
    role,
  })
  // Fire-and-forget — invite is created either way; email is best-effort.
  sendEmail({ to: email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text }).catch(() => {})

  auditLog({
    organizationId,
    userId,
    action: 'invite.create',
    resourceType: 'OrganizationInvite',
    resourceId: invite.id,
    metadata: { email, role },
    ...requestMeta(req),
  })

  return NextResponse.json({ invite: { id: invite.id, email, role, expiresAt, acceptUrl } }, { status: 201 })
}
