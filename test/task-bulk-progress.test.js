const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const bulk = fs.readFileSync(path.join(root, 'app/api/tasks/bulk/route.ts'), 'utf8')
const progress = fs.readFileSync(path.join(root, 'lib/task-progress.ts'), 'utf8')

test('shared task progress helper batches affected projects and preserves programme ownership', () => {
  assert.match(progress, /task\.groupBy\(/)
  assert.match(progress, /projectId:\s*\{\s*in:\s*ids\s*\}/)
  assert.match(progress, /AND:\s*\[\{ organizationId \}\]/)
  assert.match(progress, /programmeActivities:\s*\{\s*none:\s*\{\s*\}\s*\}/)
})

test('bulk mutation and progress refresh share one transaction', () => {
  assert.match(bulk, /prisma\.\$transaction\(async tx =>/)
  assert.match(bulk, /tx\.task\.(?:deleteMany|updateMany)/)
  assert.match(bulk, /syncTaskProjectProgress\(tx, affectedProjectIds, auth\.orgId\)/)
})

test('bulk route requires org scope and explicit tenant predicates', () => {
  assert.match(bulk, /requireOrg\(\)/)
  const orgPredicates = bulk.match(/AND:\s*\[\{ organizationId: auth\.orgId \}\]/g) || []
  assert.ok(orgPredicates.length >= 2, 'task selection and mutation both need explicit org scope')
})

test('bulk route mirrors task RBAC and assignment scoping', () => {
  assert.match(bulk, /canWrite\(auth\.role/)
  assert.match(bulk, /appRole === 'project_manager' \|\| appRole === 'foreman'/)
  assert.match(bulk, /appRole === 'operative'/)
  assert.match(bulk, /appRole !== 'project_manager'/)
  assert.match(bulk, /assignee:\s*\{ email:/)
  assert.match(bulk, /project:\s*\{ assignments:/)
})

test('bulk route delegates progress writes to the shared helper', () => {
  assert.doesNotMatch(bulk, /project\.(?:update|updateMany)\(/)
  assert.doesNotMatch(bulk, /task\.groupBy\(/)
})
