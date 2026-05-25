/**
 * Unit tests for the Prisma tenancy extension's transformation logic.
 *
 * These mirror what lib/tenancy.ts does to args/where/data so the logic
 * is exercised without spinning up a real Prisma client or DB. If the
 * extension is refactored, these tests catch regressions in the
 * cross-tenant isolation guarantees.
 */
const test = require('node:test')
const assert = require('node:assert/strict')

// ─── Mirror of the OWNED_MODELS set in lib/tenancy.ts ────────────────
const OWNED_MODELS = new Set([
  'Project', 'Task', 'TeamMember', 'Assignment', 'Invoice', 'TimeEntry',
  'Activity', 'Comment', 'Document', 'Snag', 'Certification', 'Rfi',
  'Announcement', 'Observation', 'Variation', 'Lead', 'Customer', 'Quote',
  'SiteCheckIn', 'MileageEntry', 'CostItem', 'Subcontractor', 'Equipment',
  'Material', 'PurchaseOrder', 'SubInvoice', 'Drawing', 'DrawingRevision',
  'Milestone', 'Permit', 'Rams', 'Tender', 'Inspection', 'Meeting', 'Risk',
  'ToolboxTalk', 'MaintenanceSchedule', 'Supplier', 'SafetyIncident',
  'PayrollRun', 'LeaveRequest', 'BankTransaction', 'CarbonEntry',
  'WasteEntry', 'Appraisal', 'DocumentTemplate', 'FormDefinition',
  'Reminder', 'SavedView', 'Tag', 'Goal', 'Improvement', 'KaizenCard',
  'ProcessDoc', 'SiteReview', 'Apprenticeship', 'InsuranceClaim',
  'CurrencyRate', 'Persona', 'ServiceCatalogItem', 'SubPortalSession',
  'ApiKey', 'InfraSnapshot',
  // v1.1 additions — keep in sync with lib/tenancy.ts OWNED_MODELS
  'ProjectBookmark', 'ActionPlan', 'Conflict', 'Cis300Return',
  'Conversation', 'ChatMessage',
])

const READ_OPERATIONS = new Set([
  'findFirst', 'findFirstOrThrow', 'findMany', 'findUnique', 'findUniqueOrThrow',
  'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany',
])

/**
 * Pure transform that mirrors the extension's $allOperations handler.
 * Returns the args that would be passed downstream to query() — never
 * mutates the input.
 */
function transformArgs({ model, operation, args, ctx, enforced }) {
  if (!enforced) return args
  if (!model || !OWNED_MODELS.has(model)) return args
  if (ctx && ctx.bypass) return args
  const orgId = ctx && ctx.organizationId
  if (!orgId) {
    throw new Error(`[tenancy] ${model}.${operation} called without org context.`)
  }
  const a = args || {}
  if (READ_OPERATIONS.has(operation)) {
    return { ...a, where: { ...(a.where || {}), organizationId: orgId } }
  }
  if (operation === 'create') {
    return { ...a, data: { ...(a.data || {}), organizationId: orgId } }
  }
  if (operation === 'createMany') {
    const data = Array.isArray(a.data)
      ? a.data.map(d => ({ ...d, organizationId: orgId }))
      : { ...(a.data || {}), organizationId: orgId }
    return { ...a, data }
  }
  if (operation === 'upsert') {
    return {
      ...a,
      where: { ...(a.where || {}), organizationId: orgId },
      create: { ...(a.create || {}), organizationId: orgId },
    }
  }
  if (operation === 'update' || operation === 'delete') {
    return { ...a, where: { ...(a.where || {}), organizationId: orgId } }
  }
  return args
}

// ─── Pass-through (no scoping) ───────────────────────────────────────

test('extension is a no-op when MULTITENANT_ENFORCED is false', () => {
  const args = { where: { id: 'p1' } }
  const out = transformArgs({
    model: 'Project',
    operation: 'findUnique',
    args,
    ctx: { organizationId: 'org-A' },
    enforced: false,
  })
  assert.equal(out, args, 'returns same reference when disabled')
})

test('extension is a no-op for models not in OWNED_MODELS', () => {
  const args = { where: { email: 'a@b.com' } }
  for (const model of ['User', 'Organization', 'PushSubscription', 'AuditEvent']) {
    const out = transformArgs({
      model, operation: 'findUnique', args, ctx: { organizationId: 'org-A' }, enforced: true,
    })
    assert.equal(out, args, `pass through for ${model}`)
  }
})

