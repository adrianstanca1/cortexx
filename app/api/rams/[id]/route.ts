import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPE = new Set(['rams', 'risk_assessment', 'method_statement'])
const ALLOWED_STATUS = new Set(['draft', 'reviewed', 'approved', 'active', 'expired', 'archived'])

// Forward lifecycle stages. Reopening (moving back to draft) is always allowed
// so expired/archived docs can be revived; admin overrides are not allowed.
const VALID_STAGE_TRANSITIONS: Record<string, Set<string>> = {
  draft: new Set(['reviewed', 'active']),
  reviewed: new Set(['approved', 'active']),
  approved: new Set(['active']),
  active: new Set(['expired', 'archived']),
  expired: new Set(['draft', 'archived']),
  archived: new Set(['draft']),
}

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(v as string)
  return isNaN(d.getTime()) ? undefined : d
}

function formatDocType(type: string): string {
  return type === 'rams' ? 'RAMS' : type.replace(/_/g, ' ')
}

export async function PATCH(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.rams.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const requestedStatus = typeof body.status === 'string' && ALLOWED_STATUS.has(body.status) ? body.status : existing.status
    if (body.status && body.status !== existing.status) {
      const allowed = VALID_STAGE_TRANSITIONS[existing.status]
      if (!allowed?.has(requestedStatus)) {
        return NextResponse.json({ error: `Cannot transition from ${existing.status} to ${requestedStatus}` }, { status: 400 })
      }
    }

    const data: Record<string, unknown> = {}
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 200)
    if (typeof body.type === 'string' && ALLOWED_TYPE.has(body.type)) data.type = body.type
    if (typeof body.status === 'string' && ALLOWED_STATUS.has(body.status)) data.status = body.status
    if (typeof body.hazards === 'string') data.hazards = body.hazards.slice(0, 4000) || null
    if (typeof body.controls === 'string') data.controls = body.controls.slice(0, 4000) || null
    if (typeof body.ppe === 'string') data.ppe = body.ppe.slice(0, 1000) || null
    if (typeof body.notes === 'string') data.notes = body.notes.slice(0, 2000) || null
    if ('reviewBy' in body) {
      const d = parseDate(body.reviewBy)
      if (d === undefined && body.reviewBy) return NextResponse.json({ error: 'Invalid reviewBy' }, { status: 400 })
      data.reviewBy = d ?? null
    }

    // Review sign-off: setting reviewedBy stamps reviewedAt automatically; clearing it
    // wipes the timestamp.
    if (typeof body.reviewedBy === 'string') {
      const trimmed = body.reviewedBy.trim().slice(0, 100)
      data.reviewedBy = trimmed || null
      data.reviewedAt = trimmed ? new Date() : null
    }

    // Approval sign-off: setting approvedBy stamps approvedAt automatically; clearing it
    // wipes the timestamp.
    if (typeof body.approvedBy === 'string') {
      const trimmed = body.approvedBy.trim().slice(0, 100)
      data.approvedBy = trimmed || null
      data.approvedAt = trimmed ? new Date() : null
    }

    // Optional segregation of duties: reviewer and approver must be different people.
    const reviewer = (data.reviewedBy ?? existing.reviewedBy) as string | null
    const approver = (data.approvedBy ?? existing.approvedBy) as string | null
    if (reviewer && approver && reviewer.toLowerCase() === approver.toLowerCase()) {
      return NextResponse.json({ error: 'Reviewer and approver must be different people' }, { status: 400 })
    }

    const doc = await prisma.rams.update({
      where: { id: params.id },
      data,
      include: { project: { select: { id: true, name: true } } },
    })

    const actor = actorName(auth)
    const meta: Record<string, string | null | undefined> = { fromStatus: existing.status, toStatus: doc.status }

    if (data.reviewedBy && !existing.reviewedBy) {
      prisma.activity.create({
        data: {
          projectId: doc.projectId,
          actorName: actor,
          actorType: 'human',
          action: `submitted ${formatDocType(doc.type)} for review: ${doc.title}`,
          iconType: 'doc',
        },
      }).catch(() => {})
      meta.reviewedBy = doc.reviewedBy
    }

    if (data.approvedBy && !existing.approvedBy) {
      prisma.activity.create({
        data: {
          projectId: doc.projectId,
          actorName: actor,
          actorType: 'human',
          action: doc.status === 'active'
            ? `approved and activated ${formatDocType(doc.type)}: ${doc.title}`
            : `approved ${formatDocType(doc.type)}: ${doc.title}`,
          iconType: 'check',
        },
      }).catch(() => {})
      meta.approvedBy = doc.approvedBy
    }

    if (data.status && data.status !== existing.status) {
      auditLog({
        action: `rams.status.${existing.status}.${doc.status}`,
        resourceType: 'Rams',
        resourceId: params.id,
        metadata: meta,
        ...requestMeta(req),
      })
    }

    return NextResponse.json(doc)
  } catch (error) {
    console.error('[rams/:id] PATCH failed:', error)
    return NextResponse.json({ error: 'Failed to update RAMS doc' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const doc = await prisma.rams.findUnique({ where: { id: params.id } })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.rams.delete({ where: { id: params.id } })
    auditLog({
      action: 'rams.delete',
      resourceType: 'Rams',
      resourceId: params.id,
      ...requestMeta(req),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[rams/:id] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to delete RAMS doc' }, { status: 500 })
  }
}
