const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { canManageTenders, tenderWhere } = require('../lib/tenderAccess.ts')
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8')

test('only administrators and owners in an active company can manage commercial tenders', () => {
  for (const role of ['owner', 'admin']) assert.equal(canManageTenders({ role, orgId: 'companyA' }), true)
  for (const role of ['member', 'viewer', 'project_manager', 'foreman', 'operative', null]) {
    assert.equal(canManageTenders({ role, orgId: 'companyA' }), false, String(role))
  }
  assert.equal(canManageTenders({ role: 'owner', orgId: null }), false)
})

test('all list/count/aggregate and edit selectors must stay in the active company', () => {
  const a = tenderWhere({ role: 'owner', orgId: 'companyA' })
  const b = tenderWhere({ role: 'admin', orgId: 'companyB' })
  assert.equal(a.organizationId, 'companyA')
  assert.equal(b.organizationId, 'companyB')
  assert.deepEqual(a.OR, [{ projectId: null }, { project: { is: { organizationId: 'companyA' } } }])
  assert.deepEqual(tenderWhere({ role: 'admin', orgId: null }), { id: '__no_access__' })
})

test('tender API always checks membership and organization for reads and mutations', () => {
  const collection = read('app/api/tenders/route.ts')
  const detail = read('app/api/tenders/[id]/route.ts')
  for (const source of [collection, detail]) {
    assert.match(source, /await requireOrg\(\)/)
    assert.match(source, /canManageTenders\(auth\)/)
    assert.match(source, /tenderWhere\(auth\)/)
    assert.match(source, /Company commercial admin required/)
  }
  assert.match(collection, /organizationId: auth\.orgId!/)
  assert.match(collection, /prisma\.project\.findFirst\(\{ where: \{ id: projectId, organizationId: auth\.orgId! \}/)
  assert.match(collection, /where: \{ \.\.\.tenderWhere\(auth\), status: 'draft' \}/)
  assert.match(collection, /where: \{ \.\.\.tenderWhere\(auth\), status: \{ in:/)
  assert.match(detail, /prisma\.tender\.findFirst\(\{ where: \{ id: params\.id, \.\.\.tenderWhere\(auth\) \} \}\)/)
  assert.match(detail, /where: \{ id: params\.id, organizationId: auth\.orgId! \}/)
  assert.match(detail, /enforceRateLimit\(req, 'write', auth\.userId\)/)
})
