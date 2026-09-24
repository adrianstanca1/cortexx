import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { canManage } from '@/lib/rbac'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import commercialLedger from '@/lib/commercial-ledger'

export const dynamic = 'force-dynamic'
const { paymentSummary, roundMoney } = commercialLedger

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  try {
    const { id } = await params
    const payments = await prisma.valuationPayment.findMany({
      where: { certificate: { valuationId: id } },
      include: { certificate: { select: { id: true, certificateNumber: true, revision: true, amountCertified: true } } },
      orderBy: { paidAt: 'desc' },
    })
    return NextResponse.json({ payments })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch valuation payments' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  const role = auth.role
  if (!role || !canManage(role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited

  try {
    const { id } = await params
    const valuation = await prisma.valuation.findUnique({
      where: { id },
      include: { certificates: { include: { payments: true }, orderBy: { revision: 'desc' } } },
    })
    if (!valuation) return NextResponse.json({ error: 'Valuation not found' }, { status: 404 })
    if (!['certified', 'paid'].includes(valuation.status)) return NextResponse.json({ error: 'Payments require an issued certificate' }, { status: 409 })
    const certificate = valuation.certificates.find(c => c.status === 'issued')
    if (!certificate) return NextResponse.json({ error: 'No issued certificate found' }, { status: 409 })
    const summary = paymentSummary(certificate.amountCertified, certificate.payments)
    if (summary.settled) return NextResponse.json({ error: 'Certificate is already fully paid' }, { status: 409 })

    const body = await req.json()
    let amount
    try { amount = roundMoney(Number(body.amount)) } catch { amount = NaN }
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Payment amount must be positive' }, { status: 400 })
    if (amount > summary.outstanding + 0.009) return NextResponse.json({ error: `Payment exceeds outstanding balance of £${summary.outstanding.toFixed(2)}` }, { status: 400 })
    let paidAt = new Date()
    if (body.paidAt) {
      paidAt = new Date(body.paidAt)
      if (Number.isNaN(paidAt.getTime())) return NextResponse.json({ error: 'Invalid payment date' }, { status: 400 })
    }

    const after = paymentSummary(certificate.amountCertified, [...certificate.payments, { amount }])
    const payment = await prisma.$transaction(async tx => {
      const created = await tx.valuationPayment.create({ data: {
        certificateId: certificate.id, amount, paidAt,
        reference: body.reference?.toString().trim() || null,
        method: body.method?.toString().trim() || null,
        notes: body.notes?.toString().trim() || null,
      } })
      if (after.settled) await tx.valuation.update({ where: { id }, data: { status: 'paid', paidAt } })
      else if (valuation.status === 'paid') await tx.valuation.update({ where: { id }, data: { status: 'certified', paidAt: null } })
      return created
    })

    prisma.activity.create({ data: {
      projectId: valuation.projectId,
      actorName: actorName(auth.session), actorType: 'human',
      action: `recorded payment against ${certificate.certificateNumber}`,
      detail: `£${amount.toFixed(2)} · outstanding £${after.outstanding.toFixed(2)}`, iconType: 'receipt',
    } }).catch(() => {})
    auditLog({ action: 'valuation.payment.create', resourceType: 'ValuationPayment', resourceId: payment.id, ...requestMeta(req) })
    return NextResponse.json({ payment, summary: after }, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })
  }
}
