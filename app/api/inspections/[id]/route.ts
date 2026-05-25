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

export async function PATCH(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.inspection.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 200)
    if (typeof body.type === 'string' && ALLOWED_TYPE.has(body.type)) data.type = body.type
    if (typeof body.notes === 'string') data.notes = body.notes.slice(0, 2000) || null
    if (Array.isArray(body.checklistItems)) data.checklistItems = sanitizeChecklist(body.checklistItems) as unknown as object
    if ('scheduledAt' in body) {
      const d = parseDate(body.scheduledAt)
      if (d === undefined && body.scheduledAt) return NextResponse.json({ error: 'Invalid scheduledAt' }, { status: 400 })
      data.scheduledAt = d ?? null
    }
    if (typeof body.status === 'string' && ALLOWED_STATUS.has(body.status)) {
      data.status = body.status
      // Auto-derive overallResult + completedAt on terminal status.
      // Map status -> result enum ('pass'/'fail') to match the documented
      // 4-char enum on the column.
      if (body.status === 'passed' || body.status === 'failed') {
        data.overallResult = body.status === 'passed' ? 'pass' : 'fail'
        data.completedAt = existing.completedAt || new Date()
      }
      // Only wipe stamps when actually transitioning FROM a terminal state.
      // Re-asserting the existing non-terminal status (e.g. the page sends
      // status='in_progress' on every checklist tick) must not silently demote
      // a passed/failed inspection if the client's snapshot is stale.
      if (
        (body.status === 'draft' || body.status === 'in_progress') &&
        (existing.status === 'passed' || existing.status === 'failed')
      ) {
        data.overallResult = null
        data.completedAt = null
      }
    }

    const inspection = await prisma.inspection.update({
      where: { id: params.id },
      data,
      include: { project: { select: { id: true, name: true } } },
    })

    if (data.status && data.status !== existing.status) {
      prisma.activity.create({
        data: {
          projectId: inspection.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `inspection ${inspection.title}: ${existing.status} → ${data.status}`,
          iconType: data.status === 'failed' ? 'alert' : 'check',
        },
      }).catch(() => {})
    }
    return NextResponse.json(inspection)
  } catch (error) {
    console.error('[inspections/:id] PATCH failed:', error)
    return NextResponse.json({ error: 'Failed to update inspection' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const i = await prisma.inspection.findUnique({ where: { id: params.id } })
    if (!i) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.inspection.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[inspections/:id] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to delete inspection' }, { status: 500 })
  }
}
