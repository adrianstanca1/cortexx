import { test, expect } from '@playwright/test'

test.describe('Cortexx PWA — core functionality', () => {
  test('Cortexx.html loads without fatal errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/Cortexx.html')
    await page.waitForTimeout(1000)

    await expect(page.locator('body')).toBeVisible()
    expect(errors.filter(e => !e.includes('Source map'))).toEqual([])
  })

  test('service worker registers on Cortexx.html', async ({ page }) => {
    await page.goto('/Cortexx.html')

    const swState = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { supported: false }
      const reg = await navigator.serviceWorker.getRegistration()
      return {
        supported: true,
        registered: !!reg,
        scope: reg?.scope,
      }
    })

    expect(swState.supported).toBe(true)
    expect(swState.registered).toBe(true)
  })

  test('localStorage DB is initialised', async ({ page }) => {
    await page.goto('/Cortexx.html')
    await page.waitForTimeout(500)

    const hasDB = await page.evaluate(() => {
      return !!localStorage.getItem('cortexx_db_v1')
    })
    expect(hasDB).toBe(true)
  })

  test('offline mode serves cached content', async ({ page, context }) => {
    await page.goto('/Cortexx.html')
    // Same reason as pwa-offline.spec.mjs: wait for the service worker to be
    // active rather than sleeping a fixed delay, which made this flaky.
    await page.evaluate(() => navigator.serviceWorker.ready)

    await context.setOffline(true)
    await page.reload()

    await expect(page.locator('body')).toBeVisible()
    await context.setOffline(false)
  })
})
