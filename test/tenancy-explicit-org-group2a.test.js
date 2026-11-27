/**
 * Explicit org gate for Batch 2 group 2A (issue #322).
 *
 * The 45 finance / procurement / commercial / shared routes converted in
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

const GROUP2A_ROUTES = [
  'app/api/activity/route.ts',
  'app/api/announcements/[id]/route.ts',
  'app/api/announcements/route.ts',
  'app/api/bookmarks/route.ts',
  'app/api/claims/[id]/route.ts',
  'app/api/claims/route.ts',
  'app/api/comments/[id]/route.ts',
  'app/api/conversations/[id]/messages/route.ts',
  'app/api/conversations/[id]/route.ts',
  'app/api/conversations/route.ts',
  'app/api/cost-catalog/[id]/route.ts',
  'app/api/cost-catalog/route.ts',
  'app/api/currency/[id]/route.ts',
  'app/api/currency/route.ts',
  'app/api/export/[type]/route.ts',
  'app/api/forms/[id]/route.ts',
  'app/api/forms/route.ts',
  'app/api/goals/[id]/route.ts',
  'app/api/goals/route.ts',
  'app/api/kaizen-board/[id]/route.ts',
  'app/api/kaizen-board/route.ts',
  'app/api/leads/[id]/route.ts',
  'app/api/leads/route.ts',
  'app/api/materials/[id]/route.ts',
  'app/api/materials/route.ts',
  'app/api/pos/[id]/pdf/route.ts',
  'app/api/receipts/[id]/route.ts',
  'app/api/receipts/analyze/route.ts',
  'app/api/receipts/route.ts',
  'app/api/reports/route.ts',
  'app/api/saved-views/[id]/route.ts',
  'app/api/saved-views/route.ts',
  'app/api/search/route.ts',
  'app/api/service-catalog/[id]/route.ts',
  'app/api/service-catalog/route.ts',
  'app/api/sub-portal/[id]/route.ts',
  'app/api/sub-portal/route.ts',
  'app/api/subs/[id]/route.ts',
  'app/api/subs/route.ts',
  'app/api/tags/[id]/route.ts',
  'app/api/tags/route.ts',
  'app/api/templates/[id]/route.ts',
  'app/api/templates/route.ts',
  'app/api/variations/[id]/route.ts',
  'app/api/variations/route.ts',
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
    // export/[type] checks `org instanceof Response`; the mock
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
    // Batch 3 wrapped the write handlers of some 2A routes in withRoute.
    // The mock mirrors lib/withRoute.ts gate order (org check, then
    // permission check, then the handler), using the REAL permission
    // helpers from lib/rbac.ts. GET handlers still use requireOrg
    // (mocked via orgResult), so this only fires for writes.
    '@/lib/withRoute': { withRoute: mockWithRoute },
    '@/lib/errors': { reportError: () => {} },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/tenancy': { getCurrentOrg: () => ({ organizationId: 'org-1' }) },
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

test('group 2A routes all use requireOrg and none still call requireAuth', () => {
  assert.equal(GROUP2A_ROUTES.length, 45, 'group 2A covers 45 routes')
  for (const rel of GROUP2A_ROUTES) {
    const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
    // Batch 3 (RBAC) moved some write handlers from requireOrg() to
    // withRoute({ permission: 'write' }); either is an org gate.
    assert.ok(src.includes('requireOrg') || src.includes('withRoute'),
      `${rel} should gate on an org (requireOrg or withRoute)`)
    assert.ok(!src.includes('await requireAuth()'), `${rel} should not call requireAuth`)
    if (src.includes('requireOrg')) {
      assert.ok(src.includes('const auth = org.session'), `${rel} should unwrap org.session`)
    }
    assert.ok(!src.includes("@/lib/requireOrg"), `${rel} must import from '@/lib/requireAuth', not '@/lib/requireOrg'`)
  }
})

test('tags GET: org-less user gets 403 NO_ORG and no DB call', async () => {
  const calls = []
  const prisma = {
    tag: {
      findMany: async () => {
        calls.push('tag.findMany')
        return []
      },
      count: async () => {
        calls.push('tag.count')
        return 0
      },
    },
  }
  const route = loadRoute('app/api/tags/route.ts', routeMocks({ orgResult: orgLessResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/tags'))
  assert.equal(res.status, 403)
  assert.equal(res.body.code, 'NO_ORG')
  assert.deepEqual(calls, [])
})

test('tags GET: user with an org gets 200 and the tags', async () => {
  const prisma = {
    tag: {
      findMany: async () => [{ id: 'tag-1', name: 'Urgent' }],
      count: async () => 1,
    },
  }
  const route = loadRoute('app/api/tags/route.ts', routeMocks({ orgResult: withOrgResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/tags'))
  assert.equal(res.status, 200)
  assert.equal(res.body.total, 1)
  assert.equal(res.body.items[0].name, 'Urgent')
  assert.equal(res.body.hasMore, false)
})

test('tags POST: org-less user gets 400, viewer gets 403, no tag is created', async () => {
  const calls = []
  const prisma = {
    tag: {
      create: async () => {
        calls.push('tag.create')
        return { id: 'tag-1' }
      },
    },
  }
  const route = loadRoute('app/api/tags/route.ts', routeMocks({ orgResult: orgLessResult(), prisma }))
  // Batch 3 wrapped this write in withRoute({ permission: 'write' }), so
  // the org/role gate now runs in the wrapper instead of requireOrg():
  // no org -> 400, viewer -> 403, member -> 201.
  const noOrg = await route.POST(fakeReq('http://localhost/api/tags', { name: 'Urgent' }, ctxFor('member', null)))
  assert.equal(noOrg.status, 400)
  const viewer = await route.POST(fakeReq('http://localhost/api/tags', { name: 'Urgent' }, ctxFor('viewer')))
  assert.equal(viewer.status, 403)
  const member = await route.POST(fakeReq('http://localhost/api/tags', { name: 'Urgent' }, ctxFor('member')))
  assert.equal(member.status, 201)
  assert.deepEqual(calls, ['tag.create'])
})

test('leads GET: org-less user gets 403 NO_ORG and no DB call', async () => {
  const calls = []
  const prisma = {
    lead: {
      findMany: async () => {
        calls.push('lead.findMany')
        return []
      },
      count: async () => {
        calls.push('lead.count')
        return 0
      },
      aggregate: async () => {
        calls.push('lead.aggregate')
        return { _sum: { value: null } }
      },
    },
  }
  const route = loadRoute('app/api/leads/route.ts', routeMocks({ orgResult: orgLessResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/leads'))
  assert.equal(res.status, 403)
  assert.equal(res.body.code, 'NO_ORG')
  assert.deepEqual(calls, [])
})

test('leads GET: user with an org gets 200, the leads and the pipeline value', async () => {
  const prisma = {
    lead: {
      findMany: async () => [{ id: 'lead-1', name: 'Acme', status: 'new', value: 5000 }],
      count: async () => 1,
      aggregate: async () => ({ _sum: { value: 5000 } }),
    },
  }
  const route = loadRoute('app/api/leads/route.ts', routeMocks({ orgResult: withOrgResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/leads'))
  assert.equal(res.status, 200)
  assert.equal(res.body.leads.length, 1)
  assert.equal(res.body.leads[0].name, 'Acme')
  assert.equal(res.body.openCount, 1)
  assert.equal(res.body.pipelineValue, 5000)
})

test('materials GET: org-less user gets 403 NO_ORG and no DB call', async () => {
  const calls = []
  const prisma = {
    material: {
      findMany: async () => {
        calls.push('material.findMany')
        return []
      },
    },
    $queryRaw: async () => {
      calls.push('$queryRaw')
      return [{ count: 0n }]
    },
  }
  const route = loadRoute('app/api/materials/route.ts', routeMocks({ orgResult: orgLessResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/materials'))
  assert.equal(res.status, 403)
  assert.equal(res.body.code, 'NO_ORG')
  assert.deepEqual(calls, [])
})

test('bookmarks POST: org-less user gets 400, viewer gets 403, no project lookup happens', async () => {
  const calls = []
  const prisma = {
    project: {
      findFirst: async () => {
        calls.push('project.findFirst')
        return { id: 'proj-1' }
      },
    },
    projectBookmark: {
      upsert: async () => ({ id: 'bm-1', project: { id: 'proj-1', name: 'Site' } }),
    },
  }
  const route = loadRoute('app/api/bookmarks/route.ts', routeMocks({ orgResult: orgLessResult(), prisma }))
  // Batch 3 wrapped this write in withRoute({ permission: 'write' }).
  const noOrg = await route.POST(fakeReq('http://localhost/api/bookmarks', { projectId: 'proj-1' }, ctxFor('member', null)))
  assert.equal(noOrg.status, 400)
  const viewer = await route.POST(fakeReq('http://localhost/api/bookmarks', { projectId: 'proj-1' }, ctxFor('viewer')))
  assert.equal(viewer.status, 403)
  const member = await route.POST(fakeReq('http://localhost/api/bookmarks', { projectId: 'proj-1' }, ctxFor('member')))
  assert.equal(member.status, 200)
  assert.deepEqual(calls, ['project.findFirst'])
})

test('goals GET: user with an org gets 200 and the goals', async () => {
  const prisma = {
    goal: {
      findMany: async () => [{ id: 'goal-1', title: 'Zero defects' }],
      count: async () => 1,
    },
  }
  const route = loadRoute('app/api/goals/route.ts', routeMocks({ orgResult: withOrgResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/goals'))
  assert.equal(res.status, 200)
  assert.equal(res.body.total, 1)
  assert.equal(res.body.items[0].title, 'Zero defects')
  assert.equal(res.body.hasMore, false)
})
