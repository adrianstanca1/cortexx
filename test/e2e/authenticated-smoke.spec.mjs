import { test, expect } from '@playwright/test'
import { enterCredentials, openLogin, signIn as signInWithPassword, submitLogin } from './helpers/auth.mjs'

const email = process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.tech'
const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-local-role-password'

const coreRoutes = [
  '/dashboard',
  '/projects',
  '/tasks',
  '/documents',
  '/team',
  '/timesheets',
  '/timesheets/reconcile',
  '/invoices',
  '/quotes',
  '/site-diary',
  '/snags',
  '/photos',
  '/drawings',
  '/settings',
  '/settings/integrations/xero',
]

async function signIn(page) {
  await signInWithPassword(page, email, password, { dashboard: true })
}

test.beforeEach(async ({ page }) => {
  await signIn(page)
})

test('authenticated dashboard renders without fatal browser errors', async ({ page }) => {
  const fatalErrors = []
  page.on('pageerror', error => fatalErrors.push(error.message))

  await expect(page.locator('body')).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/application error|internal server error/i)
  expect(fatalErrors).toEqual([])
})

test('core pages and subpages respond for the signed-in organisation', async ({ page }) => {
  for (const route of coreRoutes) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
    expect(response, `No navigation response for ${route}`).not.toBeNull()
    expect(response.status(), `${route} returned ${response.status()}`).toBeLessThan(500)
    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/application error|internal server error/i)
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/)
  }
})

test('navigation exposes actionable controls without placeholder links', async ({ page }) => {
  await page.goto('/dashboard')

  const placeholderLinks = await page.locator('a[href="#"], a[href^="javascript:"]').count()
  expect(placeholderLinks).toBe(0)

  const visibleControls = page.locator('a:visible, button:visible')
  expect(await visibleControls.count()).toBeGreaterThan(0)

  const enabledControls = visibleControls.filter({ hasNot: page.locator('[disabled]') })
  expect(await enabledControls.count()).toBeGreaterThan(0)
})

test('invalid credentials return a recoverable error state', async ({ page, context }) => {
  await context.clearCookies()
  await openLogin(page)
  const submitButton = await enterCredentials(page, 'invalid@example.com', 'not-the-password')
  await submitLogin(page)
  await expect(page.getByText('Invalid email or password', { exact: true })).toBeVisible()
  await expect(submitButton).toBeEnabled()
})


test('site diary hydrates without browser errors', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/site-diary')
  await expect(page.getByRole('heading', { name: 'Site diary', exact: true })).toBeVisible()
  const date = page.locator('input[type="date"]')
  await date.fill('2026-09-24')
  await expect(page.getByText('Thursday 24 September 2026', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})
