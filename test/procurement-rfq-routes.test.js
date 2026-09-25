const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

// Execute the actual handlers with isolated auth/database boundaries.
function handler(path, prisma, role = 'owner') {
  class NextResponse {
    static json(body, options = {}) { return { body, status: options.status || 200 } }
  }
  const mocks = {
    'next/server': { NextResponse },
    '@/lib/db': { prisma },
    '@/lib/requireAuth': { requireOrg: async () => ({ role, userId: 'u1', session: {} }), actorName: () => 'New actor' },
    '@/lib/rbac': { canWrite: () => true, canManage: value => value === 'owner' },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/errors': { reportError: () => {} },
    '@/lib/audit': { auditLog: () => {}, requestMeta: () => ({}) },
    '@/lib/procurement-rfq': require('../lib/procurement-rfq'),
  }
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => {
    if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`)
    return mocks[name]
  }, Date, Set, console })
  return exports
}
const params = { params: Promise.resolve({ id: 'req1' }) }
const request = body => ({ json: async () => body })

test('repeated approval/rejection cannot rewrite the audit record for any role', async () => {
  for (const role of ['member', 'owner']) for (const status of ['approved', 'rejected']) {
    let writes = 0
    const { PUT } = handler('app/api/requisitions/[id]/route.ts', {
      procurementRequisition: {
        findUnique: async () => ({ id: 'req1', status }),
        update: async () => { writes++; return {} },
      },
    }, role)
    const response = await PUT(request({ status, rejectionReason: 'tampered' }), params)
    assert.equal(response.status, 409)
    assert.equal(writes, 0)
  }
})

test('cancellation closes outstanding RFQs in the same guarded database write', async () => {
  let write
  const { PUT } = handler('app/api/requisitions/[id]/route.ts', {
    procurementRequisition: {
      findUnique: async () => ({ id: 'req1', status: 'rfq_open' }),
      update: async args => { write = args; return { id: 'req1', status: 'cancelled' } },
    },
  })
  assert.equal((await PUT(request({ status: 'cancelled' }), params)).status, 200)
  assert.equal(write.where.status, 'rfq_open')
  assert.equal(write.data.rfqs.updateMany.data.status, 'cancelled')
  assert.ok(write.data.rfqs.updateMany.where.status.in.includes('sent'))
})

test('cancelled requisition rejects quotes even if its RFQ still says sent', async () => {
  const { POST } = handler('app/api/rfqs/[id]/quotes/route.ts', {
    procurementRfq: { findUnique: async () => ({ status: 'sent', requisition: { status: 'cancelled' } }) },
  })
  assert.equal((await POST(request({ supplierId: 's1' }), params)).status, 409)
})

test('cancelled requisition cannot be awarded or create committed spend', async () => {
  const tx = {
    procurementRfq: { findUnique: async () => ({ status: 'sent', requisition: { status: 'cancelled' } }) },
  }
  const { POST } = handler('app/api/rfqs/[id]/award/route.ts', { $transaction: fn => fn(tx) })
  const response = await POST(request({ quoteId: 'q1' }), params)
  assert.equal(response.status, 409)
  assert.equal(response.body.code, 'REQUISITION_NOT_OPEN')
})

test('award loses a race to cancellation without creating a PO', async () => {
  const tx = {
    procurementRfq: { findUnique: async () => ({
      status: 'sent', requisition: { id: 'req1', status: 'rfq_open' },
      quotes: [{ id: 'q1', status: 'received', supplier: {}, lineItems: [{}], netAmount: 10 }],
    }) },
    procurementRequisition: { updateMany: async () => ({ count: 0 }) },
  }
  const { POST } = handler('app/api/rfqs/[id]/award/route.ts', { $transaction: fn => fn(tx) })
  const response = await POST(request({ quoteId: 'q1' }), params)
  assert.equal(response.status, 409)
  assert.equal(response.body.code, 'REQUISITION_NOT_OPEN')
})
