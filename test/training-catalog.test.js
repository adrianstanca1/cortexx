const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')

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

const withRouteMocks = {
  'next/server': { NextResponse },
  '@/lib/withRoute': {
    withRoute: handler => async (req, ctx) => handler({
      req,
      params: ctx?.params ? await ctx.params : {},
      userId: 'user-1',
      orgId: 'org-1',
      role: 'admin',
      session: { user: { id: 'user-1' } },
    }),
    decodePathSegment: value => {
      if (value === undefined) return value
      try { return decodeURIComponent(value) } catch { return value }
    },
  },
  '@/lib/rateLimit': { enforceRateLimit: async () => null },
  '@/lib/audit': { auditLog: (...args) => calls.audit.push(args), requestMeta: () => ({ ipAddress: null, userAgent: null }) },
  '@/lib/errors': { reportError: () => {} },
}

let calls

function coursePrisma(existing = null) {
  return {
    trainingCourse: {
      findUnique: async args => { calls.findUnique.push(args); return existing },
      update: async args => { calls.update.push(args); return { id: 'course-1', ...args.data } },
      delete: async args => { calls.delete.push(args); return existing },
      findMany: async args => { calls.findMany.push(args); return [] },
      create: async args => { calls.create.push(args); return { id: 'course-1', ...args.data } },
    },
    certification: {
      findUnique: async args => { calls.findUnique.push(args); return existing },
      findMany: async args => { calls.findMany.push(args); return [] },
      create: async args => { calls.create.push(args); return { id: 'cert-1', ...args.data } },
      update: async args => { calls.update.push(args); return { id: 'cert-1', ...args.data } },
      delete: async args => { calls.delete.push(args); return existing },
    },
    teamMember: {
      findUnique: async args => { calls.findUnique.push(args); return { id: args.where.id } },
    },
  }
}

function setup() {
  calls = { audit: [], findUnique: [], findMany: [], create: [], update: [], delete: [] }
  return coursePrisma()
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

test('course detail GET looks up the decoded course id and 404s when absent', async () => {
  const prisma = setup()
  const { GET } = loadCourseDetail(prisma)
  const missing = await GET(emptyRequest(), { params: Promise.resolve({ id: 'course-1' }) })
  assert.equal(missing.status, 404)
  assert.deepEqual(calls.findUnique[0], { where: { id: 'course-1' } })

  calls = { audit: [], findUnique: [], findMany: [], create: [], update: [], delete: [] }
  const found = { id: 'course-1', name: 'SMSTS' }
  const { GET: GET2 } = loadCourseDetail(coursePrisma(found))
  const response = await GET2(emptyRequest(), { params: Promise.resolve({ id: 'course-1' }) })
  assert.equal(response.status, 200)
  assert.deepEqual(response.body, found)
})

test('course PATCH validates input, scopes the update by id, and records an audit event', async () => {
  const prisma = setup()
  const { PATCH } = loadCourseDetail(prisma)
  const invalid = await PATCH(jsonRequest({ validityDays: 0 }), { params: Promise.resolve({ id: 'course-1' }) })
  assert.equal(invalid.status, 400)
  assert.equal(calls.update.length, 0)

  const response = await PATCH(jsonRequest({ name: ' SMSTS ', validityDays: 365, archived: true }), { params: Promise.resolve({ id: 'course-1' }) })
  assert.equal(response.status, 200)
  assert.deepEqual(calls.update[0].where, { id: 'course-1' })
  assert.equal(calls.update[0].data.name, 'SMSTS')
  assert.equal(calls.update[0].data.validityDays, 365)
  assert.ok(calls.update[0].data.archivedAt instanceof Date)
  assert.equal(calls.audit.length, 1)
  assert.deepEqual(calls.audit[0][0], {
    action: 'trainingCourse.update',
    resourceType: 'TrainingCourse',
    resourceId: 'course-1',
    userId: 'user-1',
    ipAddress: null,
    userAgent: null,
  })
})

test('course DELETE removes by id and records an audit event', async () => {
  const prisma = setup()
  const { DELETE } = loadCourseDetail(prisma)
  const response = await DELETE(emptyRequest(), { params: Promise.resolve({ id: 'course-1' }) })
  assert.deepEqual(response.body, { success: true })
  assert.deepEqual(calls.delete[0], { where: { id: 'course-1' } })
  assert.equal(calls.audit[0][0].action, 'trainingCourse.delete')
})

test('course list excludes archived courses unless requested', async () => {
  const prisma = setup()
  const { GET } = loadCourseList(prisma)
  await GET({ url: 'http://localhost/api/training/courses', nextUrl: { pathname: '/api/training/courses' }, headers: { get: () => null } }, { params: Promise.resolve({}) })
  assert.deepEqual(calls.findMany[0].where, { archivedAt: null })

  await GET({ url: 'http://localhost/api/training/courses?archived=true&category=safety', nextUrl: { pathname: '/api/training/courses' }, headers: { get: () => null } }, { params: Promise.resolve({}) })
  assert.deepEqual(calls.findMany[1].where, { category: 'safety' })
})

test('certification list enriches expiry status and applies status/category filters', async () => {
  calls = { audit: [], findUnique: [], findMany: [], create: [], update: [], delete: [] }
  const prisma = coursePrisma()
  prisma.certification.findMany = async args => {
    calls.findMany.push(args)
    return [
      { id: 'cert-expired', expiryDate: new Date(Date.now() - 86_400_000), category: 'safety' },
      { id: 'cert-valid', expiryDate: new Date(Date.now() + 365 * 86_400_000), category: 'training' },
      { id: 'cert-none', expiryDate: null, category: 'qualification' },
    ]
  }
  const { GET } = loadCertificationList(prisma)
  const req = query => ({
    url: `http://localhost/api/training${query}`,
    nextUrl: { pathname: '/api/training' },
    headers: { get: () => null },
  })
  const all = await GET(req(''), { params: Promise.resolve({}) })
  assert.equal(all.body.counts.total, 3)
  assert.equal(all.body.counts.expired, 1)
  assert.equal(all.body.counts.valid, 1)
  assert.equal(all.body.counts.no_expiry, undefined)

  const filtered = await GET(req('?status=expired&category=safety'), { params: Promise.resolve({}) })
  assert.deepEqual(filtered.body.certifications.map(c => c.id), ['cert-expired'])
  assert.deepEqual(calls.findMany[1].where, { category: 'safety' })
})

test('routed course id is decoded exactly once before the Prisma lookup', async () => {
  calls = { audit: [], findUnique: [], findMany: [], create: [], update: [], delete: [] }
  const { GET } = loadCourseDetail(coursePrisma({ id: 'c/123', name: 'Encoded' }))
  const response = await GET(emptyRequest(), { params: Promise.resolve({ id: 'c%2F123' }) })
  assert.equal(response.status, 200)
  assert.deepEqual(calls.findUnique[0].where, { id: 'c/123' })
})
