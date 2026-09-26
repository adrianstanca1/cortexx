import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { canWrite } from '@/lib/rbac'
import { programmeProjectWhere } from '@/lib/programme-access'

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
export const ALLOWED_FREQUENCY = new Set(['none', 'daily', 'weekly', 'monthly'])
const ITEM_RESULT = new Set(['pass', 'fail', 'na'])

type EquipmentCheckActor = Parameters<typeof programmeProjectWhere>[1]

export function equipmentCheckScope(auth: EquipmentCheckActor): Prisma.EquipmentCheckWhereInput {
  const role = auth.user?.role || ''
  if (!['project_manager', 'foreman', 'operative'].includes(role)) return {}
  const email = auth.user?.email?.trim() || ''
  return email
    ? { project: { assignments: { some: { member: { email: { equals: email, mode: 'insensitive' } } } } } }
    : { id: '__no_equipment_check_access__' }
}

function isFieldRole(auth: EquipmentCheckActor) {
  return ['project_manager', 'foreman', 'operative'].includes(auth.user?.role || '')
}

export function computeNextDueAt(from: Date | string | number | null | undefined, frequency: string): Date | null {
  if (!from || frequency === 'none' || !ALLOWED_FREQUENCY.has(frequency)) return null
  const base = new Date(from)
  if (isNaN(base.getTime())) return null
  const next = new Date(base)
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1)
      break
    case 'weekly':
      next.setDate(next.getDate() + 7)
      break
    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      break
  }
  return next
}

export interface ChecklistItem {
  id: string
  label: string
  result?: 'pass' | 'fail' | 'na'
  note?: string
}

export function sanitizeChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((i): i is ChecklistItem =>
      !!i && typeof i === 'object' &&
      typeof (i as ChecklistItem).label === 'string' &&
      (i as ChecklistItem).label.trim().length > 0
    )
    .slice(0, 100)
    .map((i, idx) => ({
      id: typeof i.id === 'string' && i.id ? i.id.slice(0, 40) : `item-${idx}`,
      label: i.label.trim().slice(0, 200),
      result: i.result && ITEM_RESULT.has(i.result) ? i.result : undefined,
      note: typeof i.note === 'string' && i.note ? i.note.trim().slice(0, 500) : undefined,
    }))
}

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(v as string)
  return isNaN(d.getTime()) ? undefined : d
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const equipmentId = searchParams.get('equipmentId')
    const type = searchParams.get('type')
    const status = searchParams.get('status')

    const where: Prisma.EquipmentCheckWhereInput = {
      ...equipmentCheckScope(auth.session),
      ...(projectId && { projectId }),
      ...(equipmentId && { equipmentId }),
      ...(type && ALLOWED_TYPE.has(type) && { type }),
      ...(status && ALLOWED_STATUS.has(status) && { status }),
    }
    const [checks, openCount, failedCount] = await Promise.all([
      prisma.equipmentCheck.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          equipment: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 200,
      }),
      prisma.equipmentCheck.count({ where: { ...where, status: { in: ['draft', 'in_progress'] } } }),
      prisma.equipmentCheck.count({ where: { ...where, status: 'failed' } }),
    ])
    return NextResponse.json({ checks, openCount, failedCount })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch equipment checks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const __limited = await enforceRateLimit(req, 'write', auth.userId || '')
  if (__limited) return __limited
  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    const type = ALLOWED_TYPE.has(body.type) ? body.type : 'scissor_lift'
    const checklistItems = sanitizeChecklist(body.checklistItems)
    const status = ALLOWED_STATUS.has(body.status) ? body.status : 'draft'
    if (status === 'passed' || status === 'failed') {
      // only allow terminal status when creating with explicit items
      if (checklistItems.length === 0) return NextResponse.json({ error: 'Checklist cannot be empty' }, { status: 400 })
    }

    const projectId = body.projectId ? String(body.projectId).trim() : null
    if (!projectId && isFieldRole(auth.session)) {
      return NextResponse.json({ error: 'Project is required for field roles' }, { status: 400 })
    }
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: programmeProjectWhere(projectId, auth.session),
        select: { id: true },
      })
      if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    }
    const equipmentId = body.equipmentId || null
    if (equipmentId) {
      const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId }, select: { id: true } })
      if (!equipment) return NextResponse.json({ error: 'Equipment not found' }, { status: 400 })
    }

    const frequency = typeof body.frequency === 'string' && ALLOWED_FREQUENCY.has(body.frequency) ? body.frequency : 'none'
    const now = new Date()
    const isTerminal = status === 'passed' || status === 'failed'
    const nextDueAt = computeNextDueAt(now, frequency)

    const check = await prisma.equipmentCheck.create({
      data: {
        title: title.slice(0, 200),
        type,
        status,
        checklistItems: checklistItems as unknown as object,
        overallResult: isTerminal ? (status === 'passed' ? 'pass' : 'fail') : null,
        conductedBy: body.conductedBy ? String(body.conductedBy).slice(0, 120) : actorName(auth.session),
        completedAt: isTerminal ? now : null,
        lastCompletedAt: isTerminal ? now : null,
        frequency,
        nextDueAt,
        notes: typeof body.notes === 'string' && body.notes ? body.notes.slice(0, 2000) : null,
        projectId,
        equipmentId,
      },
      include: {
        project: { select: { id: true, name: true } },
        equipment: { select: { id: true, name: true, code: true } },
      },
    })

    if (projectId) {
      prisma.activity.create({
        data: {
          projectId,
          actorName: actorName(auth.session),
          actorType: 'human',
          action: `created ${type.replace(/_/g, ' ')} equipment check: ${check.title}`,
          iconType: 'check',
        },
      }).catch(() => {})
    }

    return NextResponse.json(check, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create equipment check' }, { status: 500 })
  }
}
