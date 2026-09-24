import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { reportError } from '@/lib/errors'
import commercialWip from '@/lib/commercial-wip'
import costLedger from '@/lib/cost-ledger'

export const dynamic = 'force-dynamic'
const { commercialSummary } = commercialWip
const { costControlSummary } = costLedger

function csvCell(value: string | number) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  try {
    const { id } = await params
    const [project, variations, valuations, certificates, payments, invoices, purchaseOrders, subInvoices, costEntries] = await Promise.all([
      prisma.project.findUnique({ where: { id }, select: { id: true, name: true, budget: true, spent: true, progress: true } }),
      prisma.variation.findMany({ where: { projectId: id }, select: { status: true, costImpact: true } }),
      prisma.valuation.findMany({ where: { projectId: id }, select: { applicationNumber: true, grossToDate: true } }),
      prisma.valuationCertificate.findMany({ where: { valuation: { projectId: id } }, select: { status: true, amountCertified: true, retentionAmount: true, retentionRelease: true, issuedAt: true } }),
      prisma.valuationPayment.findMany({ where: { certificate: { valuation: { projectId: id } } }, select: { amount: true } }),
      prisma.invoice.findMany({ where: { projectId: id }, select: { status: true, amount: true } }),
      prisma.purchaseOrder.findMany({ where: { projectId: id }, include: { costCode: { select: { id: true, code: true, name: true } } } }),
      prisma.subInvoice.findMany({ where: { projectId: id }, select: { status: true, payableAmount: true, netAmount: true, purchaseOrderId: true } }),
      prisma.projectCostEntry.findMany({ where: { projectId: id }, include: { costCode: { select: { id: true, code: true, name: true } } } }),
    ])
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    const costControl = costControlSummary({ entries: costEntries, purchaseOrders, subInvoices })
    const summary = commercialSummary({ project, variations, valuations, certificates, payments, invoices, purchaseOrders, subInvoices, costControl }) as Record<string, number>
    const labels: Record<string, string> = {
      originalContractValue: 'Original contract value', approvedVariations: 'Approved variations', adjustedContractValue: 'Adjusted contract value',
      appliedToDate: 'Applied to date', certifiedToDate: 'Certified to date', retentionHeld: 'Retention held', valuationCashReceived: 'Valuation cash received',
      clientInvoicesIssued: 'Client invoices issued', clientInvoicesPaid: 'Client invoices paid', committedPOs: 'PO commitments', approvedSubcontract: 'Approved subcontract liabilities',
      paidSubcontract: 'Paid subcontract', recordedCost: 'Recorded cost', openCommitments: 'Open commitments', forecastCost: 'Forecast cost', earnedValue: 'Earned value',
      uncertifiedValue: 'Uncertified value', forecastMargin: 'Forecast margin', forecastMarginPct: 'Forecast margin %', cashPosition: 'Valuation cash less recorded cost',
    }
    const rows = [['Project', project.name], ['Generated', new Date().toISOString()], ['Metric', 'Value']]
    for (const [key, label] of Object.entries(labels)) rows.push([label, String(summary[key] ?? 0)])
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
    const safe = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'project'
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${safe}-commercial-summary.csv"`, 'Cache-Control': 'no-store' } })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to export commercial summary' }, { status: 500 })
  }
}
