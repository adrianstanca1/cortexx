import test from 'node:test'
import assert from 'node:assert/strict'
import { issueMobileToken, verifyMobileToken, bearerToken } from '../../lib/mobileAuth.ts'

process.env.NODE_ENV = 'test'
process.env.MOBILE_AUTH_SECRET = 'm'.repeat(48)

test('mobile auth token round-trips tenant and persona claims', async () => {
  const token = await issueMobileToken({
    userId: 'user-1', organizationId: 'org-1', organizationRole: 'member',
    email: 'foreman@example.com', name: 'Foreman', appRole: 'foreman',
  })
  const claims = await verifyMobileToken(token)
  assert.equal(claims.sub, 'user-1')
  assert.equal(claims.orgId, 'org-1')
  assert.equal(claims.orgRole, 'member')
  assert.equal(claims.email, 'foreman@example.com')
  assert.equal(claims.appRole, 'foreman')
})

test('mobile auth rejects tampered tokens', async () => {
  const token = await issueMobileToken({
    userId: 'user-1', organizationId: 'org-1', organizationRole: 'member', email: 'user@example.com',
  })
  const parts = token.split('.')
  parts[1] = parts[1].slice(0, -1) + (parts[1].endsWith('a') ? 'b' : 'a')
  await assert.rejects(() => verifyMobileToken(parts.join('.')))
})

test('bearer parser is strict and case-insensitive', () => {
  assert.equal(bearerToken('Bearer abc.def.ghi'), 'abc.def.ghi')
  assert.equal(bearerToken('bearer   token-value'), 'token-value')
  assert.equal(bearerToken('Basic abc'), null)
  assert.equal(bearerToken(null), null)
})
