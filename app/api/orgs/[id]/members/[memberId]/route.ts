import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { canManage, hasRole, isOwner } from '@/lib/rbac'
import { auditLog, requestMeta } from '@/lib/audit'
import { isAssignablePersona } from '@/lib/persona'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = new Set(['owner', 'admin', 'member', 'viewer'])

interface RouteParams { params: Promise<{ id: string; memberId: string }> }

/** PUT — change a member's role. Admin+ can promote up to admin; only an
 * owner can grant or revoke the owner role. */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 401 })
  const { id: organizationId, memberId } = await params

  const myMembership = await prisma.userOrganization.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  })
  if (!myMembership || !canManage(myMembership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { role?: unknown; personaRole?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const hasRoleChange = body.role !== undefined
  const hasPersonaChange = body.personaRole !== undefined
  if (!hasRoleChange && !hasPersonaChange) return NextResponse.json({ error: 'Role or personaRole is required' }, { status: 400 })
  if (hasRoleChange && (typeof body.role !== 'string' || !ALLOWED_ROLES.has(body.role))) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  if (hasPersonaChange && !isAssignablePersona(body.personaRole)) return NextResponse.json({ error: 'Invalid construction persona' }, { status: 400 })

  const target = await prisma.userOrganization.findUnique({
    where: { id: memberId },
    select: { id: true, userId: true, organizationId: true, role: true, personaRole: true },
  })
  if (!target || target.organizationId !== organizationId) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }
  const newRole = hasRoleChange ? String(body.role) : target.role
  const newPersonaRole = hasPersonaChange ? String(body.personaRole) : target.personaRole
  if (newRole === 'owner' && !isOwner(myMembership.role)) return NextResponse.json({ error: 'Only an owner can promote to owner' }, { status: 403 })
  if (newRole === 'owner' && newPersonaRole !== 'company_admin') return NextResponse.json({ error: 'Workspace owners must use the Company Admin persona' }, { status: 409 })
  if (newPersonaRole === 'company_admin' && !['owner', 'admin'].includes(newRole)) return NextResponse.json({ error: 'Company Admin persona requires owner or admin workspace access' }, { status: 409 })

  // Demoting an owner — only another owner can do it, and the org must keep
  // at least one owner after the change.
  if (target.role === 'owner' && newRole !== 'owner') {
    if (!isOwner(myMembership.role)) {
      return NextResponse.json({ error: 'Only an owner can demote an owner' }, { status: 403 })
    }
    const otherOwners = await prisma.userOrganization.count({
      where: { organizationId, role: 'owner', id: { not: target.id } },
    })
    if (otherOwners === 0) {
      return NextResponse.json({ error: 'Cannot demote the last owner', code: 'LAST_OWNER' }, { status: 409 })
    }
  }

  const updated = await prisma.userOrganization.update({
    where: { id: memberId },
    data: { role: newRole, personaRole: newPersonaRole },
  })

  auditLog({
    organizationId,
    userId,
    action: 'member.role-change',
    resourceType: 'UserOrganization',
    resourceId: memberId,
    metadata: { accessFrom: target.role, accessTo: newRole, personaFrom: target.personaRole, personaTo: newPersonaRole, targetUserId: target.userId },
    ...requestMeta(req),
  })

  return NextResponse.json({ ok: true, role: updated.role, personaRole: updated.personaRole })
}

/** DELETE — remove a member from the org. Owners can be removed only by
 * another owner, and never if they are the last owner. */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 401 })
  const { id: organizationId, memberId } = await params

  const myMembership = await prisma.userOrganization.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  })
  if (!myMembership || !canManage(myMembership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const target = await prisma.userOrganization.findUnique({
    where: { id: memberId },
    select: { id: true, userId: true, organizationId: true, role: true },
  })
  if (!target || target.organizationId !== organizationId) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  if (target.role === 'owner') {
    if (!isOwner(myMembership.role)) {
      return NextResponse.json({ error: 'Only an owner can remove an owner' }, { status: 403 })
    }
    const otherOwners = await prisma.userOrganization.count({
      where: { organizationId, role: 'owner', id: { not: target.id } },
    })
    if (otherOwners === 0) {
      return NextResponse.json({ error: 'Cannot remove the last owner', code: 'LAST_OWNER' }, { status: 409 })
    }
  }

  await prisma.userOrganization.delete({ where: { id: memberId } })

  auditLog({
    organizationId,
    userId,
    action: 'member.remove',
    resourceType: 'UserOrganization',
    resourceId: memberId,
    metadata: { targetUserId: target.userId, role: target.role },
    ...requestMeta(req),
  })

  return NextResponse.json({ ok: true })
}
