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
 * the approved matrix. The settings page passes a separate owner-derived
 * `canManageBilling` flag to `BillingSection`, so admins no longer see
 * billing controls the endpoints would reject; `canManage` stays the
 * member-administration flag.
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
// The mock also forwards decoded route params on ctx.params, mirroring
// Next.js: the real wrapper awaits the route's params promise and passes
// the decoded object, so handlers never parse ids from the raw pathname.
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
    if (requireOrg && !ctx.orgId) {
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

test('BillingSection gates billing controls on an owner-only flag, not canManage', () => {
  // Devin on #497: the checkout/portal endpoints are owner-only, but
  // BillingSection showed both controls to admins because it used the
  // member-management canManage flag (admins + owners). The settings
  // page now passes a separate owner-derived flag for the billing
  // controls and keeps canManage for member administration.
  const src = fs.readFileSync(path.join(__dirname, '..', 'app/settings/organization/page.tsx'), 'utf8')
  assert.ok(src.includes('canManageBilling={activeOrg.role === \'owner\'}'),
    'settings should pass an owner-derived billing flag to BillingSection')
  const section = src.slice(src.indexOf('function BillingSection'))
  assert.ok(section.includes('canManageBilling: boolean'),
    'BillingSection should take a canManageBilling prop')
  assert.ok(section.includes("canManageBilling && plan.key !== 'enterprise'"),
    'plan checkout buttons should be gated on canManageBilling')
  assert.ok(section.includes('canManageBilling && (\n        <button'),
    'the portal button should be gated on canManageBilling')
  assert.ok(!/canManage[^B]/.test(section.replace(/canManageBilling/g, '')),
    'BillingSection should not use the member-management canManage flag')
  // canManage is still the member-administration flag on the same page.
  assert.ok(src.includes('{canManage && ('),
    'member administration should still be gated on canManage')
})

test('withRoute forwards framework-decoded params to handlers', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib/withRoute.ts'), 'utf8')
  assert.ok(src.includes('params: Record<string, string>'),
    'HandlerContext should carry the decoded params')
  assert.ok(src.includes('await context?.params'),
    'withRoute should await the route params promise')
})

test('group 3B write handlers read ids from decoded params, never from the raw pathname', () => {
  // CodeRabbit on #496: handlers that parsed the id out of
  // req.nextUrl.pathname received the still-percent-encoded segment, so
  // /api/tags/%63123 passed '%63123' to Prisma instead of 'c123' and
  // 404d. Handlers now read the framework-decoded params from the
  // withRoute ctx instead.
  for (const rel of GROUP3B_ROUTES) {
    const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
    assert.ok(!src.includes('__segments'), `${rel} should not parse ids from the pathname`)
    assert.ok(!src.includes('nextUrl.pathname'), `${rel} should not read nextUrl.pathname`)
  }
})

test('percent-encoded route id is decoded before the Prisma call', async () => {
  const seen = []
  const prisma = {
    tag: {
      update: async ({ where, data }) => {
        seen.push(where.id)
        return { id: where.id, name: 'Urgent' }
      },
    },
  }
  const route = loadRoute('app/api/tags/[id]/route.ts', prisma)
  // %63 is 'c': the id the client asked for is 'c123', not '%63123'.
  const res = await route.PUT(
    fakeReq('http://localhost/api/tags/%63123', { name: 'Urgent' }, ctxFor('member')),
  )
  assert.equal(res.status, 200)
  assert.deepEqual(seen, ['c123'])
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
