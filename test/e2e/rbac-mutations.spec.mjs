import { test, expect } from '@playwright/test'
import { signIn as signInWithPassword } from './helpers/auth.mjs'

const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-local-role-password'
const users = {
  admin: process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.tech',
  pm: process.env.E2E_PM_EMAIL || 'pm@cortexbuildpro.tech',
  foreman: process.env.E2E_FOREMAN_EMAIL || 'foreman@cortexbuildpro.tech',
  operative: process.env.E2E_OPERATIVE_EMAIL || 'operative@cortexbuildpro.tech',
}

async function signIn(page, email) {
  return signInWithPassword(page, email, password, { dashboard: true })
}

async function api(page, path, init = {}) {
  return page.evaluate(async ({ path, init }) => {
    const res = await fetch(path, init)
    const body = await res.json().catch(() => null)
    return { status: res.status, body }
  }, { path, init })
}

async function getProjects(page) {
  const result = await api(page, '/api/projects?take=100')
  expect(result.status).toBe(200)
  return result.body?.projects || []
}

async function getTimes(page) {
  const result = await api(page, '/api/timeentries?allWeeks=true')
  expect(result.status).toBe(200)
  return result.body?.entries || []
}

async function getDashboard(page) {
  const result = await api(page, '/api/dashboard')
  expect(result.status).toBe(200)
  return result.body
}

async function expectCompanyMutationDenied(page) {
  const attempts = [
    ['/api/team', { name: 'Blocked Person', role: 'Operative' }],
    ['/api/invoices', { number: `BLOCK-${Date.now()}`, clientName: 'Blocked', amount: 10, dueDate: '2026-10-01' }],
    ['/api/quotes', { title: 'Blocked quote', customerName: 'Blocked Client', lineItems: [] }],
    ['/api/tenders', { title: 'Blocked confidential tender', totalValue: 10 }],
    ['/api/valuations', { projectId: 'blocked' }],
  ]
  for (const [path, body] of attempts) {
    const result = await api(page, path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    expect(result.status, path).toBe(403)
  }
  const xero = await api(page, '/api/integrations/xero', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ salesAccountCode: '200' }) })
  expect(xero.status, '/api/integrations/xero').toBe(403)
}

test('Company Admin retains company finance and team mutation boundary', async ({ page }) => {
  await signIn(page, users.admin)
  const teamValidation = await api(page, '/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  expect(teamValidation.status).toBe(400)
  const invoiceValidation = await api(page, '/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  expect(invoiceValidation.status).toBe(400)
  const quoteValidation = await api(page, '/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  expect(quoteValidation.status).toBe(400)
  const xeroState = await api(page, '/api/integrations/xero')
  expect(xeroState.status).toBe(200)
  expect(typeof xeroState.body?.platformConfigured).toBe('boolean')

  const projects = await getProjects(page)
  expect(projects.some(p => p.name === 'E2E Admin Only Project')).toBe(true)
  const tasks = await api(page, '/api/tasks?take=100')
  expect(tasks.status).toBe(200)
  expect(tasks.body?.tasks?.some(t => t.title === 'E2E Admin Only Task')).toBe(true)

  const dashboard = await getDashboard(page)
  expect(dashboard.projects?.some(p => p.name === 'E2E Admin Only Project')).toBe(true)
  expect(dashboard.invoices?.some(i => i.number === 'E2E-ADMIN-001')).toBe(true)
  expect(dashboard.stats?.owed).toBeGreaterThanOrEqual(1250)
})

test('Project Manager is assignment-scoped, blocked from company finance/team, and can approve assigned time only', async ({ page }) => {
  await signIn(page, users.pm)
  const projects = await getProjects(page)
  const assigned = projects.find(p => p.name === 'E2E Verification Project')
  expect(assigned).toBeTruthy()
  expect(projects.some(p => p.name === 'E2E Admin Only Project')).toBe(false)

  const tasks = await api(page, '/api/tasks?take=100')
  expect(tasks.status).toBe(200)
  expect(tasks.body?.tasks?.some(t => t.title === 'E2E Admin Only Task')).toBe(false)
  const forbiddenTask = await api(page, '/api/tasks', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Forbidden cross-project task', projectId: 'not-assigned' }),
  })
  expect(forbiddenTask.status).toBe(403)
  await expectCompanyMutationDenied(page)
  const dashboard = await getDashboard(page)
  expect(dashboard.projects?.some(p => p.name === 'E2E Admin Only Project')).toBe(false)
  expect(dashboard.invoices).toEqual([])
  expect(dashboard.stats?.owed).toBe(0)
  expect(dashboard.stats?.cashflow).toBe(0)

  const entries = await getTimes(page)
  const assignedEntry = entries.find(e => e.project?.name === 'E2E Verification Project' && !e.approved)
  expect(assignedEntry).toBeTruthy()
  expect(entries.some(e => e.project?.name === 'E2E Admin Only Project')).toBe(false)

  const approve = await api(page, `/api/timeentries/${assignedEntry.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved: true }) })
  expect(approve.status).toBe(200)
  expect(approve.body?.approved).toBe(true)
  const restore = await api(page, `/api/timeentries/${assignedEntry.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved: false }) })
  expect(restore.status).toBe(200)
})

