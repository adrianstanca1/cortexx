import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { decode, getToken } from 'next-auth/jwt'
import {
  createMobileWebTicket, hashMobileWebTicket, parseTicketIdentifier, ticketIdentifier,
  safeMobileWebPath, mobileWebCookieName, issueWebSessionJwt, isTrustedHandoffRequest, webSessionCookieParts,
} from '../lib/mobileWebHandoff.ts'

test('handoff ticket is random and only its SHA-256 digest is stored', () => {
  const a = createMobileWebTicket(), b = createMobileWebTicket()
  assert.match(a, /^[A-Za-z0-9_-]{43}$/)
  assert.notEqual(a, b)
  assert.notEqual(hashMobileWebTicket(a), a)
  assert.match(hashMobileWebTicket(a), /^[a-f0-9]{64}$/)
})

test('ticket carries tenant binding and password version to revoke after reset', () => {
  const one = ticketIdentifier('user-a', 'org-b', 1791487000123)
  assert.deepEqual(parseTicketIdentifier(one), { userId: 'user-a', orgId: 'org-b', passwordVersion: 1791487000123 })
  assert.deepEqual(parseTicketIdentifier(ticketIdentifier('a', 'b', null)), { userId: 'a', orgId: 'b', passwordVersion: null })
  for (const value of ['', 'not-a-ticket', 'cortexx:native-web:other:tenant', 'cortexx:native-web:x:y:garbage']) assert.equal(parseTicketIdentifier(value), null)
})

test('handoff redirects only to allowlisted local real web modules', () => {
  for (const path of ['/dashboard', '/apps', '/team', '/documents', '/projects/abc', '/rfqs', '/invoices', '/settings']) assert.equal(safeMobileWebPath(path), path)
  for (const path of ['https://host.test/', '//evil.test', '/\\evil', '/api/mobile/auth/me', '/auth/logout', '/unknown', '/projects/%2f%2fevil', '/apps\nLocation: https://evil.test']) assert.equal(safeMobileWebPath(path), '/dashboard')
})

test('web handoff issues an actual Auth.js cookie-decryptable session with the same organization', async () => {
  const secret = 'test-native-handoff-secret-of-sufficient-length'
  const changedAt = new Date('2026-10-08T12:00:00Z')
  const orgs = [{ id: 'org-1', slug: 'work-co', name: 'Work Co', role: 'owner', personaRole: 'company_admin' }]
  for (const secure of [false, true]) {
    const cookieName = mobileWebCookieName(secure)
    assert.equal(cookieName, secure ? '__Secure-authjs.session-token' : 'authjs.session-token')
    const jwt = await issueWebSessionJwt({ userId: 'u1', name: 'User', email: 'u@example.test', role: 'member', orgs, passwordChangedAt: changedAt, secret, secure })
    const decoded = await decode({ token: jwt, secret, salt: cookieName })
    assert.equal(decoded?.sub, 'u1')
    assert.equal(decoded?.passwordVersion, changedAt.getTime())
    assert.deepEqual(decoded?.orgs, orgs)
  }
})

test('web session endpoint is POST-only one-use and protected by fresh mobile membership', () => {
  const issue = readFileSync(new URL('../app/api/mobile/auth/web-session/route.ts', import.meta.url), 'utf8')
  const consume = readFileSync(new URL('../app/api/mobile/web-session/consume/route.ts', import.meta.url), 'utf8')
  const proxy = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8')
  assert.match(issue, /await requireOrg\(\)/)
  assert.match(issue, /bearerToken\(req\.headers\.get\('authorization'\)\)/)
  assert.match(issue, /prisma\.verificationToken\.create/)
  assert.match(consume, /export async function POST\(/)
  assert.doesNotMatch(consume, /export async function GET\(/)
  assert.match(consume, /verificationToken\.deleteMany/)
  assert.match(consume, /consumed\.count !== 1/)
  assert.match(consume, /passwordVersion !==/)
  assert.match(consume, /userOrganization\.findUnique/)
  assert.match(proxy, /'\/api\/mobile\/auth\/web-session'/)
  assert.match(proxy, /'\/api\/mobile\/web-session\/consume'/)
})

test('login handoff rejects cross-origin form CSRF and chunks large cookies', () => {
  const domain = 'https://cortexbuildpro.tech'
  assert.equal(isTrustedHandoffRequest(null, null, domain), true)
  assert.equal(isTrustedHandoffRequest(domain, 'same-origin', domain), true)
  assert.equal(isTrustedHandoffRequest('https://evil.example', 'cross-site', domain), false)
  assert.equal(isTrustedHandoffRequest(null, 'cross-site', domain), false)
  assert.equal(isTrustedHandoffRequest('null', null, domain), false)
  assert.deepEqual(webSessionCookieParts('authjs.session-token', 'small'), [{ name: 'authjs.session-token', value: 'small' }])
  const jwt = 'x'.repeat(8400)
  const parts = webSessionCookieParts('__Secure-authjs.session-token', jwt)
  assert.deepEqual(parts.map(p => p.name), ['__Secure-authjs.session-token.0', '__Secure-authjs.session-token.1', '__Secure-authjs.session-token.2'])
  assert.equal(parts.map(p => p.value).join(''), jwt)
  assert.ok(parts.every(p => p.value.length <= 3200))
})

test('web session survives Auth.js chunked cookies when account belongs to many companies', async () => {
  const secret = 'long-test-secret-not-valid-in-production-anywhere'
  const orgs = Array.from({ length: 40 }, (_, i) => ({
    id: `org${i}`, slug: `company-${i}`, name: `Company ${i} Long Construction Services`, role: 'admin', personaRole: 'company_admin',
  }))
  const jwt = await issueWebSessionJwt({ userId: 'u1', email: 'multi@example.test', name: 'Multi', role: 'company_admin', passwordChangedAt: null, orgs, secret, secure: true })
  const chunks = webSessionCookieParts(mobileWebCookieName(true), jwt)
  assert.ok(chunks.length > 1)
  const cookieHeader = chunks.map(part => `${part.name}=${part.value}`).join('; ')
  const restored = await getToken({ req: { headers: { cookie: cookieHeader } }, secret, cookieName: mobileWebCookieName(true) })
  assert.equal(restored?.sub, 'u1')
  assert.equal(restored?.orgs?.length, 40)
})
