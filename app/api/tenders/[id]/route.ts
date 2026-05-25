import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set(['draft', 'submitted', 'won', 'lost', 'withdrawn'])

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(v as string)
  return isNaN(d.getTime()) ? undefined : d
}

export async function PATCH(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.tender.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 200)
    if (typeof body.clientName === 'string') data.clientName = body.clientName.slice(0, 200) || null
    if (typeof body.notes === 'string') data.notes = body.notes.slice(0, 2000) || null
    if (typeof body.totalValue !== 'undefined') {
      const v = Number(body.totalValue)
      if (!isFinite(v) || v < 0 || v > 1_000_000_000) return NextResponse.json({ error: 'Invalid totalValue' }, { status: 400 })
      data.totalValue = v
    }
    if ('deadline' in body) {
      const d = parseDate(body.deadline)
      if (d === undefined && body.deadline) return NextResponse.json({ error: 'Invalid deadline' }, { status: 400 })
      data.deadline = d ?? null
    }
    if (typeof body.status === 'string' && ALLOWED_STATUS.has(body.status)) {
      data.status = body.status
      // Auto-stamp lifecycle dates on transitions.
      if (body.status === 'submitted' && !existing.submittedAt) data.submittedAt = new Date()
      if ((body.status === 'won' || body.status === 'lost') && !existing.decidedAt) data.decidedAt = new Date()
      if (body.status === 'draft') { data.submittedAt = null; data.decidedAt = null }
    }

    const tender = await prisma.tender.update({
      where: { id: params.id },
      data,
      include: { project: { select: { id: true, name: true } } },
    })

    if (data.status && data.status !== existing.status && tender.projectId) {
      prisma.activity.create({
        data: {
          projectId: tender.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `tender ${tender.title}: ${existing.status} → ${data.status}`,
          iconType: 'doc',
        },
      }).catch(() => {})
    }
    return NextResponse.json(tender)
  } catch (error) {
    console.error('[tenders/:id] PATCH failed:', error)
    return NextResponse.json({ error: 'Failed to update tender' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const tender = await prisma.tender.findUnique({ where: { id: params.id } })
    if (!tender) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.tender.delete({ where: { id: params.id } })
    auditLog({
      action: 'tender.delete',
      resourceType: 'Tender',
      resourceId: params.id,
      ...requestMeta(req),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[tenders/:id] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to delete tender' }, { status: 500 })
  }
}
