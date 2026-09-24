import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import { canManage } from '@/lib/rbac'
import { getCurrentOrg } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

function scopedProjectWhere(id: string, auth: { user?: { email?: string | null; role?: string } }): Prisma.ProjectWhereInput {
  const appRole = auth.user?.role || ''
  const email = auth.user?.email?.trim() || ''
  if (!['project_manager', 'foreman', 'operative'].includes(appRole)) return { id }
  if (!email) return { id: '__no_assigned_project__' }
  return { id, assignments: { some: { member: { email: { equals: email, mode: 'insensitive' } } } } }
}

function canOperationallyEditProject(auth: { user?: { role?: string } }): boolean {
  const orgRole = getCurrentOrg()?.role
  if (orgRole && canManage(orgRole)) return true
  return auth.user?.role === 'project_manager'
}

function isCompanyAdmin(): boolean {
  const orgRole = getCurrentOrg()?.role
  return !!orgRole && canManage(orgRole)
}

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    // Cap every include to a reasonable hard limit. A long-running
    // project with thousands of tasks/docs/invoices would otherwise
    // ship megabytes of nested JSON to a single page, freezing the
    // worker on serialise. Sub-resource pagination is via the per-
    // type routes (/api/tasks?projectId=…, /api/documents?projectId=…).
    const project = await prisma.project.findFirst({
      where: scopedProjectWhere(params.id, auth),
      include: {
        tasks: { include: { assignee: true }, orderBy: { dueDate: 'asc' }, take: 200 },
        assignments: { include: { member: true }, take: 200 },
        invoices: isCompanyAdmin() ? { orderBy: { createdAt: 'desc' }, take: 100 } : false,
        activities: { orderBy: { createdAt: 'desc' }, take: 10 },
        documents: { orderBy: { createdAt: 'desc' }, take: 200 },
        _count: { select: { tasks: true, assignments: true } },
      },
    })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ project })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (limited) return limited
  if (!canOperationallyEditProject(auth)) {
    return NextResponse.json({ error: 'Project Manager or Company Admin permission required' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const appRole = (auth.user as { role?: string }).role || ''
    if (appRole === 'project_manager') {
      const assigned = await prisma.project.findFirst({ where: scopedProjectWhere(params.id, auth), select: { id: true } })
      if (!assigned) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
      const adminOnlyFields = ['name', 'clientName', 'budget', 'spent', 'onSiteCount']
      if (adminOnlyFields.some(key => body[key] !== undefined)) {
        return NextResponse.json({ error: 'Company admin permission required for project setup and financial fields' }, { status: 403 })
      }
    }
    if (body.name !== undefined && !String(body.name).trim()) {
      return NextResponse.json({ error: 'Project name cannot be empty' }, { status: 400 })
    }
    if (body.startDate && body.endDate && new Date(body.endDate) < new Date(body.startDate)) {
      return NextResponse.json({ error: 'End date must be on or after start date' }, { status: 400 })
    }
    if (body.budget !== undefined && (!Number.isFinite(Number(body.budget)) || Number(body.budget) < 0)) {
      return NextResponse.json({ error: 'Budget must be a non-negative number' }, { status: 400 })
    }
    if (body.spent !== undefined) {
      return NextResponse.json({ error: 'Project spend is ledger-derived; post or reconcile project costs instead' }, { status: 409 })
    }
    if (body.progress !== undefined && (!Number.isFinite(Number(body.progress)) || Number(body.progress) < 0 || Number(body.progress) > 100)) {
      return NextResponse.json({ error: 'Progress must be between 0 and 100' }, { status: 400 })
    }
    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: String(body.name).trim() }),
        ...(body.address !== undefined && { address: String(body.address).trim() }),
        ...(body.postcode !== undefined && { postcode: String(body.postcode).trim() }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.progress !== undefined && { progress: Number(body.progress) }),
        ...(body.clientName !== undefined && { clientName: String(body.clientName).trim() }),
        ...(body.budget !== undefined && { budget: Number(body.budget) }),
        ...(body.onSiteCount !== undefined && { onSiteCount: Number(body.onSiteCount) }),
        ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
        ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
      },
    })
    return NextResponse.json(project)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  if (!isCompanyAdmin()) {
    return NextResponse.json({ error: 'Company admin permission required to delete projects' }, { status: 403 })
  }
  try {
    const project = await prisma.project.findUnique({ where: { id: params.id }, select: { name: true } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    await prisma.project.delete({ where: { id: params.id } })
    auditLog({
      action: 'project.delete',
      resourceType: 'Project',
      resourceId: params.id,
      ...requestMeta(req),
    })
    prisma.activity.create({
      data: {
        projectId: null,
        actorName: actorName(auth),
        actorType: 'human',
        action: `deleted project: ${project.name}`,
        iconType: 'trash',
      },
    }).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
