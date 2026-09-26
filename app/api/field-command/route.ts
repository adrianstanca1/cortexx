import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { reportError } from '@/lib/errors'
import { programmeProjectWhere } from '@/lib/programme-access'
import controls from '@/lib/field-controls'

export const dynamic = 'force-dynamic'

type AlertTone = 'critical' | 'warning' | 'info'

type FieldAlert = {
  id: string
  tone: AlertTone
  title: string
  detail: string
  href: string
}

function decodeFieldEvent(activity: {
  id: string
  actorName: string
  action: string
  detail: string | null
  createdAt: Date
}) {
  try {
    const parsed = activity.detail ? JSON.parse(activity.detail) as Record<string, unknown> : {}
    return {
      id: activity.id,
      actorName: activity.actorName,
      type: String(parsed.type || 'other'),
      title: String(parsed.title || activity.action.replace(/^field event:\s*[^—-]+[—-]\s*/i, '')).slice(0, 220),
      detail: parsed.detail ? String(parsed.detail).slice(0, 1000) : null,
      location: parsed.location ? String(parsed.location).slice(0, 160) : null,
      severity: ['info', 'attention', 'urgent'].includes(String(parsed.severity)) ? String(parsed.severity) : 'info',
      occurredAt: parsed.occurredAt ? new Date(String(parsed.occurredAt)).toISOString() : activity.createdAt.toISOString(),
    }
  } catch {
    return {
      id: activity.id,
      actorName: activity.actorName,
      type: 'other',
      title: activity.action.slice(0, 220),
      detail: activity.detail,
      location: null,
      severity: 'info',
      occurredAt: activity.createdAt.toISOString(),
    }
  }
}

