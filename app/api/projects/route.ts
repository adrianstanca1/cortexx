import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { canManage } from '@/lib/rbac'

import { withRoute } from '@/lib/withRoute'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100

async function GET_impl(req: NextRequest, session: { user?: { email?: string | null; role?: string } }) {
  try {
    const { searchParams } = new URL(req.url)
    const take = Math.min(parseInt(searchParams.get('take') || '50') || 50, MAX_TAKE)
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0') || 0)
    const include = searchParams.get('include') // 'archived' to include, 'only-archived' to show only archived
    const appRole = session.user?.role || ''
    const email = session.user?.email?.trim() || ''
    const assignmentScoped = ['project_manager', 'foreman', 'operative'].includes(appRole)
    const archiveWhere: Prisma.ProjectWhereInput = include === 'archived' ? {} : include === 'only-archived' ? { archivedAt: { not: null } } : { archivedAt: null }
    const where: Prisma.ProjectWhereInput = {
      ...archiveWhere,
      ...(assignmentScoped ? (email ? { assignments: { some: { member: { email: { equals: email, mode: 'insensitive' } } } } } : { id: '__no_assigned_project__' }) : {}),
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          _count: { select: { tasks: true, assignments: true } },
          assignments: { include: { member: true }, take: 8 },
        },
        orderBy: { updatedAt: 'desc' },
        take,
        skip,
      }),
      prisma.project.count({ where }),
    ])
    return NextResponse.json({ projects, total, hasMore: skip + projects.length < total })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

async function POST_impl(req: NextRequest, userId: string, role: string | null, session: { user?: { name?: string | null; email?: string | null } }) {
  if (!role || !canManage(role)) {
    return NextResponse.json({ error: 'Company admin permission required to create projects' }, { status: 403 })
  }
  const __limited = await enforceRateLimit(req, 'write', userId)
  if (__limited) return __limited

  try {
    const body = await req.json()
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }
    if (body.startDate && body.endDate && new Date(body.endDate) < new Date(body.startDate)) {
      return NextResponse.json({ error: 'End date must be on or after start date' }, { status: 400 })
    }
    if (body.budget !== undefined && (!Number.isFinite(Number(body.budget)) || Number(body.budget) < 0)) {
      return NextResponse.json({ error: 'Budget must be a non-negative number' }, { status: 400 })
    }
    if (body.spent !== undefined && Number(body.spent) !== 0) {
      return NextResponse.json({ error: 'Opening spend must be posted through the project cost ledger' }, { status: 409 })
    }
    if (body.progress !== undefined && (!Number.isFinite(Number(body.progress)) || Number(body.progress) < 0 || Number(body.progress) > 100)) {
      return NextResponse.json({ error: 'Progress must be between 0 and 100' }, { status: 400 })
    }
    const project = await prisma.project.create({
      data: {
        name: body.name.trim(),
        address: body.address?.trim() || '',
        postcode: body.postcode?.trim() || '',
        status: body.status || 'active',
        progress: body.progress || 0,
        clientName: body.clientName?.trim() || '',
        budget: body.budget || 0,
        spent: 0,
        lat: body.lat || 51.5,
        lng: body.lng || -0.1,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
      },
    })
    // Log activity (non-blocking)
    prisma.activity.create({
      data: {
        projectId: project.id,
        actorName: actorName(session),
        actorType: 'human',
        action: `created project ${project.name}`,
        iconType: 'pin',
      },
    }).catch(() => {})
    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}

export const GET = withRoute(({ req, session }) => GET_impl(req, session), { permission: 'read' })
export const POST = withRoute(({ req, userId, role, session }) => POST_impl(req, userId, role, session), { permission: 'read' })
