const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')

test('assignment APIs use active tenant membership and forbid unprivileged mutations', () => {
  const list = read('app/api/assignments/route.ts')
  const detail = read('app/api/assignments/[id]/route.ts')
  for (const route of [list, detail]) {
    assert.match(route, /await requireOrg\(\)/)
    assert.match(route, /organizationId: auth\.orgId/)
    assert.match(route, /programmeProjectScope\(auth\.session\)/)
    assert.match(route, /canManage\(/)
    assert.match(route, /canWrite\(/)
    assert.match(route, /auth\.personaRole === 'project_manager'|personaRole === 'project_manager'/)
    assert.match(route, /Assignment management permission required/)
  }
  assert.match(list, /prisma\.teamMember\.findFirst/)
  assert.match(list, /prisma\.project\.findFirst/)
  assert.match(list, /member: \{ is: \{ organizationId: auth\.orgId \} \}/)
  assert.match(detail, /prisma\.assignment\.findFirst/)
  assert.match(detail, /prisma\.assignment\.delete\(\{ where: \{ id, organizationId: auth\.orgId \} \}\)/)
})
