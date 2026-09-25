function money(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0
}

function normalizeProcurementItems(raw, options = {}) {
  if (!Array.isArray(raw)) return []
  const requirePrice = options.requirePrice === true
  return raw.map((row) => {
    if (!row || typeof row !== 'object') return null
    const description = String(row.description || '').trim()
    const quantity = Number(row.quantity)
    const unitPrice = row.unitPrice === undefined || row.unitPrice === null || row.unitPrice === '' ? 0 : Number(row.unitPrice)
    if (!description || !Number.isFinite(quantity) || quantity <= 0) return null
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || (requirePrice && unitPrice === 0)) return null
    return {
      description,
      quantity,
      unit: row.unit ? String(row.unit) : 'item',
      unitPrice: money(unitPrice),
      total: money(quantity * unitPrice),
    }
  }).filter(Boolean)
}

function alignQuoteItems(requestedRaw, quotedRaw) {
  const requested = normalizeProcurementItems(requestedRaw)
  if (!Array.isArray(quotedRaw) || !requested.length || quotedRaw.length !== requested.length) throw new Error('QUOTE_LINES_MISMATCH')
  return requested.map((row, index) => {
    const unitPrice = Number(quotedRaw[index]?.unitPrice)
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error('QUOTE_PRICE_REQUIRED')
    return { ...row, unitPrice: money(unitPrice), total: money(row.quantity * unitPrice) }
  })
}

function quoteTotals(lineItems, vatRate = 20) {
  const netAmount = money((lineItems || []).reduce((sum, row) => sum + (Number(row?.total) || 0), 0))
  const rate = Number(vatRate)
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('INVALID_VAT_RATE')
  const vatAmount = money(netAmount * rate / 100)
  return { netAmount, vatRate: rate, vatAmount, totalAmount: money(netAmount + vatAmount) }
}

const TRANSITIONS = {
  draft: new Set(['submitted', 'cancelled']),
  submitted: new Set(['approved', 'rejected', 'cancelled']),
  rejected: new Set(['draft', 'submitted', 'cancelled']),
  approved: new Set(['rfq_open', 'cancelled']),
  rfq_open: new Set(['converted', 'cancelled']),
  converted: new Set(),
  cancelled: new Set(),
}

const MANAGER_TARGETS = new Set(['approved', 'rejected', 'rfq_open', 'converted', 'cancelled'])

function canTransitionRequisition(from, to, isManager) {
  if (from === to) return true
  if (!TRANSITIONS[from] || !TRANSITIONS[from].has(to)) return false
  if (MANAGER_TARGETS.has(to) && !isManager) return false
  return true
}

function compareSupplierQuotes(quotes) {
  const rows = (Array.isArray(quotes) ? quotes : []).filter(Boolean).map((quote) => ({
    id: quote.id,
    supplierId: quote.supplierId,
    supplierName: quote.supplier?.name || quote.supplierName || 'Supplier',
    netAmount: money(quote.netAmount),
    totalAmount: money(quote.totalAmount),
    leadDays: Number.isFinite(Number(quote.leadDays)) ? Number(quote.leadDays) : null,
    status: quote.status || 'received',
  }))
  const eligible = rows.filter(row => row.status === 'received' || row.status === 'awarded')
  const lowestNet = eligible.length ? Math.min(...eligible.map(row => row.netAmount)) : null
  const fastestLead = eligible.filter(row => row.leadDays !== null).length
    ? Math.min(...eligible.filter(row => row.leadDays !== null).map(row => row.leadDays))
    : null
  return rows.map(row => ({
    ...row,
    varianceFromLowest: lowestNet === null ? null : money(row.netAmount - lowestNet),
    pctAboveLowest: lowestNet && lowestNet > 0 ? money((row.netAmount - lowestNet) / lowestNet * 100) : 0,
    fastestLead: fastestLead !== null && row.leadDays === fastestLead,
  }))
}

module.exports = { money, normalizeProcurementItems, alignQuoteItems, quoteTotals, canTransitionRequisition, compareSupplierQuotes }