function readinessScore(input: {
  expiredPermits: number
  expiringPermits: number
  failedInspections: number
  pendingQaPoints: number
  overdueChecks: number
  overdueRfis: number
  criticalConstraints: number
  highSnags: number
  pendingHandovers: number
  planHit: number | null
}) {
  let score = 100
  score -= Math.min(input.expiredPermits * 20, 40)
  score -= Math.min(input.criticalConstraints * 18, 36)
  score -= Math.min(input.failedInspections * 12, 24)
  score -= Math.min(input.pendingQaPoints * 12, 24)
  score -= Math.min(input.overdueChecks * 8, 16)
  score -= Math.min(input.overdueRfis * 5, 10)
  score -= Math.min(input.highSnags * 5, 10)
  score -= Math.min(input.pendingHandovers * 4, 8)
  score -= Math.min(input.expiringPermits * 3, 6)
  if (input.planHit !== null && input.planHit < 80) score -= Math.min((80 - input.planHit) * 0.5, 15)
  return Math.max(0, Math.round(score))
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth

  try {
    const projectId = controls.cleanText(req.nextUrl.searchParams.get('projectId'), 100)
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

    const project = await prisma.project.findFirst({
      where: programmeProjectWhere(projectId, auth.session),
      select: { id: true, name: true, status: true },
    })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })

    const now = new Date()
    const threeDays = new Date(now.getTime() + 3 * 86_400_000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000)

    const [
      activePermits,
      expiredPermits,
      expiringPermits,
      openInspections,
      failedInspections,
      pendingQaPoints,
      openSnags,
      highSnags,
      overdueChecks,
      openRfis,
      overdueRfis,
      openConstraints,
      criticalConstraints,
      pendingHandovers,
      production,
      crew,
      eventRows,
    ] = await Promise.all([
      prisma.permit.count({ where: { projectId, status: 'active' } }),
      prisma.permit.count({ where: { projectId, status: 'active', validTo: { lt: now } } }),
      prisma.permit.count({ where: { projectId, status: 'active', validTo: { gte: now, lte: threeDays } } }),
      prisma.inspection.count({ where: { projectId, status: { in: ['draft', 'in_progress'] } } }),
      prisma.inspection.count({ where: { projectId, status: 'failed' } }),
      prisma.inspection.count({
        where: {
          projectId,
          pointType: { in: ['hold', 'witness'] },
          releaseStatus: { not: 'released' },
        },
      }),
      prisma.snag.count({ where: { projectId, status: { not: 'closed' } } }),
      prisma.snag.count({
        where: { projectId, status: { not: 'closed' }, priority: { in: ['high', 'critical'] } },
      }),
      prisma.equipmentCheck.count({
        where: { projectId, nextDueAt: { lt: now }, status: { not: 'passed' } },
      }),
      prisma.rfi.count({ where: { projectId, status: { not: 'closed' } } }),
      prisma.rfi.count({ where: { projectId, status: { not: 'closed' }, dueDate: { lt: now } } }),
      prisma.fieldConstraint.count({ where: { projectId, status: { not: 'resolved' } } }),
      prisma.fieldConstraint.count({
        where: { projectId, status: { not: 'resolved' }, priority: 'critical' },
      }),
      prisma.fieldHandover.count({
        where: { projectId, acceptedAt: null, shiftDate: { gte: fourteenDaysAgo } },
      }),
      prisma.fieldProductionLog.aggregate({
        where: { projectId, date: { gte: sevenDaysAgo } },
        _sum: { plannedQty: true, installedQty: true, labourHours: true },
      }),
      prisma.siteCheckIn.findMany({
        where: { projectId, checkedOutAt: null },
        select: {
          id: true,
          checkedInAt: true,
          member: { select: { id: true, name: true, role: true } },
        },
        orderBy: { checkedInAt: 'desc' },
        take: 30,
      }),
      prisma.activity.findMany({
        where: { projectId, action: { startsWith: 'field event:' } },
        select: { id: true, actorName: true, action: true, detail: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    ])

    const plannedQty = production._sum.plannedQty || 0
    const installedQty = production._sum.installedQty || 0
    const labourHours = production._sum.labourHours || 0
    const planHit = plannedQty > 0 ? Math.round((installedQty / plannedQty) * 1000) / 10 : null

    const pulse = {
      activePermits,
      expiredPermits,
      expiringPermits,
      openInspections,
      failedInspections,
      openSnags,
      highSnags,
      overdueChecks,
      openRfis,
      overdueRfis,
      openConstraints,
      criticalConstraints,
      pendingQaPoints,
      pendingHandovers,
      planHit,
      installedQty,
      plannedQty,
      labourHours,
    }

    const score = readinessScore(pulse)
    const alerts: FieldAlert[] = []

    if (expiredPermits > 0) {
      alerts.push({ id: 'expired-permits', tone: 'critical', title: 'Permit expiry needs action', detail: expiredPermits + ' active permit' + (expiredPermits === 1 ? ' is' : 's are') + ' past validity.', href: '/permits' })
    }
    if (criticalConstraints > 0) {
      alerts.push({ id: 'critical-constraints', tone: 'critical', title: 'Critical field constraint', detail: criticalConstraints + ' critical blocker' + (criticalConstraints === 1 ? '' : 's') + ' remain unresolved.', href: '/field/constraints' })
    }
    if (failedInspections > 0) {
      alerts.push({ id: 'failed-inspections', tone: 'critical', title: 'Failed inspection outstanding', detail: failedInspections + ' failed inspection' + (failedInspections === 1 ? '' : 's') + ' require disposition.', href: '/inspections' })
    }
    if (pendingQaPoints > 0) {
      alerts.push({ id: 'qa-release', tone: 'critical', title: 'QA release required', detail: pendingQaPoints + ' hold/witness point' + (pendingQaPoints === 1 ? '' : 's') + ' await release before affected work proceeds.', href: '/inspections' })
    }
    if (overdueChecks > 0) {
      alerts.push({ id: 'equipment-checks', tone: 'warning', title: 'Equipment checks overdue', detail: overdueChecks + ' recurring check' + (overdueChecks === 1 ? '' : 's') + ' are overdue.', href: '/equipment-checks?status=overdue' })
    }
    if (overdueRfis > 0) {
      alerts.push({ id: 'overdue-rfis', tone: 'warning', title: 'Design response overdue', detail: overdueRfis + ' RFI' + (overdueRfis === 1 ? ' is' : 's are') + ' overdue.', href: '/rfis' })
    }
    if (expiringPermits > 0) {
      alerts.push({ id: 'expiring-permits', tone: 'warning', title: 'Permits expiring soon', detail: expiringPermits + ' active permit' + (expiringPermits === 1 ? '' : 's') + ' expire within 3 days.', href: '/permits' })
    }
    if (planHit !== null && planHit < 80) {
      alerts.push({ id: 'production', tone: 'warning', title: 'Production below plan', detail: '7-day installed output is ' + planHit.toFixed(1) + '% of planned quantity.', href: '/field/productivity' })
    }
    if (alerts.length === 0) {
      alerts.push({ id: 'clear', tone: 'info', title: 'No critical readiness exceptions', detail: 'Current permits, QA releases, constraints and production signals show no immediate exception.', href: '/field' })
    }

    const hardStops = expiredPermits + criticalConstraints + failedInspections + pendingQaPoints
    const status = hardStops > 0 ? 'action_required' : score < 90 ? 'attention' : 'ready'

    return NextResponse.json({
      project,
      generatedAt: now.toISOString(),
      readiness: {
        score,
        status,
        hardStops,
        alerts: alerts.slice(0, 6),
      },
      pulse,
      crew,
      events: eventRows.map(decodeFieldEvent),
    })
  } catch (error) {
    reportError(error, { context: 'field-command' })
    return NextResponse.json({ error: 'Failed to load field command brief' }, { status: 500 })
  }
}
