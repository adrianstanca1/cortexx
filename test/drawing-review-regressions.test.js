const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => {
    if (!(name in mocks)) throw new Error('Unexpected import ' + name)
    return mocks[name]
  }, URL })
  return exports
}
const markup = load('lib/drawing-markup.ts', { './rbac': { canWrite: () => true } })

test('markup pages reject truncated, fractional and non-scalar input', () => {
  for (const value of ['2oops', '1.5', 1.5, '1e2', null, true, [2], {}, 0, 10000]) {
    assert.throws(() => markup.parseMarkupPage(value), markup.DrawingMarkupValidationError)
  }
  assert.equal(markup.parseMarkupPage(undefined), 1)
  assert.equal(markup.parseMarkupPage(' 2 '), 2)
  assert.equal(markup.parseMarkupPage(9999), 9999)
})

test('markup coordinates reject blank, boolean and collection coercion', () => {
  for (const value of [null, undefined, '', ' ', true, false, [], [0.5], {}, -0.1, 1.1, NaN, Infinity]) {
    assert.throws(() => markup.parseNormalized(value, 'x'), markup.DrawingMarkupValidationError)
  }
  for (const value of [0, 0.5, 1, '0.25']) assert.equal(markup.parseNormalized(value, 'x'), Number(value))
  assert.equal(markup.parseOptionalNormalized(null, 'width'), null)
})

class NextResponse { static json(body, options = {}) { return { body, status: options.status || 200 } } }
function drawingsFixture() {
  const queries = []
  const route = load('app/api/drawings/route.ts', {
    'next/server': { NextResponse },
    '@prisma/client': {},
    '@/lib/db': { prisma: { drawing: { findMany: async query => { queries.push(query); return [] } } } },
    '@/lib/requireAuth': { requireOrg: async () => ({ session: { user: { role: 'company_admin' } } }) },
    '@/lib/programme-access': { programmeProjectScope: () => ({}) },
    '@/lib/rbac': {}, '@/lib/rateLimit': {},
    '@/lib/errors': { reportError: error => { throw error } },
  })
  return { route, queries }
}

test('drawing list excludes archived rows by default and for active filters', async () => {
  for (const query of ['', '?status=', '?status=draft', '?status=unknown']) {
    const { route, queries } = drawingsFixture()
    assert.equal((await route.GET({ url: 'https://app.test/api/drawings' + query })).status, 200)
    assert.equal(queries[0].where.archivedAt, null)
  }
})

test('drawing archive filter remains available and take stays positive and bounded', async () => {
  const { route, queries } = drawingsFixture()
  await route.GET({ url: 'https://app.test/api/drawings?status=archived&take=-5' })
  assert.equal(queries[0].where.OR[0].status, 'archived')
  assert.equal(queries[0].where.OR[1].archivedAt.not, null)
  assert.equal('archivedAt' in queries[0].where, false)
  assert.equal(queries[0].take, 1)
  await route.GET({ url: 'https://app.test/api/drawings?take=5000' })
  assert.equal(queries[2].take, 200)
  await route.GET({ url: 'https://app.test/api/drawings?take=0' })
  assert.equal(queries[4].take, 1)
})
