import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPE = new Set(['general', 'safety', 'quality', 'scaffold', 'electrical'])
const ALLOWED_STATUS = new Set(['draft', 'in_progress', 'passed', 'failed'])
const ITEM_RESULT = new Set(['pass', 'fail', 'na'])

interface ChecklistItem { id: string; label: string; result?: 'pass' | 'fail' | 'na'; note?: string }

function sanitizeChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((i): i is ChecklistItem => !!i && typeof i === 'object'
      && typeof (i as ChecklistItem).label === 'string'
      && (i as ChecklistItem).label.trim().length > 0)
    .slice(0, 100)
    .map((i, idx) => ({
      id: typeof i.id === 'string' && i.id ? i.id.slice(0, 40) : `item-${idx}`,
      label: i.label.trim().slice(0, 200),
      result: i.result && ITEM_RESULT.has(i.result) ? i.result : undefined,
      note: typeof i.note === 'string' && i.note ? i.note.slice(0, 500) : undefined,
    }))
}

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(v as string); return isNaN(d.getTime()) ? undefined : d
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')

    const where = {
      ...(projectId && { projectId }),
      ...(status && ALLOWED_STATUS.has(status) && { status }),
    }
    const [inspections, openCount, failedCount] = await Promise.all([
      prisma.inspection.findMany({
        where,
        include: { project: { select: { id: true, name: true } } },
        orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }, { updatedAt: 'desc' }],
        take: 200,
      }),
      prisma.inspection.count({ where: { ...where, status: { in: ['draft', 'in_progress'] } } }),
      prisma.inspection.count({ where: { ...where, status: 'failed' } }),
    ])
    return NextResponse.json({ inspections, openCount, failedCount })
  } catch (error) {
    console.error('[inspections] GET failed:', error)
    return NextResponse.json({ error: 'Failed to fetch inspections' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return NextResponse.json({ error: 'Project is required' }, { status: 400 })
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 400 })

    const type = ALLOWED_TYPE.has(body.type) ? body.type : 'general'
    const checklistItems = sanitizeChecklist(body.checklistItems)
    const scheduledAt = parseDate(body.scheduledAt)
    if (scheduledAt === undefined && body.scheduledAt) return NextResponse.json({ error: 'Invalid scheduledAt' }, { status: 400 })

    const inspection = await prisma.inspection.create({
      data: {
        projectId,
        title: title.slice(0, 200),
        type,
        status: 'draft',
        checklistItems: checklistItems as unknown as object,
        conductedBy: actorName(auth),
        scheduledAt: (scheduledAt ?? null) as Date | null,
        notes: typeof body.notes === 'string' && body.notes ? body.notes.slice(0, 2000) : null,
      },
      include: { project: { select: { id: true, name: true } } },
    })

    prisma.activity.create({
      data: {
        projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `scheduled ${type} inspection: ${inspection.title}`,
        iconType: 'check',
      },
    }).catch(() => {})

    return NextResponse.json(inspection, { status: 201 })
  } catch (error) {
    console.error('[inspections] POST failed:', error)
    return NextResponse.json({ error: 'Failed to create inspection' }, { status: 500 })
  }
}
