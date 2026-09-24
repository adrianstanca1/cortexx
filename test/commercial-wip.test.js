const test = require('node:test')
const assert = require('node:assert/strict')
const { commercialSummary } = require('../lib/commercial-wip')

test('commercial summary separates revenue, certification and costs', () => {
  const s = commercialSummary({
    project: { budget: 100000, spent: 30000, progress: 60 },
    variations: [{ status: 'approved', costImpact: 10000 }, { status: 'submitted', costImpact: 5000 }],
    valuations: [{ applicationNumber: 2, grossToDate: 60000 }, { applicationNumber: 1, grossToDate: 30000 }],
    certificates: [{ status: 'issued', amountCertified: 25000, retentionAmount: 1800, retentionRelease: 0, issuedAt: '2026-01-01' }, { status: 'issued', amountCertified: 30000, retentionAmount: 3300, retentionRelease: 500, issuedAt: '2026-02-01' }],
    payments: [{ amount: 20000 }, { amount: 25000 }],
    invoices: [{ status: 'sent', amount: 10000 }, { status: 'paid', amount: 20000 }, { status: 'draft', amount: 5000 }],
    purchaseOrders: [{ status: 'sent', subtotal: 40000 }, { status: 'draft', subtotal: 9999 }],
    subInvoices: [{ status: 'approved', payableAmount: 8000 }, { status: 'paid', payableAmount: 5000 }],
  })
  assert.equal(s.originalContractValue, 100000)
  assert.equal(s.approvedVariations, 10000)
  assert.equal(s.adjustedContractValue, 110000)
  assert.equal(s.certifiedToDate, 55000)
  assert.equal(s.valuationCashReceived, 45000)
  assert.equal(s.clientInvoicesPaid, 20000)
  assert.equal(s.recordedCost, 30000)
  assert.equal(s.forecastCost, 48000)
  assert.equal(s.earnedValue, 66000)
  assert.equal(s.uncertifiedValue, 11000)
  assert.equal(s.forecastMargin, 62000)
})

test('draft/cancelled commitments and draft invoices are excluded', () => {
  const s = commercialSummary({ project: { budget: 50000, spent: 1000, progress: 10 }, purchaseOrders: [{ status: 'cancelled', subtotal: 3000 }], invoices: [{ status: 'draft', amount: 4000 }] })
  assert.equal(s.committedPOs, 0)
  assert.equal(s.clientInvoicesIssued, 0)
})

test('negative uncertified value identifies over-certification without hiding it', () => {
  const s = commercialSummary({ project: { budget: 100000, progress: 20 }, certificates: [{ status: 'issued', amountCertified: 25000, issuedAt: '2026-01-01' }] })
  assert.equal(s.earnedValue, 20000)
  assert.equal(s.uncertifiedValue, -5000)
})
