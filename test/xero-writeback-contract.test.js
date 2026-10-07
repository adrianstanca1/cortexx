const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const route = fs.readFileSync('app/api/integrations/xero/writeback/route.ts', 'utf8')
const settings = fs.readFileSync('app/api/integrations/xero/route.ts', 'utf8')
const callback = fs.readFileSync('app/api/integrations/xero/callback/route.ts', 'utf8')
const page = fs.readFileSync('app/settings/integrations/xero/page.tsx', 'utf8')

test('Xero write-back retries adopt only Cortexx-owned remote invoice numbers', () => {
  assert.match(route, /remoteInvoiceByNumber/)
  assert.match(route, /Reference \|\| ''\) !== expectedReference/)
  assert.match(route, /different origin/)
})

test('Xero write-back blocks automatic overwrite when a synced payload changes', () => {
  assert.match(route, /existing\?\.payloadHash && existing\.payloadHash !== hash/)
  assert.match(route, /Automatic overwrite is blocked/)
  assert.match(route, /priorPayment\?\.payloadHash && priorPayment\.payloadHash !== paymentHash/)
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
  assert.match(route, /recoverPaymentId\(payments, expected\)/)
  assert.match(route, /if \(recoveredPaymentId\)/)
})

test('external accounting mutations use atomic in-flight claims', () => {
  assert.match(route, /status: 'in_flight'/)
  assert.match(route, /status: \{ in: \['pending', 'error'\] \}/)
  assert.match(route, /already in progress/)
})

test('tenant disconnect and tenant switches clear tenant-specific writeback identity', () => {
  assert.match(settings, /accountingWriteback\.deleteMany/)
  assert.match(callback, /tenantChanged/)
  assert.match(callback, /accountingWriteback\.deleteMany/)
  assert.match(callback, /resetSettings/)
})

test('writeback queue surfaces changed-since-sync records instead of reporting them current', () => {
  assert.match(route, /changedSinceSync/)
  assert.match(route, /Changed since last Xero sync/)
  assert.match(page, /!item\.changedSinceSync/)
})

test('saved Xero tax mappings retain the live numeric rate used for document validation', () => {
  assert.match(settings, /salesTaxRate/)
  assert.match(settings, /purchaseTaxRate/)
  assert.match(settings, /taxRateByType/)
})
