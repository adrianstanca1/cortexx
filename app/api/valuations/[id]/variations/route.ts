import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { canManage } from '@/lib/rbac'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  const role = auth.role
  if (!role || !canManage(role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  try {
    const { id } = await params
    const valuation = await prisma.valuation.findUnique({ where: { id }, select: { id: true, projectId: true, status: true } })
    if (!valuation) return NextResponse.json({ error: 'Valuation not found' }, { status: 404 })
    if (valuation.status !== 'draft') return NextResponse.json({ error: 'Variation links are locked after submission' }, { status: 409 })
    const body = await req.json()
    const raw = Array.isArray(body.links) ? body.links.slice(0, 100) : []
    const ids: string[] = Array.from(new Set<string>(raw.map((x: { variationId?: unknown }) => String(x?.variationId || '')).filter((id: string) => id.length > 0)))
    const variations = ids.length ? await prisma.variation.findMany({
      where: { id: { in: ids }, projectId: valuation.projectId, status: { in: ['submitted', 'approved'] } },
      select: { id: true, costImpact: true },
    }) : []
    if (variations.length !== ids.length) return NextResponse.json({ error: 'Only submitted/approved variations from this project can be included' }, { status: 400 })
    const byId = new Map(variations.map(v => [v.id, v]))
    const links = ids.map(variationId => {
      const rawLink = raw.find((x: { variationId?: unknown }) => String(x?.variationId || '') === variationId)
      const supplied = rawLink?.amountIncluded
      const amountIncluded = supplied === undefined ? byId.get(variationId)!.costImpact : Number(supplied)
      if (!Number.isFinite(amountIncluded)) throw new Error('INVALID_VARIATION_AMOUNT')
      return { valuationId: id, variationId, amountIncluded }
    })
    await prisma.$transaction(async tx => {
      await tx.valuationVariation.deleteMany({ where: { valuationId: id } })
      if (links.length) await tx.valuationVariation.createMany({ data: links })
    })
    auditLog({ action: 'valuation.variations.update', resourceType: 'Valuation', resourceId: id, metadata: { count: links.length }, ...requestMeta(req) })
    const saved = await prisma.valuationVariation.findMany({ where: { valuationId: id }, include: { variation: true } })
    return NextResponse.json({ links: saved })
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_VARIATION_AMOUNT') return NextResponse.json({ error: 'Variation included amount must be a number' }, { status: 400 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to update valuation variations' }, { status: 500 })
  }
}
