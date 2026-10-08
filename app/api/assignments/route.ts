import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage, canWrite } from '@/lib/rbac'
import { programmeProjectScope } from '@/lib/programme-access'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

interface AssignmentActor {
  role?: string | null
  personaRole?: string | null
}

/** Company managers may edit any company project; PMs only their own projects. */
function mayManageAssignments(actor: AssignmentActor): boolean {
  return canManage(actor.role || '') || (canWrite(actor.role || '') && actor.personaRole === 'project_manager')
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Company required' }, { status: 403 })
  if (auth.personaRole === 'client') return NextResponse.json({ assignments: [] })
  try {
    const projectId = new URL(req.url).searchParams.get('projectId')
    const assignments = await prisma.assignment.findMany({
      where: {
        organizationId: auth.orgId,
        ...(projectId && { projectId }),
        project: { is: { organizationId: auth.orgId, ...programmeProjectScope(auth.session) } },
        member: { is: { organizationId: auth.orgId } },
      },
      include: { member: true, project: true },
      orderBy: [{ projectId: 'asc' }, { member: { name: 'asc' } }],
      take: 1000,
    })
    return NextResponse.json({ assignments })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId || !mayManageAssignments(auth))
    return NextResponse.json({ error: 'Assignment management permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
  const memberId = typeof body.memberId === 'string' ? body.memberId.trim() : ''
  if (!projectId || !memberId || projectId.length > 128 || memberId.length > 128)
    return NextResponse.json({ error: 'Valid projectId and memberId required' }, { status: 400 })
  if (body.onSite !== undefined && typeof body.onSite !== 'boolean')
    return NextResponse.json({ error: 'onSite must be a boolean' }, { status: 400 })
  if (body.role !== undefined && body.role !== null && (typeof body.role !== 'string' || body.role.length > 50))
    return NextResponse.json({ error: 'Invalid assignment role' }, { status: 400 })

  try {
    const [project, member] = await Promise.all([
      prisma.project.findFirst({
        where: { id: projectId, organizationId: auth.orgId, ...programmeProjectScope(auth.session) },
        select: { id: true },
      }),
      prisma.teamMember.findFirst({
        where: { id: memberId, organizationId: auth.orgId },
        select: { id: true },
      }),
    ])
    if (!project || !member) return NextResponse.json({ error: 'Project or team member not accessible' }, { status: 404 })
    const assignment = await prisma.assignment.create({
      data: {
        organizationId: auth.orgId,
        projectId, memberId,
        role: typeof body.role === 'string' ? body.role.trim() || null : null,
        onSite: body.onSite === true,
      },
      include: { member: true, project: true },
    })
    auditLog({ action: 'assignment.create', resourceType: 'Assignment', resourceId: assignment.id,
      userId: auth.userId, ...requestMeta(req) })
    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return NextResponse.json({ error: 'Already assigned' }, { status: 409 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
  }
}
