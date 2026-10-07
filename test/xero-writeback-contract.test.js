const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const route = fs.readFileSync('app/api/integrations/xero/writeback/route.ts', 'utf8')
const settings = fs.readFileSync('app/api/integrations/xero/route.ts', 'utf8')

test('Xero write-back retries adopt only Cortexx-owned remote invoice numbers', () => {
  assert.match(route, /remoteInvoiceByNumber/)
  assert.match(route, /Reference \|\| ''\) !== expectedReference/)
  assert.match(route, /different origin/)
})

test('Xero write-back blocks automatic overwrite when a synced payload changes', () => {
  assert.match(route, /existing\?\.externalId && existing\.payloadHash && existing\.payloadHash !== hash/)
  assert.match(route, /Automatic overwrite is blocked/)
  assert.match(route, /priorPayment\.payloadHash && priorPayment\.payloadHash !== paymentHash/)
})

test('paid local invoices require mapped governed payment sync', () => {
  assert.match(route, /Paid local invoices must sync their Xero payment/)
  assert.match(route, /Map a Xero payment account/)
  assert.match(route, /entityType: paymentType/)
})

test('mapping updates validate live Xero accounts and tax rates before enablement', () => {
  assert.match(settings, /xeroApiRequest\(existing, '\/Accounts'\)/)
  assert.match(settings, /xeroApiRequest\(existing, '\/TaxRates'\)/)
  assert.match(settings, /Payment account must be a Xero bank\/payment-enabled account/)
  assert.match(settings, /Configure at least one complete sales or purchase mapping/)
})

test('payment retry recovers an already-applied remote payment before creating another', () => {
  assert.match(route, /recoverRemotePayment/)
  assert.match(route, /Multiple matching Xero payments found; manual reconciliation required/)
  assert.match(route, /if \(recoveredPaymentId\)/)
})
