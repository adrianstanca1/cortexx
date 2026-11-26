/**
 * RBAC for Batch 3 group 3A (issue #322, approved role matrix).
 *
 * The write routes in this batch used to call `requireOrg()` only, which
 * proves the caller belongs to an org but not what they may do inside it —
 * any org member, including a viewer, could create, edit or delete. They
 * now wrap their write handlers in `withRoute({ permission: 'write' })`,
 * so a viewer gets 403 on writes while a member (and above) can write.
 *
 * One exception: POST /api/projects keeps its admin-only gate. Project
 * creation was admin-only on main (inner canManage gate) and the e2e
 * contract (role-journeys + mobile-api) asserts 403 with "Company admin
 * permission required" for PM / foreman / operative. withRoute's generic
 * 'Forbidden' cannot carry that message, so the gate stays inside the
 * handler — the same pattern as the programme routes, which keep their
 * canPlanProgramme gates inside withRoute('write') handlers.
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

// Mirrors the real decodePathSegment in lib/withRoute.ts: handlers parse
// their id out of the (percent-encoded) pathname, so the segment is
// decoded exactly once; malformed encodings fall back to the raw segment.
function decodePathSegment(segment) {
  if (segment === undefined) return undefined
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

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
    '@/lib/withRoute': { withRoute: mockWithRoute, decodePathSegment },
    '@/lib/rbac': rbac,
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

test('projects POST is wrapped at write but keeps its admin-only create gate', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app/api/projects/route.ts'), 'utf8')
  const post = src.match(/export const POST = withRoute\([\s\S]*?\{ permission: '(read|write|manage)'/)
  assert.ok(post, 'projects POST should be a withRoute export with a permission')
  assert.equal(post[1], 'write', 'projects POST should be permission write')
  // The withRoute level is 'write' (viewers are blocked by the wrapper),
  // but creation itself stays admin-only: the inner canManage gate is what
  // returns the "Company admin permission required" 403 the e2e contract
  // asserts for PM / foreman / operative. Removing it widened creation to
  // every member and broke 4 browser-e2e tests (PR #496, CI 45893319864).
  assert.ok(src.includes('Company admin permission required to create projects'),
    'projects POST should keep its admin-only create gate and message')
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

test('projects POST: viewer and member get 403; only admin can create a project', async () => {
  const calls = []
  const prisma = {
    project: {
      create: async ({ data }) => {
        calls.push(data.name)
        return { id: 'proj-1', name: data.name }
      },
    },
    activity: { create: async () => ({}) },
  }
  const route = loadRoute('app/api/projects/route.ts', prisma)
  const viewer = await route.POST(fakeReq('http://localhost/api/projects', { name: 'New build' }, ctxFor('viewer')))
  assert.equal(viewer.status, 403)
  const member = await route.POST(fakeReq('http://localhost/api/projects', { name: 'New build' }, ctxFor('member')))
  assert.equal(member.status, 403)
  assert.match(member.body.error, /company admin permission required/i)
  const admin = await route.POST(fakeReq('http://localhost/api/projects', { name: 'New build' }, ctxFor('admin')))
  assert.equal(admin.status, 201)
  assert.equal(admin.body.name, 'New build')
  assert.deepEqual(calls, ['New build'], 'only the admin call should reach the database')
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

test('pathname-derived route ids are decoded exactly once', () => {
  // CodeRabbit review on PR #496: withRoute handlers parse their id out of
  // req.nextUrl.pathname, which keeps percent-encoding while the framework
  // params are decoded — /api/risks/%63123 used to reach Prisma as '%63123'
  // and 404 instead of matching 'c123'. Every extraction site must decode.
  for (const rel of GROUP3A_ROUTES) {
    const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
    for (const m of src.matchAll(/const __segments = req\.nextUrl\.pathname\.split\('\/'\)\.filter\(Boolean\)(.*)/g)) {
      assert.ok(m[1].startsWith('.map(decodePathSegment)'),
        `${rel} must decode its path segments exactly once`)
    }
    assert.ok(!/const id = req\.nextUrl\.pathname\.split\('\/'\)\.pop\(\)/.test(src),
      `${rel} must decode a .pop() path id instead of using it raw`)
  }
})

test('risks PATCH: a percent-encoded id is decoded before the Prisma lookup', async () => {
  let seenWhere = null
  const prisma = {
    risk: {
      findUnique: async ({ where }) => {
        seenWhere = where
        return { id: 'c123', title: 'Old', status: 'open', likelihood: 2, impact: 2 }
      },
      update: async ({ where, data }) => ({ id: 'c123', title: data.title || 'Old', status: 'open' }),
    },
    activity: { create: async () => ({}) },
  }
  const route = loadRoute('app/api/risks/[id]/route.ts', prisma)
  const res = await route.PATCH(fakeReq('http://localhost/api/risks/%63123', { title: 'New title' }, ctxFor('member')))
  assert.equal(res.status, 200)
  assert.equal(seenWhere.id, 'c123')
})

test('holiday PUT: a percent-encoded id is decoded before the Prisma update', async () => {
  let seenWhere = null
  const prisma = {
    leaveRequest: {
      update: async ({ where, data }) => {
        seenWhere = where
        return { id: 'c123', ...data }
      },
    },
  }
  const route = loadRoute('app/api/holiday/[id]/route.ts', prisma)
  const res = await route.PUT(fakeReq('http://localhost/api/holiday/%63123', { status: 'approved' }, ctxFor('member')))
  assert.equal(res.status, 200)
  assert.equal(seenWhere.id, 'c123')
})

test('risks PATCH: a malformed percent-encoding falls back to the raw id and 404s', async () => {
  let seenWhere = null
  const prisma = {
    risk: {
      findUnique: async ({ where }) => {
        seenWhere = where
        return null
      },
      update: async () => { throw new Error('must not be called') },
    },
    activity: { create: async () => ({}) },
  }
  const route = loadRoute('app/api/risks/[id]/route.ts', prisma)
  const res = await route.PATCH(fakeReq('http://localhost/api/risks/%ZZ', { title: 'New' }, ctxFor('member')))
  assert.equal(res.status, 404)
  assert.equal(seenWhere.id, '%ZZ')
})

// Loader for the programme GETs, which are plain requireOrg handlers (not
// withRoute writes) and return the permission flags the programme pages use
// to show edit controls. requireOrg is mocked to return a controlled
// workspace role + persona session, and the REAL lib/programme-access is
// used so the flag logic is tested, not re-implemented. The tenancy mock
// must agree with the requireOrg mock on the workspace role, mirroring
// production where requireOrg sets the org context.
function loadProgrammeGet(relPath, workspaceRole, persona, prisma) {
  const session = {
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com', role: persona },
  }
  const programmeAccess = loadModule('lib/programme-access.ts', {
    './rbac': rbac,
    './tenancy': { getCurrentOrg: () => ({ organizationId: 'org-1', userId: 'user-1', role: workspaceRole }) },
    '@prisma/client': { Prisma: {} },
  })
  return loadModule(relPath, {
    'next/server': { NextResponse: MockResponse },
    '@prisma/client': { Prisma: {} },
    '@/lib/db': { prisma },
    '@/lib/requireAuth': {
      requireOrg: async () => ({ session, userId: 'user-1', orgId: 'org-1', orgSlug: 'org', orgName: 'Org', role: workspaceRole, personaRole: persona }),
      actorName: s => s?.user?.name || 'User',
    },
    '@/lib/withRoute': { withRoute: mockWithRoute, decodePathSegment },
    '@/lib/rbac': rbac,
    '@/lib/errors': { reportError: () => {} },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/tenancy': { getCurrentOrg: () => ({ organizationId: 'org-1', userId: 'user-1', role: workspaceRole }) },
    '@/lib/audit': { auditLog: async () => {}, requestMeta: () => ({}) },
    '@/lib/programme-access': programmeAccess,
    '@/lib/programme': { __esModule: true, default: { programmeSummary: () => ({}) } },
    '@/lib/programme-resources': { __esModule: true, default: { buildResourceLoad: () => ({}) } },
    '@/lib/programme-server': { syncProjectProgrammeProgress: async () => {} },
    '@/lib/programme-change-control-server': { lockProgrammeProject: async () => {} },
  })
}

const programmePrisma = {
  project: { findFirst: async () => ({ id: 'p1', name: 'Project', startDate: null, endDate: null, progress: 0 }) },
  programmeActivity: { findMany: async () => [] },
  programmeDependency: { findMany: async () => [] },
  assignment: { findMany: async () => [] },
  programmeBaselineRevision: { findMany: async () => [] },
  programmeDelayEvent: { findMany: async () => [] },
}

const resourcesPrisma = {
  project: { findFirst: async () => ({ id: 'p1', name: 'Project' }) },
  programmeActivity: { findMany: async () => [] },
  programmeResourceAllocation: { findMany: async () => [] },
  assignment: { findMany: async () => [] },
  equipment: { findMany: async () => [] },
  material: { findMany: async () => [] },
}

test('programme GET flags: viewers are not promised edits they cannot make', async () => {
  // Devin review on PR #496: the flags used to come from the persona checks
  // alone, so an assigned viewer with a Foreman / Project Manager persona
  // saw the progress selector and planning controls, but the converted
  // writes 403 (withRoute 'write' = member+). The flags now combine the
  // workspace write threshold with the persona checks.
  const cases = [
    // [workspace role, persona, expected flags]
    ['viewer', 'foreman', { plan: false, progress: false }],
    ['viewer', 'project_manager', { plan: false, progress: false }],
    ['member', 'foreman', { plan: false, progress: true }],
    ['member', 'project_manager', { plan: true, progress: true }],
    ['admin', 'operative', { plan: true, progress: true }],
  ]
  for (const [workspaceRole, persona, expected] of cases) {
    const route = loadProgrammeGet('app/api/projects/[id]/programme/route.ts', workspaceRole, persona, programmePrisma)
    const res = await route.GET(
      fakeReq('http://localhost/api/projects/p1/programme', null, ctxFor(workspaceRole)),
      { params: Promise.resolve({ id: 'p1' }) },
    )
    assert.equal(res.status, 200, `${workspaceRole}/${persona} should load the programme`)
    // Compare field by field: the permissions object is built inside the
    // vm, so its prototype differs from this realm's Object.prototype
    // and deepStrictEqual would fail on identical contents.
    assert.equal(res.body.permissions.plan, expected.plan, `${workspaceRole}/${persona} plan flag`)
    assert.equal(res.body.permissions.progress, expected.progress, `${workspaceRole}/${persona} progress flag`)
  }
})

test('programme resources GET flags: viewers are not promised planning', async () => {
  const cases = [
    // [workspace role, persona, expected plan flag]
    ['viewer', 'project_manager', false],
    ['member', 'project_manager', true],
    ['member', 'operative', false],
    ['admin', 'operative', true],
  ]
  for (const [workspaceRole, persona, expectedPlan] of cases) {
    const route = loadProgrammeGet('app/api/projects/[id]/programme/resources/route.ts', workspaceRole, persona, resourcesPrisma)
    const res = await route.GET(
      fakeReq('http://localhost/api/projects/p1/programme/resources', null, ctxFor(workspaceRole)),
      { params: Promise.resolve({ id: 'p1' }) },
    )
    assert.equal(res.status, 200, `${workspaceRole}/${persona} should load resources`)
    assert.equal(res.body.permissions.plan, expectedPlan, `${workspaceRole}/${persona} plan flag`)
  }
})
