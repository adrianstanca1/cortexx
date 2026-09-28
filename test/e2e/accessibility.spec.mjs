import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { assertRouteHealth } from './helpers/route-health.mjs'
import { signIn } from './helpers/auth.mjs'

const email = process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.com'
const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-local-role-password'

const criticalRoutes = [
  '/dashboard',
  '/projects',
  '/tasks',
  '/documents',
  '/drawings',
  '/check-in',
  '/timesheets',
  '/site-diary',
  '/snags',
  '/photos',
  '/safety',
  '/inspections',
  '/invoices',
  '/settings',
]

function formatViolations(route, violations) {
  return violations.map(v => {
    const targets = v.nodes.slice(0, 4).map(node => node.target.join(' ')).join(', ')
    return route + ': ' + v.id + ' [' + v.impact + '] ' + v.help + ' — ' + targets
  })
}

async function analyze(page, route, ready) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
  assertRouteHealth(response, route, page.url())
  await expect(page.locator('body')).toBeVisible()
  if (ready) await expect(page.getByText(ready, { exact: true })).toBeVisible()
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return formatViolations(route, results.violations)
}

test('authentication surfaces have no WCAG A/AA violations', async ({ page, context }) => {
  await context.clearCookies()
  const findings = []
  for (const route of ['/login', '/register']) findings.push(...await analyze(page, route))
  expect(findings, findings.join('\n')).toEqual([])
})

test('critical authenticated construction surfaces have no WCAG A/AA violations', async ({ page }) => {
  test.setTimeout(180_000)
  await signIn(page, email, password, { dashboard: true })
  const findings = []
  for (const route of criticalRoutes) findings.push(...await analyze(page, route))
  expect(findings, findings.join('\n')).toEqual([])
})


test('critical creation dialogs have no WCAG A/AA violations', async ({ page }) => {
  test.setTimeout(180_000)
  await signIn(page, email, password, { dashboard: true })
  const dialogs = [
    { route: '/projects?new=1', ready: ['button', 'Create project'] },
    { route: '/documents', open: ['button', 'Add document'] },
    { route: '/check-in', open: ['button', 'Check in'] },
    { route: '/timesheets', open: ['button', 'Add entry'] },
    { route: '/snags', open: ['button', 'Add snag'] },
    { route: '/safety', open: ['button', 'Log incident'] },
    { route: '/inspections', open: ['button', 'Add inspection'] },
  ]
  const findings = []
  for (const item of dialogs) {
    const response = await page.goto(item.route, { waitUntil: 'domcontentloaded' })
    assertRouteHealth(response, item.route, page.url())
    if (item.open) await page.getByRole(item.open[0], { name: item.open[1], exact: true }).click()
    if (item.ready) await expect(page.getByRole(item.ready[0], { name: item.ready[1], exact: true })).toBeVisible()
    else await page.waitForTimeout(150)
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    findings.push(...formatViolations(item.route + ' [open]', results.violations))
  }
  expect(findings, findings.join('\n')).toEqual([])
})

test('core dynamic project workspaces have no WCAG A/AA violations', async ({ page }) => {
  test.setTimeout(180_000)
  await signIn(page, email, password, { dashboard: true })
  const response = await page.context().request.get('/api/projects?take=100')
  expect(response.ok()).toBeTruthy()
  const payload = await response.json()
  const project = (payload.projects || payload).find(item => item.name === 'E2E Verification Project')
  expect(project?.id).toBeTruthy()

  const routes = [
    '/projects/' + project.id,
    '/projects/' + project.id + '/board',
    '/projects/' + project.id + '/gallery',
    '/projects/' + project.id + '/programme',
    '/projects/' + project.id + '/programme/resources',
  ]
  // Cover populated change control without depending on another test's writes.
  const delayResponse = await page.context().request.post('/api/projects/' + project.id + '/programme/delays', {
    data: { title: 'Accessibility delay ' + Date.now(), category: 'design', startDate: '2026-10-16', delayDays: 1 },
  })
  expect(delayResponse.status()).toBe(201)
  const delay = await delayResponse.json()
  try {
    const findings = []
    for (const route of routes) {
      findings.push(...await analyze(page, route, route.endsWith('/programme') ? 'MASTER PROGRAMME' : undefined))
    }
    expect(findings, findings.join('\n')).toEqual([])
  } finally {
    const cleanup = await page.context().request.delete('/api/projects/' + project.id + '/programme/delays/' + delay.id)
    expect(cleanup.ok()).toBeTruthy()
  }
})
