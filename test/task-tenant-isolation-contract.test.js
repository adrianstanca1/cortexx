const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const route = fs.readFileSync(path.join(__dirname, '../app/api/tasks/route.ts'), 'utf8')

test('task list and count are scoped to the active organization', () => {
  assert.match(route, /const where: Prisma\.TaskWhereInput = \{ organizationId,/)
  assert.match(route, /prisma\.task\.findMany\(\{\s*where,/)
  assert.match(route, /prisma\.task\.count\(\{ where \}\)/)
  assert.match(route, /GET_impl\(req, orgId!, session\)/)
})

test('task creation rejects cross-company project and assignee IDs for all roles', () => {
  assert.match(route, /if \(projectId\) \{\s*const project = await prisma\.project\.findFirst\(\{ where: \{ id: projectId, organizationId \}/)
  assert.match(route, /if \(body\.assigneeId\) \{\s*const member = await prisma\.teamMember\.findFirst\(\{ where: \{ id: body\.assigneeId, organizationId \}/)
  assert.match(route, /organizationId,\s*title: body\.title\.trim\(\)/)
})

test('field tasks require tenant-scoped assignments and self member', () => {
  assert.match(route, /where: \{ id: projectId, organizationId, assignments:/)
  assert.match(route, /where: \{ organizationId, email: \{ equals: email/)
  assert.match(route, /where: \{ id: assigneeId, organizationId, assignments:/)
})
