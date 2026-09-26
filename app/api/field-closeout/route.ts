import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { actorName, requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { programmeProjectWhere } from '@/lib/programme-access'
import { createActivity } from '@/lib/activity'

export const dynamic = 'force-dynamic'

function parseDay(value: string | null) {
  const raw = value || new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const start = new Date(`${raw}T00:00:00.000Z`)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { key: raw, start, end }
}

function closePermission(auth: { role?: string | null; personaRole?: string | null }) {
  return canManage(auth.role || '') || auth.personaRole === 'project_manager' || auth.personaRole === 'foreman'
}

async function summary(projectId: string, start: Date, end: Date) {
  const [
    openConstraints,
    criticalConstraints,
    qaWaiting,
    failedInspections,
    handovers,
    production,
    timeEntries,
    diaryNotes,
    photos,
    openUrgentTasks,
  ] = await Promise.all([
    prisma.fieldConstraint.count({ where: { projectId, status: { not: 'resolved' } } }),
    prisma.fieldConstraint.count({ where: { projectId, status: { not: 'resolved' }, priority: 'critical' } }),
    prisma.inspection.count({ where: { projectId, pointType: { in: ['hold', 'witness'] }, releaseStatus: { in: ['pending', 'rejected'] } } }),
    prisma.inspection.count({ where: { projectId, status: 'failed', completedAt: { gte: start, lt: end } } }),
    prisma.fieldHandover.findMany({
      where: { projectId, shiftDate: { gte: start, lt: end } },
      select: { id: true, acceptedAt: true, incomingBy: true },
      orderBy: { shiftDate: 'desc' },
      take: 20,
    }),
    prisma.fieldProductionLog.findMany({
      where: { projectId, date: { gte: start, lt: end } },
      select: { plannedQty: true, installedQty: true },
      take: 200,
    }),
    prisma.timeEntry.findMany({
      where: { projectId, date: { gte: start, lt: end } },
      select: { id: true, hours: true, approved: true, memberId: true },
      take: 300,
    }),
    prisma.activity.count({
      where: { projectId, createdAt: { gte: start, lt: end }, action: { startsWith: 'site diary note:' } },
    }),
    prisma.document.count({ where: { projectId, type: 'photo', createdAt: { gte: start, lt: end } } }),
    prisma.task.count({
      where: { projectId, status: { not: 'done' }, priority: { in: ['critical', 'high'] } },
    }),
  ])

  const productionPlanned = production.reduce((sum, item) => sum + Number(item.plannedQty || 0), 0)
  const productionInstalled = production.reduce((sum, item) => sum + Number(item.installedQty || 0), 0)
  const hours = timeEntries.reduce((sum, item) => sum + Number(item.hours || 0), 0)
  const pendingHandovers = handovers.filter(item => !item.acceptedAt).length

  const blocking: string[] = []
  const warnings: string[] = []
  if (criticalConstraints > 0) blocking.push(`${criticalConstraints} critical constraint${criticalConstraints === 1 ? '' : 's'} unresolved`)
  if (qaWaiting > 0) blocking.push(`${qaWaiting} hold/witness point${qaWaiting === 1 ? '' : 's'} awaiting release`)
  if (failedInspections > 0) warnings.push(`${failedInspections} inspection${failedInspections === 1 ? '' : 's'} failed today`)
  if (openConstraints > criticalConstraints) warnings.push(`${openConstraints - criticalConstraints} non-critical constraint${openConstraints - criticalConstraints === 1 ? '' : 's'} still open`)
  if (openUrgentTasks > 0) warnings.push(`${openUrgentTasks} high/critical task${openUrgentTasks === 1 ? '' : 's'} still open`)
  if (handovers.length === 0) warnings.push('No shift handover recorded')
  else if (pendingHandovers > 0) warnings.push(`${pendingHandovers} handover${pendingHandovers === 1 ? '' : 's'} awaiting acceptance`)
  if (production.length === 0) warnings.push('No production output recorded today')
  if (diaryNotes === 0) warnings.push('No site diary note recorded today')
  if (timeEntries.length === 0) warnings.push('No time entries recorded for this project today')
  else {
    const unapprovedTimeEntries = timeEntries.filter(item => !item.approved).length
    if (unapprovedTimeEntries > 0) warnings.push(`${unapprovedTimeEntries} time entr${unapprovedTimeEntries === 1 ? 'y is' : 'ies are'} awaiting approval`)
  }

  return {
    blocking,
    warnings,
    metrics: {
      openConstraints,
      criticalConstraints,
      qaWaiting,
      failedInspections,
      handovers: handovers.length,
      pendingHandovers,
      productionLogs: production.length,
      productionPlanned,
      productionInstalled,
      productionPct: productionPlanned > 0 ? Math.round((productionInstalled / productionPlanned) * 1000) / 10 : null,
      timeEntries: timeEntries.length,
      unapprovedTimeEntries: timeEntries.filter(item => !item.approved).length,
      peopleLogged: new Set(timeEntries.map(item => item.memberId)).size,
      hours: Math.round(hours * 100) / 100,
      diaryNotes,
      photos,
      openUrgentTasks,
    },
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = String(searchParams.get('projectId') || '').trim()
    const day = parseDay(searchParams.get('date'))
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    if (!day) return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })

    const project = await prisma.project.findFirst({
      where: programmeProjectWhere(projectId, auth.session),
      select: { id: true, name: true },
    })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })

    const report = await summary(projectId, day.start, day.end)
    const existingClose = await prisma.activity.findFirst({
      where: {
        projectId,
        action: `field shift closed: ${day.key}`,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, actorName: true, createdAt: true, detail: true },
    })

    return NextResponse.json({
      project,
      date: day.key,
      canClose: closePermission(auth),
      closed: !!existingClose,
      closeout: existingClose,
      ...report,
    })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to load shift close-out' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!closePermission(auth)) {
    return NextResponse.json({ error: 'Company Admin, Project Manager or Foreman permission required' }, { status: 403 })
  }
  const limited = await enforceRateLimit(req, 'write', auth.userId || '')
  if (limited) return limited

  try {
    const body = await req.json().catch(() => ({}))
    const projectId = String(body.projectId || '').trim()
    const day = parseDay(typeof body.date === 'string' ? body.date : null)
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    if (!day) return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })

    const project = await prisma.project.findFirst({
      where: programmeProjectWhere(projectId, auth.session),
      select: { id: true, name: true },
    })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })

    const existing = await prisma.activity.findFirst({
      where: { projectId, action: `field shift closed: ${day.key}` },
      select: { id: true, actorName: true, createdAt: true, detail: true },
    })
    if (existing) return NextResponse.json({ error: 'This shift is already closed', code: 'SHIFT_ALREADY_CLOSED', closeout: existing }, { status: 409 })

    const report = await summary(projectId, day.start, day.end)
    const acknowledgeOpenItems = body.acknowledgeOpenItems === true
    if ((report.blocking.length || report.warnings.length) && !acknowledgeOpenItems) {
      return NextResponse.json({
        error: 'Open shift items require acknowledgement before close-out',
        code: 'CLOSEOUT_ACK_REQUIRED',
        ...report,
      }, { status: 409 })
    }

    const notes = String(body.notes || '').replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000)
    const payload = {
      v: 1,
      type: 'shift_closeout',
      date: day.key,
      notes: notes || null,
      acknowledgedOpenItems: acknowledgeOpenItems,
      blocking: report.blocking,
      warnings: report.warnings,
      metrics: report.metrics,
    }

    const activity = await createActivity({
      projectId,
      actorName: actorName(auth.session),
      actorType: 'human',
      action: `field shift closed: ${day.key}`,
      detail: JSON.stringify(payload),
      iconType: 'check',
    })

    return NextResponse.json({ closed: true, activity, ...report }, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to close shift' }, { status: 500 })
  }
}
