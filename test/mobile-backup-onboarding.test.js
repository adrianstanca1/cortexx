const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const { randomBytes } = require('node:crypto')
const { generateSecret } = require('speakeasy')
const testPassword = randomBytes(24).toString('hex')

// Exercise the real login handler with a transactional database double.
// No live user accounts or database are touched.
process.env.NODE_ENV = 'test'
process.env.MOBILE_AUTH_SECRET = randomBytes(32).toString('hex')
delete process.env.REDIS_URL
let user, failCreate, creates
const updateMany = async ({ where, data }) => {
  if (JSON.stringify(where.totpBackupCodes.equals) !== JSON.stringify(user.totpBackupCodes)) return { count: 0 }
  user.totpBackupCodes = data.totpBackupCodes
  return { count: 1 }
}
globalThis.prisma = {
  user: { findUnique: async () => structuredClone(user), updateMany },
  organization: { findUnique: async () => null },
  $transaction: async fn => {
    const saved = [...user.totpBackupCodes]
    try {
      return await fn({
        user: { updateMany },
        organization: { create: async () => {
          if (failCreate) throw new Error('Simulated workspace failure')
          creates++
          return { id: 'org-new', name: 'Test company', slug: 'test-company' }
        } },
        userOrganization: { create: async () => ({}) },
      })
    } catch (error) { user.totpBackupCodes = saved; throw error }
  },
}
let POST, NextRequest, reset
const code = 'ABCDE-12345'
test.before(async () => {
  ;({ POST } = await import('../app/api/mobile/auth/login/route.ts'))
  ;({ NextRequest } = await import('next/server.js'))
  ;({ _resetRateLimitForTests: reset } = await import('../lib/rateLimit.ts'))
})
test.beforeEach(async () => {
  reset(); failCreate = false; creates = 0
  user = { id: 'user-test', email: 'test@example.com', name: 'Test', role: 'member',
    passwordHash: await bcrypt.hash(testPassword, 4), organizations: [],
    totpEnabledAt: new Date(), totpSecret: generateSecret().base32,
    totpBackupCodes: [await bcrypt.hash(code, 4)] }
})
const login = extra => POST(new NextRequest('https://example.test/api/mobile/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: user.email, password: testPassword, totp: code, ...extra }),
}))
test('workspace prompt and invalid name preserve the recovery code', async () => {
  const saved = [...user.totpBackupCodes]
  assert.equal((await login({})).status, 403)
  assert.equal((await login({ workspaceName: 'x'.repeat(101) })).status, 400)
  assert.deepEqual(user.totpBackupCodes, saved)
  assert.equal(creates, 0)
})
test('workspace failure rolls recovery-code consumption back', async () => {
  failCreate = true
  const saved = [...user.totpBackupCodes]
  assert.equal((await login({ workspaceName: 'Test company' })).status, 500)
  assert.deepEqual(user.totpBackupCodes, saved)
})
test('successful onboarding consumes the code once and rejects replay', async () => {
  const response = await login({ workspaceName: 'Test company' })
  assert.equal(response.status, 200)
  assert.equal(typeof (await response.json()).token, 'string')
  assert.deepEqual(user.totpBackupCodes, [])
  assert.equal((await login({ workspaceName: 'Test company' })).status, 401)
  assert.equal(creates, 1)
})
test('denied tenant selection preserves the code; valid tenant consumes it', async () => {
  user.organizations = [{ organizationId: 'org-1', role: 'member', personaRole: 'operative',
    organization: { id: 'org-1', slug: 'one', name: 'One' } }]
  const saved = [...user.totpBackupCodes]
  assert.equal((await login({ organizationId: 'other-tenant' })).status, 403)
  assert.deepEqual(user.totpBackupCodes, saved)
  assert.equal((await login({ organizationId: 'org-1' })).status, 200)
  assert.deepEqual(user.totpBackupCodes, [])
})
