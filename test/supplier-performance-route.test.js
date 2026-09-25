const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function fixture(auth, supplier = { id: 's1', name: 'Supplier' }, orders = []) {
  const calls = []
  class Response { static json(body, options = {}) { return { body, status: options.status || 200, headers: options.headers } } }
  const mocks = {
    'next/server': { NextResponse: Response },
    '@/lib/requireAuth': { requireOrg: async () => auth === 'unauthorized' ? new Response() : auth },
    '@/lib/rbac': { canManage: role => ['owner', 'admin'].includes(role) },
    '@/lib/errors': { reportError: () => {} },
    '@/lib/supplier-performance': require('../lib/supplier-performance'),
    '@/lib/db': { prisma: {
      supplier: { findFirst: async args => { calls.push(args); return supplier } },
      purchaseOrder: { findMany: async args => { calls.push(args); return orders } },
    } },
  }
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/suppliers/[id]/performance/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText,
    { exports, require: name => { if (!(name in mocks)) throw Error(name); return mocks[name] }, Date })
  return { get: () => exports.GET({}, { params: Promise.resolve({ id: 's1' }) }), calls, Response }
}
test('supplier financial performance requires authentication and company administration', async () => {
  const unauth = fixture('unauthorized')
  assert.ok(await unauth.get() instanceof unauth.Response)
  assert.equal(unauth.calls.length, 0)
  for (const auth of [{ orgId: 'a', role: 'member' }, { orgId: 'a', role: 'viewer' }, { orgId: null, role: 'owner' }]) {
    const f = fixture(auth)
    assert.equal((await f.get()).status, 403)
    assert.equal(f.calls.length, 0)
  }
})
test('supplier, order and receipt queries are explicitly scoped to the active tenant', async () => {
  const f = fixture({ orgId: 'org-a', role: 'owner' })
  const r = await f.get()
  assert.equal(r.status, 200)
  assert.equal(f.calls[0].where.organizationId, 'org-a')
  assert.equal(f.calls[1].where.organizationId, 'org-a')
  assert.equal(f.calls[1].where.supplierId, 's1')
  assert.equal(f.calls[1].select.goodsReceipts.where.organizationId, 'org-a')
  assert.equal(r.headers['Cache-Control'], 'private, no-store')
})
test('a supplier outside the active tenant returns 404 before reading any orders', async () => {
  const f = fixture({ orgId: 'org-b', role: 'owner' }, null)
  assert.equal((await f.get()).status, 404)
  assert.equal(f.calls.length, 1)
})
test('large histories expose the limit instead of silently claiming complete totals', async () => {
  const f = fixture({ orgId: 'org-a', role: 'owner' }, { id: 's1' }, Array.from({ length: 1001 }, (_, i) => ({ id: String(i), number: String(i), status: 'draft', subtotal: 1 })))
  const r = await f.get()
  assert.equal(r.body.truncated, true)
  assert.equal(r.body.performance.orderCount, 1000)
})
