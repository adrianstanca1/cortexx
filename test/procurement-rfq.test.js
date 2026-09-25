const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizeProcurementItems, quoteTotals, canTransitionRequisition, compareSupplierQuotes } = require('../lib/procurement-rfq')

test('requisition items normalize quantities and estimated values', () => {
  const rows = normalizeProcurementItems([{ description: 'Insulation', quantity: 20, unit: 'm²', unitPrice: 12.345 }])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].unitPrice, 12.35)
  assert.equal(rows[0].total, 246.9)
})

test('supplier quote totals are VAT-aware and price-required', () => {
  const rows = normalizeProcurementItems([{ description: 'Boards', quantity: 10, unitPrice: 15 }], { requirePrice: true })
  assert.deepEqual(quoteTotals(rows, 20), { netAmount: 150, vatRate: 20, vatAmount: 30, totalAmount: 180 })
  assert.equal(normalizeProcurementItems([{ description: 'Boards', quantity: 10, unitPrice: 0 }], { requirePrice: true }).length, 0)
})

test('requisition approval and conversion are manager-gated', () => {
  assert.equal(canTransitionRequisition('draft', 'submitted', false), true)
  assert.equal(canTransitionRequisition('submitted', 'approved', false), false)
  assert.equal(canTransitionRequisition('submitted', 'approved', true), true)
  assert.equal(canTransitionRequisition('approved', 'rfq_open', true), true)
  assert.equal(canTransitionRequisition('rfq_open', 'converted', false), false)
})

test('quote comparison reports price variance and fastest lead without auto-awarding', () => {
  const rows = compareSupplierQuotes([
    { id: 'a', supplierId: 's1', supplier: { name: 'A' }, netAmount: 1000, totalAmount: 1200, leadDays: 7, status: 'received' },
    { id: 'b', supplierId: 's2', supplier: { name: 'B' }, netAmount: 1100, totalAmount: 1320, leadDays: 3, status: 'received' },
  ])
  assert.equal(rows[0].varianceFromLowest, 0)
  assert.equal(rows[1].varianceFromLowest, 100)
  assert.equal(rows[1].pctAboveLowest, 10)
  assert.equal(rows[1].fastestLead, true)
  assert.equal(rows.some(row => row.awarded === true), false)
})

test('supplier pricing is aligned to approved requisition quantities', () => {
  const { alignQuoteItems } = require('../lib/procurement-rfq')
  const rows = alignQuoteItems(
    [{ description: 'Boards', quantity: 10, unit: 'item' }],
    [{ unitPrice: 15.5 }],
  )
  assert.deepEqual(rows[0], { description: 'Boards', quantity: 10, unit: 'item', unitPrice: 15.5, total: 155 })
  assert.throws(() => alignQuoteItems([{ description: 'Boards', quantity: 10 }], []), /QUOTE_LINES_MISMATCH/)
})

test('unchanged status is never an approval transition', () => {
  for (const status of ['draft', 'submitted', 'approved', 'rejected', 'rfq_open', 'converted', 'cancelled']) {
    assert.equal(canTransitionRequisition(status, status, false), false)
    assert.equal(canTransitionRequisition(status, status, true), false)
  }
})

test('unknown delivery times do not outrank actual supplier lead times', () => {
  const rows = compareSupplierQuotes([
    { id: 'unknown', leadDays: null, netAmount: 100 },
    { id: 'known', leadDays: 4, netAmount: 110 },
    { id: 'same-day', leadDays: 0, netAmount: 120 },
  ])
  assert.equal(rows[0].leadDays, null)
  assert.equal(rows[0].fastestLead, false)
  assert.equal(rows[2].fastestLead, true)
})
