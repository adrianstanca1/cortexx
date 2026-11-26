/**
 * RBAC for Batch 3 group 3B (issue #322, approved role matrix).
 *
 * The write routes in this batch used to call `requireOrg()` only, which
 * proves the caller belongs to an org but not what they may do inside it —
 * any org member, including a viewer, could create, edit or delete. They
 * now wrap their write handlers in `withRoute({ permission: 'write' })`,
 * so a viewer gets 403 on writes while a member (and above) can write.
 *
 * Three routes needed a manual conversion because their handlers pass the
 * whole `auth` object to a helper (`loadProjectKnowledge`,
 * `accessibleMarkup`, `accessibleRevision`): the handler now reconstructs
 * the same shape from the withRoute ctx
 * (`const auth = { session, userId, orgId, orgSlug, orgName, role,
 * personaRole }`), so the helpers behave exactly as before.
 *
 * Billing (`billing/checkout`, `billing/portal`) is NOT wrapped in
 * withRoute — those routes verify membership on the client-supplied
 * `organizationId`, not the session's active org. Instead the inner gate
 * was tightened from `canManage` (admin+) to `isOwner` (owner only), per
 * the approved matrix.
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

const GROUP3B_ROUTES = [
  'app/api/activity/route.ts',
  'app/api/ai/history/route.ts',
  'app/api/announcements/[id]/route.ts',
  'app/api/announcements/route.ts',
  'app/api/ask/route.ts',
  'app/api/bookmarks/route.ts',
  'app/api/claims/[id]/route.ts',
  'app/api/claims/route.ts',
  'app/api/conversations/[id]/messages/route.ts',
  'app/api/conversations/[id]/route.ts',
  'app/api/conversations/route.ts',
  'app/api/cost-catalog/[id]/route.ts',
  'app/api/cost-catalog/route.ts',
  'app/api/currency/[id]/route.ts',
  'app/api/currency/route.ts',
  'app/api/customers/[id]/route.ts',
  'app/api/customers/route.ts',
  'app/api/drawing-markups/[markupId]/route.ts',
  'app/api/drawing-revisions/[revisionId]/markups/route.ts',
  'app/api/drawings/[id]/compare/route.ts',
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
  'app/api/photos/compare/route.ts',
  'app/api/receipts/analyze/route.ts',
  'app/api/saved-views/[id]/route.ts',
  'app/api/saved-views/route.ts',
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

// Real drawing-markup helpers (only import ./rbac).
const drawingMarkup = loadModule('lib/drawing-markup.ts', { './rbac': rbac })

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

function ctxFor(role, orgId = 'org-1', personaRole = 'project_manager') {
  return {
    session: {
      user: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        role: personaRole,
        organizations: [{ id: orgId, slug: 'org', name: 'Org', role }],
      },
    },
    userId: 'user-1',
    orgId,
    orgSlug: 'org',
    orgName: 'Org',
    role,
    personaRole,
  }
}

function loadRoute(relPath, prisma, extraMocks = {}) {
  return loadModule(relPath, {
    'next/server': { NextResponse: MockResponse },
    '@prisma/client': { Prisma: {} },
    '@/lib/db': { prisma },
    '@/lib/requireAuth': {
      requireOrg: async () => { throw new Error('requireOrg must not be called in a withRoute write handler') },
      requireAuth: async () => { throw new Error('requireAuth must not be called in a withRoute write handler') },
      actorName: session => session?.user?.name || 'User',
    },
    '@/lib/withRoute': { withRoute: mockWithRoute },
    '@/lib/errors': { reportError: () => {} },
    '@/lib/rateLimit': { enforceRateLimit: async () => null, rateLimit: async () => ({ ok: true }) },
    '@/lib/tenancy': { getCurrentOrg: () => ({ organizationId: 'org-1' }) },
    '@/lib/audit': { auditLog: async () => {}, requestMeta: () => ({}) },
    '@/lib/programme-access': {
      canPlanProgramme: () => true,
      programmeProjectWhere: (id, session) => ({ id }),
    },
    '@/lib/drawing-markup': drawingMarkup,
    '@/lib/rbac': rbac,
    '@/lib/push': { sendPush: () => {} },
    '@/lib/billing': { getStripe: () => ({}), PLANS: {}, isBillingConfigured: () => true },
    ...extraMocks,
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

test('group 3B routes all wrap writes in withRoute with permission write', () => {
  assert.equal(GROUP3B_ROUTES.length, 46, 'group 3B covers 46 routes')
  for (const rel of GROUP3B_ROUTES) {
    const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
    assert.ok(src.includes('withRoute'), `${rel} should use withRoute`)
    assert.ok(src.includes("permission: 'write'"), `${rel} should set permission 'write' on its writes`)
    assert.ok(!/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/.test(src),
      `${rel} should have no unwrapped write handler left`)
  }
})

test('manual conversions reconstruct auth for their helpers', () => {
  for (const rel of [
    'app/api/ask/route.ts',
    'app/api/drawing-markups/[markupId]/route.ts',
    'app/api/drawing-revisions/[revisionId]/markups/route.ts',
  ]) {
    const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
    assert.ok(src.includes('const auth = { session, userId, orgId, orgSlug, orgName, role, personaRole }'),
      `${rel} should reconstruct the auth object from the withRoute ctx`)
  }
})

test('billing is tightened to owner-only, not wrapped in withRoute', () => {
  for (const rel of ['app/api/billing/checkout/route.ts', 'app/api/billing/portal/route.ts']) {
    const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
    assert.ok(!src.includes('withRoute'), `${rel} must not be wrapped in withRoute (membership is checked on the client-supplied organizationId)`)
    assert.ok(src.includes('isOwner(membership.role)'), `${rel} should gate billing on isOwner`)
    assert.ok(src.includes('Only owners can manage billing'), `${rel} should say only owners can manage billing`)
    assert.ok(!src.includes('canManage'), `${rel} should no longer use canManage`)
  }
})

test('tags POST: viewer gets 403 and nothing is created; member can create', async () => {
  const calls = []
  const prisma = {
    tag: {
      create: async ({ data }) => {
        calls.push(data)
        return { id: 'tag-1', name: data.name }
      },
    },
  }
  const route = loadRoute('app/api/tags/route.ts', prisma)
  const denied = await route.POST(fakeReq('http://localhost/api/tags', { name: 'Urgent' }, ctxFor('viewer')))
  assert.equal(denied.status, 403)
  assert.deepEqual(calls, [])
  const ok = await route.POST(fakeReq('http://localhost/api/tags', { name: 'Urgent' }, ctxFor('member')))
  assert.equal(ok.status, 201)
  assert.equal(ok.body.item.name, 'Urgent')
})

test('customers POST: admin can create a customer', async () => {
  const prisma = {
    customer: {
      create: async ({ data }) => ({ id: 'cust-1', name: data.name }),
    },
  }
  const route = loadRoute('app/api/customers/route.ts', prisma)
  const res = await route.POST(fakeReq('http://localhost/api/customers', { name: 'Acme Ltd' }, ctxFor('admin')))
  assert.equal(res.status, 201)
  assert.equal(res.body.name, 'Acme Ltd')
})

test('drawing-markups PATCH: viewer gets 403; member with annotator persona can update', async () => {
  const prisma = {
    drawingMarkup: {
      findFirst: async () => ({ id: 'm1', projectId: 'p1', kind: 'pin', width: null, height: null, status: 'open', drawingId: 'd1', revisionId: 'r1' }),
      update: async ({ where, data }) => ({ id: 'm1', status: data.status || 'open', text: data.text }),
    },
    project: { findFirst: async () => ({ id: 'p1' }) },
    activity: { create: async () => ({}) },
  }
  const route = loadRoute('app/api/drawing-markups/[markupId]/route.ts', prisma)
  const denied = await route.PATCH(
    fakeReq('http://localhost/api/drawing-markups/m1', { text: 'Move this' }, ctxFor('viewer')),
  )
  assert.equal(denied.status, 403)
  const ok = await route.PATCH(
    fakeReq('http://localhost/api/drawing-markups/m1', { text: 'Move this' }, ctxFor('member')),
  )
  assert.equal(ok.status, 200)
  assert.equal(ok.body.text, 'Move this')
})

test('billing checkout: admin gets 403, owner completes checkout', async () => {
  // Billing routes are NOT withRoute-wrapped: they call requireAuth() and
  // check membership on the client-supplied organizationId, so the session
  // mock is a mutable holder the test sets per call.
  const sessionHolder = { current: null }
  const prisma = {
    userOrganization: {
      findUnique: async ({ where }) => ({
        role: where.userId_organizationId.userId === 'admin-user' ? 'admin' : 'owner',
        organization: { stripeCustomerId: null, name: 'Org' },
      }),
    },
    organization: {
      updateMany: async () => ({ count: 1 }),
    },
  }
  const stripe = {
    customers: { create: async () => ({ id: 'cus_1' }), del: async () => ({}) },
    checkout: { sessions: { create: async () => ({ url: 'https://checkout.stripe.test/session' }) } },
  }
  const route = loadRoute('app/api/billing/checkout/route.ts', prisma, {
    '@/lib/requireAuth': {
      requireAuth: async () => sessionHolder.current,
      actorName: session => session?.user?.name || 'User',
    },
    '@/lib/billing': {
      getStripe: () => stripe,
      PLANS: { starter: { priceId: 'price_123' } },
      isBillingConfigured: () => true,
    },
  })
  const adminCtx = ctxFor('admin')
  adminCtx.userId = 'admin-user'
  adminCtx.session.user.id = 'admin-user'
  sessionHolder.current = adminCtx.session
  const denied = await route.POST(fakeReq('http://localhost/api/billing/checkout', { organizationId: 'org-1', plan: 'starter' }, adminCtx))
  assert.equal(denied.status, 403)
  assert.equal(denied.body.error, 'Only owners can manage billing')
  const ownerCtx = ctxFor('owner')
  sessionHolder.current = ownerCtx.session
  const ok = await route.POST(fakeReq('http://localhost/api/billing/checkout', { organizationId: 'org-1', plan: 'starter' }, ownerCtx))
  assert.equal(ok.status, 200)
  assert.equal(ok.body.url, 'https://checkout.stripe.test/session')
})

test('billing portal: admin gets 403, owner passes the gate', async () => {
  const sessionHolder = { current: null }
  const prisma = {
    userOrganization: {
      findUnique: async ({ where }) => ({
        role: where.userId_organizationId.userId === 'admin-user' ? 'admin' : 'owner',
        organization: { stripeCustomerId: null, name: 'Org' },
      }),
    },
  }
  const route = loadRoute('app/api/billing/portal/route.ts', prisma, {
    '@/lib/requireAuth': {
      requireAuth: async () => sessionHolder.current,
      actorName: session => session?.user?.name || 'User',
    },
  })
  const adminCtx = ctxFor('admin')
  adminCtx.userId = 'admin-user'
  adminCtx.session.user.id = 'admin-user'
  sessionHolder.current = adminCtx.session
  const denied = await route.POST(fakeReq('http://localhost/api/billing/portal', { organizationId: 'org-1' }, adminCtx))
  assert.equal(denied.status, 403)
  assert.equal(denied.body.error, 'Only owners can manage billing')
  // Owner passes the gate and fails later: no Stripe customer yet (no Stripe call made).
  sessionHolder.current = ctxFor('owner').session
  const owner = await route.POST(fakeReq('http://localhost/api/billing/portal', { organizationId: 'org-1' }, ctxFor('owner')))
  assert.equal(owner.status, 404)
  assert.match(owner.body.error, /No Stripe customer/)
})
