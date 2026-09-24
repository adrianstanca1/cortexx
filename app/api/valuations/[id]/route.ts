import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { canManage } from '@/lib/rbac'
import { auditLog, requestMeta } from '@/lib/audit'
import commercialLedger from '@/lib/commercial-ledger'

export const dynamic = 'force-dynamic'

const { calculateCertificate, certificateNumber, paymentSummary } = commercialLedger
const STATUSES = new Set(['draft', 'submitted', 'certified', 'paid', 'rejected'])
const TRANSITIONS: Record<string, Set<string>> = {
  draft: new Set(['submitted', 'rejected']),
  submitted: new Set(['draft', 'certified', 'rejected']),
  certified: new Set(['paid']),
  paid: new Set(),
  rejected: new Set(['draft']),
}
const DETAIL_INCLUDE = {
  project: { select: { id: true, name: true, clientName: true, budget: true, progress: true } },
  certificates: { orderBy: { revision: 'desc' as const }, include: { payments: { orderBy: { paidAt: 'desc' as const } } } },
  variationLinks: { include: { variation: { select: { id: true, number: true, title: true, costImpact: true, status: true } } } },
}

function financialAdminGuard(role: string | null) {
  return !role || !canManage(role)
    ? NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
    : null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  try {
    const { id } = await params
    const valuation = await prisma.valuation.findUnique({ where: { id }, include: DETAIL_INCLUDE })
    if (!valuation) return NextResponse.json({ error: 'Valuation not found' }, { status: 404 })
    return NextResponse.json({ valuation })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch valuation' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  const forbidden = financialAdminGuard(auth.role)
  if (forbidden) return forbidden
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited

  try {
    const { id } = await params
    const existing = await prisma.valuation.findUnique({ where: { id }, include: { certificates: { include: { payments: true } } } })
    if (!existing) return NextResponse.json({ error: 'Valuation not found' }, { status: 404 })

    const body = await req.json()
    const requested = body.status === undefined ? existing.status : String(body.status)
    if (!STATUSES.has(requested)) return NextResponse.json({ error: 'Invalid valuation status' }, { status: 400 })
    if (requested !== existing.status && !TRANSITIONS[existing.status]?.has(requested)) {
      return NextResponse.json({ error: 'Invalid status transition: ' + existing.status + ' → ' + requested }, { status: 409 })
    }

    if (requested === 'paid' && existing.status === 'certified') {
      const currentCertificate = [...existing.certificates].sort((a, b) => b.revision - a.revision).find(c => c.status === 'issued')
      if (!currentCertificate) return NextResponse.json({ error: 'Issue a certificate before recording payment' }, { status: 409 })
      const summary = paymentSummary(currentCertificate.amountCertified, currentCertificate.payments)
      let paidAt = new Date()
      if (body.paidAt) {
        paidAt = new Date(body.paidAt)
        if (Number.isNaN(paidAt.getTime())) return NextResponse.json({ error: 'Invalid payment date' }, { status: 400 })
      }
      if (summary.outstanding > 0) {
        await prisma.$transaction(async tx => {
          await tx.valuationPayment.create({ data: {
            certificateId: currentCertificate.id,
            amount: summary.outstanding,
            paidAt,
            reference: body.paymentReference?.toString().trim() || null,
            method: body.paymentMethod?.toString().trim() || null,
            notes: body.paymentNotes?.toString().trim() || null,
          } })
          await tx.valuation.update({ where: { id }, data: { status: 'paid', paidAt } })
        })
      } else {
        await prisma.valuation.update({ where: { id }, data: { status: 'paid', paidAt: existing.paidAt || new Date() } })
      }
    } else if (requested === 'certified' && existing.status === 'submitted') {
      const certifiedGrossToDate = body.certifiedGrossToDate === undefined ? existing.grossToDate : Number(body.certifiedGrossToDate)
      const retentionPct = body.retentionPct === undefined ? existing.retentionPct : Number(body.retentionPct)
      const retentionRelease = body.retentionRelease === undefined ? 0 : Number(body.retentionRelease)
      let dueDate: Date | null = null
      if (body.dueDate) {
        dueDate = new Date(body.dueDate)
        if (Number.isNaN(dueDate.getTime())) return NextResponse.json({ error: 'Invalid certificate due date' }, { status: 400 })
      }
      const previous = await prisma.valuationCertificate.aggregate({
        where: { valuation: { projectId: existing.projectId, id: { not: id } }, status: 'issued' },
        _sum: { amountCertified: true },
      })
      let amounts
      try {
        amounts = calculateCertificate({ grossToDate: certifiedGrossToDate, retentionPct, previousCertified: previous._sum.amountCertified || 0, retentionRelease })
      } catch {
        return NextResponse.json({ error: 'Invalid certificate values' }, { status: 400 })
      }
      const issuedAt = new Date()
      if (!dueDate) dueDate = new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
      await prisma.$transaction(async tx => {
        await tx.valuationCertificate.create({ data: {
          valuationId: id,
          revision: 1,
          certificateNumber: certificateNumber(existing.applicationNumber, 1),
          certifiedGrossToDate: amounts.grossToDate,
          retentionPct: amounts.retentionPct,
          retentionAmount: amounts.retentionAmount,
          previousCertified: amounts.previousCertified,
          retentionRelease: amounts.retentionRelease,
          amountCertified: amounts.amountCertified,
          dueDate,
          issuedAt,
          notes: body.certificateNotes?.toString().trim() || null,
        } })
        await tx.valuation.update({ where: { id }, data: {
          status: 'certified', certifiedAt: issuedAt, submittedAt: existing.submittedAt || issuedAt,
          previousCertified: amounts.previousCertified,
        } })
      })
    } else {
      const data: Record<string, unknown> = {}
      if (requested !== existing.status) {
        data.status = requested
        if (requested === 'submitted') data.submittedAt = existing.submittedAt || new Date()
        if (requested === 'draft') data.submittedAt = null
      }
      if (body.notes !== undefined) data.notes = body.notes?.toString().trim() || null
      if (existing.status === 'draft' && (body.grossToDate !== undefined || body.retentionPct !== undefined)) {
        const grossToDate = body.grossToDate === undefined ? existing.grossToDate : Number(body.grossToDate)
        const retentionPct = body.retentionPct === undefined ? existing.retentionPct : Number(body.retentionPct)
        if (!Number.isFinite(grossToDate) || grossToDate < 0) return NextResponse.json({ error: 'Gross value must be non-negative' }, { status: 400 })
        if (!Number.isFinite(retentionPct) || retentionPct < 0 || retentionPct > 20) return NextResponse.json({ error: 'Retention must be between 0 and 20%' }, { status: 400 })
        const previous = await prisma.valuationCertificate.aggregate({
          where: { valuation: { projectId: existing.projectId, id: { not: id } }, status: 'issued' },
          _sum: { amountCertified: true },
        })
        const previousCertified = previous._sum.amountCertified || 0
        const retentionAmount = Math.round(grossToDate * retentionPct) / 100
        Object.assign(data, { grossToDate, retentionPct, retentionAmount, previousCertified, netDue: Math.max(0, grossToDate - retentionAmount - previousCertified) })
      }
      if (Object.keys(data).length) await prisma.valuation.update({ where: { id }, data })
    }

    const valuation = await prisma.valuation.findUnique({ where: { id }, include: DETAIL_INCLUDE })
    if (!valuation) return NextResponse.json({ error: 'Valuation not found after update' }, { status: 404 })

    if (requested !== existing.status) {
      prisma.activity.create({ data: {
        projectId: valuation.projectId,
        actorName: actorName(auth.session),
        actorType: 'human',
        action: 'marked VAL-' + String(valuation.applicationNumber).padStart(3, '0') + ' ' + valuation.status,
        iconType: 'receipt',
      } }).catch(() => {})
      auditLog({ action: `valuation.${valuation.status}`, resourceType: 'Valuation', resourceId: id, ...requestMeta(req) })
    }
    return NextResponse.json(valuation)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update valuation' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  const forbidden = financialAdminGuard(auth.role)
  if (forbidden) return forbidden
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  try {
    const { id } = await params
    const existing = await prisma.valuation.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Valuation not found' }, { status: 404 })
    if (existing.status !== 'draft' && existing.status !== 'rejected') {
      return NextResponse.json({ error: 'Submitted/certified valuations are retained for audit' }, { status: 409 })
    }
    await prisma.valuation.delete({ where: { id } })
    auditLog({ action: 'valuation.delete', resourceType: 'Valuation', resourceId: id, ...requestMeta(req) })
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete valuation' }, { status: 500 })
  }
}
