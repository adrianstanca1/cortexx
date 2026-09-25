const test = require('node:test')
const assert = require('node:assert/strict')
const xero = require('../lib/xero-adapter')

function jwt(payload) {
  return ['e30', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.')
}

test('Xero adapter uses granular accounting scopes and offline access', () => {
  assert.ok(xero.XERO_SCOPES.includes('offline_access'))
  assert.ok(xero.XERO_SCOPES.includes('accounting.invoices'))
  assert.ok(xero.XERO_SCOPES.includes('accounting.payments'))
  assert.ok(xero.XERO_SCOPES.includes('accounting.contacts'))
  assert.equal(xero.XERO_SCOPES.includes('accounting.transactions'), false)
})

test('Xero authorize URL preserves redirect, state and granular scopes', () => {
  const url = new URL(xero.buildAuthorizeUrl({ clientId: 'client-1', redirectUri: 'https://app.test/api/integrations/xero/callback', state: 'secret-state' }))
  assert.equal(url.origin, 'https://login.xero.com')
  assert.equal(url.pathname, '/identity/connect/authorize')
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('client_id'), 'client-1')
  assert.equal(url.searchParams.get('state'), 'secret-state')
  assert.match(url.searchParams.get('scope'), /accounting\.invoices/)
})

test('tenant selection prefers existing tenant, then current authentication event', () => {
  const rows = [
    { id: 'c-old', tenantId: 'tenant-old', authEventId: 'old', updatedDateUtc: '2026-01-01' },
    { id: 'c-new', tenantId: 'tenant-new', authEventId: 'event-1', updatedDateUtc: '2026-09-25' },
  ]
  assert.equal(xero.selectAuthorizedConnection(rows, jwt({ authentication_event_id: 'event-1' }), 'tenant-old').tenantId, 'tenant-old')
  assert.equal(xero.selectAuthorizedConnection(rows, jwt({ authentication_event_id: 'event-1' })).tenantId, 'tenant-new')
  assert.equal(xero.selectAuthorizedConnection(rows, jwt({ authentication_event_id: 'unknown' })), null)
})

test('sales invoice payload is draft, inclusive and requires explicit mapping', () => {
  const invoice = { id: 'i1', number: 'INV-1', clientName: 'Example Client', amount: 1200, issuedDate: '2026-09-01', dueDate: '2026-09-30', project: { name: 'Facade A' } }
  assert.throws(() => xero.salesInvoicePayload(invoice, {}), /salesAccountCode/)
  const body = xero.salesInvoicePayload(invoice, { salesAccountCode: '200', salesTaxType: 'OUTPUT2' })
  assert.equal(body.Type, 'ACCREC')
  assert.equal(body.Status, 'DRAFT')
  assert.equal(body.LineAmountTypes, 'Inclusive')
  assert.equal(body.Contact.Name, 'Example Client')
  assert.equal(body.LineItems[0].UnitAmount, 1200)
  assert.equal(body.LineItems[0].AccountCode, '200')
  assert.equal(body.LineItems[0].TaxType, 'OUTPUT2')
})

test('subcontract bill payload remains draft and flags CIS review without changing gross amount', () => {
  const invoice = { id: 's1', number: 'SUB-9', grossAmount: 1200, cisAmount: 200, invoiceDate: '2026-09-10', subcontractor: { name: 'Cladding Ltd' }, project: { name: 'Tower B' } }
  const body = xero.purchaseBillPayload(invoice, { purchaseAccountCode: '310', purchaseTaxType: 'INPUT2' })
  assert.equal(body.Type, 'ACCPAY')
  assert.equal(body.Status, 'DRAFT')
  assert.equal(body.LineItems[0].UnitAmount, 1200)
  assert.match(body.LineItems[0].Description, /CIS held in Cortexx £200\.00/)
})

test('payload hashes are stable and remote statuses only map forward-worthy states', () => {
  assert.equal(xero.payloadHash({ b: 2, a: 1 }), xero.payloadHash({ b: 2, a: 1 }))
  assert.equal(xero.xeroStatusToLocal('PAID', 'invoice'), 'paid')
  assert.equal(xero.xeroStatusToLocal('AUTHORISED', 'invoice'), 'sent')
  assert.equal(xero.xeroStatusToLocal('AUTHORISED', 'sub_invoice'), 'approved')
  assert.equal(xero.xeroStatusToLocal('DRAFT', 'invoice'), null)
})
