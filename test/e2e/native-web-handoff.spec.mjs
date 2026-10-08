import { test, expect } from '@playwright/test'

const email = process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.tech'
const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-local-role-password'

async function signIntoNative(request) {
  const result = await request.post('/api/mobile/auth/login', { data: { email, password } })
  expect(result.status()).toBe(200)
  const body = await result.json()
  expect(body.user.email).toBe(email)
  expect(body.user.organization.id).toEqual(expect.any(String))
  return body
}

async function mint(request, token) {
  const response = await request.post('/api/mobile/auth/web-session', { data: {}, headers: { Authorization: `Bearer ${token}` } })
  expect(response.status()).toBe(200)
  const result = await response.json()
  expect(result.ticket).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(response.headers()['cache-control']).toMatch(/no-store/)
  return result.ticket
}

function exchange(request, ticket, next = '/documents', extra = {}) {
  return request.post('/api/mobile/web-session/consume', {
    form: { ticket, next },
    maxRedirects: 0,
    ...extra,
  })
}

test('native bearer exchanges once for a web session with same user and company, then opens live web pages', async ({ request }) => {
  const native = await signIntoNative(request)
  const ticket = await mint(request, native.token)
  const first = await exchange(request, ticket)
  expect(first.status()).toBe(303)
  expect(new URL(first.headers().location).pathname).toBe('/documents')
  expect(first.headers()['set-cookie']).toMatch(/authjs\.session-token/)
  expect(first.headers()['set-cookie']).toMatch(/HttpOnly/i)
  const session = await request.get('/api/auth/session')
  expect(session.status()).toBe(200)
  const web = await session.json()
  expect(web.user?.id).toBe(native.user.id)
  expect(web.user?.email).toBe(native.user.email)
  expect(web.user?.organizations?.some(org => org.id === native.user.organization.id)).toBe(true)

  const me = await request.get('/api/mobile/auth/me')
  expect(me.status()).toBe(200)
  const webProfile = await me.json()
  expect(webProfile.user?.organization?.id).toBe(native.user.organization.id)
  expect(webProfile.user?.id).toBe(native.user.id)

  const page = await request.get('/documents')
  expect(page.status()).toBe(200)
  const replay = await exchange(request, ticket)
  expect(replay.status()).toBe(401)
})

test('session exchange rejects forged forms, invalid tickets and unauthenticated issuers', async ({ request }) => {
  expect((await request.post('/api/mobile/auth/web-session', { data: {} })).status()).toBe(401)
  expect((await exchange(request, 'x'.repeat(43))).status()).toBe(401)
  const native = await signIntoNative(request)
  const ticket = await mint(request, native.token)
  const foreign = await exchange(request, ticket, '/dashboard', { headers: { origin: 'https://evil.example' } })
  expect(foreign.status()).toBe(401)
  const legitimate = await exchange(request, ticket, 'https://evil.example')
  expect(legitimate.status()).toBe(303)
  expect(new URL(legitimate.headers().location).pathname).toBe('/dashboard')
  expect(new URL(legitimate.headers().location).host).not.toBe('evil.example')
})
