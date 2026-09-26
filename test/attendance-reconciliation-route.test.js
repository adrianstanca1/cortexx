const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const attendance = require('../lib/attendance-reconciliation')

class NextResponse {
  static json(body, options = {}) { return { body, status: options.status || 200 } }
}

function loadRoute({ auth, prisma, audit = () => {} }) {
  const mocks = {
    'next/server': { NextResponse },
    '@prisma/client': {},
    '@/lib/db': { prisma },
    '@/lib/requireAuth': { requireOrg: async () => auth, actorName: () => 'Site Manager' },
    '@/lib/rbac': { canManage: role => role === 'admin' || role === 'owner' },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/errors': { reportError: () => {} },
    '@/lib/audit': { auditLog: audit, requestMeta: () => ({ ipAddress: null, userAgent: null }) },
    '@/lib/attendance-reconciliation': attendance,
  }
  const code = ts.transpileModule(fs.readFileSync('app/api/attendance-reconciliation/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, {
    exports,
    require: name => {
      if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`)
      return mocks[name]
    },
    Date, Number, String, Boolean, JSON, URL, console,
  })
  return exports
}

const pmAuth = {
  role: 'member',
  personaRole: 'project_manager',
  userId: 'u-pm',
  orgId: 'org-a',
  session: { user: { role: 'project_manager', email: 'pm@example.com', name: 'PM' } },
}

function fixture(overrides = {}) {
  const state = { checkWhere: null, timeWhere: null, created: null, updated: null, activity: null }
  const db = {
    siteCheckIn: {
      findMany: async args => { state.checkWhere = args.where; return overrides.checkins || [] },
    },
    timeEntry: {
      findMany: async args => { state.timeWhere = args.where; return overrides.timeEntries || [] },
      create: async args => {
        state.created = args.data
        return { id: 't-new', ...args.data, member: { id: 'm1', name: 'Alex' }, project: { id: 'p1', name: 'Facade' } }
      },
      update: async args => {
        state.updated = args.data
        return { id: args.where.id, memberId: 'm1', projectId: 'p1', date: new Date('2026-09-21T00:00:00Z'), ...args.data, member: { id: 'm1', name: 'Alex' }, project: { id: 'p1', name: 'Facade' } }
      },
    },
    project: { findFirst: async () => ({ id: 'p1', name: 'Facade' }) },
    teamMember: { findFirst: async () => ({ id: 'm1', name: 'Alex' }) },
    activity: { create: async args => { state.activity = args.data; return { id: 'a1' } } },
    $transaction: async fn => fn(db),
  }
  return { prisma: db, state }
}

test('operative cannot access manager attendance reconciliation', async () => {
  const { prisma } = fixture()
  const auth = { ...pmAuth, personaRole: 'operative', session: { user: { role: 'operative', email: 'op@example.com' } } }
  const { GET } = loadRoute({ auth, prisma })
  const response = await GET({ nextUrl: new URL('http://local/api/attendance-reconciliation?week=39&year=2026') })
  assert.equal(response.status, 403)
})

test('Project Manager reconciliation reads only assigned projects', async () => {
  const { prisma, state } = fixture()
  const { GET } = loadRoute({ auth: pmAuth, prisma })
  const response = await GET({ nextUrl: new URL('http://local/api/attendance-reconciliation?week=39&year=2026') })
  assert.equal(response.status, 200)
  assert.equal(state.checkWhere.project.assignments.some.member.email.equals, 'pm@example.com')
  assert.equal(state.timeWhere.project.assignments.some.member.email.equals, 'pm@example.com')
})

test('manager can create unapproved time from completed attendance with audit evidence', async () => {
  const checkins = [{
    id: 'c1', memberId: 'm1', projectId: 'p1',
    checkedInAt: new Date('2026-09-21T07:00:00Z'), checkedOutAt: new Date('2026-09-21T15:00:00Z'),
    member: { id: 'm1', name: 'Alex' }, project: { id: 'p1', name: 'Facade' },
  }]
  const { prisma, state } = fixture({ checkins })
  let audited
  const { POST } = loadRoute({ auth: pmAuth, prisma, audit: payload => { audited = payload } })
  const response = await POST({
    headers: { get: () => null },
    json: async () => ({ memberId: 'm1', projectId: 'p1', date: '2026-09-21' }),
  })
  assert.equal(response.status, 200)
  assert.equal(state.created.hours, 8)
  assert.equal(state.created.approved, false)
  assert.equal(audited.action, 'attendance.reconcile')
  assert.equal(audited.metadata.previousLoggedHours, 0)
  assert.equal(state.activity.action, 'reconciled attendance for Alex')
})

test('approved time cannot be changed by attendance reconciliation', async () => {
  const checkins = [{
    id: 'c1', memberId: 'm1', projectId: 'p1',
    checkedInAt: new Date('2026-09-21T07:00:00Z'), checkedOutAt: new Date('2026-09-21T15:00:00Z'),
    member: { id: 'm1', name: 'Alex' }, project: { id: 'p1', name: 'Facade' },
  }]
  const timeEntries = [{
    id: 't1', memberId: 'm1', projectId: 'p1', date: new Date('2026-09-21T00:00:00Z'), hours: 7, approved: true,
    member: { id: 'm1', name: 'Alex' }, project: { id: 'p1', name: 'Facade' },
  }]
  const { prisma, state } = fixture({ checkins, timeEntries })
  const { POST } = loadRoute({ auth: pmAuth, prisma })
  const response = await POST({ headers: { get: () => null }, json: async () => ({ memberId: 'm1', projectId: 'p1', date: '2026-09-21' }) })
  assert.equal(response.status, 409)
  assert.match(response.body.error, /Unapprove/)
  assert.equal(state.updated, null)
})
