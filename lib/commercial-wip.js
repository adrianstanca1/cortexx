'use strict'

function money(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function sum(rows, key) {
  return money((rows || []).reduce((total, row) => total + (Number(row?.[key]) || 0), 0))
}

function commercialSummary(input) {
  const project = input.project || {}
  const variations = input.variations || []
  const valuations = input.valuations || []
  const certificates = input.certificates || []
  const payments = input.payments || []
  const invoices = input.invoices || []
  const purchaseOrders = input.purchaseOrders || []
  const subInvoices = input.subInvoices || []

  const originalContractValue = money(project.budget)
  const approvedVariations = sum(variations.filter(v => v.status === 'approved'), 'costImpact')
  const adjustedContractValue = money(originalContractValue + approvedVariations)
  const latestValuation = [...valuations].sort((a, b) => Number(b.applicationNumber || 0) - Number(a.applicationNumber || 0))[0]
  const appliedToDate = money(latestValuation?.grossToDate || 0)
  const issuedCertificates = certificates.filter(c => c.status === 'issued')
  const certifiedToDate = sum(issuedCertificates, 'amountCertified')
  const latestCertificate = [...issuedCertificates].sort((a, b) => new Date(b.issuedAt || 0) - new Date(a.issuedAt || 0))[0]
  const retentionHeld = money(Math.max(0, Number(latestCertificate?.retentionAmount || 0) - Number(latestCertificate?.retentionRelease || 0)))
  const valuationCashReceived = sum(payments, 'amount')
  const clientInvoicesIssued = sum(invoices.filter(i => i.status !== 'draft'), 'amount')
  const clientInvoicesPaid = sum(invoices.filter(i => i.status === 'paid'), 'amount')
  const committedPOs = sum(purchaseOrders.filter(po => !['draft', 'cancelled'].includes(po.status)), 'subtotal')
  const approvedSubcontract = sum(subInvoices.filter(si => ['approved', 'paid'].includes(si.status)), 'payableAmount')
  const paidSubcontract = sum(subInvoices.filter(si => si.status === 'paid'), 'payableAmount')
  const recordedCost = money(project.spent)
  const openCommitments = money(Math.max(0, committedPOs - recordedCost) + Math.max(0, approvedSubcontract - paidSubcontract))
  const forecastCost = money(recordedCost + openCommitments)
  const earnedValue = money(adjustedContractValue * Math.max(0, Math.min(100, Number(project.progress) || 0)) / 100)
  const uncertifiedValue = money(earnedValue - certifiedToDate)
  const forecastMargin = money(adjustedContractValue - forecastCost)
  const forecastMarginPct = adjustedContractValue > 0 ? money(forecastMargin / adjustedContractValue * 100) : 0
  const cashPosition = money(valuationCashReceived - recordedCost)

  return {
    originalContractValue, approvedVariations, adjustedContractValue,
    appliedToDate, certifiedToDate, retentionHeld, valuationCashReceived,
    clientInvoicesIssued, clientInvoicesPaid, committedPOs, approvedSubcontract,
    paidSubcontract, recordedCost, openCommitments, forecastCost, earnedValue,
    uncertifiedValue, forecastMargin, forecastMarginPct, cashPosition,
  }
}

module.exports = { money, commercialSummary }
