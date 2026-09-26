import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canWrite } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import { programmeProjectWhere } from '@/lib/programme-access'
import controls from '@/lib/field-controls'

export const dynamic = 'force-dynamic'

const STATUSES = new Set(['idea', 'pilot', 'proven', 'parked'])
const AREAS = new Set(['productivity', 'safety', 'quality', 'logistics', 'procurement', 'carbon', 'digital', 'programme', 'commercial', 'other'])
const DIRECTIONS = new Set(['increase', 'decrease'])

function normalizeStatus(value: unknown) {
  const status = String(value || 'idea').toLowerCase()
  if (status === 'testing') return 'pilot'
  if (status === 'complete' || status === 'completed') return 'proven'
  return STATUSES.has(status) ? status : 'idea'
}

function canTransitionStatus(fromValue: unknown, to: string) {
  const from = normalizeStatus(fromValue)
  if (from === to) return true
  if (from === 'idea') return to === 'pilot' || to === 'parked'
  if (from === 'pilot') return to === 'idea' || to === 'proven' || to === 'parked'
  if (from === 'parked') return to === 'idea' || to === 'pilot'
  if (from === 'proven') return to === 'pilot' || to === 'parked'
  return false
}

function metricValue(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && Math.abs(n) <= 1_000_000_000 ? n : undefined
}

async function accessibleProject(projectId: string, session: Parameters<typeof programmeProjectWhere>[1]) {
  return prisma.project.findFirst({
    where: programmeProjectWhere(projectId, session),
    select: { id: true },
  })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  try {
    const item = await prisma.improvement.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true } } },
    })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (item.projectId && !(await accessibleProject(item.projectId, auth.session))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ item })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId || '')
  if (limited) return limited
  const { id } = await params

  try {
    const existing = await prisma.improvement.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.projectId && !(await accessibleProject(existing.projectId, auth.session))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}

    if (body.title !== undefined) {
      const title = controls.cleanText(body.title, 220)
      if (!title) return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
      data.title = title
    }
    if (body.projectId !== undefined) {
      const projectId = controls.cleanText(body.projectId, 100) || null
      if (projectId && !(await accessibleProject(projectId, auth.session))) {
        return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
      }
      data.projectId = projectId
    }
    if (body.description !== undefined) data.description = controls.cleanText(body.description, 3000) || null
    if (body.raisedBy !== undefined) data.raisedBy = controls.cleanText(body.raisedBy, 120) || null
    if (body.ownerName !== undefined) data.ownerName = controls.cleanText(body.ownerName, 120) || null

    if (body.area !== undefined) {
      const area = controls.cleanText(body.area, 40).toLowerCase()
      if (!AREAS.has(area)) return NextResponse.json({ error: 'Invalid innovation area' }, { status: 400 })
      data.area = area
    }
    if (body.impact !== undefined) data.impact = controls.cleanText(body.impact, 20) || null
    if (body.effort !== undefined) data.effort = controls.cleanText(body.effort, 20) || null
    if (body.metricName !== undefined) data.metricName = controls.cleanText(body.metricName, 120) || null
    if (body.metricUnit !== undefined) data.metricUnit = controls.cleanText(body.metricUnit, 40) || null
    if (body.metricDirection !== undefined) {
      const direction = controls.cleanText(body.metricDirection, 20).toLowerCase()
      if (direction && !DIRECTIONS.has(direction)) return NextResponse.json({ error: 'Invalid metric direction' }, { status: 400 })
      data.metricDirection = direction || null
    }

    for (const field of ['baselineValue', 'targetValue', 'resultValue'] as const) {
      if (body[field] === undefined) continue
      const value = metricValue(body[field])
      if (value === undefined) return NextResponse.json({ error: field + ' must be a finite number' }, { status: 400 })
      data[field] = value
    }

    if (body.status !== undefined) {
      const status = controls.cleanText(body.status, 30).toLowerCase()
      if (!STATUSES.has(status)) return NextResponse.json({ error: 'Invalid innovation status' }, { status: 400 })
      if (!canTransitionStatus(existing.status, status)) {
        return NextResponse.json({ error: 'Invalid innovation status transition' }, { status: 409 })
      }

      if (status === 'proven') {
        const effectiveMetricName = body.metricName !== undefined ? data.metricName : existing.metricName
        const effectiveBaseline = body.baselineValue !== undefined ? data.baselineValue : existing.baselineValue
        const effectiveTarget = body.targetValue !== undefined ? data.targetValue : existing.targetValue
        const effectiveResult = body.resultValue !== undefined ? data.resultValue : existing.resultValue
        if (
          !effectiveMetricName ||
          effectiveBaseline === null || effectiveBaseline === undefined ||
          effectiveTarget === null || effectiveTarget === undefined ||
          effectiveResult === null || effectiveResult === undefined
        ) {
          return NextResponse.json({ error: 'Proven improvements require a metric, baseline, target and observed result' }, { status: 400 })
        }
      }

      data.status = status
      if (status === 'pilot' && normalizeStatus(existing.status) !== 'pilot') data.startedAt = existing.startedAt || new Date()
      if (status === 'proven') {
        data.startedAt = existing.startedAt || new Date()
        data.completedAt = existing.completedAt || new Date()
      } else if (normalizeStatus(existing.status) === 'proven') {
        data.completedAt = null
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No supported updates provided' }, { status: 400 })
    }

    const item = await prisma.improvement.update({
      where: { id },
      data,
      include: { project: { select: { id: true, name: true } } },
    })

    auditLog({
      action: 'innovation.improvement.update',
      resourceType: 'Improvement',
      resourceId: item.id,
      metadata: { fields: Object.keys(data), projectId: item.projectId, status: item.status },
      ...requestMeta(req),
    })

    return NextResponse.json({ item })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId || '')
  if (limited) return limited
  const { id } = await params

  try {
    const existing = await prisma.improvement.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.projectId && !(await accessibleProject(existing.projectId, auth.session))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.improvement.delete({ where: { id } })
    await auditLog({
      userId: auth.userId || undefined,
      action: 'improve-hub.delete',
      resourceType: 'improvement',
      resourceId: id,
      ...requestMeta(req),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
