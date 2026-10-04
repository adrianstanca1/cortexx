import { test, expect } from '@playwright/test'

test('task mutations update fallback progress without overwriting the programme', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.com')
  await page.getByLabel('Password').fill(process.env.E2E_ADMIN_PASSWORD || 'e2e-local-role-password')
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL('**/dashboard')
  const request = async (path, method = 'GET', data) => {
    const response = await page.request.fetch(path, { method, data })
    expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBeTruthy()
    return response.json()
  }
  const project = await request('/api/projects', 'POST', { name: `Progress verification ${Date.now()}`, postcode: 'E1 1AA' })
  const path = `/api/projects/${project.id}`
  const progress = async () => (await request(path)).project.progress
  const task = await request('/api/tasks', 'POST', { title: 'First task', projectId: project.id, status: 'done' })
  expect(await progress()).toBe(100)
  const open = await request('/api/tasks', 'POST', { title: 'Second task', projectId: project.id })
  expect(await progress()).toBe(50)
  await request(`/api/tasks/${task.id}`, 'DELETE')
  expect(await progress()).toBe(0)

  // Creating the programme activity takes ownership of progress. Thereafter
  // every task mutation must leave the programme-derived value untouched.
  await request(`${path}/programme`, 'POST', { title: 'Facade installation', plannedStart: '2026-09-01', plannedEnd: '2026-09-10', progress: 37 })
  expect(await progress()).toBe(37)
  await request(`/api/tasks/${open.id}`, 'PUT', { status: 'done' })
  expect(await progress()).toBe(37)

  // Deleting the last task must not zero a programme-owned project, and it
  // must not surface the programme as absent either.
  await request(`/api/tasks/${open.id}`, 'DELETE')
  expect(await progress()).toBe(37)
})
