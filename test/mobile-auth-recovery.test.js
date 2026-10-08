const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')

test('native login exposes signup, password recovery, workspace onboarding, and TOTP', () => {
  const ui = read('expo/LoginScreen.tsx')
  const client = read('expo/api.ts')
  for (const text of ['Forgot password?', 'Create an account', 'Company / workspace name', 'NO_ORG', 'TOTP_REQUIRED']) {
    assert.ok(ui.includes(text), text)
  }
  for (const endpoint of ['/api/mobile/auth/login', '/api/mobile/auth/register', '/api/auth/password-reset/request']) {
    assert.ok(client.includes(endpoint), endpoint)
  }
})

test('new mobile accounts have an owner workspace in a single transaction', () => {
  const code = read('app/api/mobile/auth/register/route.ts')
  assert.match(code, /prisma\.\$transaction/)
  assert.match(code, /tx\.user\.create/)
  assert.match(code, /tx\.organization\.create/)
  assert.match(code, /tx\.userOrganization\.create/)
  assert.match(code, /personaRole: 'company_admin'/)
  const login = read('app/api/mobile/auth/login/route.ts')
  assert.match(login, /code: 'NO_ORG'/)
  assert.match(login, /workspaceName/)
})

test('recovery uses hashed single-use tokens and invalidates older mobile JWT sessions', () => {
  const request = read('app/api/auth/password-reset/request/route.ts')
  const confirm = read('app/api/auth/password-reset/confirm/route.ts')
  const verify = read('lib/requireAuth.ts')
  assert.match(request, /randomBytes\(32\)/)
  assert.match(request, /createHash\('sha256'\)/)
  assert.match(request, /30 \* 60 \* 1000/)
  assert.match(confirm, /verificationToken\.deleteMany/)
  assert.match(confirm, /passwordChangedAt: new Date\(\)/)
  assert.match(verify, /membership\.user\.passwordChangedAt/)
  assert.match(verify, /claims\.pwd/)
})

test('reset web page and mobile registration routes are public', () => {
  const proxy = read('proxy.ts')
  assert.ok(proxy.includes("'/reset-password'"))
  assert.ok(proxy.includes("'/api/mobile/auth/register'"))
  assert.ok(read('app/reset-password/page.tsx').includes('/api/auth/password-reset/confirm'))
})
