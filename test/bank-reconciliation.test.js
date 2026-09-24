const test = require('node:test')
const assert = require('node:assert/strict')
const { allocationSummary, directionForAmount, targetAllowed, outstanding } = require('../lib/bank-reconciliation')

test('allocation summary handles unmatched, partial and reconciled bank values', () => {
  assert.deepEqual(allocationSummary(100, []), { total: 100, allocated: 0, remaining: 100, overAllocated: 0, status: 'unmatched' })
  assert.deepEqual(allocationSummary(100, [{ amount: 40 }]), { total: 100, allocated: 40, remaining: 60, overAllocated: 0, status: 'partial' })
  assert.deepEqual(allocationSummary(-100, [{ amount: 60 }, { amount: 40 }]), { total: 100, allocated: 100, remaining: 0, overAllocated: 0, status: 'reconciled' })
})

test('direction gates credits to receivables and debits to payables', () => {
  assert.equal(directionForAmount(1), 'credit')
  assert.equal(directionForAmount(-1), 'debit')
  assert.equal(targetAllowed(50, 'client_invoice'), true)
  assert.equal(targetAllowed(50, 'valuation_certificate'), true)
  assert.equal(targetAllowed(50, 'sub_invoice'), false)
  assert.equal(targetAllowed(-50, 'sub_invoice'), true)
  assert.equal(targetAllowed(-50, 'client_invoice'), false)
})

test('outstanding supports partial allocations without negative balances', () => {
  assert.equal(outstanding(1200, [{ amount: 500 }, { amount: 200 }]), 500)
  assert.equal(outstanding(100, [{ amount: 120 }]), 0)
})
