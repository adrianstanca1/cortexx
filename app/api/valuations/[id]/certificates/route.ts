import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { canManage } from '@/lib/rbac'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import commercialLedger from '@/lib/commercial-ledger'

export const dynamic = 'force-dynamic'
const { calculateCertificate, certificateNumber } = commercialLedger

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  try {
    const { id } = await params
    const certificates = await prisma.valuationCertificate.findMany({
      where: { valuationId: id },
      include: { payments: { orderBy: { paidAt: 'desc' } } },
      orderBy: { revision: 'desc' },
    })
    return NextResponse.json({ certificates })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch certificates' }, { status: 500 })
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
    if (valuation.status !== 'certified') return NextResponse.json({ error: 'Only a certified unpaid valuation can be revised' }, { status: 409 })
    const current = valuation.certificates.find(c => c.status === 'issued')
    if (!current) return NextResponse.json({ error: 'No issued certificate to revise' }, { status: 409 })
    if (current.payments.some(p => p.amount > 0)) return NextResponse.json({ error: 'A certificate with payments cannot be revised; record an adjustment in the next application' }, { status: 409 })

    const body = await req.json()
    const grossToDate = body.certifiedGrossToDate === undefined ? current.certifiedGrossToDate : Number(body.certifiedGrossToDate)
    const retentionPct = body.retentionPct === undefined ? current.retentionPct : Number(body.retentionPct)
    const retentionRelease = body.retentionRelease === undefined ? current.retentionRelease : Number(body.retentionRelease)
    const previous = await prisma.valuationCertificate.aggregate({
      where: { valuation: { projectId: valuation.projectId, id: { not: id } }, status: 'issued' },
      _sum: { amountCertified: true },
    })
    let amounts
    try {
      amounts = calculateCertificate({ grossToDate, retentionPct, previousCertified: previous._sum.amountCertified || 0, retentionRelease })
    } catch {
      return NextResponse.json({ error: 'Invalid certificate values' }, { status: 400 })
    }
    let dueDate = current.dueDate
    if (body.dueDate) {
      dueDate = new Date(body.dueDate)
      if (Number.isNaN(dueDate.getTime())) return NextResponse.json({ error: 'Invalid certificate due date' }, { status: 400 })
    }
    const revision = current.revision + 1
    const issuedAt = new Date()
    const certificate = await prisma.$transaction(async tx => {
      await tx.valuationCertificate.update({ where: { id: current.id }, data: { status: 'superseded' } })
      const created = await tx.valuationCertificate.create({ data: {
        valuationId: id,
        revision,
        certificateNumber: certificateNumber(valuation.applicationNumber, revision),
        certifiedGrossToDate: amounts.grossToDate,
        retentionPct: amounts.retentionPct,
        retentionAmount: amounts.retentionAmount,
        previousCertified: amounts.previousCertified,
        retentionRelease: amounts.retentionRelease,
        amountCertified: amounts.amountCertified,
        dueDate,
        issuedAt,
        notes: body.notes?.toString().trim() || current.notes,
      } })
      await tx.valuation.update({ where: { id }, data: { certifiedAt: issuedAt, previousCertified: amounts.previousCertified } })
      return created
    })

    prisma.activity.create({ data: {
      projectId: valuation.projectId,
      actorName: actorName(auth.session), actorType: 'human',
      action: `issued ${certificate.certificateNumber} for VAL-${String(valuation.applicationNumber).padStart(3, '0')}`,
      detail: `Certified £${certificate.amountCertified.toFixed(2)}`, iconType: 'receipt',
    } }).catch(() => {})
    auditLog({ action: 'valuation.certificate.revise', resourceType: 'ValuationCertificate', resourceId: certificate.id, ...requestMeta(req) })
    return NextResponse.json(certificate, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to revise certificate' }, { status: 500 })
  }
}
