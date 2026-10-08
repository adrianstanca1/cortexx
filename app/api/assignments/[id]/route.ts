import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { canManage, canWrite } from '@/lib/rbac'
import { programmeProjectScope } from '@/lib/programme-access'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

function canEdit(role: string | null, personaRole: string | null | undefined): boolean {
  return canManage(role || '') || (canWrite(role || '') && personaRole === 'project_manager')
}

export async function PATCH(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const { id } = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId || !canEdit(auth.role, auth.personaRole))
    return NextResponse.json({ error: 'Assignment management permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (body.onSite === undefined && body.role === undefined)
    return NextResponse.json({ error: 'No update provided' }, { status: 400 })
  if (body.onSite !== undefined && typeof body.onSite !== 'boolean')
    return NextResponse.json({ error: 'onSite must be a boolean' }, { status: 400 })
  if (body.role !== undefined && body.role !== null && (typeof body.role !== 'string' || body.role.length > 50))
    return NextResponse.json({ error: 'Invalid assignment role' }, { status: 400 })
  try {
    const current = await prisma.assignment.findFirst({
      where: {
        id, organizationId: auth.orgId,
        project: { is: { organizationId: auth.orgId, ...programmeProjectScope(auth.session) } },
        member: { is: { organizationId: auth.orgId } },
      },
      select: { id: true },
    })
    if (!current) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    const assignment = await prisma.assignment.update({
      where: { id, organizationId: auth.orgId },
      data: {
        ...(body.onSite !== undefined ? { onSite: body.onSite as boolean } : {}),
        ...(body.role !== undefined ? { role: typeof body.role === 'string' ? body.role.trim() || null : null } : {}),
      },
      include: { member: true },
    })
    auditLog({ action: 'assignment.update', resourceType: 'Assignment', resourceId: id,
      userId: auth.userId, ...requestMeta(req) })
    return NextResponse.json(assignment)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const { id } = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId || !canEdit(auth.role, auth.personaRole))
    return NextResponse.json({ error: 'Assignment management permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  try {
    const existing = await prisma.assignment.findFirst({
      where: {
        id, organizationId: auth.orgId,
        project: { is: { organizationId: auth.orgId, ...programmeProjectScope(auth.session) } },
        member: { is: { organizationId: auth.orgId } },
      },
      include: { member: { select: { name: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    await prisma.assignment.delete({ where: { id, organizationId: auth.orgId } })
    auditLog({ action: 'assignment.delete', resourceType: 'Assignment', resourceId: id,
      userId: auth.userId, ...requestMeta(req) })
    prisma.activity.create({
      data: {
        projectId: existing.projectId,
        actorName: actorName(auth.session),
        actorType: 'human',
        action: `unassigned ${existing.member.name} from project`,
        iconType: 'hardhat',
      },
    }).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to remove assignment' }, { status: 500 })
  }
}
