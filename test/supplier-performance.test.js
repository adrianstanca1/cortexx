const test = require('node:test')
const assert = require('node:assert/strict')
const { supplierPerformance } = require('../lib/supplier-performance')
const base = { id: 'p1', number: 'PO-1', status: 'sent', subtotal: 100, expectedDelivery: '2026-09-24' }
const now = new Date('2026-09-25T12:00:00Z')

test('empty supplier history has unknown reliability, not a fabricated score', () => {
  const p = supplierPerformance([], now)
  assert.equal(p.onTimePercent, null)
  assert.equal(p.orderedNet, 0)
})
test('delivery metrics separate on-time, late, overdue and missing evidence', () => {
  const p = supplierPerformance([
    { ...base, status: 'received', receivedAt: '2026-09-24T23:00:00Z' },
    { ...base, status: 'received', receivedAt: '2026-09-25' },
    { ...base, status: 'part_received', goodsReceipts: [{ netReceived: 40, deliveredAt: '2026-09-23' }] },
    { ...base, status: 'closed', receivedAt: null },
    { ...base, status: 'received', expectedDelivery: null, receivedAt: '2026-09-23' },
  ], now)
  assert.equal(p.onTimePercent, 50)
  assert.equal(p.assessed, 2)
  assert.equal(p.completed, 3)
  assert.equal(p.overdue, 1)
  assert.equal(p.missingDates, 2)
  assert.equal(p.receivedNet, 40)
  assert.equal(p.outstandingNet, 360)
})
test('draft, cancelled and rejected orders do not inflate values or delivery scores', () => {
  const p = supplierPerformance(['draft', 'cancelled', 'rejected'].map(status => ({ ...base, status })), now)
  assert.equal(p.orderedNet, 0)
  assert.equal(p.outstandingNet, 0)
  assert.equal(p.overdue, 0)
})
test('out-of-order receipt entry cannot falsely classify a late delivery as on time', () => {
  const p = supplierPerformance([{ ...base, status: 'received', receivedAt: '2026-09-23', goodsReceipts: [{ deliveredAt: '2026-09-25', netReceived: 100 }] }], now)
  assert.equal(p.onTimePercent, 0)
  assert.equal(p.orders[0].completedDelivery, '2026-09-25')
  assert.equal(p.outstandingNet, 0)
})
test('due today is not overdue and invalid dates are treated as missing', () => {
  const p = supplierPerformance([{ ...base, expectedDelivery: '2026-09-25' }, { ...base, expectedDelivery: 'bad' }], now)
  assert.equal(p.overdue, 0)
  assert.equal(p.missingDates, 1)
})
