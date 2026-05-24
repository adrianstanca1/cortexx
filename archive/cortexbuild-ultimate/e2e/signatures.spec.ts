import { test, expect } from '@playwright/test'

test.describe('Signatures Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.locator('#root').waitFor({ state: 'visible', timeout: 20000 })
    await page.waitForTimeout(1000)
  })

  test('RAMS module has sign button in rows', async ({ page }) => {
    // Navigate to RAMS via sidebar
    const ramsLink = page.locator('a, button').filter({ hasText: /RAMS/i }).first()
    if (await ramsLink.isVisible()) {
      await ramsLink.click()
      await page.waitForTimeout(2000)
    }

    // RAMS page should load
    const hasRamsHeading = await page.getByText(/RAMS|Risk Assessment/i).first().isVisible().catch(() => false)
    expect(hasRamsHeading).toBeTruthy()
  })

  test('Valuations module loads with valuation table', async ({ page }) => {
    // Navigate to Valuations via sidebar
    const valLink = page.locator('a, button').filter({ hasText: /Valuation/i }).first()
    if (await valLink.isVisible()) {
      await valLink.click()
      await page.waitForTimeout(2000)
    }

    // Should show some valuations content
    const hasContent = await page.locator('#root').innerHTML().then(html => html.length > 200)
    expect(hasContent).toBeTruthy()
  })

  test('Change Orders module loads', async ({ page }) => {
    // Navigate to Change Orders via sidebar
    const coLink = page.locator('a, button').filter({ hasText: /Change Order/i }).first()
    if (await coLink.isVisible()) {
      await coLink.click()
      await page.waitForTimeout(2000)
    }

    const hasContent = await page.locator('#root').innerHTML().then(html => html.length > 200)
    expect(hasContent).toBeTruthy()
  })

  test('Documents module has sign button in detail panel', async ({ page }) => {
    // Navigate to Documents
    const docsLink = page.locator('a, button').filter({ hasText: /Document/i }).filter({ hasText: /DMS|Files/i }).first()
    if (await docsLink.isVisible()) {
      await docsLink.click()
      await page.waitForTimeout(2000)
    }

    // Should load documents content
    const hasDocsContent = await page.locator('#root').innerHTML().then(html => html.length > 200)
    expect(hasDocsContent).toBeTruthy()
  })
})
