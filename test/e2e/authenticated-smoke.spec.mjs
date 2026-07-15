import { test, expect } from '@playwright/test'

const email = process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.com'
const password = process.env.E2E_ADMIN_PASSWORD || 'changeme-please-1234'

const coreRoutes = [
  '/dashboard',
  '/projects',
  '/tasks',
  '/documents',
  '/team',
  '/timesheets',
  '/invoices',
  '/quotes',
  '/site-diary',
  '/snags',
  '/photos',
  '/drawings',
  '/settings',
]

async function enterCredentials(page, nextEmail, nextPassword) {
  const emailInput = page.getByLabel('Email')
  const passwordInput = page.getByLabel('Password')
  const submitButton = page.getByRole('button', { name: /^sign in$/i })

  await expect(emailInput).toBeVisible()
  await expect(passwordInput).toBeVisible()

  // Type as a user would rather than setting the DOM value in one operation.
  // This reliably reaches React's controlled-input handlers after hydration.
  await emailInput.click()
  await emailInput.pressSequentially(nextEmail)
  await passwordInput.click()
  await passwordInput.pressSequentially(nextPassword)

  await expect(emailInput).toHaveValue(nextEmail)
  await expect(passwordInput).toHaveValue(nextPassword)
  await expect(submitButton).toBeEnabled()

  return submitButton
}

async function signIn(page) {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /sign in to cortexx/i })).toBeVisible()
  const submitButton = await enterCredentials(page, email, password)
  await submitButton.click()
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30_000 })
  await expect(page).toHaveURL(/\/dashboard/)
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
  await page.goto('/login')
  const submitButton = await enterCredentials(page, 'invalid@example.com', 'not-the-password')
  await submitButton.click()
  await expect(page.getByRole('alert')).toContainText(/invalid email or password/i)
  await expect(submitButton).toBeEnabled()
})
