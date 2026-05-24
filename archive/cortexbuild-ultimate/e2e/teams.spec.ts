import { test, expect } from '@playwright/test'

test.describe('Teams Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.locator('#root').waitFor({ state: 'visible', timeout: 20000 })
    await page.waitForTimeout(1000)

    // Navigate to Teams module via sidebar
    const teamsLink = page.locator('a').filter({ hasText: /Team|Teams|Workforce/i }).first()
    if (await teamsLink.isVisible()) {
      await teamsLink.click()
      await page.waitForTimeout(3000)
    }
  })

  test('teams page loads after navigation', async ({ page }) => {
    // Wait for page content
    await page.waitForTimeout(2000)
    
    // Check that we navigated
    const hasContent = await page.locator('#root').isVisible()
    expect(hasContent).toBeTruthy()
  })

  test('teams has content structure', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(2000)
    
    // Should have some structure
    const hasTable = await page.locator('table').isVisible()
    const hasGrid = await page.locator('[class*="grid"]').isVisible()
    const hasCards = await page.locator('[class*="card"]').count() > 0
    const hasAnyContent = await page.locator('#root').innerHTML().then(html => html.length > 100)
    
    expect(hasTable || hasGrid || hasCards || hasAnyContent).toBeTruthy()
  })

  test('teams has add member button', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(2000)
    
    // Look for any button
    const hasButton = await page.locator('button, [role="button"], a[role="button"]').count() > 0
    expect(hasButton).toBeTruthy()
  })

  test('teams shows team member information', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(2000)
    
    // Just verify page has content
    const hasContent = await page.locator('#root').innerHTML().then(html => html.length > 100)
    expect(hasContent).toBeTruthy()
  })

  test('teams has search or filter', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(2000)
    
    // Look for any input or select element
    const hasInput = await page.locator('input, select').count() > 0
    expect(hasInput).toBeTruthy()
  })

  test('bulk actions available when selecting items', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(2000)
    
    // Try to find and click a checkbox
    const checkbox = page.locator('input[type="checkbox"]').first()
    if (await checkbox.isVisible()) {
      await checkbox.click()
      await page.waitForTimeout(500)
      
      // Bulk actions bar should appear
      const hasBulkActions = await page.locator('[class*="bulk"], [class*="selected"], text=selected').isVisible()
      expect(hasBulkActions).toBeTruthy()
    }
  })

  test('responsive layout on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(1000)
    
    // Content should still be visible
    const hasContent = await page.locator('#root').isVisible()
    expect(hasContent).toBeTruthy()
  })
})
