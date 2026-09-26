const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const resources = require('../lib/programme-resources')

class NextResponse { static json(body, options = {}) { return { body, status: options.status || 200 } } }

function loadRoute({ role = 'project_manager', prisma }) {
  const auth = { user: { id: 'u1', email: 'pm@example.com', role } }
  const mocks = {
    'next/server': { NextResponse },
    '@/lib/db': { prisma },
    '@/lib/requireAuth': { requireAuth: async () => auth, actorName: () => 'Planner' },
    '@/lib/errors': { reportError: () => {} },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/audit': { auditLog: () => {}, requestMeta: () => ({}) },
    '@/lib/programme-access': { canPlanProgramme: a => ['project_manager', 'company_admin'].includes(a.user.role), programmeProjectWhere: id => ({ id }) },
    '@/lib/programme-resources': resources,
  }
  const source = fs.readFileSync('app/api/projects/[id]/programme/resources/route.ts', 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => { if (!(name in mocks)) throw new Error(`Unexpected import ${name}`); return mocks[name] }, Date, Number, String, Set, JSON, console })
  return exports
}

function fixture() {
  const state = { created: null }
  const prisma = {
    project: { findFirst: async () => ({ id: 'p1', name: 'Project' }) },
    programmeActivity: {
      findFirst: async () => ({ id: 'a1', title: 'Cladding', plannedStart: new Date('2026-09-28T00:00:00Z') }),
      findMany: async () => [],
    },
    programmeResourceAllocation: {
      findFirst: async () => null,
      findMany: async () => [],
      create: async args => { state.created = args.data; return { id: 'r1', ...args.data, activity: { id: 'a1', title: 'Cladding', plannedStart: new Date(), plannedEnd: new Date() }, teamMember: args.data.teamMemberId ? { id: args.data.teamMemberId, name: 'Alex' } : null, equipment: null, material: null } },
    },
    teamMember: { findFirst: async args => args.where.id === 'm1' ? { id: 'm1', name: 'Alex' } : null },
    equipment: { findFirst: async () => null, findMany: async () => [] },
    material: { findFirst: async () => null, findMany: async () => [] },
    assignment: { findMany: async () => [] },
    activity: { create: async () => ({ id: 'log1' }) },
  }
  return { prisma, state }
}

const request = body => ({ headers: { get: () => null }, json: async () => body })
const params = { params: Promise.resolve({ id: 'p1' }) }

test('Foreman cannot mutate programme resource loading', async () => {
  const { prisma } = fixture()
  const { POST } = loadRoute({ role: 'foreman', prisma })
  const res = await POST(request({ activityId: 'a1', resourceType: 'labour', label: 'Crew', quantity: 4 }), params)
  assert.equal(res.status, 403)
})

test('named labour resource must belong to project assignment', async () => {
  const { prisma } = fixture()
  prisma.teamMember.findFirst = async () => null
  const { POST } = loadRoute({ prisma })
  const res = await POST(request({ activityId: 'a1', resourceType: 'labour', teamMemberId: 'other', quantity: 4 }), params)
  assert.equal(res.status, 400)
  assert.match(res.body.error, /assigned to this project/)
})

test('named labour allocation is normalized to one person and project activity', async () => {
  const { prisma, state } = fixture()
  const { POST } = loadRoute({ prisma })
  const res = await POST(request({ activityId: 'a1', resourceType: 'labour', teamMemberId: 'm1', quantity: 9, hoursPerDay: 7.5 }), params)
  assert.equal(res.status, 201)
  assert.equal(state.created.quantity, 1)
  assert.equal(state.created.hoursPerDay, 7.5)
  assert.equal(state.created.unit, 'people')
  assert.equal(state.created.projectId, 'p1')
})

test('generic resource demand requires a human-readable label', async () => {
  const { prisma } = fixture()
  const { POST } = loadRoute({ prisma })
  const res = await POST(request({ activityId: 'a1', resourceType: 'equipment', quantity: 2 }), params)
  assert.equal(res.status, 400)
  assert.match(res.body.error, /needs a label/)
})
