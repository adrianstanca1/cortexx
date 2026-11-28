const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const ORG_ID = 'org-1'

function loadModule(filePath, mocks = {}) {
  const source = fs.readFileSync(path.join(root, filePath), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, {
    exports,
    require: name => {
      if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`)
      return mocks[name]
    },
    URL,
    URLSearchParams,
    decodeURIComponent,
    Date,
    Number,
    String,
    Set,
    Error,
    console,
    Buffer,
  })
  return exports
}

// JSON round-trip normalizes VM-realm objects into host-realm values before
// deepStrictEqual; VM object literals fail prototype identity checks otherwise.
function deepEqual(actual, expected) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)))
}

class NextResponse {
  static json(body, options = {}) { return { body, status: options.status || 200 } }
}

const jsonRequest = body => ({
  url: 'http://localhost/api/training/courses/course-1',
  nextUrl: { pathname: '/api/training/courses/course-1' },
  headers: { get: () => null },
  json: async () => body,
})
const emptyRequest = () => ({
  url: 'http://localhost/api/training/courses/course-1',
  nextUrl: { pathname: '/api/training/courses/course-1' },
  headers: { get: () => null },
})

let calls
function reset() {
  calls = { audit: [], findUnique: [], findMany: [], create: [], update: [], delete: [], transactions: 0 }
}

const withRouteMocks = {
  'next/server': { NextResponse },
  '@/lib/withRoute': {
    withRoute: handler => async (req, ctx) => handler({
      req,
      params: ctx?.params ? await ctx.params : {},
      userId: 'user-1',
      orgId: ORG_ID,
      role: 'admin',
      session: { user: { id: 'user-1' } },
    }),
    decodePathSegment: value => {
      if (value === undefined) return value
      try { return decodeURIComponent(value) } catch { return value }
    },
  },
  '@/lib/rateLimit': { enforceRateLimit: async () => null },
  '@/lib/audit': { auditLog: () => {}, requestMeta: () => ({ ipAddress: null, userAgent: null }) },
  '@/lib/errors': { reportError: () => {} },
}

function makePrisma(found = null) {
  const db = {
    trainingCourse: {
      findUnique: async args => { calls.findUnique.push(args); return found && args.where.id === 'course-1' && args.where.organizationId === ORG_ID ? found : null },
      findMany: async args => { calls.findMany.push(args); return [] },
      create: async args => { calls.create.push(args); return { id: 'course-1', ...args.data } },
      update: async args => { calls.update.push(args); return { id: 'course-1', ...args.data } },
      delete: async args => { calls.delete.push(args); return { id: 'course-1' } },
    },
    certification: { findMany: async args => { calls.findMany.push(args); return [] } },
    teamMember: { findUnique: async args => ({ id: args.where.id }) },
    auditEvent: { create: async args => { calls.audit.push(args); return args.data } },
  }
  db.$transaction = async callback => { calls.transactions += 1; return callback(db) }
  return db
}

function loadCourseDetail(prisma) {
  return loadModule('app/api/training/courses/[id]/route.ts', {
    ...withRouteMocks,
    '@prisma/client': { Prisma: { PrismaClientKnownRequestError: class {} } },
    '@/lib/db': { prisma },
  })
}
function loadCourseList(prisma) {
  return loadModule('app/api/training/courses/route.ts', {
    ...withRouteMocks,
    '@prisma/client': { Prisma: { PrismaClientKnownRequestError: class {} } },
    '@/lib/db': { prisma },
  })
}
function loadCertificationList(prisma) {
  return loadModule('app/api/training/route.ts', {
    ...withRouteMocks,
    '@prisma/client': { Prisma: { PrismaClientKnownRequestError: class {} } },
    '@/lib/db': { prisma },
  })
}

const params = id => ({ params: Promise.resolve({ id }) })

test('course detail GET binds the decoded id to the active organization', async () => {
  reset()
  const prisma = makePrisma({ id: 'course-1', name: 'SMSTS' })
  const { GET } = loadCourseDetail(prisma)
  prisma.trainingCourse.findUnique = async args => {
    calls.findUnique.push(args)
    return args.where.id === 'c/123' && args.where.organizationId === ORG_ID ? { id: 'c/123', name: 'Encoded' } : null
  }
  const missing = await GET(emptyRequest(), params('course-9'))
  assert.equal(missing.status, 404)
  deepEqual(calls.findUnique[0].where, { id: 'course-9', organizationId: ORG_ID })

  const response = await GET(emptyRequest(), params('c%2F123'))
  assert.equal(response.status, 200)
  deepEqual(calls.findUnique[1].where, { id: 'c/123', organizationId: ORG_ID })
})

test('course PATCH validates input, atomically scopes the update, and records an audit event', async () => {
  reset()
  const { PATCH } = loadCourseDetail(makePrisma({ id: 'course-1' }))
  assert.equal((await PATCH(jsonRequest({ validityDays: 0 }), params('course-1'))).status, 400)
  assert.equal(calls.update.length, 0)

  const response = await PATCH(jsonRequest({ name: ' SMSTS ', validityDays: 365, archived: true }), params('course-1'))
  assert.equal(response.status, 200)
  assert.equal(calls.transactions, 1)
  deepEqual(calls.update[0].where, { id: 'course-1', organizationId: ORG_ID })
  assert.equal(calls.update[0].data.name, 'SMSTS')
  assert.equal(calls.update[0].data.validityDays, 365)
  assert.ok(calls.update[0].data.archivedAt instanceof Date)
  assert.equal(calls.audit.length, 1)
  assert.equal(calls.audit[0].data.action, 'trainingCourse.update')
  assert.equal(calls.audit[0].data.organizationId, ORG_ID)
})

test('course DELETE removes by org-bound id and audits inside the same transaction', async () => {
  reset()
  const { DELETE } = loadCourseDetail(makePrisma({ id: 'course-1' }))
  const response = await DELETE(emptyRequest(), params('course-1'))
  deepEqual(response.body, { success: true })
  assert.equal(calls.transactions, 1)
  deepEqual(calls.delete[0].where, { id: 'course-1', organizationId: ORG_ID })
  assert.equal(calls.audit[0].data.action, 'trainingCourse.delete')
})

test('course list excludes archived courses unless requested', async () => {
  reset()
  const { GET } = loadCourseList(makePrisma())
  const base = { nextUrl: { pathname: '/api/training/courses' }, headers: { get: () => null } }
  await GET({ ...base, url: 'http://localhost/api/training/courses' }, { params: Promise.resolve({}) })
  deepEqual(calls.findMany[0].where, { archivedAt: null })
  await GET({ ...base, url: 'http://localhost/api/training/courses?archived=true&category=safety' }, { params: Promise.resolve({}) })
  assert.equal(calls.findMany.length, 2)
  deepEqual(calls.findMany[1].where, { category: 'safety' })
})

test('certification list enriches expiry status and applies status/category filters', async () => {
  reset()
  const prisma = makePrisma()
  prisma.certification.findMany = async args => {
    calls.findMany.push(args)
    return [
      { id: 'cert-expired', expiryDate: new Date(Date.now() - 86_400_000), category: 'safety' },
      { id: 'cert-valid', expiryDate: new Date(Date.now() + 365 * 86_400_000), category: 'training' },
      { id: 'cert-none', expiryDate: null, category: 'qualification' },
    ]
  }
  const { GET } = loadCertificationList(prisma)
  const req = query => ({ url: `http://localhost/api/training${query}`, nextUrl: { pathname: '/api/training' }, headers: { get: () => null } })
  const all = await GET(req(''), { params: Promise.resolve({}) })
  assert.equal(all.body.counts.total, 3)
  assert.equal(all.body.counts.expired, 1)
  assert.equal(all.body.counts.valid, 1)
  assert.equal(all.body.counts.no_expiry, undefined)

  const filtered = await GET(req('?status=expired&category=safety'), { params: Promise.resolve({}) })
  deepEqual(filtered.body.certifications.map(c => c.id), ['cert-expired'])
  deepEqual(calls.findMany[1].where, { category: 'safety' })
})