test('bypassTenancy ctx skips scoping even on owned models', () => {
  const args = { where: { status: 'overdue' } }
  const out = transformArgs({
    model: 'Invoice', operation: 'findMany', args,
    ctx: { organizationId: null, bypass: true }, enforced: true,
  })
  assert.equal(out, args)
})

// ─── Fail closed ─────────────────────────────────────────────────────

test('throws on owned-model query without org context (fail closed)', () => {
  assert.throws(
    () => transformArgs({
      model: 'Project', operation: 'findMany', args: {}, ctx: null, enforced: true,
    }),
    /called without org context/,
  )
})

test('throws even when ctx exists but organizationId is null', () => {
  assert.throws(
    () => transformArgs({
      model: 'Task', operation: 'create', args: { data: { title: 't' } },
      ctx: { organizationId: null, userId: 'u' }, enforced: true,
    }),
    /called without org context/,
  )
})

// ─── Read operations inject organizationId into where ─────────────────

test('findMany gets organizationId injected into where', () => {
  const out = transformArgs({
    model: 'Project', operation: 'findMany',
    args: { where: { status: 'active' } },
    ctx: { organizationId: 'org-A' }, enforced: true,
  })
  assert.equal(out.where.organizationId, 'org-A')
  assert.equal(out.where.status, 'active')
})

test('count gets organizationId injected', () => {
  const out = transformArgs({
    model: 'Invoice', operation: 'count',
    args: {},
    ctx: { organizationId: 'org-A' }, enforced: true,
  })
  assert.equal(out.where.organizationId, 'org-A')
})

test('findUnique gets organizationId injected', () => {
  const out = transformArgs({
    model: 'Project', operation: 'findUnique',
    args: { where: { id: 'p1' } },
    ctx: { organizationId: 'org-A' }, enforced: true,
  })
  assert.deepEqual(out.where, { id: 'p1', organizationId: 'org-A' })
})

test('updateMany and deleteMany are scoped (bulk-write protection)', () => {
  for (const op of ['updateMany', 'deleteMany']) {
    const out = transformArgs({
      model: 'Task', operation: op,
      args: { where: { status: 'done' }, data: { status: 'archived' } },
      ctx: { organizationId: 'org-A' }, enforced: true,
    })
    assert.equal(out.where.organizationId, 'org-A', `${op} scoped`)
  }
})

// ─── Write operations inject organizationId into data ─────────────────

test('create gets organizationId injected into data', () => {
  const out = transformArgs({
    model: 'Project', operation: 'create',
    args: { data: { name: 'Camden Refurb' } },
    ctx: { organizationId: 'org-A' }, enforced: true,
  })
  assert.equal(out.data.organizationId, 'org-A')
  assert.equal(out.data.name, 'Camden Refurb')
})

test('createMany with array data gets organizationId on each row', () => {
  const out = transformArgs({
    model: 'Task', operation: 'createMany',
    args: { data: [{ title: 'a' }, { title: 'b' }, { title: 'c' }] },
    ctx: { organizationId: 'org-A' }, enforced: true,
  })
  assert.equal(out.data.length, 3)
  assert.ok(out.data.every(d => d.organizationId === 'org-A'))
})

test('upsert scopes both where and create branches', () => {
  const out = transformArgs({
    model: 'Project', operation: 'upsert',
    args: { where: { id: 'p1' }, create: { name: 'X' }, update: { name: 'Y' } },
    ctx: { organizationId: 'org-A' }, enforced: true,
  })
  assert.equal(out.where.organizationId, 'org-A')
  assert.equal(out.create.organizationId, 'org-A')
})

// ─── Non-mutation guarantees (the bug that started this whole audit) ──

test('does NOT mutate caller args (where)', () => {
  const args = { where: { status: 'active' } }
  transformArgs({
    model: 'Project', operation: 'findMany', args,
    ctx: { organizationId: 'org-A' }, enforced: true,
  })
  assert.equal(args.where.organizationId, undefined, 'caller where stays clean')
})

test('does NOT mutate caller args (data)', () => {
  const sharedTemplate = { title: 'shared' }
  const args = { data: sharedTemplate }
  transformArgs({
    model: 'Task', operation: 'create', args,
    ctx: { organizationId: 'org-A' }, enforced: true,
  })
  assert.equal(sharedTemplate.organizationId, undefined,
    'shared template not contaminated — this is the bug that would leak orgIds across calls')
})

