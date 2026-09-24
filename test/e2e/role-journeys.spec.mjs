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
  await expect(page).toHaveURL(/\/dashboard/)
}

async function api(page, path, init = {}) {
  return page.evaluate(async ({ path, init }) => {
    const res = await fetch(path, init)
    const body = await res.json().catch(() => null)
    return { status: res.status, body }
  }, { path, init })
}

async function getVerificationProject(page) {
  const result = await api(page, '/api/projects')
  expect(result.status).toBe(200)
  const project = result.body?.projects?.find(p => p.name === 'E2E Verification Project') || result.body?.projects?.[0]
  expect(project).toBeTruthy()
  return project
}

async function getPersonaMember(page, email) {
  const result = await api(page, '/api/team')
  expect(result.status).toBe(200)
  const member = result.body?.team?.find(m => m.email === email)
  expect(member).toBeTruthy()
  return member
}

async function expectProjectCreateDenied(page, label) {
  const result = await api(page, '/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Forbidden ${label} Project`, postcode: 'E2E 1ZZ', address: 'Denied', clientName: 'Denied', budget: 1 }),
  })
  expect(result.status).toBe(403)
  expect(result.body?.error).toMatch(/company admin permission required/i)
}

test('Company Admin can create projects from the browser UI', async ({ page }) => {
  await signIn(page, users.admin)
  await page.goto('/projects?new=1')
  await expect(page.getByRole('button', { name: 'Create new project' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'New project' })).toBeVisible()

  const suffix = `${Date.now()}`.slice(-7)
  await page.getByPlaceholder('Camden Mews Refurb').fill(`E2E Admin Project ${suffix}`)
  await page.getByPlaceholder('NW1 9AH').fill('E2E 2AA')
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByText('Project created', { exact: true })).toBeVisible()
})

test('Project Manager operates tasks but cannot create projects', async ({ page }) => {
  await signIn(page, users.pm)
  await page.goto('/projects?new=1')
  await expect(page.getByRole('button', { name: 'Create new project' })).toHaveCount(0)
  await expectProjectCreateDenied(page, 'PM')

  const project = await getVerificationProject(page)
  const created = await api(page, '/api/tasks', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'E2E PM coordination task', priority: 'high', projectId: project.id }),
  })
  expect(created.status).toBe(201)
  expect(created.body?.projectId).toBe(project.id)
  await page.goto('/tasks')
  await expect(page.locator('body')).toContainText('E2E PM coordination task')
})

test('Foreman can execute site workflow but cannot create projects', async ({ page }) => {
  await signIn(page, users.foreman)
  await expectProjectCreateDenied(page, 'Foreman')
  const project = await getVerificationProject(page)
  const member = await getPersonaMember(page, users.foreman)

  let checkin = await api(page, '/api/checkins', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId: member.id, projectId: project.id, latitude: 51.5, longitude: -0.1, notes: 'E2E foreman field check-in' }),
  })
  if (checkin.status === 409) {
    checkin = await api(page, `/api/checkins?memberId=${encodeURIComponent(member.id)}&activeOnly=true`)
    expect(checkin.status).toBe(200)
    expect(checkin.body?.checkins?.length).toBeGreaterThan(0)
  } else {
    expect(checkin.status).toBe(201)
  }

  for (const route of ['/my-day', '/tasks', '/site-diary', '/check-in']) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
    expect(response?.status() || 0).toBeLessThan(500)
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/)
  }
})

test('Operative can log hours and use field pages but cannot create projects', async ({ page }) => {
  await signIn(page, users.operative)
  await expectProjectCreateDenied(page, 'Operative')
  const project = await getVerificationProject(page)
  const member = await getPersonaMember(page, users.operative)

  const entry = await api(page, '/api/timeentries', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId: member.id, projectId: project.id, date: new Date().toISOString(), hours: 7.5 }),
  })
  expect(entry.status).toBe(201)
  expect(entry.body?.memberId).toBe(member.id)

  for (const route of ['/my-day', '/check-in', '/timesheets']) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
    expect(response?.status() || 0).toBeLessThan(500)
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/)
  }
})
