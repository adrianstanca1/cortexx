import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { canManage } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

const STATUSES = new Set(['draft', 'submitted', 'certified', 'paid', 'rejected'])
const TRANSITIONS: Record<string, Set<string>> = {
  draft: new Set(['submitted', 'rejected']),
  submitted: new Set(['draft', 'certified', 'rejected']),
  certified: new Set(['paid']),
  paid: new Set(),
  rejected: new Set(['draft']),
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const org = await requireOrg()
  if (org instanceof NextResponse) return org
  if (!org.role || !canManage(org.role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', org.userId)
  if (limited) return limited

  try {
    const { id } = await params
    const existing = await prisma.valuation.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Valuation not found' }, { status: 404 })

    const body = await req.json()
    const data: Record<string, unknown> = {}

    if (body.status !== undefined) {
      const next = String(body.status)
      if (!STATUSES.has(next)) return NextResponse.json({ error: 'Invalid valuation status' }, { status: 400 })
      if (next !== existing.status && !TRANSITIONS[existing.status]?.has(next)) {
        return NextResponse.json({ error: 'Invalid status transition: ' + existing.status + ' → ' + next }, { status: 409 })
      }
      data.status = next
      if (next === 'submitted') data.submittedAt = existing.submittedAt || new Date()
      if (next === 'certified') {
        data.submittedAt = existing.submittedAt || new Date()
        data.certifiedAt = existing.certifiedAt || new Date()
      }
      if (next === 'paid') data.paidAt = existing.paidAt || new Date()
      if (next === 'draft') {
        data.submittedAt = null
        if (existing.status === 'rejected') data.certifiedAt = null
      }
    }

    if (body.notes !== undefined) data.notes = body.notes?.toString().trim() || null

    if (existing.status === 'draft' && (body.grossToDate !== undefined || body.retentionPct !== undefined)) {
      const grossToDate = body.grossToDate === undefined ? existing.grossToDate : Number(body.grossToDate)
      const retentionPct = body.retentionPct === undefined ? existing.retentionPct : Number(body.retentionPct)
      if (!Number.isFinite(grossToDate) || grossToDate < 0) {
        return NextResponse.json({ error: 'Gross value must be non-negative' }, { status: 400 })
      }
      if (!Number.isFinite(retentionPct) || retentionPct < 0 || retentionPct > 20) {
        return NextResponse.json({ error: 'Retention must be between 0 and 20%' }, { status: 400 })
      }
      const previous = await prisma.valuation.aggregate({
        where: { projectId: existing.projectId, id: { not: id }, status: { in: ['certified', 'paid'] } },
        _sum: { netDue: true },
      })
      const previousCertified = previous._sum.netDue || 0
      const retentionAmount = grossToDate * retentionPct / 100
      Object.assign(data, {
        grossToDate,
        retentionPct,
        retentionAmount,
        previousCertified,
        netDue: Math.max(0, grossToDate - retentionAmount - previousCertified),
      })
    }

    const valuation = await prisma.valuation.update({
      where: { id },
      data,
      include: { project: { select: { id: true, name: true, clientName: true, budget: true, progress: true } } },
    })

    if (body.status && body.status !== existing.status) {
      prisma.activity.create({
        data: {
          projectId: valuation.projectId,
          actorName: actorName(org.session),
          actorType: 'human',
          action: 'marked VAL-' + String(valuation.applicationNumber).padStart(3, '0') + ' ' + valuation.status,
          iconType: 'receipt',
        },
      }).catch(() => {})
    }

    return NextResponse.json(valuation)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update valuation' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const org = await requireOrg()
  if (org instanceof NextResponse) return org
  if (!org.role || !canManage(org.role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', org.userId)
  if (limited) return limited

  try {
    const { id } = await params
    const existing = await prisma.valuation.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Valuation not found' }, { status: 404 })
    if (existing.status !== 'draft' && existing.status !== 'rejected') {
      return NextResponse.json({ error: 'Submitted/certified valuations are retained for audit' }, { status: 409 })
    }
    await prisma.valuation.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete valuation' }, { status: 500 })
  }
}
