const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function fixture(options = {}) {
  const auth = options.auth === undefined ? { orgId: 'org-a', userId: 'u1', role: 'admin' } : options.auth
  const calls = [], audits = [], records = []
  class Response {
    constructor(body, status) { this.body = body; this.status = status }
    static json(body, options = {}) { return { body, status: options.status || 200, headers: options.headers } }
  }
  const call = (name, result) => async args => { calls.push([name, args]); return typeof result === 'function' ? result(args) : result }
  const prisma = {
    supplier: { findFirst: call('supplier', options.supplier === null ? null : { id: 's1' }) },
    snag: {
      findFirst: call('snag', options.source === null ? null : { id: 'sn1', projectId: 'p1' }),
      findMany: call('snags', options.sources || []),
    },
    inspection: {
      findFirst: call('inspection', options.source === null ? null : { id: 'in1', projectId: 'p1' }),
      findMany: call('inspections', options.sources || []),
    },
    purchaseOrder: {
      findFirst: call('order', options.order === null ? null : { id: 'po1' }),
      findMany: call('orders', options.orders || []),
    },
    supplierQualityEvidence: {
      create: call('create', args => {
        if (options.createError) throw Object.assign(new Error('database conflict'), { code: options.createError })
        const record = { id: 'e1', ...args.data }; records.push(record); return record
      }),
      findFirst: call('evidence', options.record === undefined ? { id: 'e1', withdrawnAt: null } : options.record),
      updateMany: call('withdraw', { count: options.updatedCount === undefined ? 1 : options.updatedCount }),
    },
    auditEvent: { create: call('audit', args => { if (options.auditError) throw new Error('audit failed'); audits.push(args.data) }) },
    $transaction: async (fn, options) => {
      assert.equal(options.isolationLevel, 'Serializable')
      const before = records.length
      try { return await fn(prisma) } catch (error) { records.length = before; throw error }
    },
  }
  const mocks = {
    'next/server': { NextResponse: Response }, '@/lib/db': { prisma },
    '@/lib/requireAuth': { requireOrg: async () => auth === null ? new Response({ error: 'Unauthorized' }, 401) : auth },
    '@/lib/rbac': { canManage: role => ['owner', 'admin'].includes(role) },
    '@/lib/rateLimit': { enforceRateLimit: async () => options.limited || null },
    '@/lib/audit': { requestMeta: () => ({ ip: '127.0.0.1', userAgent: 'test' }) },
    '@/lib/errors': { reportError: () => {} },
    '@/lib/supplier-quality-server': { defectSelect: {}, inspectionSelect: {} },
  }
  function load(path) {
    const exports = {}
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports, require: name => { assert.ok(name in mocks, name); return mocks[name] }, Error, Date, URL })
    return exports
  }
  const { POST } = load('app/api/suppliers/[id]/quality/route.ts')
  const { PATCH } = load('app/api/suppliers/[id]/quality/[evidenceId]/route.ts')
  const { GET } = load('app/api/suppliers/[id]/quality/sources/route.ts')
  const params = { params: Promise.resolve({ id: 's1', evidenceId: 'e1' }) }
  const body = { sourceType: 'snag', sourceId: 'sn1', reason: '  Supplier material failed inspection  ' }
  return {
    post: (value = body) => POST({ json: async () => value }, params),
    withdraw: (value = { reason: '  Source attributed incorrectly  ' }) => PATCH({ json: async () => value }, params),
    sources: (query = '') => GET({ url: 'https://example.test/api/suppliers/s1/quality/sources' + query }, params),
    calls, audits, records,
  }
}

test('quality sources, attribution and withdrawal require company administration', async () => {
  for (const auth of [null, { orgId: 'org-a', userId: 'u1', role: 'viewer' }, { orgId: 'org-a', userId: 'u1', role: 'member' }, { orgId: null, userId: 'u1', role: 'owner' }]) {
    const f = fixture({ auth })
    for (const action of [f.sources, f.post, f.withdraw]) assert.equal((await action()).status, auth ? 403 : 401)
    assert.equal(f.calls.length, 0)
  }
  const missingActor = fixture({ auth: { orgId: 'org-a', role: 'admin' } })
  assert.equal((await missingActor.post()).status, 403)
  assert.equal((await missingActor.withdraw()).status, 403)
  assert.equal(missingActor.calls.length, 0)
})

test('invalid input and rate-limited writes do not read or mutate evidence', async () => {
  const f = fixture()
  for (const body of [null, [], { sourceType: 'other', sourceId: 'sn1', reason: 'Reason' },
    { sourceType: 'snag', sourceId: '../source', reason: 'Reason' },
    { sourceType: 'snag', sourceId: 'sn1', reason: '  ' },
    { sourceType: 'snag', sourceId: 'sn1', reason: 'x'.repeat(2001) },
    { sourceType: 'snag', sourceId: 'sn1', reason: 'Reason', organizationId: 'org-b' },
    { sourceType: 'snag', sourceId: 'sn1', reason: 'Reason', purchaseOrderId: 1 },
  ]) assert.equal((await f.post(body)).status, 400)
  for (const body of [null, [], { reason: 'x' }, { reason: 'Reason', sourceId: 'sn2' }]) assert.equal((await f.withdraw(body)).status, 400)
  assert.equal((await f.sources('?sourceType=safety')).status, 400)
  assert.equal((await f.sources('?q=' + 'x'.repeat(101))).status, 400)
  assert.equal(f.calls.length, 0)
  const limited = fixture({ limited: { status: 429 } })
  assert.equal((await limited.post()).status, 429)
  assert.equal((await limited.withdraw()).status, 429)
  assert.equal(limited.calls.length, 0)
})

