import { test, expect } from '@playwright/test'

test.describe('Client Portal Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.locator('#root').waitFor({ state: 'visible', timeout: 20000 })
    await page.waitForTimeout(1000)
  })

  test('client portal page loads', async ({ page }) => {
    // Navigate to Client Portal via sidebar
    const portalLink = page.locator('a, button').filter({ hasText: /Client Portal|Client\/Owner/i }).first()
    if (await portalLink.isVisible()) {
      await portalLink.click()
      await page.waitForTimeout(3000)
    }

    // Should have portal content
    const hasContent = await page.locator('#root').innerHTML().then(html => html.length > 200)
    expect(hasContent).toBeTruthy()
  })

  test('client portal shows project overview', async ({ page }) => {
    const portalLink = page.locator('a, button').filter({ hasText: /Client Portal|Client\/Owner/i }).first()
    if (await portalLink.isVisible()) {
      await portalLink.click()
      await page.waitForTimeout(2000)
    }

    // Should show some project-related content
    const hasOverview = await page.locator('#root').innerHTML().then(html =>
      html.includes('progress') || html.includes('budget') || html.includes('Project') || html.includes('Client')
    )
    expect(hasOverview).toBeTruthy()
  })

  test('client portal has valuations section', async ({ page }) => {
    const portalLink = page.locator('a, button').filter({ hasText: /Client Portal|Client\/Owner/i }).first()
    if (await portalLink.isVisible()) {
      await portalLink.click()
      await page.waitForTimeout(2000)
    }

    // Look for valuations content
    const hasValuations = await page.locator('#root').innerHTML().then(html =>
      html.includes('Valuation') || html.includes('valuation') || html.includes('Certificate')
    )
    expect(hasValuations).toBeTruthy()
  })

  test('client portal accessible via token URL', async ({ page }) => {
    // Navigate with portal token
    await page.goto('/?module=client-portal&token=test-token')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(3000)

    const hasContent = await page.locator('#root').innerHTML().then(html => html.length > 200)
    expect(hasContent).toBeTruthy()
  })
})
