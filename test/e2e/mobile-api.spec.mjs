import { test, expect } from '@playwright/test'

const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-local-role-password'
const users = {
  admin: process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.com',
  pm: process.env.E2E_PM_EMAIL || 'pm@cortexbuildpro.com',
}

async function mobileLogin(request, email) {
  const res = await request.post('/api/mobile/auth/login', { data: { email, password } })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.token).toEqual(expect.any(String))
  expect(body.user?.email).toBe(email)
  return body
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` }
}

test('native Company Admin token resolves current tenant and assigned project data', async ({ request }) => {
  const login = await mobileLogin(request, users.admin)
  expect(login.user.organizationRole).toMatch(/owner|admin/)

  const me = await request.get('/api/mobile/auth/me', { headers: bearer(login.token) })
  expect(me.status()).toBe(200)
  const meBody = await me.json()
  expect(meBody.user?.email).toBe(users.admin)
  expect(meBody.user?.organizations?.length).toBeGreaterThan(0)

  const projects = await request.get('/api/projects?take=100', { headers: bearer(login.token) })
  expect(projects.status()).toBe(200)
  const projectBody = await projects.json()
  expect(projectBody.projects?.some(p => p.name === 'E2E Verification Project')).toBe(true)
})

test('native Project Manager is assignment-scoped and cannot create projects', async ({ request }) => {
  const login = await mobileLogin(request, users.pm)
  expect(login.user.role).toBe('project_manager')

  const projects = await request.get('/api/projects?take=100', { headers: bearer(login.token) })
  expect(projects.status()).toBe(200)
  const projectBody = await projects.json()
  expect(projectBody.projects?.some(p => p.name === 'E2E Verification Project')).toBe(true)

  const denied = await request.post('/api/projects', {
    headers: bearer(login.token),
    data: { name: 'Forbidden native PM project', postcode: 'E2E 9ZZ' },
  })
  expect(denied.status()).toBe(403)
  expect((await denied.json()).error).toMatch(/company admin permission required/i)
})

test('invalid native bearer tokens fail closed', async ({ request }) => {
  for (const path of ['/api/mobile/auth/me', '/api/projects', '/api/tasks']) {
    const res = await request.get(path, { headers: bearer('invalid.mobile.token') })
    expect(res.status(), path).toBe(401)
  }
})