test('attribution verifies tenant, quality source and supplier/project order before creating an audited record', async () => {
  for (const sourceType of ['snag', 'inspection']) {
    const f = fixture()
    const result = await f.post({ sourceType, sourceId: sourceType === 'snag' ? 'sn1' : 'in1', purchaseOrderId: 'po1', reason: '  Reviewed material failure  ' })
    assert.equal(result.status, 201)
    assert.equal(result.headers['Cache-Control'], 'private, no-store')
    const source = f.calls.find(c => c[0] === sourceType)[1].where
    assert.equal(source.organizationId, 'org-a')
    assert.equal(source.project.organizationId, 'org-a')
    if (sourceType === 'inspection') assert.equal(source.type, 'quality')
    const order = f.calls.find(c => c[0] === 'order')[1].where
    assert.equal(order.organizationId, 'org-a')
    assert.equal(order.supplierId, 's1')
    assert.equal(order.projectId, 'p1')
    assert.ok(order.status.in.includes('received'))
    assert.ok(!order.status.in.includes('draft'))
    assert.equal(f.records[0].reason, 'Reviewed material failure')
    assert.equal(f.records[0].createdBy, 'u1')
    assert.equal(f.records[0].organizationId, 'org-a')
    assert.equal(f.records[0].projectId, 'p1')
    assert.equal(f.records[0][sourceType === 'snag' ? 'inspectionId' : 'snagId'], null)
    assert.equal(f.audits[0].action, 'supplier.quality.link')
    assert.equal(f.audits[0].resourceId, result.body.id)
    assert.equal(f.audits[0].metadata.reason, f.records[0].reason)
  }
})

test('foreign or missing records, duplicate evidence and concurrent record changes never create history', async () => {
  for (const options of [{ supplier: null }, { source: null }, { order: null }]) {
    const f = fixture(options)
    assert.equal((await f.post({ sourceType: 'snag', sourceId: 'sn1', purchaseOrderId: 'po1', reason: 'Reviewed failure' })).status, 404)
    assert.equal(f.records.length, 0)
    assert.equal(f.audits.length, 0)
  }
  for (const createError of ['P2002', 'P2003', 'P2034']) {
    const f = fixture({ createError })
    assert.equal((await f.post()).status, 409)
    assert.equal(f.audits.length, 0)
  }
  const f = fixture({ auditError: true })
  assert.equal((await f.post()).status, 500)
  assert.equal(f.records.length, 0)
})

test('withdrawal retains attribution and source fields and cannot overwrite a prior withdrawal', async () => {
  const f = fixture()
  assert.equal((await f.withdraw()).status, 200)
  const update = f.calls.find(c => c[0] === 'withdraw')[1]
  assert.equal(update.where.organizationId, 'org-a')
  assert.equal(update.where.supplierId, 's1')
  assert.equal(update.where.id, 'e1')
  assert.equal(update.where.withdrawnAt, null)
  assert.deepEqual(Object.keys(update.data).sort(), ['withdrawalReason', 'withdrawnAt', 'withdrawnBy'])
  assert.equal(update.data.withdrawalReason, 'Source attributed incorrectly')
  assert.equal(update.data.withdrawnBy, 'u1')
  assert.equal(f.audits[0].action, 'supplier.quality.withdraw')
  assert.equal((await fixture({ record: null }).withdraw()).status, 404)
  const prior = fixture({ record: { withdrawnAt: new Date() } })
  assert.equal((await prior.withdraw()).status, 409)
  assert.equal(prior.calls.some(c => c[0] === 'withdraw'), false)
  const concurrent = fixture({ updatedCount: 0 })
  assert.equal((await concurrent.withdraw()).status, 409)
  assert.equal(concurrent.audits.length, 0)
})

test('source search is tenant/project scoped, excludes all prior attributions, and discloses bounded results', async () => {
  const f = fixture({ sources: Array.from({ length: 26 }, (_, i) => ({ id: String(i) })), orders: Array.from({ length: 101 }, (_, i) => ({ id: String(i) })) })
  const response = await f.sources('?sourceType=inspection&q=panel')
  assert.equal(response.status, 200)
  assert.equal(response.body.sources.length, 25)
  assert.equal(response.body.purchaseOrders.length, 100)
  assert.equal(response.body.truncated, true)
  assert.equal(response.body.ordersTruncated, true)
  assert.equal(response.headers['Cache-Control'], 'private, no-store')
  const sources = f.calls.find(c => c[0] === 'inspections')[1].where
  assert.equal(sources.organizationId, 'org-a')
  assert.equal(sources.project.organizationId, 'org-a')
  assert.equal(sources.type, 'quality')
  assert.equal(sources.supplierQualityEvidence.none.supplierId, 's1')
  assert.equal(sources.supplierQualityEvidence.none.organizationId, 'org-a')
  assert.equal(sources.supplierQualityEvidence.none.withdrawnAt, undefined)
  assert.equal(sources.title.contains, 'panel')
  const order = f.calls.find(c => c[0] === 'orders')[1].where
  assert.equal(order.organizationId, 'org-a')
  assert.equal(order.project.organizationId, 'org-a')
  assert.equal(order.supplierId, 's1')
  assert.equal((await fixture({ supplier: null }).sources()).status, 404)
})
