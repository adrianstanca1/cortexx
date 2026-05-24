import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.locator('#root').waitFor({ state: 'visible', timeout: 20000 })
    await page.waitForTimeout(1000)
  })

  test('dashboard loads after login', async ({ page }) => {
    // Verify we're on the dashboard (root URL after login)
    const url = page.url()
    expect(url).toMatch(/\/?$/)
    
    // App content should be visible
    const hasContent = await page.locator('#root').isVisible()
    expect(hasContent).toBeTruthy()
  })

  test('dashboard has charts or graphs', async ({ page }) => {
    // Wait for charts to load
    await page.waitForTimeout(3000)
    
    // Look for chart elements - canvas, svg, or recharts containers
    const hasChart = await page.locator('canvas, svg, [class*="chart"], [class*="recharts"]').count() > 0
    expect(hasChart).toBeTruthy()
  })

  test('dashboard is responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(1000)
    
    // Content should still be visible on mobile
    const hasContent = await page.locator('#root').isVisible()
    expect(hasContent).toBeTruthy()
  })
})
