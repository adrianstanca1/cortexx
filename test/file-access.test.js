const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function load(file, mocks) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, require: name => { if (!(name in mocks)) throw new Error('Unexpected import ' + name); return mocks[name] }, URL, Response,
  })
  return exports
}
class NextResponse { static json(body, options = {}) { return { body, status: options.status || 200 } } }
const rbac = load('lib/rbac.ts', {})
const programme = load('lib/programme-access.ts', { './rbac': rbac, './tenancy': { getCurrentOrg: () => null } })
const scope = load('lib/file-access.ts', { './programme-access': programme })

test('internal file scope preserves company-wide files and restricts project files', () => {
  const result = scope.fileProjectScope({ user: { role: 'foreman', email: 'foreman@example.test' } })
  assert.equal(result.OR[0].projectId, null)
  assert.equal(result.OR[1].project.is.assignments.some.member.email.equals, 'foreman@example.test')
  const client = scope.fileProjectScope({ user: { role: 'client' } })
  assert.equal(client.OR.length, 1)
  assert.equal(client.OR[0].project.is.id, '__no_internal_file__')
})

function fixture(role, personaRole = 'foreman') {
  let dbCalls = 0
  const auth = { role, personaRole, userId: 'u', session: { user: { role: personaRole } } }
  const mocks = {
    'next/server': { NextResponse }, '@prisma/client': {},
    '@/lib/db': { prisma: new Proxy({}, { get() { dbCalls++; throw new Error('Denied call must not query data') } }) },
    '@/lib/requireAuth': { requireOrg: async () => auth },
    '@/lib/rbac': rbac, '@/lib/file-access': scope, '@/lib/programme-access': programme,
    '@/lib/audit': {}, '@/lib/errors': { reportError: error => { throw error } },
    '@/lib/rateLimit': { enforceRateLimit: async () => null }, '@/lib/storage': {},
  }
  return { mocks, calls: () => dbCalls }
}
for (const role of ['viewer', null]) {
  test('read-only or missing membership blocks document mutations and uploads: ' + role, async () => {
    const { mocks, calls } = fixture(role)
    const docs = load('app/api/documents/[id]/route.ts', mocks)
    const upload = load('app/api/uploads/route.ts', mocks)
    const params = { params: Promise.resolve({ id: 'private' }) }
    assert.equal((await docs.PUT({}, params)).status, 403)
    assert.equal((await docs.DELETE({}, params)).status, 403)
    assert.equal((await upload.POST({})).status, 403)
    assert.equal(calls(), 0)
  })
}
test('client persona cannot mutate internal files even with member org role', async () => {
  const { mocks } = fixture('member', 'client')
  const docs = load('app/api/documents/[id]/route.ts', mocks)
  const upload = load('app/api/uploads/route.ts', mocks)
  assert.equal((await docs.DELETE({}, { params: Promise.resolve({ id: 'd' }) })).status, 403)
  assert.equal((await upload.POST({})).status, 403)
})
