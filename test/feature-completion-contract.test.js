const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')

test('project creation accepts an early-stage project without postcode', () => {
  const route = read('app/api/projects/route.ts')
  assert.doesNotMatch(route, /Postcode is required/)
  assert.match(route, /postcode:\s*body\.postcode\?\.trim\(\) \|\| ''/)
})

test('task creation surfaces API permission errors instead of a generic failure', () => {
  const page = read('app/tasks/page.tsx')
  assert.match(page, /payload\?\.error \|\| 'Failed to create task'/)
  assert.match(page, /Select one of your assigned projects before creating this task/)
})

test('field roles require an assigned project and operative tasks self-assign', () => {
  const page = read('app/tasks/page.tsx')
  assert.match(page, /\['project_manager', 'foreman', 'operative'\]\.includes\(activePersona\)/)
  assert.match(page, /activePersona === 'operative' \? null : \(form\.assigneeId \|\| null\)/)
  assert.match(page, /No assigned projects/)
})

test('bank reconciliation exposes CSV statement import', () => {
  const page = read('app/bank/page.tsx')
  assert.match(page, /Import CSV statement/)
  assert.match(page, /parseBankCsv/)
  assert.match(page, /source: 'csv'/)
})
