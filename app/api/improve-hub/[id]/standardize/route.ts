import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import { programmeProjectWhere } from '@/lib/programme-access'

export const dynamic = 'force-dynamic'

function normalizeStatus(value: unknown) {
  const status = String(value || 'idea').toLowerCase()
  if (status === 'complete' || status === 'completed') return 'proven'
  if (status === 'testing') return 'pilot'
  return status
}

function canStandardise(auth: { role: string | null; personaRole?: string | null }) {
  return canManage(auth.role || '') || auth.personaRole === 'project_manager'
}

function improvementPct(direction: string | null, baseline: number, result: number) {
  if (!Number.isFinite(baseline) || !Number.isFinite(result) || baseline === 0) return null
  const delta = direction === 'decrease' ? baseline - result : result - baseline
  return Math.round((delta / Math.abs(baseline)) * 1000) / 10
}

function fmt(value: number | null, unit: string | null) {
  if (value === null) return '—'
  return String(value) + (unit ? ' ' + unit : '')
}

function standardBody(improvement: {
  id: string
  title: string | null
  description: string | null
  area: string | null
  metricName: string | null
  metricUnit: string | null
  metricDirection: string | null
  baselineValue: number | null
  targetValue: number | null
  resultValue: number | null
  startedAt: Date | null
  completedAt: Date | null
  project: { name: string } | null
}) {
  const measuredPct = improvement.baselineValue !== null && improvement.resultValue !== null
    ? improvementPct(improvement.metricDirection, improvement.baselineValue, improvement.resultValue)
    : null

  return [
    'STANDARD WORK — generated from a proven CortexBuild innovation pilot',
    '',
    'Source innovation: ' + improvement.id,
    'Scope: ' + (improvement.project?.name || 'Company-wide'),
    'Innovation area: ' + (improvement.area || 'other'),
    '',
    'Purpose / proven method',
    improvement.description?.trim() || improvement.title?.trim() || 'Evidence-backed construction improvement.',
    '',
    'Evidence',
    'Metric: ' + (improvement.metricName || '—'),
    'Baseline: ' + fmt(improvement.baselineValue, improvement.metricUnit),
    'Target: ' + fmt(improvement.targetValue, improvement.metricUnit),
    'Observed result: ' + fmt(improvement.resultValue, improvement.metricUnit),
    'Desired direction: ' + (improvement.metricDirection === 'decrease' ? 'decrease' : 'increase'),
    measuredPct === null ? null : 'Measured improvement: ' + (measuredPct >= 0 ? '+' : '') + measuredPct + '%',
    improvement.startedAt ? 'Pilot started: ' + improvement.startedAt.toISOString() : null,
    improvement.completedAt ? 'Proven: ' + improvement.completedAt.toISOString() : null,
    '',
    'Standardisation note',
    'Adopt the proven improvement described above as the current working standard. Keep project-specific design information, RAMS, quality requirements, manufacturer instructions and statutory controls in force. Update this Process Library version when the method or supporting evidence changes.',
  ].filter((line): line is string => line !== null).join('\n')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canStandardise(auth)) {
    return NextResponse.json({ error: 'Company Admin or Project Manager permission required' }, { status: 403 })
  }
  const limited = await enforceRateLimit(req, 'write', auth.userId || '')
  if (limited) return limited

  const { id } = await params
  try {
    const improvement = await prisma.improvement.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        standardProcess: true,
      },
    })
    if (!improvement) return NextResponse.json({ error: 'Improvement not found' }, { status: 404 })

    if (improvement.projectId) {
      const project = await prisma.project.findFirst({
        where: programmeProjectWhere(improvement.projectId, auth.session),
        select: { id: true },
      })
      if (!project) return NextResponse.json({ error: 'Improvement not found' }, { status: 404 })
    }

    if (improvement.standardProcessId && improvement.standardProcess) {
      return NextResponse.json({
        item: improvement,
        process: improvement.standardProcess,
        alreadyStandardized: true,
      })
    }

    if (normalizeStatus(improvement.status) !== 'proven') {
      return NextResponse.json({ error: 'Only proven improvements can be standardised' }, { status: 409 })
    }

    if (
      !improvement.metricName ||
      improvement.baselineValue === null ||
      improvement.targetValue === null ||
      improvement.resultValue === null
    ) {
      return NextResponse.json({
        error: 'A proven improvement needs metric, baseline, target and observed result before standardisation',
      }, { status: 400 })
    }

    const owner = improvement.ownerName?.trim() || improvement.raisedBy?.trim() || actorName(auth.session)
    const title = 'Standard · ' + (improvement.title?.trim() || 'Proven improvement')
    const category = improvement.area || 'innovation'
    const body = standardBody(improvement)
    const now = new Date()

    const linked = await prisma.$transaction(async tx => {
      const current = await tx.improvement.findFirst({
        where: { id, organizationId: auth.orgId },
        include: { standardProcess: true },
      })
      if (!current) throw new Error('IMPROVEMENT_NOT_FOUND')
      if (current.standardProcess) return { process: current.standardProcess, created: false }

      const process = await tx.processDoc.create({
        data: {
          organizationId: auth.orgId,
          title,
          category,
          body,
          owner,
          version: '1.0',
          publishedAt: now,
        },
      })

      const update = await tx.improvement.updateMany({
        where: { id, organizationId: auth.orgId, standardProcessId: null },
        data: { standardProcessId: process.id },
      })

      if (update.count === 0) {
        await tx.processDoc.delete({ where: { id: process.id } })
        const raced = await tx.improvement.findFirst({
          where: { id, organizationId: auth.orgId },
          include: { standardProcess: true },
        })
        if (raced?.standardProcess) return { process: raced.standardProcess, created: false }
        throw new Error('STANDARD_LINK_RACE')
      }

      return { process, created: true }
    })

    const updated = await prisma.improvement.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        standardProcess: true,
      },
    })
    if (!updated) return NextResponse.json({ error: 'Improvement not found' }, { status: 404 })

    const measuredPct = improvementPct(
      improvement.metricDirection,
      improvement.baselineValue,
      improvement.resultValue,
    )

    auditLog({
      action: 'innovation.improvement.standardize',
      resourceType: 'Improvement',
      resourceId: updated.id,
      metadata: {
        processId: linked.process.id,
        projectId: updated.projectId,
        area: updated.area,
        measuredPct,
        created: linked.created,
      },
      ...requestMeta(req),
    })

    return NextResponse.json({
      item: updated,
      process: linked.process,
      alreadyStandardized: !linked.created,
    }, { status: linked.created ? 201 : 200 })
  } catch (error) {
    if (error instanceof Error && error.message === 'IMPROVEMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Improvement not found' }, { status: 404 })
    }
    reportError(error, { context: 'innovation.standardize', improvementId: id })
    return NextResponse.json({ error: 'Failed to standardise improvement' }, { status: 500 })
  }
}
