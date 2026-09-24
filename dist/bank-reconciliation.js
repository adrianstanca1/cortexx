'use strict'

function money(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function allocationSummary(transactionAmount, allocations = []) {
  const total = money(Math.abs(Number(transactionAmount) || 0))
  const allocated = money(allocations.reduce((sum, row) => sum + Math.max(0, Number(row?.amount) || 0), 0))
  const remaining = money(Math.max(0, total - allocated))
  const overAllocated = money(Math.max(0, allocated - total))
  const status = total <= 0 || allocated <= 0 ? 'unmatched' : remaining <= 0.009 && overAllocated <= 0.009 ? 'reconciled' : 'partial'
  return { total, allocated, remaining, overAllocated, status }
}

function directionForAmount(amount) {
  const n = Number(amount) || 0
  return n > 0 ? 'credit' : n < 0 ? 'debit' : 'zero'
}

function targetAllowed(amount, targetType) {
  const direction = directionForAmount(amount)
  if (direction === 'credit') return targetType === 'client_invoice' || targetType === 'valuation_certificate'
  if (direction === 'debit') return targetType === 'sub_invoice'
  return false
}

function outstanding(targetAmount, allocations = []) {
  return money(Math.max(0, Number(targetAmount || 0) - allocations.reduce((sum, row) => sum + Math.max(0, Number(row?.amount) || 0), 0)))
}

module.exports = { money, allocationSummary, directionForAmount, targetAllowed, outstanding }
