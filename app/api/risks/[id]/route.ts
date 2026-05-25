import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const ALLOWED_CATEGORY = new Set(['operational', 'financial', 'schedule', 'safety', 'quality', 'environmental'])
const ALLOWED_STATUS = new Set(['open', 'mitigated', 'accepted', 'closed'])

function clamp1to5(v: unknown): number {
  const n = Number(v)
  if (!isFinite(n)) return 3
  return Math.max(1, Math.min(5, Math.round(n)))
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
    const existing = await prisma.risk.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 200)
    if (typeof body.category === 'string' && ALLOWED_CATEGORY.has(body.category)) data.category = body.category
    if (typeof body.status === 'string' && ALLOWED_STATUS.has(body.status)) data.status = body.status
    if (typeof body.mitigation === 'string') data.mitigation = body.mitigation.slice(0, 2000) || null
    if (typeof body.owner === 'string') data.owner = body.owner.slice(0, 100) || null
    if (typeof body.notes === 'string') data.notes = body.notes.slice(0, 2000) || null
    if ('reviewBy' in body) {
      const d = parseDate(body.reviewBy)
      if (d === undefined && body.reviewBy) return NextResponse.json({ error: 'Invalid reviewBy' }, { status: 400 })
      data.reviewBy = d ?? null
    }
    // Re-compute score whenever likelihood or impact changes; clamp to 1-5.
    const newLikelihood = typeof body.likelihood !== 'undefined' ? clamp1to5(body.likelihood) : existing.likelihood
    const newImpact = typeof body.impact !== 'undefined' ? clamp1to5(body.impact) : existing.impact
    if (newLikelihood !== existing.likelihood) data.likelihood = newLikelihood
    if (newImpact !== existing.impact) data.impact = newImpact
    if (newLikelihood !== existing.likelihood || newImpact !== existing.impact) {
      data.score = newLikelihood * newImpact
    }

    const risk = await prisma.risk.update({
      where: { id: params.id },
      data,
      include: { project: { select: { id: true, name: true } } },
    })

    if (data.status && data.status !== existing.status) {
      prisma.activity.create({
        data: {
          projectId: risk.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `risk ${risk.title}: ${existing.status} → ${data.status}`,
          iconType: 'check',
        },
      }).catch(() => {})
    }
    return NextResponse.json(risk)
  } catch (error) {
    console.error('[risks/:id] PATCH failed:', error)
    return NextResponse.json({ error: 'Failed to update risk' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const r = await prisma.risk.findUnique({ where: { id: params.id } })
    if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.risk.delete({ where: { id: params.id } })
    auditLog({
      action: 'risk.delete',
      resourceType: 'Risk',
      resourceId: params.id,
      ...requestMeta(req),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[risks/:id] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to delete risk' }, { status: 500 })
  }
}
