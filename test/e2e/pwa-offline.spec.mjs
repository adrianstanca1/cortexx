import { test, expect } from '@playwright/test'

test.describe('PWA — manifest, service worker, offline', () => {
  test('manifest.json is valid and parseable', async ({ page }) => {
    const response = await page.goto('/manifest.json')
    expect(response).not.toBeNull()
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/json')

    const manifest = await response.json()
    expect(manifest.name).toBe('CortexBuild Pro')
    expect(manifest.short_name).toBe('CortexBuild')
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/Cortexx.html')
    expect(manifest.icons).toBeInstanceOf(Array)
    expect(manifest.icons.length).toBeGreaterThanOrEqual(4)
    expect(manifest.shortcuts).toBeInstanceOf(Array)
  })

  test('service worker registers successfully', async ({ page }) => {
    await page.goto('/landing.html')

    const swState = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { supported: false }
      const reg = await navigator.serviceWorker.ready
      return {
        supported: true,
        active: !!reg.active,
        scope: reg.scope,
      }
    })

    expect(swState.supported).toBe(true)
    expect(swState.active).toBe(true)
    expect(swState.scope).toContain('/')
  })

  test('offline.html is cached and accessible', async ({ page, context }) => {
    // First visit to cache resources
    await page.goto('/landing.html')
    // Wait for the service worker to be active AND controlling this page rather
    // than sleeping a fixed 500ms. Nothing can be served from cache until a
    // controller exists, so the old timeout raced activation and the offline
    // navigation then failed outright with ERR_INTERNET_DISCONNECTED — testing
    // the race, not the offline behaviour. The page that registers a worker is
    // not controlled by it until clients.claim() lands, so reload once to be
    // certain instead of depending on that timing.
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await page.evaluate(() => navigator.serviceWorker.ready)

    // Go offline
    await context.setOffline(true)

    // Navigate to a page that should fall back to offline.html
    const response = await page.goto('/nonexistent-page', { waitUntil: 'domcontentloaded' })
    expect(response).not.toBeNull()
    // Should get the offline fallback or the cached landing
    const bodyText = await page.locator('body').textContent()
    expect(bodyText).toMatch(/offline|CortexBuild|construction OS/i)

    // Restore online
    await context.setOffline(false)
  })

  test('browserconfig.xml exists for legacy IE/Edge', async ({ page }) => {
    const response = await page.goto('/browserconfig.xml')
    expect(response).not.toBeNull()
    expect(response.status()).toBe(200)

    const body = await response.text()
    expect(body).toContain('browserconfig')
    expect(body).toContain('icon-192.png')
  })

  test('theme-color meta tag matches manifest', async ({ page }) => {
    await page.goto('/landing.html')

    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content')
    expect(themeColor).toBe('#0a0f1a')
  })

  test('apple-touch-icon is referenced', async ({ page }) => {
    await page.goto('/landing.html')

    const icon = page.locator('link[rel="apple-touch-icon"]')
    await expect(icon).toHaveAttribute('href', '/apple-touch-icon.png')
  })

  test('manifest link is present on landing page', async ({ page }) => {
    await page.goto('/landing.html')

    const manifest = page.locator('link[rel="manifest"]')
    await expect(manifest).toHaveAttribute('href', '/manifest.json')
  })
})
