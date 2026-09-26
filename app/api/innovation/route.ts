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
      select: { id: true, name: true, status: true, progress: true },
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

    const projectIdFilter = { in: projectIds.length ? projectIds : ['__no_project__'] }
    const activeRequisitionStatuses = { notIn: ['converted', 'cancelled', 'rejected'] }

    const [
      improvements,
      improvementStats,
      constraints,
      constraintPriorityGroups,
      productionLogs,
      productionAggregate,
      blockedActivities,
      overdueActivities,
      openRequisitions,
      procurementAtRisk,
      safetySeverityGroups,
    ] = await Promise.all([
      prisma.improvement.findMany({
        where: improvementWhere,
        select: {
          id: true,
          projectId: true,
          title: true,
          raisedBy: true,
          ownerName: true,
          area: true,
          status: true,
          impact: true,
          effort: true,
          metricName: true,
          metricUnit: true,
          metricDirection: true,
          baselineValue: true,
          targetValue: true,
          resultValue: true,
          startedAt: true,
          completedAt: true,
          standardProcessId: true,
          createdAt: true,
          project: { select: { id: true, name: true } },
          standardProcess: { select: { id: true, title: true, version: true, publishedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 24,
      }),
      prisma.improvement.findMany({
        where: improvementWhere,
        select: {
          status: true,
          area: true,
          metricName: true,
          metricDirection: true,
          baselineValue: true,
          targetValue: true,
          resultValue: true,
          standardProcessId: true,
        },
      }),
      prisma.fieldConstraint.findMany({
        where: { projectId: projectIdFilter, status: { not: 'resolved' } },
        select: {
          id: true,
          title: true,
          ownerName: true,
          priority: true,
          status: true,
          category: true,
          dueDate: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        take: 20,
      }),
      prisma.fieldConstraint.groupBy({
        by: ['priority'],
        where: { projectId: projectIdFilter, status: { not: 'resolved' } },
        _count: { _all: true },
      }),
      prisma.fieldProductionLog.findMany({
        where: { projectId: projectIdFilter, date: { gte: productionFrom } },
        select: {
          id: true,
          date: true,
          area: true,
          activity: true,
          unit: true,
          plannedQty: true,
          installedQty: true,
          labourHours: true,
          crewSize: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      }),
      prisma.fieldProductionLog.aggregate({
        where: { projectId: projectIdFilter, date: { gte: productionFrom } },
        _sum: { plannedQty: true, installedQty: true, labourHours: true, crewSize: true },
      }),
      prisma.programmeActivity.count({
        where: { projectId: projectIdFilter, status: 'blocked' },
      }),
      prisma.programmeActivity.count({
        where: { projectId: projectIdFilter, plannedEnd: { lt: now }, status: { not: 'complete' } },
      }),
      prisma.procurementRequisition.count({
        where: { projectId: projectIdFilter, status: activeRequisitionStatuses },
      }),
      prisma.procurementRequisition.count({
        where: {
          projectId: projectIdFilter,
          status: activeRequisitionStatuses,
          neededBy: { lte: horizon },
        },
      }),
      prisma.safetyIncident.groupBy({
        by: ['severity'],
        where: { projectId: projectIdFilter, status: { not: 'closed' } },
        _count: { _all: true },
      }),
    ])

    const production = {
      plannedQty: productionAggregate._sum.plannedQty || 0,
      installedQty: productionAggregate._sum.installedQty || 0,
      labourHours: productionAggregate._sum.labourHours || 0,
    }

    const openConstraints = constraintPriorityGroups.reduce((sum, row) => sum + row._count._all, 0)
    const criticalConstraints = constraintPriorityGroups.find(row => row.priority === 'critical')?._count._all || 0
    const highConstraints = constraintPriorityGroups.find(row => row.priority === 'high')?._count._all || 0
    const openSafety = safetySeverityGroups.reduce((sum, row) => sum + row._count._all, 0)
    const highSafety = safetySeverityGroups
      .filter(row => ['high', 'critical'].includes(String(row.severity).toLowerCase()))
      .reduce((sum, row) => sum + row._count._all, 0)
    const ideaCounts = countByStatus(improvementStats)
    const pilotRows = improvementStats.filter(row => ['pilot', 'testing'].includes(String(row.status || '').toLowerCase()))
    const measurementGaps = pilotRows.filter(row => !row.metricName || row.baselineValue === null || row.targetValue === null).length
    const measuredRows = improvementStats.filter(row =>
      ['proven', 'complete', 'completed'].includes(String(row.status || '').toLowerCase()) &&
      Boolean(row.metricName) &&
      row.baselineValue !== null &&
      row.resultValue !== null
    )
    const measuredProven = measuredRows.length
    const standardized = improvementStats.filter(row => Boolean(row.standardProcessId)).length
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

    const learningByArea = Array.from(improvementStats.reduce((map, row) => {
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
    if (blockedActivities > 0 || overdueActivities > 0) {
      signals.push({ id: 'programme', level: blockedActivities > 0 ? 'high' : 'medium', title: 'Programme pressure detected', detail: blockedActivities + ' blocked and ' + overdueActivities + ' overdue activities.', href: projectId ? '/projects/' + projectId + '/programme' : '/projects' })
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
      constraints,
      productionLogs,
      signals,
      learningByArea,
      summary: {
        ideas: improvementStats.length,
        pilots: ideaCounts.pilot || ideaCounts.testing || 0,
        proven: ideaCounts.proven || ideaCounts.complete || ideaCounts.completed || 0,
        measurementGaps,
        measuredProven,
        standardized,
        avgMeasuredImprovementPct,
        openConstraints,
        criticalConstraints,
        highConstraints,
        blockedActivities,
        overdueActivities,
        openRequisitions,
        procurementAtRisk,
        openSafety,
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
