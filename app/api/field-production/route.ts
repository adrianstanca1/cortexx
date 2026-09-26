import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { canWrite } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { programmeProjectWhere } from '@/lib/programme-access'
import controls from '@/lib/field-controls'

export const dynamic = 'force-dynamic'
const UNITS = new Set(['m2', 'm', 'lm', 'panels', 'items', 'hours', 'tonnes', 'kg'])

function parseDate(value: unknown) {
  if (!value) return null
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = controls.cleanText(searchParams.get('projectId'), 100)
    const area = controls.cleanText(searchParams.get('area'), 160)
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    const project = await prisma.project.findFirst({ where: programmeProjectWhere(projectId, auth.session), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })

    const from = searchParams.get('from') ? parseDate(searchParams.get('from')) : null
    const to = searchParams.get('to') ? parseDate(searchParams.get('to')) : null
    const logs = await prisma.fieldProductionLog.findMany({
      where: {
        projectId,
        ...(area ? { area } : {}),
        ...((from || to) ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      include: {
        programmeActivity: { select: { id: true, code: true, title: true, status: true, progress: true, location: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 300,
    })

    const totals = logs.reduce((acc, row) => {
      acc.plannedQty += row.plannedQty
      acc.installedQty += row.installedQty
      acc.labourHours += row.labourHours
      acc.crewDays += row.crewSize
      return acc
    }, { plannedQty: 0, installedQty: 0, labourHours: 0, crewDays: 0 })
    const metrics = controls.productionMetrics(totals.plannedQty, totals.installedQty, totals.labourHours)

    return NextResponse.json({ logs, summary: { ...totals, ...metrics } })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to load production logs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId || '')
  if (limited) return limited

  try {
    const body = await req.json()
    const projectId = controls.cleanText(body.projectId, 100)
    const area = controls.cleanText(body.area, 160)
    const activity = controls.cleanText(body.activity, 160)
    if (!projectId || !area || !activity) return NextResponse.json({ error: 'projectId, area and activity are required' }, { status: 400 })

    const project = await prisma.project.findFirst({ where: programmeProjectWhere(projectId, auth.session), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })

    const programmeActivityId = controls.cleanText(body.programmeActivityId, 100) || null
    const programmeActivity = programmeActivityId
      ? await prisma.programmeActivity.findFirst({
          where: { id: programmeActivityId, projectId },
          select: { id: true, code: true, title: true, location: true },
        })
      : null
    if (programmeActivityId && !programmeActivity) {
      return NextResponse.json({ error: 'Programme activity must belong to the selected project' }, { status: 400 })
    }

    const date = body.date ? parseDate(body.date) : new Date()
    if (!date) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    const plannedQty = controls.normalizeNonNegative(body.plannedQty)
    const installedQty = controls.normalizeNonNegative(body.installedQty)
    const labourHours = controls.normalizeNonNegative(body.labourHours, 100000)
    const crewSizeN = controls.normalizeNonNegative(body.crewSize, 10000)
    if ([plannedQty, installedQty, labourHours, crewSizeN].some(v => v === null)) {
      return NextResponse.json({ error: 'Production quantities, crew and labour hours must be non-negative numbers' }, { status: 400 })
    }

    const log = await prisma.fieldProductionLog.create({
      data: {
        projectId,
        date,
        area,
        elevation: controls.cleanText(body.elevation, 160) || null,
        activity,
        unit: UNITS.has(String(body.unit)) ? String(body.unit) : 'm2',
        plannedQty: plannedQty || 0,
        installedQty: installedQty || 0,
        crewSize: Math.round(crewSizeN || 0),
        labourHours: labourHours || 0,
        notes: controls.cleanText(body.notes, 2000) || null,
        createdBy: actorName(auth.session),
        programmeActivityId,
      },
      include: {
        programmeActivity: { select: { id: true, code: true, title: true, status: true, progress: true, location: true } },
      },
    })
    const metrics = controls.productionMetrics(log.plannedQty, log.installedQty, log.labourHours)

    prisma.activity.create({
      data: {
        projectId,
        actorName: actorName(auth.session),
        actorType: 'human',
        action: `production logged: ${activity} · ${area}`,
        detail: `${log.installedQty} ${log.unit} installed vs ${log.plannedQty} planned${programmeActivity ? ` · programme: ${programmeActivity.code ? programmeActivity.code + ' · ' : ''}${programmeActivity.title}` : ''}`,
        iconType: metrics.varianceQty < 0 ? 'alert' : 'check',
      },
    }).catch(() => {})

    return NextResponse.json({ log, metrics }, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create production log' }, { status: 500 })
  }
}
