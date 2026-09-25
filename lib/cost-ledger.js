'use strict'

function money(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function receiptPosting(receipt = {}) {
  const grossAmount = money(receipt.totalAmount)
  const vatAmount = money(receipt.vatAmount)
  const netAmount = receipt.subtotal == null
    ? money(Math.max(0, grossAmount - vatAmount))
    : money(receipt.subtotal)
  return { netAmount, vatAmount, grossAmount }
}

function subInvoicePosting(invoice = {}) {
  const netAmount = money(invoice.netAmount)
  const vatAmount = money(invoice.vatAmount)
  const grossAmount = money(invoice.grossAmount || (netAmount + vatAmount))
  return { netAmount, vatAmount, grossAmount }
}

function costControlSummary(input = {}) {
  const entries = (input.entries || []).filter(entry => entry && entry.status === 'posted')
  const purchaseOrders = (input.purchaseOrders || []).filter(po => po && ['approved', 'sent', 'part_received', 'received'].includes(po.status))
  const subInvoices = (input.subInvoices || []).filter(si => si && ['approved', 'paid'].includes(si.status))

  const actualNet = money(entries.reduce((sum, entry) => sum + (Number(entry.netAmount) || 0), 0))
  const actualVat = money(entries.reduce((sum, entry) => sum + (Number(entry.vatAmount) || 0), 0))
  const actualGross = money(entries.reduce((sum, entry) => sum + (Number(entry.grossAmount) || 0), 0))
  const uncodedNet = money(entries.filter(entry => !entry.costCodeId).reduce((sum, entry) => sum + (Number(entry.netAmount) || 0), 0))

  const matchedByPo = new Map()
  for (const invoice of subInvoices) {
    if (!invoice.purchaseOrderId) continue
    matchedByPo.set(
      invoice.purchaseOrderId,
      money((matchedByPo.get(invoice.purchaseOrderId) || 0) + (Number(invoice.netAmount) || 0)),
    )
  }

  let committedNet = 0
  let openCommitments = 0
  const byCode = new Map()
  const bucket = (id, code, name) => {
    const key = id || 'uncoded'
    if (!byCode.has(key)) byCode.set(key, { costCodeId: id || null, code: code || 'UNCODED', name: name || 'Uncoded', actualNet: 0, openCommitments: 0, forecastNet: 0 })
    return byCode.get(key)
  }

  for (const entry of entries) {
    const b = bucket(entry.costCodeId, entry.costCode?.code, entry.costCode?.name)
    b.actualNet = money(b.actualNet + (Number(entry.netAmount) || 0))
  }

  for (const po of purchaseOrders) {
    const subtotal = money(po.subtotal)
    const matched = money(matchedByPo.get(po.id) || 0)
    const open = money(Math.max(0, subtotal - matched))
    committedNet = money(committedNet + subtotal)
    openCommitments = money(openCommitments + open)
    const b = bucket(po.costCodeId, po.costCode?.code, po.costCode?.name)
    b.openCommitments = money(b.openCommitments + open)
  }

  const breakdown = [...byCode.values()]
    .map(row => ({ ...row, forecastNet: money(row.actualNet + row.openCommitments) }))
    .sort((a, b) => b.forecastNet - a.forecastNet || a.code.localeCompare(b.code))

  return {
    actualNet,
    actualVat,
    actualGross,
    uncodedNet,
    committedNet,
    openCommitments,
    forecastNet: money(actualNet + openCommitments),
    codedPct: actualNet > 0 ? money((actualNet - uncodedNet) / actualNet * 100) : 100,
    breakdown,
  }
}

module.exports = { money, receiptPosting, subInvoicePosting, costControlSummary }
