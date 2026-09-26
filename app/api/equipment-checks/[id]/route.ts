import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import { canWrite } from '@/lib/rbac'
import { programmeProjectWhere } from '@/lib/programme-access'
import { sanitizeChecklist, ALLOWED_FREQUENCY, computeNextDueAt, equipmentCheckScope } from '../route'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPE = new Set([
  'scissor_lift',
  'cherry_picker',
  'telehandler',
  'harness',
  'fall_arrest',
  'ladder',
  'other',
])
const ALLOWED_STATUS = new Set(['draft', 'in_progress', 'passed', 'failed'])

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(v as string)
  return isNaN(d.getTime()) ? undefined : d
}

function extractId(req: NextRequest): string | null {
  return req.nextUrl.pathname.split('/').pop() || null
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const id = extractId(req)
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  try {
    const check = await prisma.equipmentCheck.findFirst({
      where: { id, ...equipmentCheckScope(auth.session) },
      include: {
        project: { select: { id: true, name: true } },
        equipment: { select: { id: true, name: true, code: true } },
      },
    })
    if (!check) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(check)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch equipment check' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId || '')
  if (limited) return limited
  const id = extractId(req)
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  try {
    const body = await req.json()
    const existing = await prisma.equipmentCheck.findFirst({ where: { id, ...equipmentCheckScope(auth.session) } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}

    if ('projectId' in body) {
      const projectId = body.projectId ? String(body.projectId).trim() : null
      if (projectId) {
        const project = await prisma.project.findFirst({
          where: programmeProjectWhere(projectId, auth.session),
          select: { id: true },
        })
        if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
      } else if (['project_manager', 'foreman', 'operative'].includes(auth.session.user?.role || '')) {
        return NextResponse.json({ error: 'Project is required for field roles' }, { status: 400 })
      }
      data.projectId = projectId
    }

    if ('equipmentId' in body) {
      const equipmentId = body.equipmentId ? String(body.equipmentId).trim() : null
      if (equipmentId) {
        const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId }, select: { id: true } })
        if (!equipment) return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
      }
      data.equipmentId = equipmentId
    }

    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 200)
    if (typeof body.type === 'string' && ALLOWED_TYPE.has(body.type)) data.type = body.type
    if (typeof body.notes === 'string') data.notes = body.notes.slice(0, 2000) || null
    if (typeof body.conductedBy === 'string') data.conductedBy = body.conductedBy.slice(0, 120) || null
    if (Array.isArray(body.checklistItems)) data.checklistItems = sanitizeChecklist(body.checklistItems) as unknown as object
    if ('completedAt' in body) {
      const d = parseDate(body.completedAt)
      if (d === undefined && body.completedAt) return NextResponse.json({ error: 'Invalid completedAt' }, { status: 400 })
      data.completedAt = d ?? null
    }

    let frequency = existing.frequency
    if (typeof body.frequency === 'string' && ALLOWED_FREQUENCY.has(body.frequency)) {
      frequency = body.frequency
      data.frequency = frequency
    }

    if (typeof body.status === 'string' && ALLOWED_STATUS.has(body.status)) {
      data.status = body.status
      const now = new Date()
      const isTerminal = body.status === 'passed' || body.status === 'failed'
      if (isTerminal) {
        data.overallResult = body.status === 'passed' ? 'pass' : 'fail'
        data.completedAt = now
        data.lastCompletedAt = now
        data.nextDueAt = computeNextDueAt(now, frequency)
      } else if (existing.status === 'passed' || existing.status === 'failed') {
        data.overallResult = null
        data.completedAt = null
      }

      if (!isTerminal && 'frequency' in body) {
        data.nextDueAt = frequency === 'none' ? null : computeNextDueAt(now, frequency)
      }
    } else if ('frequency' in body) {
      const scheduleFrom = existing.lastCompletedAt || existing.completedAt || existing.createdAt
      data.nextDueAt = frequency === 'none' ? null : computeNextDueAt(scheduleFrom, frequency)
    }

    const check = await prisma.equipmentCheck.update({
      where: { id },
      data,
      include: {
        project: { select: { id: true, name: true } },
        equipment: { select: { id: true, name: true, code: true } },
      },
    })

    if (data.status && data.status !== existing.status) {
      prisma.activity.create({
        data: {
          projectId: check.projectId,
          actorName: actorName(auth.session),
          actorType: 'human',
          action: `equipment check ${check.title}: ${existing.status} → ${data.status}`,
          iconType: data.status === 'failed' ? 'alert' : 'check',
        },
      }).catch(() => {})
    }

    return NextResponse.json(check)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update equipment check' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const id = extractId(req)
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const limited = await enforceRateLimit(req, 'write', auth.userId || '')
  if (limited) return limited

  try {
    const check = await prisma.equipmentCheck.findFirst({ where: { id, ...equipmentCheckScope(auth.session) } })
    if (!check) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.equipmentCheck.delete({ where: { id } })
    auditLog({
      action: 'equipmentCheck.delete',
      resourceType: 'EquipmentCheck',
      resourceId: id,
      userId: auth.userId || '',
      ...requestMeta(req),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete equipment check' }, { status: 500 })
  }
}
