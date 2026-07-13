import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import { sanitizeChecklist, ALLOWED_FREQUENCY, computeNextDueAt } from '../route'

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
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const id = extractId(req)
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  try {
    const check = await prisma.equipmentCheck.findUnique({
      where: { id },
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
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const id = extractId(req)
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  try {
    const body = await req.json()
    const existing = await prisma.equipmentCheck.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
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
          actorName: actorName(auth),
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
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const id = extractId(req)
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited

  try {
    const check = await prisma.equipmentCheck.findUnique({ where: { id } })
    if (!check) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.equipmentCheck.delete({ where: { id } })
    auditLog({
      action: 'equipmentCheck.delete',
      resourceType: 'EquipmentCheck',
      resourceId: id,
      userId: (auth.user as { id?: string }).id || '',
      ...requestMeta(req),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete equipment check' }, { status: 500 })
  }
}
