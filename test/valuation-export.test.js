const { test } = require('node:test')
const assert = require('node:assert/strict')
const { csvCell, valuationCsvRow, csvHeader } = require('../lib/valuation-export')
test('CSV export neutralises formula injection and preserves quoted multiline text', () => {
  assert.equal(csvCell(' =HYPERLINK("bad")'), '"\' =HYPERLINK(""bad"")"')
  assert.equal(csvCell('Site, "A"\nLondon'), '"Site, ""A""\nLondon"')
  assert.equal(csvCell(-42), '"-42"')
})
test('valuation export uses issued certificate and actual partial payments', () => {
  const row = valuationCsvRow({ project: { name: 'Site', clientName: 'Client' }, applicationNumber: 2, periodEnd: '2026-09-24', status: 'certified', grossToDate: 200, retentionAmount: 6, previousCertified: 100, netDue: 94, notes: null,
    certificates: [{ status: 'superseded', amountCertified: 90 }, { status: 'issued', certificateNumber: 'CERT-002-R2', amountCertified: 94, payments: [{ amount: 40 }], dueDate: null }] })
  assert.ok(row.includes('"CERT-002-R2","94","40","54"'))
  assert.equal(csvHeader.split(',').length, 15)
})
