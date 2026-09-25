import { test, expect } from '@playwright/test'

const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-local-role-password'
const users = {
  admin: process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.com',
  pm: process.env.E2E_PM_EMAIL || 'pm@cortexbuildpro.com',
  foreman: process.env.E2E_FOREMAN_EMAIL || 'foreman@cortexbuildpro.com',
  operative: process.env.E2E_OPERATIVE_EMAIL || 'operative@cortexbuildpro.com',
}
async function signIn(page, email) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30_000 })
}
async function api(page, path, init = {}) {
  return page.evaluate(async ({ path, init }) => {
    const res = await fetch(path, init)
    const body = await res.json().catch(() => null)
    return { status: res.status, body }
  }, { path, init })
}
async function project(page) {
  const result = await api(page, '/api/projects?take=100')
  expect(result.status).toBe(200)
  const p = result.body?.projects?.find(row => row.name === 'E2E Verification Project')
  expect(p).toBeTruthy()
  return p
}

test('Company Admin commits immutable baseline and closes accepted delay', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mutation governance is viewport-independent and covered on desktop.')
  // Cold CI dev servers compile these new API routes lazily, so this complete
  // governance journey has a larger budget while retaining strict assertions.
  test.setTimeout(120_000)
  await signIn(page, users.admin)
  const p = await project(page)
  const list = await api(page, `/api/projects/${p.id}/programme`)
  expect(list.status).toBe(200)
  const activity = list.body?.activities?.[0]
  expect(activity).toBeTruthy()

  const baseline = await api(page, `/api/projects/${p.id}/programme/baselines`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: `E2E ${Date.now()}`, reason: 'E2E approved revision' }) })
  expect(baseline.status).toBe(201)
  expect(baseline.body?.revision).toBeGreaterThanOrEqual(1)
  const locked = await api(page, `/api/projects/${p.id}/programme/${activity.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baselineStart: '2026-12-01' }) })
  expect(locked.status).toBe(409)

  const delay = await api(page, `/api/projects/${p.id}/programme/delays`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `E2E delay ${Date.now()}`, category: 'supply', activityId: activity.id, startDate: '2026-10-15', delayDays: 2, cause: 'Late delivery', impact: 'Facade start moved' }) })
  expect(delay.status).toBe(201)
  const accepted = await api(page, `/api/projects/${p.id}/programme/delays/${delay.body.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'accepted', decisionNotes: 'Accepted in E2E' }) })
  expect(accepted.status).toBe(200)
  expect(accepted.body?.status).toBe('accepted')
  const closed = await api(page, `/api/projects/${p.id}/programme/delays/${delay.body.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'closed', decisionNotes: 'Closed in E2E' }) })
  expect(closed.status).toBe(200)
  expect(closed.body?.status).toBe('closed')

  await page.goto(`/projects/${p.id}/programme`)
  await expect(page.getByText('CHANGE CONTROL')).toBeVisible()
  await expect(page.getByText(/Baseline Rev/)).toBeVisible()
})

test('Project Manager can create a governed delay on assigned project', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mutation governance is viewport-independent and covered on desktop.')
  await signIn(page, users.pm)
  const p = await project(page)
  const delay = await api(page, `/api/projects/${p.id}/programme/delays`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `PM delay ${Date.now()}`, category: 'design', startDate: '2026-10-16', delayDays: 1 }) })
  expect(delay.status).toBe(201)
})

test('Foreman can read change control but cannot govern baselines or delays', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mutation governance is viewport-independent and covered on desktop.')
  await signIn(page, users.foreman)
  const p = await project(page)
  const list = await api(page, `/api/projects/${p.id}/programme`)
  expect(list.status).toBe(200)
  expect(Array.isArray(list.body?.baselines)).toBe(true)
  expect(Array.isArray(list.body?.delays)).toBe(true)
  const baselineDenied = await api(page, `/api/projects/${p.id}/programme/baselines`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Forbidden baseline' }) })
  expect(baselineDenied.status).toBe(403)
  const delayDenied = await api(page, `/api/projects/${p.id}/programme/delays`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Forbidden delay', startDate: '2026-10-16' }) })
  expect(delayDenied.status).toBe(403)
})

test('Operative can read change-control evidence but cannot mutate it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mutation governance is viewport-independent and covered on desktop.')
  await signIn(page, users.operative)
  const p = await project(page)
  const list = await api(page, `/api/projects/${p.id}/programme`)
  expect(list.status).toBe(200)
  expect(list.body?.permissions?.plan).toBe(false)
  const delayDenied = await api(page, `/api/projects/${p.id}/programme/delays`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Operative forbidden delay', startDate: '2026-10-17' }) })
  expect(delayDenied.status).toBe(403)
})

test('mobile programme change-control page renders', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-specific rendering smoke check.')
  await signIn(page, users.admin)
  const p = await project(page)
  await page.goto(`/projects/${p.id}/programme`)
  await expect(page.getByText('CHANGE CONTROL')).toBeVisible()
  await expect(page.getByText(/Baseline Rev|No committed baseline/i)).toBeVisible()
})