test('Foreman is assignment-scoped and cannot approve time or mutate company administration', async ({ page }) => {
  await signIn(page, users.foreman)
  const projects = await getProjects(page)
  expect(projects.some(p => p.name === 'E2E Verification Project')).toBe(true)
  expect(projects.some(p => p.name === 'E2E Admin Only Project')).toBe(false)
  await expectCompanyMutationDenied(page)
  const dashboard = await getDashboard(page)
  expect(dashboard.projects?.some(p => p.name === 'E2E Admin Only Project')).toBe(false)
  expect(dashboard.invoices).toEqual([])
  expect(dashboard.stats?.owed).toBe(0)

  const entries = await getTimes(page)
  const entry = entries.find(e => e.project?.name === 'E2E Verification Project')
  expect(entry).toBeTruthy()
  const denied = await api(page, `/api/timeentries/${entry.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved: true }) })
  expect(denied.status).toBe(403)
  const bulkDenied = await api(page, '/api/timeentries/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', ids: [entry.id] }) })
  expect(bulkDenied.status).toBe(403)
})

test('Operative sees only self task/time context and cannot approve or mutate other users', async ({ page }) => {
  await signIn(page, users.operative)
  const team = await api(page, '/api/team')
  expect(team.status).toBe(200)
  expect(team.body?.team?.length).toBe(1)
  expect(team.body?.team?.[0]?.email).toBe(users.operative)
  const selfTeamMutation = await api(page, `/api/team/${team.body.team[0].id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: 'blocked' }),
  })
  expect(selfTeamMutation.status).toBe(403)

  const dashboard = await getDashboard(page)
  expect(dashboard.projects?.some(p => p.name === 'E2E Admin Only Project')).toBe(false)
  expect(dashboard.invoices).toEqual([])
  expect(dashboard.team?.length).toBe(1)
  expect(dashboard.team?.[0]?.email).toBe(users.operative)
  expect(dashboard.tasks?.some(t => t.title === 'E2E Admin Only Task')).toBe(false)
  expect(dashboard.tasks?.every(t => t.assignee?.email === users.operative)).toBe(true)
  expect(dashboard.stats?.cashflow).toBe(0)
  expect(dashboard.stats?.owed).toBe(0)

  const tasks = await api(page, '/api/tasks?take=100')
  expect(tasks.status).toBe(200)
  expect(tasks.body?.tasks?.some(t => t.title === 'E2E Operative Task')).toBe(true)
  expect(tasks.body?.tasks?.some(t => t.title === 'E2E Admin Only Task')).toBe(false)
  await expectCompanyMutationDenied(page)

  const entries = await getTimes(page)
  expect(entries.length).toBeGreaterThan(0)
  expect(entries.every(e => e.member?.email === users.operative)).toBe(true)
  const unapproved = entries.find(e => !e.approved)
  expect(unapproved).toBeTruthy()
  const denied = await api(page, `/api/timeentries/${unapproved.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved: true }) })
  expect(denied.status).toBe(403)

  const approved = entries.find(e => e.approved)
  expect(approved).toBeTruthy()
  const editApproved = await api(page, `/api/timeentries/${approved.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hours: 6 }) })
  expect(editApproved.status).toBe(403)
  const deleteApproved = await api(page, `/api/timeentries/${approved.id}`, { method: 'DELETE' })
  expect(deleteApproved.status).toBe(403)

  const foreman = await api(page, '/api/team')
  expect(foreman.body?.team?.some(m => m.email === users.foreman)).toBe(false)
})

test('field users cannot change workforce assignments, but can only view assigned projects', async ({ page }) => {
  for (const email of [users.foreman, users.operative]) {
    await signIn(page, email)
    const projects = await getProjects(page)
    const allowed = new Set(projects.map(p => p.id))
    const visible = await api(page, '/api/assignments')
    expect(visible.status).toBe(200)
    for (const assignment of visible.body?.assignments || []) {
      expect(allowed.has(assignment.projectId)).toBe(true)
      expect(assignment.project?.name).not.toBe('E2E Admin Only Project')
    }
    const forbiddenCreate = await api(page, '/api/assignments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: projects[0]?.id || 'not-a-project', memberId: 'not-a-member' }),
    })
    expect(forbiddenCreate.status).toBe(403)
    const forbiddenEdit = await api(page, '/api/assignments/not-a-real-assignment', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onSite: true }),
    })
    expect(forbiddenEdit.status).toBe(403)
    const forbiddenDelete = await api(page, '/api/assignments/not-a-real-assignment', { method: 'DELETE' })
    expect(forbiddenDelete.status).toBe(403)
  }
})

test('project manager workforce edits require a project actually assigned to them', async ({ page }) => {
  await signIn(page, users.pm)
  const assignments = await api(page, '/api/assignments')
  expect(assignments.status).toBe(200)
  expect((assignments.body?.assignments || []).some(a => a.project?.name === 'E2E Admin Only Project')).toBe(false)
  // A manager may edit workforce only on the projects granted to them.
  const denied = await api(page, '/api/assignments', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: 'not-an-assigned-project', memberId: 'not-a-member' }),
  })
  expect(denied.status).toBe(404)
  const deniedDelete = await api(page, '/api/assignments/not-an-assignment', { method: 'DELETE' })
  expect(deniedDelete.status).toBe(404)
})

test('company commercial admin can list tenders but field roles cannot read or mutate them', async ({ page }) => {
  await signIn(page, users.admin)
  const adminList = await api(page, '/api/tenders')
  expect(adminList.status).toBe(200)
  for (const email of [users.pm, users.foreman, users.operative]) {
    await signIn(page, email)
    const list = await api(page, '/api/tenders')
    expect(list.status).toBe(403)
    const mutate = await api(page, '/api/tenders/nonexistent-id', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'won' }),
    })
    expect(mutate.status).toBe(403)
    const remove = await api(page, '/api/tenders/nonexistent-id', { method: 'DELETE' })
    expect(remove.status).toBe(403)
  }
})
