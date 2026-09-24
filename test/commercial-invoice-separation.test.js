const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

test('client invoice mutations never overwrite project cost/spent', () => {
  const api = fs.readFileSync(path.join(root, 'app/api/invoices/[id]/route.ts'), 'utf8')
  assert.doesNotMatch(api, /project\.update\([\s\S]{0,240}spent\s*:/, 'client revenue must not be copied into Project.spent')
})

test('project finance UI does not derive spent from paid client invoices', () => {
  const page = fs.readFileSync(path.join(root, 'app/projects/[id]/page.tsx'), 'utf8')
  assert.doesNotMatch(page, /newSpent/)
  assert.doesNotMatch(page, /spent:\s*updatedInvoices/)
})

test('project APIs cannot bypass the canonical cost ledger with direct spent writes', () => {
  const createApi = fs.readFileSync(path.join(root, 'app/api/projects/route.ts'), 'utf8')
  const itemApi = fs.readFileSync(path.join(root, 'app/api/projects/[id]/route.ts'), 'utf8')
  assert.match(createApi, /Opening spend must be posted through the project cost ledger/)
  assert.match(itemApi, /Project spend is ledger-derived; post or reconcile project costs instead/)
  assert.doesNotMatch(itemApi, /body\.spent[^\n]*spent:\s*Number\(body\.spent\)/)
})

test('assigned non-admin project detail does not unconditionally expose client invoices', () => {
  const itemApi = fs.readFileSync(path.join(root, 'app/api/projects/[id]/route.ts'), 'utf8')
  assert.match(itemApi, /invoices:\s*isCompanyAdmin\(\)\s*\?/)
})
