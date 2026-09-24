'use strict'
const { paymentSummary } = require('./commercial-ledger')

// Quote every field and neutralise spreadsheet formula prefixes in user text.
function csvCell(value) {
  let text = value == null ? '' : String(value)
  if (/^[\s]*[=+@-]/.test(text) && typeof value !== 'number') text = "'" + text
  return '"' + text.replace(/"/g, '""') + '"'
}
function valuationCsvRow(v) {
  const certificate = (v.certificates || []).find(c => c.status === 'issued')
  const balance = paymentSummary(certificate?.amountCertified || 0, certificate?.payments || [])
  return [v.project.name, v.project.clientName, v.applicationNumber, new Date(v.periodEnd).toISOString().slice(0, 10), v.status,
    v.grossToDate, v.retentionAmount, v.previousCertified, v.netDue, certificate?.certificateNumber,
    certificate?.amountCertified ?? 0, balance.paid, balance.outstanding,
    certificate?.dueDate ? new Date(certificate.dueDate).toISOString().slice(0, 10) : '', v.notes].map(csvCell).join(',')
}
const csvHeader = ['Project', 'Client', 'Application', 'Period end', 'Status', 'Gross to date GBP', 'Application retention GBP', 'Previously certified GBP', 'Application net due GBP', 'Certificate', 'Certified GBP', 'Paid GBP', 'Certificate outstanding GBP', 'Certificate due date', 'Notes'].map(csvCell).join(',')
module.exports = { csvCell, csvHeader, valuationCsvRow }
