import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canWrite } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import { programmeProjectWhere } from '@/lib/programme-access'
import controls from '@/lib/field-controls'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200
const STATUSES = new Set(['idea', 'pilot', 'proven', 'parked'])
const AREAS = new Set(['productivity', 'safety', 'quality', 'logistics', 'procurement', 'carbon', 'digital', 'programme', 'commercial', 'other'])
const DIRECTIONS = new Set(['increase', 'decrease'])

function metricValue(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && Math.abs(n) <= 1_000_000_000 ? n : undefined
}

async function accessibleProject(projectId: string, session: Parameters<typeof programmeProjectWhere>[1]) {
  return prisma.project.findFirst({
    where: programmeProjectWhere(projectId, session),
    select: { id: true, name: true },
  })
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  try {
    const sp = req.nextUrl.searchParams
    const take = Math.min(parseInt(sp.get('take') || '50') || 50, MAX_TAKE)
    const skip = Math.max(0, parseInt(sp.get('skip') || '0') || 0)
    const projectId = controls.cleanText(sp.get('projectId'), 100)

    if (projectId && !(await accessibleProject(projectId, auth.session))) {
      return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    }

    const where = projectId ? { projectId } : {}
    const [items, total] = await Promise.all([
      prisma.improvement.findMany({
        where,
        include: { project: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.improvement.count({ where }),
    ])
    return NextResponse.json({ items, total, hasMore: skip + items.length < total })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId || '')
  if (limited) return limited

  try {
    const body = await req.json().catch(() => ({}))
    const title = controls.cleanText(body.title, 220)
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

    const projectId = controls.cleanText(body.projectId, 100) || null
    if (projectId && !(await accessibleProject(projectId, auth.session))) {
      return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    }

    const statusRaw = controls.cleanText(body.status, 30).toLowerCase()
    const status = STATUSES.has(statusRaw) ? statusRaw : 'idea'
    const areaRaw = controls.cleanText(body.area, 40).toLowerCase()
    const area = AREAS.has(areaRaw) ? areaRaw : 'other'
    const directionRaw = controls.cleanText(body.metricDirection, 20).toLowerCase()
    const metricDirection = DIRECTIONS.has(directionRaw) ? directionRaw : null

    const baselineValue = metricValue(body.baselineValue)
    const targetValue = metricValue(body.targetValue)
    const resultValue = metricValue(body.resultValue)
    if (
      (body.baselineValue !== undefined && baselineValue === undefined) ||
      (body.targetValue !== undefined && targetValue === undefined) ||
      (body.resultValue !== undefined && resultValue === undefined)
    ) {
      return NextResponse.json({ error: 'Metric values must be finite numbers' }, { status: 400 })
    }

    const metricName = controls.cleanText(body.metricName, 120) || null
    if (
      status === 'proven' &&
      (!metricName || baselineValue === null || baselineValue === undefined || targetValue === null || targetValue === undefined || resultValue === null || resultValue === undefined)
    ) {
      return NextResponse.json({ error: 'Proven improvements require a metric, baseline, target and observed result' }, { status: 400 })
    }

    const now = new Date()
    const item = await prisma.improvement.create({
      data: {
        title,
        projectId,
        description: controls.cleanText(body.description, 3000) || null,
        raisedBy: controls.cleanText(body.raisedBy, 120) || null,
        ownerName: controls.cleanText(body.ownerName, 120) || null,
        area,
        status,
        impact: controls.cleanText(body.impact, 20) || null,
        effort: controls.cleanText(body.effort, 20) || null,
        metricName,
        metricUnit: controls.cleanText(body.metricUnit, 40) || null,
        metricDirection,
        baselineValue: baselineValue ?? null,
        targetValue: targetValue ?? null,
        resultValue: resultValue ?? null,
        startedAt: status === 'pilot' || status === 'proven' ? now : null,
        completedAt: status === 'proven' ? now : null,
      },
      include: { project: { select: { id: true, name: true } } },
    })

    auditLog({
      action: 'innovation.improvement.create',
      resourceType: 'Improvement',
      resourceId: item.id,
      metadata: { projectId, status, area },
      ...requestMeta(req),
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}
