import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { reportError } from '@/lib/errors'
import bankMath from '@/lib/bank-reconciliation'

export const dynamic = 'force-dynamic'
const { outstanding, directionForAmount } = bankMath

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.role || !canManage(auth.role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  try {
    const { id } = await params
    const bank = await prisma.bankTransaction.findUnique({ where: { id }, include: { allocations: true } })
    if (!bank) return NextResponse.json({ error: 'Bank transaction not found' }, { status: 404 })
    const direction = directionForAmount(bank.amount)
    if (direction === 'zero') return NextResponse.json({ direction, candidates: [] })

    if (direction === 'credit') {
      const [invoices, certificates, allocations] = await Promise.all([
        prisma.invoice.findMany({ where: { status: { in: ['sent', 'overdue', 'paid'] } }, include: { project: { select: { id: true, name: true } } }, orderBy: { dueDate: 'asc' }, take: 250 }),
        prisma.valuationCertificate.findMany({ where: { status: 'issued' }, include: { valuation: { include: { project: { select: { id: true, name: true } } } } }, orderBy: { issuedAt: 'desc' }, take: 250 }),
        prisma.bankAllocation.findMany({ where: { targetType: { in: ['client_invoice', 'valuation_certificate'] } }, select: { targetType: true, targetId: true, amount: true } }),
      ])
      const byTarget = new Map<string, Array<{ amount: number }>>()
      for (const a of allocations) {
        const key = `${a.targetType}:${a.targetId}`
        const rows = byTarget.get(key) || []; rows.push({ amount: a.amount }); byTarget.set(key, rows)
      }
      const candidates = [
        ...invoices.map(i => ({ targetType: 'client_invoice', targetId: i.id, label: `${i.number} · ${i.clientName}`, project: i.project?.name || null, amount: i.amount, outstanding: outstanding(i.amount, byTarget.get(`client_invoice:${i.id}`) || []), dueDate: i.dueDate, status: i.status })),
        ...certificates.map(c => ({ targetType: 'valuation_certificate', targetId: c.id, label: c.certificateNumber, project: c.valuation.project?.name || null, amount: c.amountCertified, outstanding: outstanding(c.amountCertified, byTarget.get(`valuation_certificate:${c.id}`) || []), dueDate: c.dueDate, status: c.status })),
      ].filter(c => c.outstanding > 0.009)
      return NextResponse.json({ direction, candidates })
    }

    const [invoices, allocations] = await Promise.all([
      prisma.subInvoice.findMany({ where: { status: { in: ['approved', 'paid'] } }, include: { subcontractor: { select: { name: true } }, project: { select: { id: true, name: true } }, purchaseOrder: { select: { number: true } }, costCode: { select: { code: true } } }, orderBy: { invoiceDate: 'desc' }, take: 250 }),
      prisma.bankAllocation.findMany({ where: { targetType: 'sub_invoice' }, select: { targetId: true, amount: true } }),
    ])
    const byTarget = new Map<string, Array<{ amount: number }>>()
    for (const a of allocations) { const rows = byTarget.get(a.targetId) || []; rows.push({ amount: a.amount }); byTarget.set(a.targetId, rows) }
    const candidates = invoices.map(i => ({
      targetType: 'sub_invoice', targetId: i.id, label: `${i.number} · ${i.subcontractor.name}`, project: i.project?.name || null,
      amount: i.payableAmount, outstanding: outstanding(i.payableAmount, byTarget.get(i.id) || []), dueDate: i.invoiceDate, status: i.status,
      purchaseOrder: i.purchaseOrder?.number || null, costCode: i.costCode?.code || null,
    })).filter(c => c.outstanding > 0.009)
    return NextResponse.json({ direction, candidates })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to load reconciliation candidates' }, { status: 500 })
  }
}
