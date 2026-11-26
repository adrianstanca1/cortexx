/**
 * RBAC for Batch 3 group 3A (issue #322, approved role matrix).
 *
 * The write routes in this batch used to call `requireOrg()` only, which
 * proves the caller belongs to an org but not what they may do inside it —
 * any org member, including a viewer, could create, edit or delete. They
 * now wrap their write handlers in `withRoute({ permission: 'write' })`,
 * so a viewer gets 403 on writes while a member (and above) can write.
 *
 * The mock `withRoute` in this file mirrors the real wrapper in
 * lib/withRoute.ts: org check first (400 when requireOrg and no org),
 * then the permission check, then the handler — but the permission
 * helpers themselves are the REAL ones from lib/rbac.ts (canWrite /
 * canManage), loaded the same way as the routes, so the rank semantics
 * (write = member+, manage = admin+) are not re-implemented here.
 *
 * Loaded the same way as the Batch 2 route tests (see
 * test/tenancy-explicit-org-group2a.test.js): route source is transpiled
 * with the TypeScript compiler and run in a vm with mocked imports, so
 * no real Prisma client or database is touched.
 *
 * Run with:  npm test
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const GROUP3A_ROUTES = [
  'app/api/action-plans/[id]/route.ts',
  'app/api/action-plans/route.ts',
  'app/api/apprentice/[id]/route.ts',
  'app/api/apprentice/route.ts',
  'app/api/carbon/[id]/route.ts',
  'app/api/carbon/route.ts',
  'app/api/checkins/[id]/route.ts',
  'app/api/conflicts/[id]/route.ts',
  'app/api/conflicts/route.ts',
  'app/api/holiday/[id]/route.ts',
  'app/api/holiday/route.ts',
  'app/api/infrastructure/[id]/route.ts',
  'app/api/infrastructure/route.ts',
  'app/api/inspections/[id]/route.ts',
  'app/api/inspections/route.ts',
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
  'app/api/projects/[id]/archive/route.ts',
  'app/api/projects/[id]/programme/[activityId]/route.ts',
  'app/api/projects/[id]/programme/baselines/route.ts',
  'app/api/projects/[id]/programme/delays/[delayId]/route.ts',
  'app/api/projects/[id]/programme/delays/route.ts',
  'app/api/projects/[id]/programme/dependencies/[dependencyId]/route.ts',
  'app/api/projects/[id]/programme/dependencies/route.ts',
  'app/api/projects/[id]/programme/resources/[resourceId]/route.ts',
  'app/api/projects/[id]/programme/resources/route.ts',
  'app/api/projects/[id]/programme/route.ts',
  'app/api/rams/[id]/route.ts',
  'app/api/rams/generate/route.ts',
  'app/api/rams/route.ts',
  'app/api/reminders/[id]/route.ts',
  'app/api/reminders/route.ts',
  'app/api/reviews/[id]/route.ts',
  'app/api/reviews/route.ts',
  'app/api/risks/[id]/route.ts',
  'app/api/risks/route.ts',
  'app/api/snags/[id]/analyze/route.ts',
  'app/api/snags/[id]/route.ts',
  'app/api/tasks/[id]/comments/route.ts',
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

function loadModule(relPath, mocks) {
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
    Response: MockResponse,
  })
  return exports
}

// Real permission helpers from lib/rbac.ts (no imports of its own).
const rbac = loadModule('lib/rbac.ts', {})
const { canWrite, canManage } = rbac

// Mock withRoute mirroring lib/withRoute.ts gate order: org check, then
// permission check, then the handler. The test supplies the auth context
// on the request as __ctx (what the real wrapper derives from the session).
function mockWithRoute(handler, { requireOrg = true, permission = 'read' } = {}) {
  return async req => {
    const ctx = req.__ctx
    if (requireOrg && !ctx.orgId) {
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
    session: {
      user: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'operative',
        organizations: [{ id: orgId, slug: 'org', name: 'Org', role }],
      },
    },
    userId: 'user-1',
    orgId,
    orgSlug: 'org',
    orgName: 'Org',
    role,
    personaRole: 'operative',
  }
}

function loadRoute(relPath, prisma) {
  return loadModule(relPath, {
    'next/server': { NextResponse: MockResponse },
    '@prisma/client': { Prisma: {} },
    '@/lib/db': { prisma },
    '@/lib/requireAuth': {
      requireOrg: async () => { throw new Error('requireOrg must not be called in a withRoute write handler') },
      actorName: session => session?.user?.name || 'User',
    },
    '@/lib/withRoute': { withRoute: mockWithRoute },
    '@/lib/errors': { reportError: () => {} },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/tenancy': { getCurrentOrg: () => ({ organizationId: 'org-1' }) },
    '@/lib/audit': { auditLog: async () => {}, requestMeta: () => ({}) },
    '@/lib/programme-access': {
      canPlanProgramme: () => true,
      programmeProjectWhere: (id, session) => ({ id }),
    },
    '@/lib/programme-change-control': { normalizeDelayDays: d => d },
    '@/lib/file-access': {},
    '@/lib/upload-provenance': { authorizeUploadReference: async () => null },
    '@/lib/field-controls': { cleanText: s => s, sanitizeEvidence: e => e },
    '@/lib/quality-closeout': { snagCloseoutReadiness: () => ({ ready: true, missing: [] }) },
  })
}

function fakeReq(url, jsonBody, ctx) {
  const u = new URL(url)
  return {
    url,
    nextUrl: { pathname: u.pathname, searchParams: u.searchParams },
    headers: { get: () => null },
    json: async () => jsonBody || {},
    __ctx: ctx,
  }
}

test('group 3A routes all wrap writes in withRoute with permission write', () => {
  assert.equal(GROUP3A_ROUTES.length, 57, 'group 3A covers 57 routes')
  for (const rel of GROUP3A_ROUTES) {
    const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
    assert.ok(src.includes('withRoute'), `${rel} should use withRoute`)
    assert.ok(src.includes("permission: 'write'"), `${rel} should set permission 'write' on its writes`)
    assert.ok(!/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/.test(src),
      `${rel} should have no unwrapped write handler left`)
  }
})

test('projects POST is fixed from read to write and has no admin-only gate', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app/api/projects/route.ts'), 'utf8')
  const post = src.match(/export const POST = withRoute\([\s\S]*?\{ permission: '(read|write|manage)'/)
  assert.ok(post, 'projects POST should be a withRoute export with a permission')
  assert.equal(post[1], 'write', 'projects POST should be permission write')
  assert.ok(!src.includes('Company admin permission required to create projects'),
    'the inner admin-only project-create gate should be gone')
})

test('training writes require an org, training reads stay open', () => {
  for (const [rel, writes] of [
    ['app/api/training/route.ts', ['POST']],
    ['app/api/training/courses/route.ts', ['POST']],
    ['app/api/training/[id]/route.ts', ['PUT', 'DELETE']],
  ]) {
    const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
    for (const method of writes) {
      const m = src.match(new RegExp(`export const ${method} = withRoute\\([\\s\\S]*?\\{ requireOrg: (true|false)`))
      assert.ok(m, `${rel} ${method} should be a withRoute export`)
      assert.equal(m[1], 'true', `${rel} ${method} should require an org`)
    }
    const get = src.match(/export const GET = withRoute\([\s\S]*?\{ requireOrg: (true|false)/)
    assert.ok(get, `${rel} GET should be a withRoute export`)
    assert.equal(get[1], 'false', `${rel} GET should stay open without an org`)
  }
})

test('action-plans PUT: viewer gets 403 and nothing is updated', async () => {
  const calls = []
  const prisma = {
    actionPlan: {
      update: async () => {
        calls.push('actionPlan.update')
        return { id: 'ap-1', title: 'x' }
      },
    },
  }
  const route = loadRoute('app/api/action-plans/[id]/route.ts', prisma)
  const res = await route.PUT(fakeReq('http://localhost/api/action-plans/ap-1', { title: 'New' }, ctxFor('viewer')))
  assert.equal(res.status, 403)
  assert.deepEqual(calls, [])
})

test('action-plans PUT: member can update, and the id comes from the URL', async () => {
  let seenWhere = null
  const prisma = {
    actionPlan: {
      update: async ({ where, data }) => {
        seenWhere = where
        return { id: 'ap-1', title: data.title }
      },
    },
  }
  const route = loadRoute('app/api/action-plans/[id]/route.ts', prisma)
  const res = await route.PUT(fakeReq('http://localhost/api/action-plans/ap-1', { title: 'New title' }, ctxFor('member')))
  assert.equal(res.status, 200)
  assert.equal(seenWhere.id, 'ap-1') // id comes from the URL path, not the body
  assert.equal(res.body.item.title, 'New title')
})

test('action-plans DELETE: admin can delete', async () => {
  const prisma = {
    actionPlan: { delete: async () => ({ id: 'ap-1' }) },
  }
  const route = loadRoute('app/api/action-plans/[id]/route.ts', prisma)
  const res = await route.DELETE(fakeReq('http://localhost/api/action-plans/ap-1', null, ctxFor('admin')))
  assert.equal(res.status, 200)
  assert.equal(res.body.ok, true)
})

test('risks PATCH: viewer gets 403; member can update the title', async () => {
  const prisma = {
    risk: {
      findUnique: async () => ({ id: 'risk-1', title: 'Old', status: 'open', likelihood: 2, impact: 2 }),
      update: async ({ where, data }) => ({ id: 'risk-1', title: data.title || 'Old', status: 'open' }),
    },
    activity: { create: async () => ({}) },
  }
  const route = loadRoute('app/api/risks/[id]/route.ts', prisma)
  const denied = await route.PATCH(fakeReq('http://localhost/api/risks/risk-1', { title: 'New' }, ctxFor('viewer')))
  assert.equal(denied.status, 403)
  const ok = await route.PATCH(fakeReq('http://localhost/api/risks/risk-1', { title: 'New title' }, ctxFor('member')))
  assert.equal(ok.status, 200)
  assert.equal(ok.body.title, 'New title')
})

test('projects POST: viewer gets 403; member can now create a project', async () => {
  const prisma = {
    project: {
      create: async ({ data }) => ({ id: 'proj-1', name: data.name }),
    },
    activity: { create: async () => ({}) },
  }
  const route = loadRoute('app/api/projects/route.ts', prisma)
  const denied = await route.POST(fakeReq('http://localhost/api/projects', { name: 'New build' }, ctxFor('viewer')))
  assert.equal(denied.status, 403)
  const ok = await route.POST(fakeReq('http://localhost/api/projects', { name: 'New build' }, ctxFor('member')))
  assert.equal(ok.status, 201)
  assert.equal(ok.body.name, 'New build')
})

test('training POST: org-less user gets 400; member with an org can create', async () => {
  const prisma = {
    certification: {
      create: async ({ data }) => ({ id: 'cert-1', holderName: data.holderName, type: data.type }),
    },
  }
  const route = loadRoute('app/api/training/route.ts', prisma)
  const noOrg = await route.POST(
    fakeReq('http://localhost/api/training', { holderName: 'Jo', type: 'CSCS' }, ctxFor('member', null)),
  )
  assert.equal(noOrg.status, 400)
  const ok = await route.POST(
    fakeReq('http://localhost/api/training', { holderName: 'Jo', type: 'CSCS' }, ctxFor('member')),
  )
  assert.equal(ok.status, 201)
  assert.equal(ok.body.holderName, 'Jo')
})

test('training GET: reads stay open without an org', async () => {
  const prisma = {
    certification: {
      findMany: async () => [],
    },
  }
  const route = loadRoute('app/api/training/route.ts', prisma)
  const res = await route.GET(fakeReq('http://localhost/api/training', null, ctxFor('member', null)))
  assert.equal(res.status, 200)
  assert.equal(res.body.counts.total, 0)
})
