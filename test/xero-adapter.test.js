const test = require('node:test')
const assert = require('node:assert/strict')
const xero = require('../lib/xero-adapter')

function jwt(payload) { return ['e30', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.') }

test('Xero adapter requests read-only granular banking scopes with offline access', () => {
  assert.ok(xero.XERO_SCOPES.includes('offline_access'))
  assert.ok(xero.XERO_SCOPES.includes('accounting.banktransactions.read'))
  assert.ok(xero.XERO_SCOPES.includes('accounting.settings.read'))
  assert.equal(xero.XERO_SCOPES.some(scope => scope === 'accounting.transactions' || scope === 'accounting.invoices' || scope === 'accounting.payments'), false)
})

test('Xero authorize URL preserves redirect, state and read-only scopes', () => {
  const url = new URL(xero.buildAuthorizeUrl({ clientId: 'client-1', redirectUri: 'https://app.test/api/integrations/xero/callback', state: 'secret-state' }))
  assert.equal(url.origin, 'https://login.xero.com')
  assert.equal(url.pathname, '/identity/connect/authorize')
  assert.equal(url.searchParams.get('state'), 'secret-state')
  assert.match(url.searchParams.get('scope'), /accounting\.banktransactions\.read/)
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

test('Xero bank transactions normalize cash direction, dates and evidence', () => {
  const spend = xero.normalizeXeroBankTransaction({
    BankTransactionID: 'bt-spend', Type: 'SPEND', Total: 120.5, DateString: '2026-09-20T00:00:00', CurrencyCode: 'GBP',
    Reference: 'PO-44', Contact: { Name: 'Supplier Ltd' }, BankAccount: { Name: 'Business Current' },
    LineItems: [{ Description: 'Materials' }],
  })
  assert.equal(spend.amount, -120.5)
  assert.equal(spend.reference, 'PO-44')
  assert.equal(spend.accountName, 'Business Current')
  assert.match(spend.description, /Supplier Ltd.*Materials/)
  assert.equal(spend.occurredAt.toISOString().slice(0, 10), '2026-09-20')

  const receive = xero.normalizeXeroBankTransaction({ BankTransactionID: 'bt-in', Type: 'RECEIVE', Total: 500, Date: '/Date(1790208000000+0000)/' })
  assert.equal(receive.amount, 500)
})

test('Xero bank response ignores malformed rows instead of inventing ledger entries', () => {
  const rows = xero.bankTransactionsFromResponse({ BankTransactions: [
    { BankTransactionID: 'valid', Type: 'RECEIVE', Total: 1, DateString: '2026-09-25' },
    { Type: 'SPEND', Total: 2, DateString: '2026-09-25' },
    { BankTransactionID: 'bad-date', Type: 'SPEND', Total: 2, DateString: 'not-a-date' },
  ] })
  assert.deepEqual(rows.map(row => row.externalId), ['valid'])
})
