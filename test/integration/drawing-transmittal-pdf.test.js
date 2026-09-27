'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { buildDrawingTransmittal, transmittalFilename } = require('../../lib/drawing-transmittal')
const fixture = {
  id: 'issue-123', purpose: 'For construction', message: 'Fix cladding to the approved rail centres.', issuedAt: '2026-09-27T08:00:00Z',
  drawing: { number: 'A-101', title: 'East facade', project: { name: 'Facade project' } },
  revision: { revision: 'C03', fileName: 'A101-C03.pdf' },
  recipients: [{ email: 'foreman@example.test', name: 'Foreman', acknowledgedAt: '2026-09-27T09:00:00Z', acknowledgedBy: 'manager@example.test' }, { email: 'installer@example.test', name: null, acknowledgedAt: null, acknowledgedBy: null }],
}
test('transmittal produces a complete PDF without modifying the recorded issue', async () => {
  const original = JSON.stringify(fixture)
  const pdf = await buildDrawingTransmittal(fixture, 'Facade Contractor', new Date('2026-09-27T10:00:00Z'))
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
  assert.match(pdf.toString('latin1'), /%%EOF/)
  assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1, 'Footer must not create an extra page')
  assert.equal(JSON.stringify(fixture), original)
})
test('large recipient lists paginate rather than losing acknowledgement evidence', async () => {
  const pdf = await buildDrawingTransmittal({ ...fixture, recipients: Array.from({ length: 100 }, (_, i) => ({ ...fixture.recipients[0], email: `recipient-${i}@example.test` })) }, 'Facade Contractor')
  const pages = pdf.toString('latin1').match(/\/Type \/Page\b/g) || []
  assert.ok(pages.length > 2, `Expected multiple pages, got ${pages.length}`)
})
test('download filename cannot inject HTTP headers or path components', () => {
  assert.equal(transmittalFilename('../../issue\r\nHeader: injected'), 'transmittal-issueHeaderinjected.pdf')
  assert.equal(transmittalFilename(''), 'transmittal-drawing.pdf')
})
