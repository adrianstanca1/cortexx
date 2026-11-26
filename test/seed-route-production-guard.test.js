/**
 * Production guard for the seed endpoint (issue #322, Batch 1).
 *
 * `POST /api/seed` wipes and reseeds data across ALL tenants, so it must
 * never run in production — even with ALLOW_SEED=true and a valid
 * SEED_TOKEN. The route returns 404 in production, the same as a missing
 * route, so the endpoint does not even reveal that it exists. In
 * non-production environments the existing ALLOW_SEED + SEED_TOKEN gates
 * still apply and local-dev seeding keeps working.
 *
 * The handler is loaded the same way as other route tests in this repo
 * (see test/field-closeout-route.test.js): the route source is transpiled
 * with the TypeScript compiler and run in a vm with mocked imports, so no
 * real Prisma client or database is touched.
 *
 * Run with:  npm test
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const SEED_TOKEN = 'test-seed-token'

function loadSeedRoute(prisma) {
  class NextResponse {
    static json(body, options = {}) { return { body, status: options.status || 200 } }
  }
  const mocks = {
    'next/server': { NextResponse },
    '@/lib/db': { prisma },
    '@/lib/tenancy': { bypassTenancy: fn => fn() },
    '@/lib/errors': { reportError: () => {} },
  }
  const code = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '..', 'app', 'api', 'seed', 'route.ts'), 'utf8'),
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
    Date, Number, String, Set, URL, console,
  })
  return exports
}

function prismaMock() {
  const calls = []
  const model = name => ({
    deleteMany: async () => { calls.push(`${name}.deleteMany`); return { count: 0 } },
    create: async ({ data }) => { calls.push(`${name}.create`); return { id: `${name}-1`, ...data } },
    createMany: async ({ data }) => { calls.push(`${name}.createMany`); return { count: data.length } },
  })
  return {
    calls,
    activity: model('activity'),
    document: model('document'),
    timeEntry: model('timeEntry'),
    invoice: model('invoice'),
    assignment: model('assignment'),
    task: model('task'),
    teamMember: model('teamMember'),
    project: model('project'),
  }
}

function fakeRequest(token) {
  return {
    headers: {
      get: name => (name.toLowerCase() === 'authorization' && token ? `Bearer ${token}` : null),
    },
  }
}

function withEnv(env, fn) {
  const saved = {}
  for (const key of Object.keys(env)) {
    saved[key] = process.env[key]
    if (env[key] === undefined) delete process.env[key]
    else process.env[key] = env[key]
  }
  try {
    return fn()
  } finally {
    for (const key of Object.keys(env)) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }
}

test('production: seed returns 404 even with ALLOW_SEED=true and a valid token', async () => {
  const prisma = prismaMock()
  const { POST } = loadSeedRoute(prisma)
  const res = await withEnv(
    { NODE_ENV: 'production', ALLOW_SEED: 'true', SEED_TOKEN },
    () => POST(fakeRequest(SEED_TOKEN)),
  )
  assert.equal(res.status, 404)
  assert.equal(res.body.error, 'Not found')
  assert.deepEqual(prisma.calls, [], 'no database call may happen in production')
})

test('production: seed returns 404 regardless of the other gates', async () => {
  const prisma = prismaMock()
  const { POST } = loadSeedRoute(prisma)
  const res = await withEnv(
    { NODE_ENV: 'production', ALLOW_SEED: undefined, SEED_TOKEN: undefined },
    () => POST(fakeRequest(null)),
  )
  assert.equal(res.status, 404)
  assert.deepEqual(prisma.calls, [], 'no database call may happen in production')
})

test('development: seed still works with ALLOW_SEED=true and a valid token', async () => {
  const prisma = prismaMock()
  const { POST } = loadSeedRoute(prisma)
  const res = await withEnv(
    { NODE_ENV: 'development', ALLOW_SEED: 'true', SEED_TOKEN },
    () => POST(fakeRequest(SEED_TOKEN)),
  )
  assert.equal(res.status, 200)
  assert.equal(res.body.success, true)
  assert.ok(prisma.calls.includes('project.deleteMany'), 'seed wipes existing data first')
  assert.ok(prisma.calls.includes('project.create'), 'seed creates demo projects')
})

test('development: seed keeps its existing gates (403 without ALLOW_SEED, 401 with a bad token)', async () => {
  const prisma = prismaMock()
  const { POST } = loadSeedRoute(prisma)
  const noFlag = await withEnv(
    { NODE_ENV: 'development', ALLOW_SEED: undefined, SEED_TOKEN },
    () => POST(fakeRequest(SEED_TOKEN)),
  )
  assert.equal(noFlag.status, 403)
  const badToken = await withEnv(
    { NODE_ENV: 'development', ALLOW_SEED: 'true', SEED_TOKEN },
    () => POST(fakeRequest('wrong-token')),
  )
  assert.equal(badToken.status, 401)
  assert.deepEqual(prisma.calls, [], 'a rejected request must not touch the database')
})

test('seed source: the production guard is checked before the ALLOW_SEED gate', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'api', 'seed', 'route.ts'),
    'utf8',
  )
  const guardAt = source.indexOf("process.env.NODE_ENV === 'production'")
  const flagAt = source.indexOf("process.env.ALLOW_SEED !== 'true'")
  assert.ok(guardAt !== -1, 'production guard is present in the route')
  assert.ok(flagAt !== -1, 'ALLOW_SEED gate is still present')
  assert.ok(guardAt < flagAt, 'production guard runs before the ALLOW_SEED gate')
  assert.match(source, /status: 404/)
})
