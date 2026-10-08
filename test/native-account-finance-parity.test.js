const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')

test('financial API routes accept valid native Bearer tokens for authorized company admins', () => {
  const proxy = read('proxy.ts')
  const list = proxy.match(/const MOBILE_BEARER_API_PREFIXES = \[[\s\S]*?\]/)?.[0] || ''
  assert.match(list, /'\/api\/quotes'/)
  assert.match(list, /'\/api\/invoices'/)
  for (const file of ['app/api/quotes/route.ts', 'app/api/invoices/route.ts']) {
    const route = read(file)
    assert.match(route, /await requireOrg\(\)/)
    assert.match(route, /Financial admin permission required/)
    assert.match(route, /canManage\(auth\.role\)/)
  }
})

test('Expo invoice and quote rows display the actual web API schema', () => {
  const ui = read('expo/Tabs.tsx')
  assert.match(ui, /rowTitle=\{\(i\) => i\.number \|\| 'Invoice'/)
  assert.match(ui, /i\.clientName/)
  assert.match(ui, /rowTitle=\{\(i\) => i\.number \|\| i\.title \|\| 'Quote'/)
  assert.match(ui, /i\.customerName/)
  assert.match(ui, /i\.total/)
  assert.doesNotMatch(ui, /i\.invoiceNo \|\| i\.invoice_no/)
  assert.doesNotMatch(ui, /i\.ref \|\| 'Quote'/)
})

test('native password change uses shared web route and does not clear token for wrong old password', () => {
  const client = read('expo/api.ts')
  const profile = read('expo/ProfileScreen.tsx')
  assert.match(client, /export async function changePassword\(/)
  assert.match(client, /\/api\/auth\/password/)
  assert.match(client, /response\.status === 401 && result\?\.error !== 'Current password is incorrect'/)
  assert.match(client, /stopRealtimeStream\(\);\s*await clearToken\(\);/)
  assert.match(profile, /pendingWrites\(\) > 0/)
  assert.match(profile, /await changePassword\(currentPassword, nextPassword\)/)
  assert.match(profile, /accessibilityLabel="Current password"/)
  assert.match(profile, /accessibilityLabel="New password"/)
  assert.match(profile, /onLogout\(\)/)
})
