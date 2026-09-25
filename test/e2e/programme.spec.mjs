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

test('Company Admin can plan activities and dependencies from project programme', async ({ page }) => {
  await signIn(page, users.admin)
  const p = await project(page)
  await page.goto(`/projects/${p.id}/programme`)
  await expect(page.getByText('PROJECT PROGRAMME')).toBeVisible()
  await expect(page.getByRole('button', { name: /activity/i })).toBeVisible()
  const created = await api(page, `/api/projects/${p.id}/programme`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `E2E admin programme ${Date.now()}`, plannedStart: '2026-10-09', plannedEnd: '2026-10-12' }) })
  expect(created.status).toBe(201)
  const list = await api(page, `/api/projects/${p.id}/programme`)
  expect(list.status).toBe(200)
  expect(list.body?.summary?.criticalPath?.hasCycle).toBe(false)
  expect(list.body?.activities?.some(a => a.id === created.body?.id)).toBe(true)
})

test('Project Manager can plan the assigned project programme', async ({ page }) => {
  await signIn(page, users.pm)
  const p = await project(page)
  const created = await api(page, `/api/projects/${p.id}/programme`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `E2E PM programme ${Date.now()}`, plannedStart: '2026-10-10', plannedEnd: '2026-10-11' }) })
  expect(created.status).toBe(201)
})

test('Foreman can update field progress but cannot alter programme dates or create activities', async ({ page }) => {
  await signIn(page, users.foreman)
  const p = await project(page)
  const list = await api(page, `/api/projects/${p.id}/programme`)
  expect(list.status).toBe(200)
  const activity = list.body?.activities?.find(a => a.id === 'e2e-programme-b') || list.body?.activities?.[0]
  expect(activity).toBeTruthy()
  const progress = await api(page, `/api/projects/${p.id}/programme/${activity.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progress: 50 }) })
  expect(progress.status).toBe(200)
  expect(progress.body?.progress).toBe(50)
  const dateDenied = await api(page, `/api/projects/${p.id}/programme/${activity.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plannedEnd: '2026-12-31' }) })
  expect(dateDenied.status).toBe(403)
  const createDenied = await api(page, `/api/projects/${p.id}/programme`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Forbidden foreman activity', plannedStart: '2026-10-01', plannedEnd: '2026-10-02' }) })
  expect(createDenied.status).toBe(403)
})

test('Operative has read-only programme access', async ({ page }) => {
  await signIn(page, users.operative)
  const p = await project(page)
  const list = await api(page, `/api/projects/${p.id}/programme`)
  expect(list.status).toBe(200)
  expect(list.body?.permissions?.plan).toBe(false)
  expect(list.body?.permissions?.progress).toBe(false)
  const activity = list.body?.activities?.[0]
  expect(activity).toBeTruthy()
  const updateDenied = await api(page, `/api/projects/${p.id}/programme/${activity.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progress: 10 }) })
  expect(updateDenied.status).toBe(403)
})
