import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { auditLog, requestMeta } from '@/lib/audit'
import controls from '@/lib/field-controls'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPE = new Set(['general', 'safety', 'quality', 'scaffold', 'electrical'])
const ALLOWED_STATUS = new Set(['draft', 'in_progress', 'passed', 'failed'])
const RELEASE_STATUS = new Set(['pending', 'released', 'rejected', 'not_required'])
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
    if (typeof body.location === 'string') data.location = controls.cleanText(body.location, 160) || null
    const releaseEvidence = body.evidence && typeof body.evidence === 'object'
      ? controls.sanitizeEvidence(body.evidence)
      : controls.sanitizeEvidence(existing.evidence)
    if (body.evidence && typeof body.evidence === 'object') data.evidence = releaseEvidence as unknown as object

    let finalReleaseStatus = existing.releaseStatus
    if (typeof body.releaseStatus === 'string' && RELEASE_STATUS.has(body.releaseStatus)) {
      if (existing.pointType === 'inspection' && body.releaseStatus !== 'not_required') {
        return NextResponse.json({ error: 'Standard inspections do not use hold-point release' }, { status: 409 })
      }
      finalReleaseStatus = body.releaseStatus
      data.releaseStatus = body.releaseStatus
      if (body.releaseStatus === 'released') {
        if ((existing.pointType === 'hold' || existing.pointType === 'witness') && !controls.hasReleaseEvidence(releaseEvidence)) {
          return NextResponse.json({ error: 'Evidence photo or signed evidence is required before releasing this QA point' }, { status: 409 })
        }
        if (existing.pointType === 'witness') {
          data.witnessedBy = controls.cleanText(body.releasedBy, 120) || actorName(auth)
          data.witnessedAt = existing.witnessedAt || new Date()
        } else {
          data.releasedBy = controls.cleanText(body.releasedBy, 120) || actorName(auth)
          data.releasedAt = existing.releasedAt || new Date()
        }
      } else if (body.releaseStatus === 'rejected') {
        data.releasedBy = null
        data.releasedAt = null
        data.witnessedBy = null
        data.witnessedAt = null
      }
    }

    if (typeof body.status === 'string' && ALLOWED_STATUS.has(body.status)) {
      if (body.status === 'passed' && !controls.canCompletePoint(existing.pointType, finalReleaseStatus)) {
        return NextResponse.json({ error: `${existing.pointType} point must be released before it can pass` }, { status: 409 })
      }
      data.status = body.status
      if (body.status === 'passed' || body.status === 'failed') {
        data.overallResult = body.status === 'passed' ? 'pass' : 'fail'
        data.completedAt = existing.completedAt || new Date()
      }
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
      include: {
        project: { select: { id: true, name: true } },
        drawing: { select: { id: true, number: true, title: true } },
        drawingRevision: { select: { id: true, revision: true, fileUrl: true } },
      },
    })

    if (data.releaseStatus && data.releaseStatus !== existing.releaseStatus) {
      prisma.activity.create({
        data: {
          projectId: inspection.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `${inspection.pointType} point ${inspection.title}: ${existing.releaseStatus} → ${String(data.releaseStatus)}`,
          detail: inspection.drawing ? `Drawing ${inspection.drawing.number}${inspection.drawingRevision ? ` · Rev ${inspection.drawingRevision.revision}` : ''}` : undefined,
          iconType: data.releaseStatus === 'released' ? 'check' : 'alert',
        },
      }).catch(() => {})
    }

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

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const i = await prisma.inspection.findUnique({ where: { id: params.id } })
    if (!i) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.inspection.delete({ where: { id: params.id } })
    auditLog({
      action: 'inspection.delete',
      resourceType: 'Inspection',
      resourceId: params.id,
      ...requestMeta(req),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[inspections/:id] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to delete inspection' }, { status: 500 })
  }
}
