'use strict'

const assert = require('node:assert/strict')
const { suite, getPrismaAndTenancy, truncate, seedTwoOrgs } = require('./setup')

suite('bank reconciliation ledger', async t => {
  const { prisma, tenancy } = getPrismaAndTenancy()
  const { syncBankStatus, syncTargetPaymentState } = await import('../../lib/bank-reconciliation-server.ts')
  await truncate(prisma)
  const { orgA, orgB, userA } = await seedTwoOrgs(prisma)
  const ctx = { organizationId: orgA.id, userId: userA.id, role: 'owner' }

  const project = await tenancy.runWithOrg(ctx, () => prisma.project.create({ data: { name: 'Bank Test', address: '1 Ledger Way', postcode: 'E1 1AA', budget: 10000 } }))

  await t.test('credit allocation settles and reversal reopens a client invoice', async () => {
    const { bank, invoice } = await tenancy.runWithOrg(ctx, async () => {
      const invoice = await prisma.invoice.create({ data: { number: 'BANK-C-1', projectId: project.id, clientName: 'Client', amount: 1000, status: 'sent', dueDate: new Date('2099-01-01') } })
      const bank = await prisma.bankTransaction.create({ data: { source: 'manual', occurredAt: new Date('2026-09-24'), amount: 1000, description: 'Client payment' } })
      return { bank, invoice }
    })

    const allocation = await tenancy.runWithOrg(ctx, () => prisma.$transaction(async tx => {
      const allocation = await tx.bankAllocation.create({ data: { bankTransactionId: bank.id, targetType: 'client_invoice', targetId: invoice.id, amount: 1000 } })
      await syncTargetPaymentState(tx, orgA.id, 'client_invoice', invoice.id)
      await syncBankStatus(tx, bank.id, orgA.id)
      return allocation
    }))
    let state = await tenancy.runWithOrg(ctx, () => Promise.all([prisma.invoice.findUnique({ where: { id: invoice.id } }), prisma.bankTransaction.findUnique({ where: { id: bank.id } })]))
    assert.equal(state[0].status, 'paid')
    assert.ok(state[0].bankReconciledAt)
    assert.equal(state[1].status, 'reconciled')

    await tenancy.runWithOrg(ctx, () => prisma.$transaction(async tx => {
      await tx.bankAllocation.delete({ where: { id: allocation.id } })
      await syncTargetPaymentState(tx, orgA.id, 'client_invoice', invoice.id)
      await syncBankStatus(tx, bank.id, orgA.id)
    }))
    state = await tenancy.runWithOrg(ctx, () => Promise.all([prisma.invoice.findUnique({ where: { id: invoice.id } }), prisma.bankTransaction.findUnique({ where: { id: bank.id } })]))
    assert.equal(state[0].status, 'sent')
    assert.equal(state[0].bankReconciledAt, null)
    assert.equal(state[1].status, 'unmatched')
  })

  await t.test('debit allocation pays approved subcontract invoice and preserves net project cost', async () => {
    const sub = await tenancy.runWithOrg(ctx, () => prisma.subcontractor.create({ data: { name: 'Sub Ltd', cisStatus: 'gross' } }))
    const invoice = await tenancy.runWithOrg(ctx, () => prisma.subInvoice.create({ data: {
      number: 'SUB-BANK-1', subcontractorId: sub.id, projectId: project.id, invoiceDate: new Date('2026-09-20'),
      netAmount: 700, vatAmount: 140, cisAmount: 0, grossAmount: 840, payableAmount: 840, status: 'approved',
    } }))
    const bank = await tenancy.runWithOrg(ctx, () => prisma.bankTransaction.create({ data: { source: 'manual', occurredAt: new Date('2026-09-24'), amount: -840, description: 'Sub payment' } }))
    await tenancy.runWithOrg(ctx, () => prisma.$transaction(async tx => {
      await tx.bankAllocation.create({ data: { bankTransactionId: bank.id, targetType: 'sub_invoice', targetId: invoice.id, amount: 840 } })
      await syncTargetPaymentState(tx, orgA.id, 'sub_invoice', invoice.id)
      await syncBankStatus(tx, bank.id, orgA.id)
    }))
    const [updated, p] = await tenancy.runWithOrg(ctx, () => Promise.all([prisma.subInvoice.findUnique({ where: { id: invoice.id } }), prisma.project.findUnique({ where: { id: project.id } })]))
    assert.equal(updated.status, 'paid')
    assert.ok(updated.bankReconciledAt)
    assert.equal(p.spent, 700, 'bank cash movement must not double-count VAT or cost; approved net cost remains £700')
  })

  await t.test('certificate bank allocation can back a real valuation payment and paid lifecycle', async () => {
    const valuation = await tenancy.runWithOrg(ctx, () => prisma.valuation.create({ data: { projectId: project.id, applicationNumber: 1, grossToDate: 500, retentionPct: 0, retentionAmount: 0, previousCertified: 0, netDue: 500, status: 'certified' } }))
    const certificate = await tenancy.runWithOrg(ctx, () => prisma.valuationCertificate.create({ data: {
      valuationId: valuation.id, revision: 1, certificateNumber: 'CERT-BANK-1', certifiedGrossToDate: 500, retentionPct: 0,
      retentionAmount: 0, previousCertified: 0, retentionRelease: 0, amountCertified: 500, status: 'issued',
    } }))
    const bank = await tenancy.runWithOrg(ctx, () => prisma.bankTransaction.create({ data: { source: 'manual', occurredAt: new Date('2026-09-24'), amount: 500, description: 'Valuation cash' } }))
    await tenancy.runWithOrg(ctx, () => prisma.$transaction(async tx => {
      const allocation = await tx.bankAllocation.create({ data: { bankTransactionId: bank.id, targetType: 'valuation_certificate', targetId: certificate.id, amount: 500 } })
      await tx.valuationPayment.create({ data: { certificateId: certificate.id, amount: 500, paidAt: new Date('2026-09-24'), method: 'bank', bankAllocationId: allocation.id } })
      await syncTargetPaymentState(tx, orgA.id, 'valuation_certificate', certificate.id)
      await syncBankStatus(tx, bank.id, orgA.id)
    }))
    const [updated, payment] = await tenancy.runWithOrg(ctx, () => Promise.all([prisma.valuation.findUnique({ where: { id: valuation.id } }), prisma.valuationPayment.findFirst({ where: { certificateId: certificate.id } })]))
    assert.equal(updated.status, 'paid')
    assert.ok(payment.bankAllocationId)
  })

  await t.test('tenant extension hides bank allocations from another organisation', async () => {
    const count = await tenancy.runWithOrg({ organizationId: orgB.id, userId: null, role: 'owner' }, () => prisma.bankAllocation.count())
    assert.equal(count, 0)
  })
})
