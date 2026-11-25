const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

class NextResponse {
  constructor(body, status) { this.body = body; this.status = status }
  static json(body, options = {}) { return new NextResponse(body, options.status || 200) }
}

function load(file, mocks) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  vm.runInNewContext(code, {
    exports,
    require: name => {
      if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`)
      return mocks[name]
    },
    Date, URL, Response,
  })
  return exports
}

const { canManage } = load('lib/rbac.ts', {})

function fixture(role = 'admin', options = {}) {
  const calls = []
  const rateCalls = []
  const record = (name, result) => async args => {
    calls.push({ name, args })
    return typeof result === 'function' ? result(args) : result
  }
  const prisma = {
    payrollRun: {
      findMany: record('payroll.findMany', []),
      count: record('payroll.count', 0),
      create: record('payroll.create', args => ({ id: 'payroll-1', ...args.data })),
      findUnique: record('payroll.findUnique', { id: 'payroll-1' }),
      update: record('payroll.update', args => ({ id: args.where.id, ...args.data })),
      delete: record('payroll.delete', { id: 'payroll-1' }),
    },
    subInvoice: { findMany: record('subInvoice.findMany', []) },
    cis300Return: {
      findMany: record('cis300.findMany', []),
      count: record('cis300.count', 0),
      findFirst: record('cis300.findFirst', null),
      findUnique: record('cis300.findUnique', { id: 'cis-1', status: 'draft' }),
      create: record('cis300.create', args => ({ id: 'cis-1', ...args.data })),
      update: record('cis300.update', args => ({ id: args.where.id, ...args.data })),
      delete: record('cis300.delete', { id: 'cis-1' }),
    },
  }
  const auth = options.auth ?? { role, userId: 'user-1', orgId: 'org-1' }
  const mocks = {
    'next/server': { NextResponse },
    '@/lib/db': { prisma },
    '@/lib/requireAuth': { requireOrg: async () => auth },
    '@/lib/rbac': { canManage },
    '@/lib/rateLimit': { enforceRateLimit: async (req, action, userId) => {
      rateCalls.push({ action, userId })
      return options.limited ? { status: 429 } : null
    } },
    '@/lib/errors': { reportError: () => {} },
    '@/lib/audit': { auditLog: () => {} },
  }
  return {
    calls,
    rateCalls,
    payroll: load('app/api/payroll/route.ts', mocks),
    cis300: load('app/api/cis300/route.ts', mocks),
    payrollItem: load('app/api/payroll/[id]/route.ts', mocks),
    cis300Item: load('app/api/cis300/[id]/route.ts', mocks),
    cis300Export: load('app/api/cis300/[id]/export/route.ts', mocks),
  }
}

function getRequest() {
  return { nextUrl: new URL('https://example.test/api/financial-records') }
}

function postRequest(body = {}) {
  return { json: async () => body }
}

const routes = ['payroll', 'cis300']

test('payroll and CIS300 reads and writes deny non-admin members before touching data', async () => {
  for (const role of ['member', 'viewer']) {
    const f = fixture(role)
    for (const name of routes) {
      assert.equal((await f[name].GET(getRequest())).status, 403, `${role} GET ${name}`)
      assert.equal((await f[name].POST(postRequest({ taxMonth: '2026-11-06' }))).status, 403, `${role} POST ${name}`)
    }
    assert.equal(f.calls.length, 0)
    assert.equal(f.rateCalls.length, 0)
  }
})

test('payroll and CIS300 item routes deny non-admin reads and writes before touching data', async () => {
  for (const role of ['member', 'viewer']) {
    const f = fixture(role)
    const context = { params: Promise.resolve({ id: 'record-1' }) }
    for (const name of ['payrollItem', 'cis300Item']) {
      assert.equal((await f[name].GET(getRequest(), context)).status, 403, `${role} GET ${name}`)
      assert.equal((await f[name].PUT(postRequest({ status: 'submitted' }), context)).status, 403, `${role} PUT ${name}`)
      assert.equal((await f[name].DELETE(getRequest(), context)).status, 403, `${role} DELETE ${name}`)
    }
    assert.equal((await f.cis300Export.GET(getRequest(), context)).status, 403, `${role} GET CIS300 export`)
    assert.equal(f.calls.length, 0)
    assert.equal(f.rateCalls.length, 0)
  }
})

test('payroll and CIS300 item routes preserve access for organization admins and owners', async () => {
  for (const role of ['admin', 'owner']) {
    const f = fixture(role)
    const context = { params: Promise.resolve({ id: 'record-1' }) }
    for (const name of ['payrollItem', 'cis300Item']) {
      assert.equal((await f[name].GET(getRequest(), context)).status, 200, `${role} GET ${name}`)
      assert.equal((await f[name].PUT(postRequest({ status: 'submitted' }), context)).status, 200, `${role} PUT ${name}`)
      assert.equal((await f[name].DELETE(getRequest(), context)).status, 200, `${role} DELETE ${name}`)
    }
    assert.equal((await f.cis300Export.GET(getRequest(), context)).status, 200, `${role} GET CIS300 export`)
    assert.equal(f.rateCalls.length, 4)
  }
})

test('payroll and CIS300 preserve access for organization admins and owners', async () => {
  for (const role of ['admin', 'owner']) {
    const f = fixture(role)
    assert.equal((await f.payroll.GET(getRequest())).status, 200)
    assert.equal((await f.payroll.POST(postRequest({ grossTotal: 100 }))).status, 201)
    assert.equal((await f.cis300.GET(getRequest())).status, 200)
    assert.equal((await f.cis300.POST(postRequest({ taxMonth: '2026-11-06' }))).status, 201)
    assert.equal(f.calls.length, 8)
    assert.deepEqual(f.rateCalls.map(call => call.userId), ['user-1', 'user-1'])
  }
})

test('unauthenticated requests and requests without an organization fail before querying financial records', async () => {
  for (const status of [401, 403]) {
    const f = fixture('admin', { auth: new NextResponse({ error: 'Unauthorized' }, status) })
    for (const name of routes) {
      assert.equal((await f[name].GET(getRequest())).status, status)
      assert.equal((await f[name].POST(postRequest({ taxMonth: '2026-11-06' }))).status, status)
    }
    assert.equal(f.calls.length, 0)
    assert.equal(f.rateCalls.length, 0)
  }
})

test('financial write endpoints still apply rate limits after authorization', async () => {
  const f = fixture('admin', { limited: true })
  assert.equal((await f.payroll.POST(postRequest({}))).status, 429)
  assert.equal((await f.cis300.POST(postRequest({ taxMonth: '2026-11-06' }))).status, 429)
  assert.equal(f.calls.length, 0)
  assert.equal(f.rateCalls.length, 2)
})
