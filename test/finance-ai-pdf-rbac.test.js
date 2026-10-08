const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')

test('quote drafting and PDF downloading use the same company-finance RBAC as the quote editor', () => {
  const api = read('app/api/quotes/route.ts')
  const draft = read('app/api/quotes/draft/route.ts')
  const pdf = read('app/api/quotes/[id]/pdf/route.ts')
  for (const src of [api, draft, pdf]) {
    assert.match(src, /await requireOrg\(\)/)
    assert.match(src, /canManage\(/)
    assert.match(src, /Financial admin permission required/)
  }
  assert.doesNotMatch(draft, /await requireAuth\(\)/)
  assert.doesNotMatch(pdf, /await requireAuth\(\)/)
  assert.match(draft, /enforceRateLimit\(req, 'write', auth\.userId\)/)
  assert.match(pdf, /where: \{ id: params\.id, organizationId: auth\.orgId! \}/)
  assert.match(pdf, /Cortex Construct/)
})
