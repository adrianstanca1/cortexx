const test = require('node:test')
const assert = require('node:assert/strict')
const xero = require('../lib/xero-writeback')

test('client invoice write-back requires an explicit VAT breakdown', () => {
  assert.throws(() => xero.clientInvoicePayload({
    id: 'inv-1', number: 'INV-1', clientName: 'Client', amount: 120,
    issuedDate: '2026-10-01', dueDate: '2026-10-31', status: 'sent',
  }, { salesAccountCode: '200', salesTaxType: 'OUTPUT2' }, 'contact-1'), /Explicit net and VAT/)
})

test('client invoice write-back refuses inconsistent gross totals', () => {
  assert.throws(() => xero.clientInvoicePayload({
    id: 'inv-1', number: 'INV-1', clientName: 'Client', amount: 121, netAmount: 100, vatAmount: 20,
    issuedDate: '2026-10-01', dueDate: '2026-10-31', status: 'sent',
  }, { salesAccountCode: '200', salesTaxType: 'OUTPUT2' }, 'contact-1'), /must equal/)
})

test('client invoice payload uses governed mappings and local idempotency reference', () => {
  const payload = xero.clientInvoicePayload({
    id: 'inv-1', number: 'INV-1', clientName: 'Client', amount: 120, netAmount: 100, vatAmount: 20,
    issuedDate: '2026-10-01', dueDate: '2026-10-31', status: 'sent', project: { name: 'North Elevation' },
  }, { salesAccountCode: '200', salesTaxType: 'OUTPUT2' }, 'contact-1')
  assert.equal(payload.Type, 'ACCREC')
  assert.equal(payload.Status, 'AUTHORISED')
  assert.equal(payload.Reference, 'Cortexx:inv-1')
  assert.equal(payload.LineItems[0].UnitAmount, 100)
  assert.equal(payload.LineItems[0].AccountCode, '200')
  assert.equal(payload.LineItems[0].TaxType, 'OUTPUT2')
  assert.equal(payload.LineItems[0].TaxAmount, 20)
})

test('CIS subcontract invoices fail closed instead of guessing Xero CIS treatment', () => {
  assert.throws(() => xero.subInvoicePayload({
    id: 'sub-1', number: 'SUB-1', netAmount: 100, vatAmount: 20, grossAmount: 120, cisAmount: 20,
    invoiceDate: '2026-10-01', status: 'approved',
  }, { purchaseAccountCode: '310', purchaseTaxType: 'INPUT2' }, 'contact-1'), /dedicated Xero CIS mapping/)
})

test('payment payload requires a mapped payment account', () => {
  assert.throws(() => xero.paymentPayload({ invoiceId: 'xero-inv', amount: 120, paidAt: '2026-10-02' }), /Payment account mapping/)
  const payload = xero.paymentPayload({ invoiceId: 'xero-inv', amount: 120, paidAt: '2026-10-02', accountCode: '090', reference: 'INV-1' })
  assert.deepEqual(payload.Invoice, { InvoiceID: 'xero-inv' })
  assert.equal(payload.Account.Code, '090')
  assert.equal(payload.Amount, 120)
})

test('missing write scopes are explicit', () => {
  assert.deepEqual(xero.missingWriteScopes('openid accounting.invoices'), ['accounting.payments', 'accounting.contacts'])
  assert.deepEqual(xero.missingWriteScopes('accounting.invoices accounting.payments accounting.contacts'), [])
})

test('contact numbers and payload hashes are deterministic', () => {
  assert.equal(xero.contactNumber('client_invoice', 'abc-123'), xero.contactNumber('client_invoice', 'abc-123'))
  assert.equal(xero.payloadHash({ a: 1, b: 2 }), xero.payloadHash({ a: 1, b: 2 }))
})

test('VAT amount must match explicit rate when supplied', () => {
  assert.deepEqual(
    xero.validateGrossBreakdown({ amount: 120, netAmount: 100, vatAmount: 20, vatRate: 20 }).ok,
    true,
  )
  assert.match(
    xero.validateGrossBreakdown({ amount: 120, netAmount: 100, vatAmount: 20, vatRate: 5 }).error,
    /does not match/,
  )
})
