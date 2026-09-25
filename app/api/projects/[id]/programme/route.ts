import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { reportError } from '@/lib/errors'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { getCurrentOrg } from '@/lib/tenancy'
import { canPlanProgramme, programmeProjectWhere } from '@/lib/programme-access'
import programme from '@/lib/programme'
import { syncProjectProgrammeProgress } from '@/lib/programme-server'

export const dynamic = 'force-dynamic'
const { programmeSummary } = programme
const STATUSES = new Set(['not_started', 'in_progress', 'complete', 'blocked'])

function parseDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const { id } = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const project = await prisma.project.findFirst({
      where: programmeProjectWhere(id, auth),
      select: { id: true, name: true, startDate: true, endDate: true, progress: true },
    })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    const [activities, dependencies, team, baselines, delays] = await Promise.all([
      prisma.programmeActivity.findMany({
        where: { projectId: id },
        include: { responsibleMember: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: [{ sortOrder: 'asc' }, { plannedStart: 'asc' }, { createdAt: 'asc' }],
        take: 1000,
      }),
      prisma.programmeDependency.findMany({ where: { projectId: id }, orderBy: { createdAt: 'asc' }, take: 3000 }),
      prisma.assignment.findMany({ where: { projectId: id }, include: { member: { select: { id: true, name: true, email: true, role: true } } }, take: 500 }),
      prisma.programmeBaselineRevision.findMany({
        where: { projectId: id },
        select: { id: true, revision: true, label: true, reason: true, status: true, effectiveAt: true, createdAt: true, createdByUserId: true },
        orderBy: { revision: 'desc' },
        take: 100,
      }),
      prisma.programmeDelayEvent.findMany({
        where: { projectId: id },
        include: { activity: { select: { id: true, code: true, title: true } } },
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        take: 300,
      }),
    ])
    const lookaheadDays = Math.max(1, Math.min(84, Number(req.nextUrl.searchParams.get('days')) || 21))
    const summary = programmeSummary(activities, dependencies, { lookaheadDays })
    return NextResponse.json({ project, activities, dependencies, team: team.map(a => a.member), summary, baselines, delays, baselineLocked: baselines.length > 0, latestBaseline: baselines[0] || null, permissions: { plan: canPlanProgramme(auth), progress: auth.user?.role === 'foreman' || canPlanProgramme(auth) } })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to load project programme' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const { id } = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  if (!canPlanProgramme(auth)) return NextResponse.json({ error: 'Company Admin or Project Manager permission required' }, { status: 403 })
  const userId = (auth.user as { id?: string }).id || ''
  const limited = await enforceRateLimit(req, 'write', userId)
  if (limited) return limited
  try {
    const project = await prisma.project.findFirst({ where: programmeProjectWhere(id, auth), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    const baselineLocked = await prisma.programmeBaselineRevision.count({ where: { projectId: id } }).then(count => count > 0)
    const body = await req.json()
    const title = String(body.title || '').trim().slice(0, 220)
    if (!title) return NextResponse.json({ error: 'Activity title is required' }, { status: 400 })
    const plannedStart = parseDate(body.plannedStart)
    const plannedEnd = parseDate(body.plannedEnd)
    if (!plannedStart || !plannedEnd) return NextResponse.json({ error: 'Valid planned start and end dates are required' }, { status: 400 })
    if (plannedEnd < plannedStart) return NextResponse.json({ error: 'Planned end must be on or after planned start' }, { status: 400 })
    const baselineStart = baselineLocked ? plannedStart : (parseDate(body.baselineStart) || plannedStart)
    const baselineEnd = baselineLocked ? plannedEnd : (parseDate(body.baselineEnd) || plannedEnd)
    if (baselineEnd < baselineStart) return NextResponse.json({ error: 'Baseline end must be on or after baseline start' }, { status: 400 })
    const progress = Math.max(0, Math.min(100, Number(body.progress) || 0))
    const status = STATUSES.has(String(body.status)) ? String(body.status) : progress >= 100 ? 'complete' : progress > 0 ? 'in_progress' : 'not_started'
    const responsibleMemberId = body.responsibleMemberId ? String(body.responsibleMemberId) : null
    if (responsibleMemberId) {
      const member = await prisma.teamMember.findFirst({ where: { id: responsibleMemberId, assignments: { some: { projectId: id } } }, select: { id: true } })
      if (!member) return NextResponse.json({ error: 'Responsible person must be assigned to this project' }, { status: 400 })
    }
    const orgId = getCurrentOrg()?.organizationId
    if (!orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
    const activity = await prisma.$transaction(async tx => {
      const created = await tx.programmeActivity.create({ data: {
        projectId: id,
        code: String(body.code || '').trim().slice(0, 40) || null,
        title,
        description: String(body.description || '').trim().slice(0, 2000) || null,
        baselineStart,
        baselineEnd,
        plannedStart,
        plannedEnd,
        progress,
        status,
        responsibleMemberId,
        location: String(body.location || '').trim().slice(0, 160) || null,
        notes: String(body.notes || '').trim().slice(0, 2000) || null,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
        actualStart: status !== 'not_started' ? new Date() : null,
        actualEnd: status === 'complete' ? new Date() : null,
      } })
      await syncProjectProgrammeProgress(tx, id, orgId)
      return created
    })
    auditLog({ action: 'programme.activity.create', resourceType: 'ProgrammeActivity', resourceId: activity.id, metadata: { projectId: id, title }, ...requestMeta(req) })
    prisma.activity.create({ data: { projectId: id, actorName: actorName(auth), actorType: 'human', action: `added programme activity: ${title}`, iconType: 'clock' } }).catch(() => {})
    return NextResponse.json(activity, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create programme activity' }, { status: 500 })
  }
}
