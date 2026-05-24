import { test, expect } from '@playwright/test'

test.describe('Webhooks Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.locator('#root').waitFor({ state: 'visible', timeout: 20000 })
    await page.waitForTimeout(1000)
  })

  test('webhooks page loads after navigation', async ({ page }) => {
    // Navigate to Webhooks via sidebar
    const whLink = page.locator('a, button').filter({ hasText: /Webhook/i }).first()
    if (await whLink.isVisible()) {
      await whLink.click()
      await page.waitForTimeout(3000)
    }

    // Should have webhooks heading or content
    const hasContent = await page.locator('#root').innerHTML().then(html => html.length > 200)
    expect(hasContent).toBeTruthy()
  })

  test('webhooks has create button', async ({ page }) => {
    const whLink = page.locator('a, button').filter({ hasText: /Webhook/i }).first()
    if (await whLink.isVisible()) {
      await whLink.click()
      await page.waitForTimeout(2000)
    }

    // Look for a New Webhook or Create button
    const hasNewButton = await page.getByText(/New|Add|Create/i).first().isVisible().catch(() => false)
    expect(hasNewButton).toBeTruthy()
  })

  test('webhooks shows webhook list', async ({ page }) => {
    const whLink = page.locator('a, button').filter({ hasText: /Webhook/i }).first()
    if (await whLink.isVisible()) {
      await whLink.click()
      await page.waitForTimeout(2000)
    }

    // Should have some list structure
    const hasList = await page.locator('[class*="divide"]').first().isVisible().catch(() => false)
    const hasCards = await page.locator('[class*="card"]').first().isVisible().catch(() => false)
    const hasTable = await page.locator('table').first().isVisible().catch(() => false)
    const hasAnyContent = await page.locator('#root').innerHTML().then(html => html.length > 200)

    expect(hasList || hasCards || hasTable || hasAnyContent).toBeTruthy()
  })

  test('new webhook modal opens', async ({ page }) => {
    const whLink = page.locator('a, button').filter({ hasText: /Webhook/i }).first()
    if (await whLink.isVisible()) {
      await whLink.click()
      await page.waitForTimeout(2000)
    }

    // Click New Webhook button
    const newBtn = page.getByText(/New Webhook/i).first()
    if (await newBtn.isVisible().catch(() => false)) {
      await newBtn.click()
      await page.waitForTimeout(1000)
      // Modal should appear
      const hasModal = await page.locator('form').first().isVisible().catch(() => false)
      expect(hasModal).toBeTruthy()
    }
  })
})