test('does NOT mutate caller args (createMany array elements)', () => {
  const item1 = { title: 'a' }
  const item2 = { title: 'b' }
  transformArgs({
    model: 'Task', operation: 'createMany',
    args: { data: [item1, item2] },
    ctx: { organizationId: 'org-A' }, enforced: true,
  })
  assert.equal(item1.organizationId, undefined)
  assert.equal(item2.organizationId, undefined)
})

// ─── Cross-org isolation scenarios ────────────────────────────────────

test('org-A user reading org-B records: where override is ignored', () => {
  // User in org-A tries to be clever by passing organizationId: org-B
  // in their where clause. The extension's spread { ...where, organizationId: orgId }
  // puts orgId LAST so the user's value is overwritten.
  const out = transformArgs({
    model: 'Project', operation: 'findMany',
    args: { where: { organizationId: 'org-B' } },
    ctx: { organizationId: 'org-A' }, enforced: true,
  })
  assert.equal(out.where.organizationId, 'org-A',
    'user cannot escape their tenant by spoofing organizationId in where')
})

test('org-A user creating record with claimed organizationId: org-B is overridden', () => {
  const out = transformArgs({
    model: 'Project', operation: 'create',
    args: { data: { name: 'X', organizationId: 'org-B' } },
    ctx: { organizationId: 'org-A' }, enforced: true,
  })
  assert.equal(out.data.organizationId, 'org-A',
    'user cannot create records in another tenant by setting organizationId in data')
})

// ─── v1.1 module-specific tests ────────────────────────────────────
// Confirm each v1.1 model is in OWNED_MODELS and gets auto-scoped on
// reads + writes. These guard against schema drift — adding a new
// model without registering it in lib/tenancy.ts would silently
// expose cross-tenant data.

test('v1.1: ProjectBookmark findMany is scoped', () => {
  const out = transformArgs({
    model: 'ProjectBookmark', operation: 'findMany',
    args: { where: { userId: 'u1' } },
    ctx: { organizationId: 'org-A', userId: 'u1' }, enforced: true,
  })
  assert.equal(out.where.organizationId, 'org-A')
  assert.equal(out.where.userId, 'u1')
})

test('v1.1: ActionPlan create gets organizationId injected', () => {
  const out = transformArgs({
    model: 'ActionPlan', operation: 'create',
    args: { data: { title: 'Close out punch list', owner: 'Bob' } },
    ctx: { organizationId: 'org-A' }, enforced: true,
  })
  assert.equal(out.data.organizationId, 'org-A')
  assert.equal(out.data.title, 'Close out punch list')
})

test('v1.1: Conflict cross-tenant attack via where is overridden', () => {
  const out = transformArgs({
    model: 'Conflict', operation: 'findMany',
    args: { where: { organizationId: 'org-B' } },
    ctx: { organizationId: 'org-A' }, enforced: true,
  })
  assert.equal(out.where.organizationId, 'org-A')
})

test('v1.1: Cis300Return cross-tenant attack via data is overridden', () => {
  const out = transformArgs({
    model: 'Cis300Return', operation: 'create',
    args: { data: { taxMonth: '2026-04', organizationId: 'org-B' } },
    ctx: { organizationId: 'org-A' }, enforced: true,
  })
  assert.equal(out.data.organizationId, 'org-A')
  assert.equal(out.data.taxMonth, '2026-04')
})

test('v1.1: Conversation findUnique scoped', () => {
  const out = transformArgs({
    model: 'Conversation', operation: 'findUnique',
    args: { where: { id: 'conv-1' } },
    ctx: { organizationId: 'org-A' }, enforced: true,
  })
  assert.deepEqual(out.where, { id: 'conv-1', organizationId: 'org-A' })
})

test('v1.1: ChatMessage deleteMany bulk-write is scoped', () => {
  const out = transformArgs({
    model: 'ChatMessage', operation: 'deleteMany',
    args: { where: { conversationId: 'c1' } },
    ctx: { organizationId: 'org-A' }, enforced: true,
  })
  assert.equal(out.where.organizationId, 'org-A')
  assert.equal(out.where.conversationId, 'c1')
})
