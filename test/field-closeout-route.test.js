const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function handler(prisma, auth = { role: 'member', personaRole: 'project_manager', userId: 'u1', session: { user: { role: 'project_manager', email: 'pm@example.com' } } }, createActivity = async args => ({ id: 'a1', ...args, createdAt: new Date() })) {
  class NextResponse {
    static json(body, options = {}) { return { body, status: options.status || 200 } }
  }
  const mocks = {
    'next/server': { NextResponse },
    '@/lib/db': { prisma },
    '@/lib/requireAuth': { requireOrg: async () => auth, actorName: () => 'Site PM' },
    '@/lib/rbac': { canManage: role => role === 'admin' || role === 'owner' },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/errors': { reportError: () => {} },
    '@/lib/programme-access': { programmeProjectWhere: id => ({ id }) },
    '@/lib/activity': { createActivity },
  }
  const code = ts.transpileModule(fs.readFileSync('app/api/field-closeout/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, {
    exports,
    require: name => {
      if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`)
      return mocks[name]
    },
    Date, Number, String, Set, URL, console,
  })
  return exports
}

function prismaFixture({ critical = 0, open = 0, qa = 0, failed = 0, handovers = [], production = [], timeEntries = [], diary = 1, photos = 1, urgent = 0 } = {}) {
  let constraintCalls = 0
  return {
    project: { findFirst: async () => ({ id: 'p1', name: 'Site One' }) },
    fieldConstraint: {
      count: async () => {
        constraintCalls++
        return constraintCalls % 2 === 1 ? open : critical
      },
    },
    inspection: {
      count: async args => args.where.status === 'failed' ? failed : qa,
    },
    fieldHandover: { findMany: async () => handovers },
    fieldProductionLog: { findMany: async () => production },
    timeEntry: { findMany: async () => timeEntries },
    activity: {
      count: async () => diary,
      findFirst: async () => null,
    },
    document: { count: async () => photos },
    task: { count: async () => urgent },
  }
}

test('field close-out GET aggregates operational evidence and exposes close permission', async () => {
  const prisma = prismaFixture({
    open: 2,
    critical: 1,
    qa: 1,
    handovers: [{ id: 'h1', acceptedAt: null }],
    production: [{ plannedQty: 10, installedQty: 8 }],
    timeEntries: [{ id: 't1', hours: 8, approved: false, memberId: 'm1' }],
    diary: 1,
    photos: 4,
    urgent: 2,
  })
  const { GET } = handler(prisma)
  const response = await GET({ url: 'http://local/api/field-closeout?projectId=p1&date=2026-09-26' })
  assert.equal(response.status, 200)
  assert.equal(response.body.canClose, true)
  assert.equal(response.body.metrics.productionPct, 80)
  assert.equal(response.body.metrics.hours, 8)
  assert.equal(response.body.metrics.photos, 4)
  assert.equal(response.body.metrics.openUrgentTasks, 2)
  assert.ok(response.body.blocking.some(x => x.includes('critical constraint')))
  assert.ok(response.body.blocking.some(x => x.includes('hold/witness')))
  assert.ok(response.body.warnings.some(x => x.includes('awaiting approval')))
})

test('field close-out POST requires acknowledgement when blockers or warnings remain', async () => {
  const prisma = prismaFixture({ open: 1, critical: 1, diary: 0, photos: 0 })
  let writes = 0
  const { POST } = handler(prisma, undefined, async () => { writes++; return { id: 'a1' } })
  const response = await POST({ json: async () => ({ projectId: 'p1', date: '2026-09-26' }) })
  assert.equal(response.status, 409)
  assert.equal(response.body.code, 'CLOSEOUT_ACK_REQUIRED')
  assert.equal(writes, 0)
})

test('field close-out POST records auditable evidence after acknowledgement', async () => {
  const prisma = prismaFixture({ open: 1, critical: 1, diary: 0 })
  let activityArgs
  const { POST } = handler(prisma, undefined, async args => {
    activityArgs = args
    return { id: 'a1', ...args, createdAt: new Date('2026-09-26T17:00:00Z') }
  })
  const response = await POST({ json: async () => ({ projectId: 'p1', date: '2026-09-26', acknowledgeOpenItems: true, notes: 'Handover complete' }) })
  assert.equal(response.status, 201)
  assert.equal(response.body.closed, true)
  assert.equal(activityArgs.action, 'field shift closed: 2026-09-26')
  const detail = JSON.parse(activityArgs.detail)
  assert.equal(detail.type, 'shift_closeout')
  assert.equal(detail.acknowledgedOpenItems, true)
  assert.equal(detail.notes, 'Handover complete')
})

test('operative can review close-out but cannot formally close the shift', async () => {
  const auth = { role: 'member', personaRole: 'operative', userId: 'u1', session: { user: { role: 'operative', email: 'op@example.com' } } }
  const prisma = prismaFixture()
  const { GET, POST } = handler(prisma, auth)
  const get = await GET({ url: 'http://local/api/field-closeout?projectId=p1&date=2026-09-26' })
  assert.equal(get.status, 200)
  assert.equal(get.body.canClose, false)
  const post = await POST({ json: async () => ({ projectId: 'p1', date: '2026-09-26' }) })
  assert.equal(post.status, 403)
})

test('field close-out duplicate detection is keyed to shift date, not activity creation time', async () => {
  const prisma = prismaFixture()
  let where
  prisma.activity.findFirst = async args => {
    where = args.where
    return {
      id: 'existing-close',
      actorName: 'Night PM',
      createdAt: new Date('2026-09-27T00:20:00Z'),
      detail: '{}',
    }
  }
  let writes = 0
  const { POST } = handler(prisma, undefined, async () => { writes++; return { id: 'new' } })
  const response = await POST({ json: async () => ({
    projectId: 'p1',
    date: '2026-09-26',
    acknowledgeOpenItems: true,
  }) })
  assert.equal(response.status, 409)
  assert.equal(response.body.code, 'SHIFT_ALREADY_CLOSED')
  assert.equal(writes, 0)
  assert.equal(where.action, 'field shift closed: 2026-09-26')
  assert.equal(where.createdAt, undefined)
})
