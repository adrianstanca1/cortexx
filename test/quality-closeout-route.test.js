const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const controls = require('../lib/field-controls')
const qualityCloseout = require('../lib/quality-closeout')

class NextResponse {
  static json(body, options = {}) { return { body, status: options.status || 200 } }
}

function compile(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
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

function snagHandler(prisma, authorizeUploadReference = async () => null) {
  const auth = { orgId: 'org1', userId: 'u1', role: 'member', session: { user: { email: 'pm@example.com', role: 'project_manager' } } }
  return compile('app/api/snags/[id]/route.ts', {
    'next/server': { NextResponse },
    '@/lib/db': { prisma },
    '@/lib/requireAuth': { requireOrg: async () => auth, actorName: () => 'Site PM' },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/audit': { auditLog: () => {}, requestMeta: () => ({}) },
    '@/lib/errors': { reportError: () => {} },
    '@/lib/tenancy': { runWithOrg: (_ctx, fn) => fn() },
    '@/lib/upload-provenance': { authorizeUploadReference },
    '@/lib/field-controls': controls,
    '@/lib/quality-closeout': qualityCloseout,
  })
}

function inspectionHandler(prisma, authorizeUploadReference = async () => null) {
  const auth = { user: { id: 'u1', email: 'pm@example.com', role: 'project_manager' } }
  return compile('app/api/inspections/[id]/route.ts', {
    'next/server': { NextResponse },
    '@/lib/db': { prisma },
    '@/lib/requireAuth': { requireAuth: async () => auth, actorName: () => 'Site PM' },
    '@/lib/audit': { auditLog: () => {}, requestMeta: () => ({}) },
    '@/lib/upload-provenance': { authorizeUploadReference },
    '@/lib/field-controls': controls,
    '@/lib/quality-closeout': qualityCloseout,
  })
}

function snagFixture(overrides = {}) {
  let updated = null
  const existing = {
    id: 's1', projectId: 'p1', title: 'Loose panel', status: 'in_progress', resolution: null,
    closeoutEvidence: {}, closedAt: null, closedBy: null, closeoutVerifiedAt: null,
    ...overrides,
  }
  return {
    prisma: {
      snag: {
        findUnique: async () => existing,
        update: async ({ data }) => { updated = { ...existing, ...data, project: { id: 'p1', name: 'Site' } }; return updated },
        delete: async () => ({}),
      },
      activity: { create: async () => ({ id: 'a1' }) },
    },
    getUpdated: () => updated,
  }
}

test('snag cannot close without resolution and trusted evidence', async () => {
  const fx = snagFixture()
  const { PUT } = snagHandler(fx.prisma)
  const response = await PUT({ json: async () => ({ status: 'closed' }) }, { params: Promise.resolve({ id: 's1' }) })
  assert.equal(response.status, 409)
  assert.deepEqual(Array.from(response.body.missing), ['resolution', 'closeout_evidence'])
  assert.equal(fx.getUpdated(), null)
})

test('snag closes with auditable rectification evidence and actor', async () => {
  const fx = snagFixture()
  const { PUT } = snagHandler(fx.prisma)
  const response = await PUT({ json: async () => ({
    status: 'closed',
    resolution: 'Re-fixed panel and torque checked fasteners',
    closeoutEvidence: { photoUrls: ['/api/uploads/fixed.jpg'] },
  }) }, { params: Promise.resolve({ id: 's1' }) })
  assert.equal(response.status, 200)
  assert.equal(response.body.status, 'closed')
  assert.equal(response.body.closedBy, 'Site PM')
  assert.ok(response.body.closedAt instanceof Date)
  assert.ok(response.body.closeoutVerifiedAt instanceof Date)
  assert.deepEqual(Array.from(response.body.closeoutEvidence.photoUrls), ['/api/uploads/fixed.jpg'])
})

test('closed snag is retained for audit instead of being deleted', async () => {
  const fx = snagFixture({ status: 'closed', closeoutVerifiedAt: new Date() })
  const { DELETE } = snagHandler(fx.prisma)
  const response = await DELETE({}, { params: Promise.resolve({ id: 's1' }) })
  assert.equal(response.status, 409)
})

function inspectionFixture(overrides = {}) {
  let updated = null
  const existing = {
    id: 'i1', projectId: 'p1', title: 'Facade QA', type: 'quality', pointType: 'inspection',
    status: 'failed', overallResult: 'fail', completedAt: new Date('2026-09-25T10:00:00Z'),
    checklistItems: [{ id: '1', label: 'Panel fixed', result: 'pass' }], releaseStatus: 'not_required',
    evidence: {}, witnessedAt: null, releasedAt: null,
    ...overrides,
  }
  return {
    prisma: {
      inspection: {
        findUnique: async () => existing,
        update: async ({ data }) => { updated = { ...existing, ...data, project: { id: 'p1', name: 'Site' }, drawing: null, drawingRevision: null }; return updated },
        delete: async () => ({}),
      },
      activity: { create: async () => ({ id: 'a1' }) },
    },
    getUpdated: () => updated,
  }
}

test('failed inspection requires verification evidence before passing', async () => {
  const fx = inspectionFixture()
  const { PATCH } = inspectionHandler(fx.prisma)
  const response = await PATCH({ json: async () => ({ status: 'passed' }) }, { params: Promise.resolve({ id: 'i1' }) })
  assert.equal(response.status, 409)
  assert.deepEqual(Array.from(response.body.missing), ['verification_evidence'])
  assert.equal(fx.getUpdated(), null)
})

test('failed inspection can pass with evidence and records verification actor/time', async () => {
  const fx = inspectionFixture()
  const { PATCH } = inspectionHandler(fx.prisma)
  const response = await PATCH({ json: async () => ({ status: 'passed', evidence: { photoUrls: ['/api/uploads/rework.jpg'] } }) }, { params: Promise.resolve({ id: 'i1' }) })
  assert.equal(response.status, 200)
  assert.equal(response.body.status, 'passed')
  assert.equal(response.body.closeoutVerifiedBy, 'Site PM')
  assert.ok(response.body.closeoutVerifiedAt instanceof Date)
})

test('inspection cannot pass while checklist contains a failed item', async () => {
  const fx = inspectionFixture({ status: 'in_progress', overallResult: null, completedAt: null, checklistItems: [{ id: '1', label: 'Panel fixed', result: 'fail' }] })
  const { PATCH } = inspectionHandler(fx.prisma)
  const response = await PATCH({ json: async () => ({ status: 'passed' }) }, { params: Promise.resolve({ id: 'i1' }) })
  assert.equal(response.status, 409)
  assert.deepEqual(Array.from(response.body.missing), ['failed_checklist_items'])
})

test('completed inspection is retained for audit', async () => {
  const fx = inspectionFixture({ status: 'passed', overallResult: 'pass' })
  const { DELETE } = inspectionHandler(fx.prisma)
  const response = await DELETE({}, { params: Promise.resolve({ id: 'i1' }) })
  assert.equal(response.status, 409)
})


test('snag closeout rejects local evidence without tenant upload provenance', async () => {
  const fx = snagFixture()
  const denied = async () => NextResponse.json({ error: 'Upload provenance not found' }, { status: 400 })
  const { PUT } = snagHandler(fx.prisma, denied)
  const response = await PUT({ json: async () => ({
    resolution: 'Rectification completed',
    closeoutEvidence: { photoUrls: ['/api/uploads/foreign.jpg'] },
  }) }, { params: Promise.resolve({ id: 's1' }) })
  assert.equal(response.status, 400)
  assert.equal(fx.getUpdated(), null)
})

test('inspection verification rejects local evidence without tenant upload provenance', async () => {
  const fx = inspectionFixture()
  const denied = async () => NextResponse.json({ error: 'Upload provenance not found' }, { status: 400 })
  const { PATCH } = inspectionHandler(fx.prisma, denied)
  const response = await PATCH({ json: async () => ({
    status: 'passed',
    evidence: { photoUrls: ['/api/uploads/foreign.jpg'] },
  }) }, { params: Promise.resolve({ id: 'i1' }) })
  assert.equal(response.status, 400)
  assert.equal(fx.getUpdated(), null)
})
