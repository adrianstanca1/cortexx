import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'
// The PWA ships from the repo root via Caddy, not from the Next app (which
// serves only public/). These specs therefore run against a static server that
// stands in for Caddy — see scripts/static-server.mjs.
const pwaBaseURL = process.env.PLAYWRIGHT_PWA_BASE_URL || 'http://127.0.0.1:3101'
const PWA_SPECS = ['**/cortexx-pwa.spec.mjs', '**/landing-3d.spec.mjs', '**/pwa-offline.spec.mjs']

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.spec.mjs',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results/playwright',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    // ── Next.js app journeys (authenticated UI) ──────────────────────────
    {
      name: 'desktop-chromium',
      testIgnore: PWA_SPECS,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'mobile-chromium',
      testIgnore: PWA_SPECS,
      use: {
        ...devices['Pixel 7'],
        isMobile: true,
        hasTouch: true,
      },
    },
    // ── PWA journeys (static repo-root bundle, Caddy-equivalent) ─────────
    {
      name: 'pwa-desktop-chromium',
      testMatch: PWA_SPECS,
      // The service worker precaches the entire app source before anything can
      // be served offline, which is slower than the app journeys' 45s budget.
      timeout: 90_000,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
        baseURL: pwaBaseURL,
      },
    },
    {
      name: 'pwa-mobile-chromium',
      testMatch: PWA_SPECS,
      timeout: 90_000,
      use: {
        ...devices['Pixel 7'],
        isMobile: true,
        hasTouch: true,
        baseURL: pwaBaseURL,
      },
    },
  ],
  webServer: [{
    // Stands in for Caddy: serves the PWA off the repo root.
    command: 'node scripts/static-server.mjs',
    url: `${pwaBaseURL}/landing.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: { ...process.env, PORT: new URL(pwaBaseURL).port },
  }, {
    command: 'npm run dev',
    // Poll /login, not /: proxy.ts rewrites unauthenticated / to
    // /legacy/Cortexx-standalone.html, which lives only on the VPS (never
    // committed), so / is a permanent 404 in CI and the readiness check
    // would time out. /login is a committed public route the journeys use.
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXTAUTH_URL: baseURL,
      AUTH_URL: baseURL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'local-playwright-secret-change-me',
      AUTH_SECRET: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'local-playwright-secret-change-me',
    },
  }],
})
