const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function fixture(role, history = 0, invitations = 0) {
  const calls = [], audits = []
  class Response { static json(body, options = {}) { return { body, status: options.status || 200 } } }
  const prisma = {
    supplier: {
      findUnique: async args => { calls.push(['find', args]); return { id: 's1' } },
      create: async args => { calls.push(['create', args]); return { id: 's1' } },
      update: async args => { calls.push(['update', args]); return { id: 's1' } },
      delete: async args => { calls.push(['delete', args]); return { id: 's1' } },
    },
    purchaseOrder: { count: async () => history }, supplierQuote: { count: async () => 0 },
    procurementRfq: { count: async args => { calls.push(['invitations', args]); return invitations } },
    $transaction: async (fn, opts) => { assert.equal(opts.isolationLevel, 'Serializable'); return fn(prisma) },
  }
  const mocks = {
    'next/server': { NextResponse: Response }, '@/lib/db': { prisma },
    '@/lib/requireAuth': { requireOrg: async () => ({ role, orgId: 'org-a', userId: 'u1' }) },
    '@/lib/rbac': { canWrite: r => ['member', 'admin', 'owner'].includes(r), canManage: r => ['admin', 'owner'].includes(r) },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/audit': { auditLog: entry => audits.push(entry), requestMeta: () => ({}) },
  }
  const load = path => {
    const exports = {}
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: name => mocks[name], Error, Date, console })
    return exports
  }
  return { ...load('app/api/suppliers/route.ts'), ...load('app/api/suppliers/[id]/route.ts'), calls, audits }
}
const req = { json: async () => ({ name: 'Trade supplier', archived: true }) }
const params = { params: Promise.resolve({ id: 's1' }) }
test('viewers cannot mutate suppliers and members cannot delete them', async () => {
  const viewer = fixture('viewer')
  for (const method of ['POST', 'PATCH', 'DELETE']) assert.equal((await viewer[method](req, params)).status, 403)
  assert.equal(viewer.calls.length, 0)
  assert.equal((await fixture('member').DELETE(req, params)).status, 403)
})
test('supplier creation and changes are tenant-scoped and audited', async () => {
  const f = fixture('member')
  assert.equal((await f.POST(req)).status, 201)
  assert.equal((await f.PATCH(req, params)).status, 200)
  assert.equal(f.calls.find(c => c[0] === 'create')[1].data.organizationId, 'org-a')
  assert.equal(f.calls.find(c => c[0] === 'update')[1].where.organizationId, 'org-a')
  assert.deepEqual(f.audits.map(a => a.action), ['supplier.create', 'supplier.update'])
})
test('procurement history prevents deleting a supplier while allowing archive', async () => {
  const f = fixture('owner', 1)
  const response = await f.DELETE(req, params)
  assert.equal(response.status, 409)
  assert.match(response.body.error, /Archive/)
  assert.equal(f.calls.some(c => c[0] === 'delete'), false)
  assert.equal((await f.PATCH(req, params)).status, 200)
})
test('admin can delete an unused supplier with an audit record', async () => {
  const f = fixture('admin')
  assert.equal((await f.DELETE(req, params)).status, 200)
  assert.equal(f.calls.find(c => c[0] === 'delete')[1].where.organizationId, 'org-a')
  assert.equal(f.audits[0].action, 'supplier.delete')
})


test('RFQ invitations preserve supplier history before any quote or order exists', async () => {
  const f = fixture('owner', 0, 1)
  assert.equal((await f.DELETE(req, params)).status, 409)
  assert.equal(f.calls.some(c => c[0] === 'delete'), false)
  const query = f.calls.find(c => c[0] === 'invitations')[1]
  assert.equal(query.where.organizationId, 'org-a')
  assert.equal(query.where.supplierIds.array_contains[0], 's1')
})
