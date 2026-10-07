const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { transformSync } = require('esbuild')
const { NextRequest, NextResponse } = require('next/server')
const helpers = require('../lib/xero-writeback')

const code = transformSync(fs.readFileSync('app/api/integrations/xero/writeback/route.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code

function harness({ missingPaymentId = false, missingInvoiceDetails = false, paidDate = '2026-10-02', priorInvoice, remotePayments = [] } = {}) {
  const invoice = { id: 'inv-1', organizationId: 'org-1', number: 'INV-1', clientName: 'Client', amount: 120, netAmount: 100, vatAmount: 20, vatRate: 20, issuedDate: '2026-10-01', dueDate: '2026-10-31', status: 'paid', paidDate }
  const connection = { id: 'connection-1', status: 'connected', externalTenantId: 'tenant-1', scopes: helpers.WRITE_SCOPES.join(' '), settings: { writebackEnabled: true, salesAccountCode: '200', salesTaxType: 'OUTPUT2', salesTaxRate: 20, paymentAccountCode: '090' } }
  const records = new Map(priorInvoice ? [['client_invoice', priorInvoice]] : [])
  const calls = []
  const accepted = new Map()
  const model = {
    findUnique: async ({ where }) => records.get(where.connectionId_entityType_entityId.entityType) || null,
    upsert: async ({ where, create, update }) => {
      const key = where.connectionId_entityType_entityId.entityType
      const row = records.has(key) ? { ...records.get(key), ...update } : { id: `wb-${key}`, ...create }
      records.set(key, row)
      return row
    },
    update: async ({ where, data }) => {
      const key = where.connectionId_entityType_entityId.entityType
      const row = { ...records.get(key), ...data }
      records.set(key, row)
      return row
    },
    updateMany: async ({ where, data }) => {
      for (const [key, row] of records) {
        const idMatches = !where.id || row.id === where.id
        const allowed = where.status?.in || []
        const statusMatches = !where.status || allowed.includes(row.status)
        if (idMatches && statusMatches) { records.set(key, { ...row, ...data }); return { count: 1 } }
      }
      return { count: 0 }
    },
  }
  const api = async (_connection, path, init = {}) => {
    calls.push({ path, ...init })
    if (path.startsWith('/Contacts?')) return { Contacts: [{ ContactID: 'contact-1' }] }
    if (path.startsWith('/Invoices?')) return { Invoices: [] }
    if (path.startsWith('/Invoices/')) return { Invoices: missingInvoiceDetails ? [] : [{ InvoiceID: 'xero-invoice-1', Payments: remotePayments }] }
    if (path.startsWith('/Payments/')) return { Payments: remotePayments.filter(row => path.endsWith(row.PaymentID)) }
    const key = init.headers?.['Idempotency-Key']
    assert.ok(key, 'Every external mutation must carry an idempotency key')
    if (!accepted.has(key)) {
      if (path === '/Invoices') accepted.set(key, { Invoices: [{ InvoiceID: 'xero-invoice-1' }] })
      else if (path === '/Payments') accepted.set(key, { Payments: missingPaymentId ? [] : [{ PaymentID: 'xero-payment-1' }] })
      else throw new Error(`Unexpected API request: ${path}`)
    }
    await new Promise(resolve => setTimeout(resolve, 1))
    return accepted.get(key)
  }
  const mocks = {
    'next/server': { NextRequest, NextResponse },
    '@/lib/db': { prisma: {
      accountingConnection: { findFirst: async ({ where }) => where.organizationId === 'org-1' ? connection : null },
      invoice: { findFirst: async ({ where }) => where.id === invoice.id && where.organizationId === invoice.organizationId ? invoice : null },
      subInvoice: { findFirst: async () => null },
      accountingWriteback: model,
    } },
    '@/lib/requireAuth': { requireOrg: async () => ({ orgId: 'org-1', role: 'admin', userId: 'user-1' }) },
    '@/lib/rbac': { canManage: () => true },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/audit': { auditLog: () => {}, requestMeta: () => ({}) },
    '@/lib/xero-server': { xeroApiRequest: api },
    '@/lib/xero-writeback': helpers,
    '@/lib/errors': { reportError: () => {} },
  }
  const loaded = { exports: {} }
  vm.runInNewContext(code, { Error, module: loaded, exports: loaded.exports, require: name => {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`)
    return mocks[name]
  } })
  const post = () => loaded.exports.POST(new NextRequest('http://localhost/api/integrations/xero/writeback', { method: 'POST', body: JSON.stringify({ entityType: 'client_invoice', entityId: invoice.id, dryRun: false, syncPayment: true }) }))
  return { post, calls, records, accepted }
}

test('write-back validates paid dates before any remote mutation', async () => {
  const h = harness({ paidDate: null })
  const response = await h.post()
  assert.equal(response.status, 409)
  assert.match((await response.json()).error, /explicit payment date/)
  assert.equal(h.calls.length, 0)
})

test('a payment response without PaymentID remains failed and cannot be called synced', async () => {
  const h = harness({ missingPaymentId: true })
  const response = await h.post()
  assert.equal(response.status, 502)
  assert.match((await response.json()).error, /no PaymentID/)
  assert.equal(h.records.get('client_invoice_payment').status, 'error')
})

test('changed invoice data after an uncertain write requires reconciliation', async () => {
  const h = harness({ priorInvoice: { status: 'pending', payloadHash: 'older-payload', externalId: null } })
  assert.equal((await h.post()).status, 409)
  assert.equal(h.calls.filter(call => call.method === 'POST').length, 0)
})

test('manual payments with the same date and amount cannot be adopted or duplicated', async () => {
  const h = harness({ remotePayments: [{ PaymentID: 'manual-1', Amount: 120, Date: '2026-10-02', Reference: 'MANUAL', Account: { Code: '091' } }] })
  const response = await h.post()
  assert.equal(response.status, 502)
  assert.match((await response.json()).error, /manual reconciliation/)
  assert.equal(h.calls.filter(call => call.path === '/Payments').length, 0)
})

test('missing remote invoice details cannot be treated as an empty payment history', async () => {
  const h = harness({ missingInvoiceDetails: true })
  assert.equal((await h.post()).status, 502)
  assert.equal(h.calls.filter(call => call.path === '/Payments').length, 0)
})

test('concurrent write-back requests reuse identical provider keys for one invoice and payment', async () => {
  const h = harness()
  const responses = await Promise.all([h.post(), h.post()])
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409])
  assert.equal(h.accepted.size, 2)
  for (const path of ['/Invoices', '/Payments']) {
    const keys = h.calls.filter(call => call.path === path).map(call => call.headers['Idempotency-Key'])
    assert.ok(keys.length > 0)
    assert.equal(new Set(keys).size, 1)
  }
})
