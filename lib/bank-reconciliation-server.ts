import bankMath from '@/lib/bank-reconciliation'
import { postSourceCost } from '@/lib/cost-ledger-server'

const { allocationSummary, money } = bankMath
// The app wraps Prisma with tenancy/broadcast extensions, so transaction callbacks
// expose the extended client shape rather than raw Prisma.TransactionClient.
// Keep this helper structural to work with both runtime clients and test doubles.
export type BankTx = any
export type BankTargetType = 'client_invoice' | 'valuation_certificate' | 'sub_invoice'

export async function syncBankStatus(tx: BankTx, bankTransactionId: string, organizationId: string) {
  const bank = await tx.bankTransaction.findFirst({
    where: { id: bankTransactionId, organizationId },
    include: { allocations: { select: { amount: true } } },
  })
  if (!bank) throw new Error('BANK_NOT_FOUND')
  const summary = allocationSummary(bank.amount, bank.allocations)
  const updated = await tx.bankTransaction.update({
    where: { id: bank.id },
    data: { status: summary.status, reconciled: summary.status === 'reconciled' },
  })
  return { bank: updated, summary }
}

export async function targetAllocated(tx: BankTx, organizationId: string, targetType: BankTargetType, targetId: string) {
  const result = await tx.bankAllocation.aggregate({ where: { organizationId, targetType, targetId }, _sum: { amount: true } })
  return money(result._sum.amount || 0)
}

export async function getTarget(tx: BankTx, organizationId: string, targetType: BankTargetType, targetId: string) {
  if (targetType === 'client_invoice') {
    const invoice = await tx.invoice.findFirst({ where: { id: targetId, organizationId }, include: { project: { select: { id: true, name: true } } } })
    if (!invoice) throw new Error('TARGET_NOT_FOUND')
    return { amount: money(invoice.amount), label: `${invoice.number} · ${invoice.clientName}`, status: invoice.status, projectId: invoice.projectId, record: invoice }
  }
  if (targetType === 'sub_invoice') {
    const invoice = await tx.subInvoice.findFirst({ where: { id: targetId, organizationId }, include: { subcontractor: { select: { name: true } }, purchaseOrder: { select: { costCodeId: true } } } })
    if (!invoice) throw new Error('TARGET_NOT_FOUND')
    if (!['approved', 'paid'].includes(invoice.status)) throw new Error('SUB_INVOICE_NOT_APPROVED')
    return { amount: money(invoice.payableAmount), label: `${invoice.number} · ${invoice.subcontractor.name}`, status: invoice.status, projectId: invoice.projectId, record: invoice }
  }
  const certificate = await tx.valuationCertificate.findFirst({
    where: { id: targetId, organizationId, status: 'issued' },
    include: { valuation: { select: { id: true, projectId: true, applicationNumber: true, status: true } } },
  })
  if (!certificate) throw new Error('TARGET_NOT_FOUND')
  return { amount: money(certificate.amountCertified), label: certificate.certificateNumber, status: certificate.status, projectId: certificate.valuation.projectId, record: certificate }
}

export async function syncTargetPaymentState(tx: BankTx, organizationId: string, targetType: BankTargetType, targetId: string) {
  const target = await getTarget(tx, organizationId, targetType, targetId)
  const allocated = await targetAllocated(tx, organizationId, targetType, targetId)
  const settled = allocated + 0.009 >= target.amount

  if (targetType === 'client_invoice') {
    const invoice = target.record as any
    if (settled && invoice.status !== 'paid') {
      await tx.invoice.update({ where: { id: targetId }, data: { status: 'paid', paidDate: new Date(), bankReconciledAt: new Date() } })
    } else if (!settled && invoice.bankReconciledAt) {
      const status = invoice.dueDate < new Date() ? 'overdue' : 'sent'
      await tx.invoice.update({ where: { id: targetId }, data: { status, paidDate: null, bankReconciledAt: null } })
    }
  } else if (targetType === 'sub_invoice') {
    const invoice = target.record as any
    if (invoice.projectId) {
      await postSourceCost(tx, {
        organizationId,
        projectId: invoice.projectId,
        sourceType: 'sub_invoice',
        sourceId: invoice.id,
        sourceReference: invoice.number,
        description: `Subcontract invoice ${invoice.number} · ${invoice.subcontractor.name}`,
        netAmount: money(invoice.netAmount),
        vatAmount: money(invoice.vatAmount),
        grossAmount: money(invoice.grossAmount),
        costCodeId: invoice.costCodeId || invoice.purchaseOrder?.costCodeId || null,
        occurredAt: invoice.invoiceDate,
        notes: invoice.notes,
      })
    }
    if (settled && invoice.status !== 'paid') {
      await tx.subInvoice.update({ where: { id: targetId }, data: { status: 'paid', paidAt: new Date(), bankReconciledAt: new Date() } })
    } else if (!settled && invoice.bankReconciledAt) {
      await tx.subInvoice.update({ where: { id: targetId }, data: { status: 'approved', paidAt: null, bankReconciledAt: null } })
    }
  } else {
    const certificate = target.record as any
    const payments = await tx.valuationPayment.aggregate({ where: { certificateId: certificate.id }, _sum: { amount: true } })
    const paid = money(payments._sum.amount || 0)
    if (paid + 0.009 >= certificate.amountCertified) {
      await tx.valuation.update({ where: { id: certificate.valuation.id }, data: { status: 'paid', paidAt: new Date() } })
    } else if (certificate.valuation.status === 'paid') {
      await tx.valuation.update({ where: { id: certificate.valuation.id }, data: { status: 'certified', paidAt: null } })
    }
  }
  return { target, allocated, settled }
}
