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
  assert.match(progress, /organizationId/)
  assert.match(progress, /programmeActivities:\s*\{\s*none:\s*\{\s*\}\s*\}/)
})

test('bulk mutation and progress refresh share one transaction', () => {
  assert.match(bulk, /prisma\.\$transaction\(async tx =>/)
  assert.match(bulk, /tx\.task\.(?:deleteMany|updateMany)/)
  assert.match(bulk, /syncTaskProjectProgress\(tx, affectedProjectIds, orgId\)/)
})

test('bulk route reads org scope from the request tenancy context, not the session', () => {
  assert.match(bulk, /getCurrentOrg\(\)\?\.organizationId/)
  assert.match(bulk, /if \(!orgId\) return NextResponse\.json\(\{ error: 'Organisation context required' \}, \{ status: 403 \}\)/)
  assert.doesNotMatch(bulk, /auth\.orgId/)
})

test('bulk route delegates progress writes to the shared helper', () => {
  assert.doesNotMatch(bulk, /project\.(?:update|updateMany)\(/)
  assert.doesNotMatch(bulk, /task\.groupBy\(/)
})
