/**
 * Explicit org gate for Batch 2 group 2B (issue #322).
 *
 * The 52 field-ops / safety / people / site routes converted in this batch
 * used to call `requireAuth()` only, which establishes the org context as a
 * side effect but does not error for org-less users — the Prisma tenancy
 * extension then failed closed with a 500. They now call `requireOrg()` and
 * unwrap the session (`const auth = org.session`), so org-less users get
 * 403 { error: 'No organization', code: 'NO_ORG' } instead of a 500, and
 * nothing changes for users who have an org.
 *
 * One exception: `app/api/events/stream/route.ts` (SSE) unwraps as
 * `const session = org.session` because its handler already used the name
 * `session` downstream. The gate still closes the stream with 403 for
 * org-less users before any stream is created — previously they got an
 * `error` event every 5s forever.
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

const GROUP2B_ROUTES = [
  'app/api/action-plans/[id]/route.ts',
  'app/api/action-plans/route.ts',
  'app/api/apprentice/[id]/route.ts',
  'app/api/apprentice/route.ts',
  'app/api/carbon/[id]/route.ts',
  'app/api/carbon/route.ts',
  'app/api/conflicts/[id]/route.ts',
  'app/api/conflicts/route.ts',
  'app/api/developer-api/[id]/route.ts',
  'app/api/developer-api/route.ts',
  'app/api/events/stream/route.ts',
  'app/api/holiday/[id]/route.ts',
  'app/api/holiday/route.ts',
  'app/api/infrastructure/[id]/route.ts',
  'app/api/infrastructure/route.ts',
  'app/api/inspections/[id]/route.ts',
  'app/api/inspections/route.ts',
  'app/api/live-status/route.ts',
  'app/api/maintenance/[id]/route.ts',
  'app/api/maintenance/route.ts',
  'app/api/meetings/[id]/route.ts',
  'app/api/meetings/route.ts',
  'app/api/mileage/[id]/route.ts',
  'app/api/mileage/route.ts',
  'app/api/milestones/[id]/route.ts',
  'app/api/milestones/route.ts',
  'app/api/observations/[id]/route.ts',
  'app/api/observations/route.ts',
  'app/api/performance/[id]/route.ts',
  'app/api/performance/route.ts',
  'app/api/permits/[id]/route.ts',
  'app/api/permits/route.ts',
  'app/api/personas/[id]/route.ts',
  'app/api/personas/route.ts',
  'app/api/photos/compare/route.ts',
  'app/api/rams/[id]/route.ts',
  'app/api/rams/generate/route.ts',
  'app/api/rams/route.ts',
  'app/api/reminders/[id]/route.ts',
  'app/api/reminders/route.ts',
  'app/api/reviews/[id]/route.ts',
  'app/api/reviews/route.ts',
  'app/api/risks/[id]/route.ts',
  'app/api/risks/route.ts',
  'app/api/safety/[id]/actions/[actionId]/route.ts',
  'app/api/safety/[id]/actions/route.ts',
  'app/api/safety/[id]/route.ts',
  'app/api/schedule/route.ts',
  'app/api/toolbox-talks/[id]/route.ts',
  'app/api/toolbox-talks/route.ts',
  'app/api/waste/[id]/route.ts',
  'app/api/waste/route.ts',
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

// Fake timers for the SSE route: the stream registers a 5s poll and a 25s
// keep-alive. Real timers would keep the test runner alive forever, so the
// sandbox records registrations instead of scheduling anything.
let intervalCalls = []

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
    // events/stream checks `org instanceof Response`; the mock
    // NextResponse must be the same class the sandbox sees as Response.
    Response: MockResponse,
    ReadableStream,
    TextEncoder,
    setInterval: (fn, ms) => {
      intervalCalls.push(ms)
      return intervalCalls.length
    },
    clearInterval: () => {},
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
    // Batch 3 wrapped the write handlers of some 2B routes in withRoute.
    // The mock mirrors lib/withRoute.ts gate order (org check, then
    // permission check, then the handler), using the REAL permission
    // helpers from lib/rbac.ts. GET handlers still use requireOrg
    // (mocked via orgResult), so this only fires for writes.
    '@/lib/withRoute': { withRoute: mockWithRoute },
    '@/lib/errors': { reportError: () => {} },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/tenancy': {
      getCurrentOrg: () => ({ organizationId: 'org-1' }),
      setOrgContext: () => {},
      runWithOrg: async (_ctx, fn) => fn(),
    },
  }
}

// Real permission helpers from lib/rbac.ts (no imports of its own).
const rbac = loadRoute('lib/rbac.ts', {})
const { canWrite, canManage } = rbac

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
    return handler({ ...ctx, req })
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
    signal: { addEventListener: () => {} },
    __ctx: ctx,
  }
}

test('group 2B routes all use requireOrg and none still call requireAuth', () => {
  assert.equal(GROUP2B_ROUTES.length, 52, 'group 2B covers 52 routes')
  for (const rel of GROUP2B_ROUTES) {
    const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
    // Batch 3 (RBAC) moved some write handlers from requireOrg() to
    // withRoute({ permission: 'write' }); either is an org gate.
    assert.ok(src.includes('requireOrg') || src.includes('withRoute'),
      `${rel} should gate on an org (requireOrg or withRoute)`)
    assert.ok(!src.includes('await requireAuth()'), `${rel} should not call requireAuth`)
    if (src.includes('requireOrg')) {
      assert.ok(src.includes('org.session'), `${rel} should unwrap org.session`)
    }
    assert.ok(!src.includes("@/lib/requireOrg"), `${rel} must import from '@/lib/requireAuth', not '@/lib/requireOrg'`)
  }
})

test('waste GET: org-less user gets 403 NO_ORG and no DB call', async () => {
  const calls = []
  const prisma = {
    wasteEntry: {
      findMany: async () => {
        calls.push('wasteEntry.findMany')
        return []
      },
      count: async () => {
        calls.push('wasteEntry.count')
        return 0
      },
    },
  }
  const route = loadRoute('app/api/waste/route.ts', routeMocks({ orgResult: orgLessResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/waste'))
  assert.equal(res.status, 403)
  assert.equal(res.body.code, 'NO_ORG')
  assert.deepEqual(calls, [])
})

test('waste GET: user with an org gets 200 and the waste entries', async () => {
  const prisma = {
    wasteEntry: {
      findMany: async () => [{ id: 'waste-1', wasteType: 'concrete' }],
      count: async () => 1,
    },
  }
  const route = loadRoute('app/api/waste/route.ts', routeMocks({ orgResult: withOrgResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/waste'))
  assert.equal(res.status, 200)
  assert.equal(res.body.total, 1)
  assert.equal(res.body.items[0].wasteType, 'concrete')
  assert.equal(res.body.hasMore, false)
})

test('waste POST: org-less user gets 400, viewer gets 403, no entry is created', async () => {
  const calls = []
  const prisma = {
    wasteEntry: {
      create: async () => {
        calls.push('wasteEntry.create')
        return { id: 'waste-1' }
      },
    },
  }
  const route = loadRoute('app/api/waste/route.ts', routeMocks({ orgResult: orgLessResult(), prisma }))
  // Batch 3 wrapped this write in withRoute({ permission: 'write' }), so
  // the org/role gate now runs in the wrapper instead of requireOrg():
  // no org -> 400, viewer -> 403, member -> 201.
  const noOrg = await route.POST(fakeReq('http://localhost/api/waste', { wasteType: 'concrete', weightKg: 120 }, ctxFor('member', null)))
  assert.equal(noOrg.status, 400)
  const viewer = await route.POST(fakeReq('http://localhost/api/waste', { wasteType: 'concrete', weightKg: 120 }, ctxFor('viewer')))
  assert.equal(viewer.status, 403)
  const member = await route.POST(fakeReq('http://localhost/api/waste', { wasteType: 'concrete', weightKg: 120 }, ctxFor('member')))
  assert.equal(member.status, 201)
  assert.deepEqual(calls, ['wasteEntry.create'])
})

test('meetings GET: org-less user gets 403 NO_ORG and no DB call', async () => {
  const calls = []
  const prisma = {
    meeting: {
      findMany: async () => {
        calls.push('meeting.findMany')
        return []
      },
      count: async () => {
        calls.push('meeting.count')
        return 0
      },
    },
  }
  const route = loadRoute('app/api/meetings/route.ts', routeMocks({ orgResult: orgLessResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/meetings'))
  assert.equal(res.status, 403)
  assert.equal(res.body.code, 'NO_ORG')
  assert.deepEqual(calls, [])
})

test('risks GET: user with an org gets 200, the risks and the counts', async () => {
  const prisma = {
    risk: {
      findMany: async () => [{ id: 'risk-1', title: 'Crane lift', status: 'open', score: 12 }],
      count: async () => 1,
    },
  }
  const route = loadRoute('app/api/risks/route.ts', routeMocks({ orgResult: withOrgResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/risks'))
  assert.equal(res.status, 200)
  assert.equal(res.body.risks.length, 1)
  assert.equal(res.body.risks[0].title, 'Crane lift')
  assert.equal(res.body.openCount, 1)
  assert.equal(res.body.highSeverityCount, 1)
})

test('schedule GET: org-less user gets 403 NO_ORG and no DB call', async () => {
  const calls = []
  const prisma = {
    task: {
      findMany: async () => {
        calls.push('task.findMany')
        return []
      },
    },
    project: {
      findMany: async () => {
        calls.push('project.findMany')
        return []
      },
    },
  }
  const route = loadRoute('app/api/schedule/route.ts', routeMocks({ orgResult: orgLessResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/schedule'))
  assert.equal(res.status, 403)
  assert.equal(res.body.code, 'NO_ORG')
  assert.deepEqual(calls, [])
})

test('action-plans GET: org-less user gets 403 NO_ORG and no DB call', async () => {
  const calls = []
  const prisma = {
    actionPlan: {
      findMany: async () => {
        calls.push('actionPlan.findMany')
        return []
      },
      count: async () => {
        calls.push('actionPlan.count')
        return 0
      },
    },
  }
  const route = loadRoute('app/api/action-plans/route.ts', routeMocks({ orgResult: orgLessResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/action-plans'))
  assert.equal(res.status, 403)
  assert.equal(res.body.code, 'NO_ORG')
  assert.deepEqual(calls, [])
})

test('permits GET: user with an org gets 200, the permits and the counts', async () => {
  const prisma = {
    permit: {
      findMany: async () => [{ id: 'permit-1', type: 'hot_work', status: 'active' }],
      count: async () => 1,
    },
  }
  const route = loadRoute('app/api/permits/route.ts', routeMocks({ orgResult: withOrgResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/permits'))
  assert.equal(res.status, 200)
  assert.equal(res.body.permits.length, 1)
  assert.equal(res.body.permits[0].type, 'hot_work')
  assert.equal(res.body.activeCount, 1)
  assert.equal(res.body.expiringSoon, 1)
})

test('events/stream GET: org-less user gets 403 NO_ORG, no stream starts, no DB call', async () => {
  intervalCalls = []
  const calls = []
  const prisma = {
    activity: {
      findMany: async () => {
        calls.push('activity.findMany')
        return []
      },
    },
  }
  const route = loadRoute('app/api/events/stream/route.ts', routeMocks({ orgResult: orgLessResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/events/stream'))
  assert.equal(res.status, 403)
  assert.equal(res.body.code, 'NO_ORG')
  assert.deepEqual(intervalCalls, [])
  assert.deepEqual(calls, [])
})

test('events/stream GET: user with an org gets a 200 SSE stream and no DB call yet', async () => {
  intervalCalls = []
  const calls = []
  const prisma = {
    activity: {
      findMany: async () => {
        calls.push('activity.findMany')
        return []
      },
    },
  }
  const route = loadRoute('app/api/events/stream/route.ts', routeMocks({ orgResult: withOrgResult(), prisma }))
  const res = await route.GET(fakeReq('http://localhost/api/events/stream'))
  assert.equal(res.status, 200)
  assert.equal(res.headers['Content-Type'], 'text/event-stream')
  // The poll (5s) and keep-alive (25s) timers are registered: the stream
  // actually started instead of closing with an error event loop.
  assert.deepEqual(intervalCalls, [5000, 25000])
  // The poll never fires in the test, so no activity query has run yet.
  assert.deepEqual(calls, [])
})
