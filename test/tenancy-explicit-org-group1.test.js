/**
 * Explicit org gate for Batch 2 group 1 (issue #322).
 *
 * The 19 Project / Task / Invoice / Customer / Snag routes converted in
 * this batch used to call `requireAuth()` only, which establishes the org
 * context as a side effect but does not error for org-less users — the
 * Prisma tenancy extension then failed closed with a 500. They now call
 * `requireOrg()` and unwrap the session (`const auth = org.session`), so
 * org-less users get 403 { error: 'No organization', code: 'NO_ORG' }
 * instead of a 500, and nothing changes for users who have an org.
 *
 * Loaded the same way as other route tests in this repo (see
 * test/seed-route-production-guard.test.js): the route source is
 * transpiled with the TypeScript compiler and run in a vm with mocked
 * imports, so no real Prisma client or database is touched.
 *
 * Run with:  npm test
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const GROUP1_ROUTES = [
  'app/api/projects/[id]/route.ts',
  'app/api/projects/[id]/archive/route.ts',
  'app/api/projects/[id]/comments/route.ts',
  'app/api/projects/[id]/share-token/route.ts',
  'app/api/projects/[id]/programme/route.ts',
  'app/api/projects/[id]/programme/[activityId]/route.ts',
  'app/api/projects/[id]/programme/baselines/route.ts',
  'app/api/projects/[id]/programme/baselines/[baselineId]/route.ts',
  'app/api/projects/[id]/programme/delays/route.ts',
  'app/api/projects/[id]/programme/delays/[delayId]/route.ts',
  'app/api/projects/[id]/programme/dependencies/route.ts',
  'app/api/projects/[id]/programme/dependencies/[dependencyId]/route.ts',
  'app/api/tasks/[id]/comments/route.ts',
  'app/api/invoices/[id]/pdf/route.ts',
  'app/api/invoices/[id]/print/route.ts',
  'app/api/customers/route.ts',
  'app/api/customers/[id]/route.ts',
  'app/api/snags/[id]/analyze/route.ts',
  'app/api/sub-invoices/[id]/pdf/route.ts',
]

class MockResponse {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status || 200
    this.headers = init.headers || {}
  }
  static json(body, options = {}) {
    return new MockResponse(body, options)
  }
}

const SESSION = {
  user: {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'admin',
    organizations: [{ id: 'org-1', slug: 'org', name: 'Org', role: 'admin' }],
  },
}

function orgLessResult() {
  return MockResponse.json({ error: 'No organization', code: 'NO_ORG' }, { status: 403 })
}

function withOrgResult() {
  return {
    session: SESSION,
    userId: 'user-1',
    orgId: 'org-1',
    orgSlug: 'org',
    orgName: 'Org',
    role: 'admin',
    personaRole: 'admin',
  }
}

function loadRoute(relPath, mocks) {
  const code = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText
  const exports = {}
  vm.runInNewContext(code, {
    exports,
    module: { exports },
    require: name => {
      if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`)
      return mocks[name]
    },
    process,
    console,
    Date,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    JSON,
    Math,
    Promise,
    Error,
    RegExp,
    URL,
    // invoices/[id]/print checks `org instanceof Response`; the mock
    // NextResponse must be the same class the sandbox sees as Response.
    Response: MockResponse,
  })
  return exports
}

function routeMocks({ orgResult, prisma }) {
  return {
    'next/server': { NextResponse: MockResponse },
    '@/lib/db': { prisma },
    '@/lib/requireAuth': {
      requireOrg: async () => orgResult,
      actorName: session => session?.user?.name || 'User',
    },
    '@/lib/errors': { reportError: () => {} },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/audit': { auditLog: async () => {}, requestMeta: () => ({}) },
    // Batch 3 wrapped the write handlers of some group-1 routes in
    // withRoute. The mock mirrors lib/withRoute.ts gate order (org check,
    // then permission check, then the handler), using the REAL permission
    // helpers from lib/rbac.ts. GET handlers still use requireOrg
    // (mocked via orgResult), so this only fires for writes.
    '@/lib/withRoute': { withRoute: mockWithRoute },
    pdfkit: { default: class PDFDocument {} },
  }
}

// Real permission helpers from lib/rbac.ts (no imports of its own).
const rbac = loadRoute('lib/rbac.ts', {})
const { canWrite, canManage } = rbac

// Next.js decodes dynamic route params before the handler sees them; the
// mock mirrors that by decoding the request's id segment, so handlers
// under test read decoded ids from ctx.params. Malformed encodings keep
// the raw segment (they can never match a real id, so the lookup 404s).
function decodedParams(req) {
  const segment = req.nextUrl?.pathname.split('/').filter(Boolean)[2]
  if (segment === undefined) return {}
  let value = segment
  try { value = decodeURIComponent(segment) } catch { /* keep the raw segment on malformed encoding */ }
  return { id: value, markupId: value, revisionId: value }
}

