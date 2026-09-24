const test = require('node:test')
const assert = require('node:assert/strict')
const { receiptPosting, subInvoicePosting, costControlSummary } = require('../lib/cost-ledger')

test('receipt posting uses net/VAT/gross without double-counting VAT', () => {
  assert.deepEqual(receiptPosting({ subtotal: 100, vatAmount: 20, totalAmount: 120 }), { netAmount: 100, vatAmount: 20, grossAmount: 120 })
  assert.deepEqual(receiptPosting({ vatAmount: 10, totalAmount: 60 }), { netAmount: 50, vatAmount: 10, grossAmount: 60 })
})

test('subcontract invoice posting recognises net construction cost', () => {
  assert.deepEqual(subInvoicePosting({ netAmount: 1000, vatAmount: 200, grossAmount: 1200, payableAmount: 1000 }), { netAmount: 1000, vatAmount: 200, grossAmount: 1200 })
})

test('cost summary reduces PO commitment by approved invoices matched to that PO', () => {
  const summary = costControlSummary({
    entries: [{ status: 'posted', netAmount: 400, vatAmount: 80, grossAmount: 480, costCodeId: 'mat', costCode: { code: 'MAT', name: 'Materials' } }],
    purchaseOrders: [{ id: 'po1', status: 'sent', subtotal: 1000, costCodeId: 'mat', costCode: { code: 'MAT', name: 'Materials' } }],
    subInvoices: [{ status: 'approved', purchaseOrderId: 'po1', netAmount: 300 }],
  })
  assert.equal(summary.actualNet, 400)
  assert.equal(summary.committedNet, 1000)
  assert.equal(summary.openCommitments, 700)
  assert.equal(summary.forecastNet, 1100)
  assert.deepEqual(summary.breakdown[0], { costCodeId: 'mat', code: 'MAT', name: 'Materials', actualNet: 400, openCommitments: 700, forecastNet: 1100 })
})

test('draft/cancelled POs and disputed invoices do not inflate commitments', () => {
  const summary = costControlSummary({
    purchaseOrders: [{ id: 'a', status: 'draft', subtotal: 100 }, { id: 'b', status: 'cancelled', subtotal: 200 }, { id: 'c', status: 'received', subtotal: 500 }],
    subInvoices: [{ status: 'disputed', purchaseOrderId: 'c', netAmount: 400 }],
  })
  assert.equal(summary.committedNet, 500)
  assert.equal(summary.openCommitments, 500)
})

test('uncoded actual cost is visible and coding percentage is explicit', () => {
  const summary = costControlSummary({ entries: [
    { status: 'posted', netAmount: 75, costCodeId: null },
    { status: 'posted', netAmount: 25, costCodeId: 'lab', costCode: { code: 'LAB', name: 'Labour' } },
    { status: 'void', netAmount: 999, costCodeId: null },
  ] })
  assert.equal(summary.actualNet, 100)
  assert.equal(summary.uncodedNet, 75)
  assert.equal(summary.codedPct, 25)
})
