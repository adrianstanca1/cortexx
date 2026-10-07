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

test('missing or nonnumeric VAT amounts cannot silently become zero', () => {
  for (const value of [null, undefined, '', '  ', false, [], {}]) {
    assert.equal(xero.validateGrossBreakdown({ amount: 100, netAmount: 100, vatAmount: value }).ok, false)
    assert.equal(xero.validateGrossBreakdown({ amount: 100, netAmount: value, vatAmount: 100 }).ok, false)
  }
  assert.equal(xero.validateGrossBreakdown({ amount: 100, netAmount: 100, vatAmount: 0 }).ok, true)
})

test('payment retries require an explicit valid date rather than changing with the clock', () => {
  const input = { invoiceId: 'invoice-1', accountCode: '090', amount: 120 }
  assert.throws(() => xero.paymentPayload(input), /explicit payment date/)
  assert.throws(() => xero.paymentPayload({ ...input, paidAt: 'invalid' }), /date is invalid/)
})

test('external idempotency identity is stable and isolated by company and operation', () => {
  const key = xero.idempotencyKey('company-a', 'payment', 'invoice-1')
  assert.equal(key, xero.idempotencyKey('company-a', 'payment', 'invoice-1'))
  assert.notEqual(key, xero.idempotencyKey('company-b', 'payment', 'invoice-1'))
  assert.notEqual(key, xero.idempotencyKey('company-a', 'invoice', 'invoice-1'))
  assert.ok(key.length <= 128)
})

test('payment recovery verifies reference and bank account as well as date and amount', () => {
  const expected = xero.paymentPayload({ invoiceId: 'invoice-1', amount: 120, paidAt: '2026-10-02', accountCode: '090', reference: 'INV-1' })
  const payment = { PaymentID: 'payment-1', Amount: 120, Date: '2026-10-02T00:00:00Z', Reference: 'INV-1', Account: { Code: '090' } }
  assert.equal(xero.recoverPaymentId([payment], expected), 'payment-1')
  assert.equal(xero.recoverPaymentId([{ ...payment, Date: `/Date(${Date.parse('2026-10-02T00:00:00Z')}+0000)/` }], expected), 'payment-1')
  assert.throws(() => xero.recoverPaymentId([{ ...payment, Reference: 'MANUAL' }], expected), /manual reconciliation/)
  assert.throws(() => xero.recoverPaymentId([{ ...payment, Account: { Code: '091' } }], expected), /manual reconciliation/)
  assert.throws(() => xero.recoverPaymentId([{ ...payment, Account: undefined }], expected), /manual reconciliation/)
  assert.throws(() => xero.recoverPaymentId([{ ...payment, Date: undefined }], expected), /manual reconciliation/)
  assert.throws(() => xero.recoverPaymentId([payment, { ...payment, PaymentID: 'another' }], expected), /Multiple matching/)
  assert.equal(xero.recoverPaymentId([{ ...payment, Status: 'DELETED' }], expected), null)
})
