import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { reportError } from '@/lib/errors'
import commercialWip from '@/lib/commercial-wip'

export const dynamic = 'force-dynamic'
const { commercialSummary } = commercialWip

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  try {
    const { id } = await params
    const [project, variations, valuations, certificates, payments, invoices, purchaseOrders, subInvoices] = await Promise.all([
      prisma.project.findUnique({ where: { id }, select: { id: true, name: true, budget: true, spent: true, progress: true } }),
      prisma.variation.findMany({ where: { projectId: id }, select: { status: true, costImpact: true } }),
      prisma.valuation.findMany({ where: { projectId: id }, select: { applicationNumber: true, grossToDate: true } }),
      prisma.valuationCertificate.findMany({
        where: { valuation: { projectId: id } },
        select: { status: true, amountCertified: true, retentionAmount: true, retentionRelease: true, issuedAt: true },
      }),
      prisma.valuationPayment.findMany({ where: { certificate: { valuation: { projectId: id } } }, select: { amount: true } }),
      prisma.invoice.findMany({ where: { projectId: id }, select: { status: true, amount: true } }),
      prisma.purchaseOrder.findMany({ where: { projectId: id }, select: { status: true, subtotal: true } }),
      prisma.subInvoice.findMany({ where: { projectId: id }, select: { status: true, payableAmount: true } }),
    ])
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    const summary = commercialSummary({ project, variations, valuations, certificates, payments, invoices, purchaseOrders, subInvoices })
    return NextResponse.json({ project: { id: project.id, name: project.name }, summary })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to calculate commercial summary' }, { status: 500 })
  }
}