function mockWithRoute(handler, { requireOrg = true, permission = 'read' } = {}) {
  return async req => {
    const ctx = req.__ctx
    if (requireOrg && (!ctx || !ctx.orgId)) {
      return MockResponse.json({ error: 'Organisation context required' }, { status: 400 })
    }
    if (permission === 'write' && (!ctx.role || !canWrite(ctx.role))) {
      return MockResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (permission === 'manage' && (!ctx.role || !canManage(ctx.role))) {
      return MockResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return handler({ ...ctx, req, params: decodedParams(req) })
  }
}

function ctxFor(role, orgId = 'org-1') {
  return {
    session: SESSION,
    userId: 'user-1',
    orgId,
    orgSlug: 'org',
    orgName: 'Org',
    role,
    personaRole: 'admin',
  }
}

function fakeReq(url, jsonBody, ctx) {
  return {
    url,
    nextUrl: { pathname: new URL(url).pathname, searchParams: new URL(url).searchParams },
    json: async () => jsonBody || {},
    __ctx: ctx,
  }
}

test('group 1 routes all use requireOrg and none still call requireAuth', () => {
  for (const rel of GROUP1_ROUTES) {
    const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
    // Batch 3 (RBAC) moved some write handlers from requireOrg() to
    // withRoute({ permission: 'write' }); either is an org gate.
    assert.ok(src.includes('requireOrg') || src.includes('withRoute'),
      `${rel} should gate on an org (requireOrg or withRoute)`)
    assert.ok(!src.includes('await requireAuth()'), `${rel} should not call requireAuth`)
    if (src.includes('requireOrg')) {
      assert.ok(src.includes('const auth = org.session'), `${rel} should unwrap org.session`)
    }
  }
})

test('projects comments GET: org-less user gets 403 NO_ORG and no DB call', async () => {
  const calls = []
  const prisma = {
    comment: {
      findMany: async () => {
        calls.push('comment.findMany')
        return []
      },
    },
  }
  const route = loadRoute('app/api/projects/[id]/comments/route.ts', routeMocks({ orgResult: orgLessResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/projects/proj-1/comments'), { params: Promise.resolve({ id: 'proj-1' }) })
  assert.equal(res.status, 403)
  assert.equal(res.body.code, 'NO_ORG')
  assert.deepEqual(calls, [])
})

test('projects comments GET: user with an org gets 200 and the comments', async () => {
  const prisma = {
    comment: {
      findMany: async () => [{ id: 'c-1', body: 'hello' }],
    },
  }
  const route = loadRoute('app/api/projects/[id]/comments/route.ts', routeMocks({ orgResult: withOrgResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/projects/proj-1/comments'), { params: Promise.resolve({ id: 'proj-1' }) })
  assert.equal(res.status, 200)
  assert.equal(res.body.comments.length, 1)
})

test('customers GET: org-less user gets 403 NO_ORG and no DB call', async () => {
  const calls = []
  const prisma = {
    customer: {
      findMany: async () => {
        calls.push('customer.findMany')
        return []
      },
      count: async () => {
        calls.push('customer.count')
        return 0
      },
    },
  }
  const route = loadRoute('app/api/customers/route.ts', routeMocks({ orgResult: orgLessResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/customers'))
  assert.equal(res.status, 403)
  assert.equal(res.body.code, 'NO_ORG')
  assert.deepEqual(calls, [])
})

test('customers GET: user with an org gets 200 and the customers', async () => {
  const prisma = {
    customer: {
      findMany: async () => [{ id: 'cust-1', name: 'Acme' }],
      count: async () => 1,
    },
  }
  const route = loadRoute('app/api/customers/route.ts', routeMocks({ orgResult: withOrgResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/customers'))
  assert.equal(res.status, 200)
  assert.equal(res.body.total, 1)
  assert.equal(res.body.customers[0].name, 'Acme')
})

test('customers POST: org-less user gets 400, viewer gets 403, no customer is created', async () => {
  const calls = []
  const prisma = {
    customer: {
      create: async () => {
        calls.push('customer.create')
        return { id: 'cust-1' }
      },
    },
  }
  const route = loadRoute('app/api/customers/route.ts', routeMocks({ orgResult: orgLessResult(), prisma }))
  // Batch 3 wrapped this write in withRoute({ permission: 'write' }).
  const noOrg = await route.POST(fakeReq('http://localhost/api/customers', { name: 'Acme' }, ctxFor('member', null)))
  assert.equal(noOrg.status, 400)
  const viewer = await route.POST(fakeReq('http://localhost/api/customers', { name: 'Acme' }, ctxFor('viewer')))
  assert.equal(viewer.status, 403)
  const member = await route.POST(fakeReq('http://localhost/api/customers', { name: 'Acme' }, ctxFor('member')))
  assert.equal(member.status, 201)
  assert.deepEqual(calls, ['customer.create'])
})

test('invoices print GET: org-less user gets 403 NO_ORG and no DB call', async () => {
  const calls = []
  const prisma = {
    invoice: {
      findUnique: async () => {
        calls.push('invoice.findUnique')
        return null
      },
    },
  }
  const route = loadRoute('app/api/invoices/[id]/print/route.ts', routeMocks({ orgResult: orgLessResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/invoices/inv-1/print'), { params: Promise.resolve({ id: 'inv-1' }) })
  assert.equal(res.status, 403)
  assert.equal(res.body.code, 'NO_ORG')
  assert.deepEqual(calls, [])
})

test('invoices print GET: user with an org gets 200 and the invoice HTML', async () => {
  const prisma = {
    invoice: {
      findUnique: async () => ({
        id: 'inv-1',
        number: 'INV-001',
        clientName: 'Acme Ltd',
        status: 'sent',
        amount: 1200,
        netAmount: 1000,
        vatAmount: 200,
        vatRate: 20,
        issuedDate: '2026-11-01',
        dueDate: '2026-12-01',
        paidDate: null,
        notes: null,
        project: { name: 'Site A', address: '1 Main St', postcode: 'AB1 2CD' },
      }),
    },
  }
  const route = loadRoute('app/api/invoices/[id]/print/route.ts', routeMocks({ orgResult: withOrgResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/invoices/inv-1/print'), { params: Promise.resolve({ id: 'inv-1' }) })
  assert.equal(res.status, 200)
  assert.ok(String(res.body).includes('INV-001'))
  assert.ok(String(res.body).includes('Acme Ltd'))
})
