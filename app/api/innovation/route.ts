import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage, canWrite } from '@/lib/rbac'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

type ProjectSummary = {
  id: string
  name: string
  status: string
  progress: number
  address: string
  postcode: string
}

function accessibleProjectWhere(auth: Awaited<ReturnType<typeof requireOrg>>): Prisma.ProjectWhereInput {
  if (auth instanceof NextResponse) return { id: '__unauthorized__' }
  const role = auth.personaRole || String((auth.session.user as { role?: string }).role || '')
  const email = String((auth.session.user as { email?: string | null }).email || '').trim()
  const assignmentScoped = ['project_manager', 'foreman', 'operative'].includes(role)

  return {
    archivedAt: null,
    ...(assignmentScoped
      ? (email
        ? { assignments: { some: { member: { email: { equals: email, mode: 'insensitive' } } } } }
        : { id: '__no_assigned_project__' })
      : {}),
  }
}

function pct(installed: number, planned: number) {
  return planned > 0 ? Math.round((installed / planned) * 1000) / 10 : null
}

function countByStatus(rows: Array<{ status: string | null }>) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = String(row.status || 'idea').toLowerCase()
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth

  try {
    const projectId = req.nextUrl.searchParams.get('projectId')?.trim() || null
    const projectWhere = accessibleProjectWhere(auth)

    const projects = await prisma.project.findMany({
      where: projectWhere,
      select: { id: true, name: true, status: true, progress: true, address: true, postcode: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }) as ProjectSummary[]

    if (projectId && !projects.some(project => project.id === projectId)) {
      return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    }

    const scopedProjects = projectId ? projects.filter(project => project.id === projectId) : projects
    const projectIds = scopedProjects.map(project => project.id)
    const improvementWhere: Prisma.ImprovementWhereInput = projectId
      ? { OR: [{ projectId }, { projectId: null }] }
      : projectIds.length
        ? { OR: [{ projectId: { in: projectIds } }, { projectId: null }] }
        : { projectId: null }
    const now = new Date()
    const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const productionFrom = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const [
      improvements,
      kaizenCards,
      constraints,
      productionLogs,
      blockedActivities,
      overdueActivities,
      requisitions,
      safetyIncidents,
    ] = await Promise.all([
      prisma.improvement.findMany({
        where: improvementWhere,
        include: {
          project: { select: { id: true, name: true } },
          standardProcess: { select: { id: true, title: true, version: true, publishedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 60,
      }),
      prisma.kaizenCard.findMany({ orderBy: { createdAt: 'desc' }, take: 60 }),
      projectIds.length
        ? prisma.fieldConstraint.findMany({
            where: { projectId: { in: projectIds }, status: { not: 'resolved' } },
            include: { project: { select: { id: true, name: true } } },
            orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
            take: 120,
          })
        : Promise.resolve([]),
      projectIds.length
        ? prisma.fieldProductionLog.findMany({
            where: { projectId: { in: projectIds }, date: { gte: productionFrom } },
            include: {
              project: { select: { id: true, name: true } },
              programmeActivity: { select: { id: true, code: true, title: true, status: true, progress: true } },
            },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
            take: 300,
          })
        : Promise.resolve([]),
      projectIds.length
        ? prisma.programmeActivity.findMany({
            where: { projectId: { in: projectIds }, status: 'blocked' },
            select: { id: true, projectId: true, code: true, title: true, plannedEnd: true, progress: true, status: true },
            orderBy: { plannedEnd: 'asc' },
            take: 100,
          })
        : Promise.resolve([]),
      projectIds.length
        ? prisma.programmeActivity.findMany({
            where: { projectId: { in: projectIds }, plannedEnd: { lt: now }, status: { not: 'complete' } },
            select: { id: true, projectId: true, code: true, title: true, plannedEnd: true, progress: true, status: true },
            orderBy: { plannedEnd: 'asc' },
            take: 100,
          })
        : Promise.resolve([]),
      projectIds.length
        ? prisma.procurementRequisition.findMany({
            where: {
              projectId: { in: projectIds },
              status: { notIn: ['converted', 'cancelled', 'rejected'] },
            },
            select: { id: true, projectId: true, number: true, status: true, neededBy: true, estimatedNet: true },
            orderBy: [{ neededBy: 'asc' }, { createdAt: 'desc' }],
            take: 120,
          })
        : Promise.resolve([]),
      projectIds.length
        ? prisma.safetyIncident.findMany({
            where: { projectId: { in: projectIds }, status: { not: 'closed' } },
            select: { id: true, projectId: true, title: true, severity: true, status: true, occurredAt: true },
            orderBy: { occurredAt: 'desc' },
            take: 100,
          })
        : Promise.resolve([]),
    ])

    const production = productionLogs.reduce(
      (acc, row) => {
        acc.plannedQty += row.plannedQty
        acc.installedQty += row.installedQty
        acc.labourHours += row.labourHours
        acc.crewDays += row.crewSize
        return acc
      },
      { plannedQty: 0, installedQty: 0, labourHours: 0, crewDays: 0 },
    )

    const criticalConstraints = constraints.filter(row => row.priority === 'critical').length
    const highConstraints = constraints.filter(row => row.priority === 'high').length
    const procurementAtRisk = requisitions.filter(row => row.neededBy && row.neededBy <= horizon).length
    const highSafety = safetyIncidents.filter(row => ['high', 'critical'].includes(String(row.severity).toLowerCase())).length
    const ideaCounts = countByStatus(improvements)
    const pilotRows = improvements.filter(row => ['pilot', 'testing'].includes(String(row.status || '').toLowerCase()))
    const measurementGaps = pilotRows.filter(row => !row.metricName || row.baselineValue === null || row.targetValue === null).length
    const measuredRows = improvements.filter(row =>
      ['proven', 'complete', 'completed'].includes(String(row.status || '').toLowerCase()) &&
      Boolean(row.metricName) &&
      row.baselineValue !== null &&
      row.resultValue !== null
    )
    const measuredProven = measuredRows.length
    const standardized = improvements.filter(row => Boolean(row.standardProcessId)).length
    const measuredChanges = measuredRows
      .filter(row => row.baselineValue !== 0)
      .map(row => {
        const baseline = Number(row.baselineValue)
        const result = Number(row.resultValue)
        const delta = row.metricDirection === 'decrease' ? baseline - result : result - baseline
        return Math.round((delta / Math.abs(baseline)) * 1000) / 10
      })
      .filter(value => Number.isFinite(value))
    const avgMeasuredImprovementPct = measuredChanges.length
      ? Math.round((measuredChanges.reduce((sum, value) => sum + value, 0) / measuredChanges.length) * 10) / 10
      : null

    const learningByArea = Array.from(improvements.reduce((map, row) => {
      const area = row.area || 'other'
      const current = map.get(area) || { area, ideas: 0, proven: 0, standardized: 0 }
      current.ideas += 1
      if (['proven', 'complete', 'completed'].includes(String(row.status || '').toLowerCase())) current.proven += 1
      if (row.standardProcessId) current.standardized += 1
      map.set(area, current)
      return map
    }, new Map<string, { area: string; ideas: number; proven: number; standardized: number }>()).values())
      .sort((a, b) => b.proven - a.proven || b.ideas - a.ideas)
      .slice(0, 5)

    const signals: Array<{ id: string; level: 'high' | 'medium' | 'good'; title: string; detail: string; href: string }> = []
    if (criticalConstraints > 0) {
      signals.push({ id: 'constraints', level: 'high', title: 'Critical field constraints need ownership', detail: criticalConstraints + ' critical blocker' + (criticalConstraints === 1 ? '' : 's') + ' remain open.', href: '/field/constraints' })
    }
    if (blockedActivities.length > 0 || overdueActivities.length > 0) {
      signals.push({ id: 'programme', level: blockedActivities.length > 0 ? 'high' : 'medium', title: 'Programme pressure detected', detail: blockedActivities.length + ' blocked and ' + overdueActivities.length + ' overdue activities.', href: projectId ? '/projects/' + projectId + '/programme' : '/projects' })
    }
    if (procurementAtRisk > 0) {
      signals.push({ id: 'procurement', level: 'medium', title: 'Materials may constrain delivery', detail: procurementAtRisk + ' active requisition' + (procurementAtRisk === 1 ? '' : 's') + ' needed within seven days.', href: '/requisitions' })
    }
    if (highSafety > 0) {
      signals.push({ id: 'safety', level: 'high', title: 'Safety learning opportunity', detail: highSafety + ' high/critical open incident' + (highSafety === 1 ? '' : 's') + ' require closeout and learning.', href: '/safety' })
    }
    const achievement = pct(production.installedQty, production.plannedQty)
    if (achievement !== null && achievement < 90) {
      signals.push({ id: 'production', level: 'medium', title: 'Production is below recent plan', detail: '14-day installed output is ' + achievement + '% of planned quantity.', href: '/field' })
    }
    if (measurementGaps > 0) {
      signals.push({ id: 'measurement', level: 'medium', title: 'Pilots need a measurement plan', detail: measurementGaps + ' active pilot' + (measurementGaps === 1 ? '' : 's') + ' lack a metric, baseline or target.', href: '/innovation' })
    }
    if (measuredProven > standardized) {
      const waiting = measuredProven - standardized
      signals.push({ id: 'standardize', level: 'good', title: 'Proven learning is ready to standardise', detail: waiting + ' measured improvement' + (waiting === 1 ? '' : 's') + ' can become reusable company process.', href: '/innovation' })
    }
    if (signals.length === 0) {
      signals.push({ id: 'stable', level: 'good', title: 'No major innovation trigger detected', detail: 'Use the idea backlog to target the next measurable improvement.', href: '/improve-hub' })
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      scope: { projectId, projectCount: scopedProjects.length },
      permissions: {
        write: canWrite(auth.role || ''),
        standardise: canManage(auth.role || '') || auth.personaRole === 'project_manager',
      },
      projects,
      improvements,
      kaizenCards,
      constraints,
      productionLogs: productionLogs.slice(0, 40),
      blockedActivities,
      overdueActivities,
      requisitions,
      safetyIncidents,
      signals,
      learningByArea,
      summary: {
        ideas: improvements.length,
        pilots: ideaCounts.pilot || ideaCounts.testing || 0,
        proven: ideaCounts.proven || ideaCounts.complete || ideaCounts.completed || 0,
        measurementGaps,
        measuredProven,
        standardized,
        avgMeasuredImprovementPct,
        openConstraints: constraints.length,
        criticalConstraints,
        highConstraints,
        blockedActivities: blockedActivities.length,
        overdueActivities: overdueActivities.length,
        openRequisitions: requisitions.length,
        procurementAtRisk,
        openSafety: safetyIncidents.length,
        highSafety,
        plannedQty: production.plannedQty,
        installedQty: production.installedQty,
        labourHours: production.labourHours,
        achievementPct: achievement,
        qtyPerLabourHour: production.labourHours > 0
          ? Math.round((production.installedQty / production.labourHours) * 1000) / 1000
          : null,
      },
    })
  } catch (error) {
    reportError(error, { context: 'innovation.overview' })
    return NextResponse.json({ error: 'Failed to load innovation overview' }, { status: 500 })
  }
}
