import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  globalSetup: resolve(__dirname, './e2e/global-setup'),
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    storageState: 'e2e/.auth/storage-state.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Firefox and WebKit disabled by default - enable for full cross-browser testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
  // Optional: set E2E_START_API=1 to boot Express on :3001 for the same run (needs DATABASE_URL in server/.env).
  webServer: process.env.CI
    ? undefined
    : process.env.E2E_START_API === '1'
      ? [
          {
            command: 'node index.js',
            cwd: resolve(__dirname, 'server'),
            url: 'http://127.0.0.1:3001/api/health',
            reuseExistingServer: true,
            timeout: 120_000,
          },
          {
            command: 'npm run dev',
            url: 'http://127.0.0.1:5173',
            reuseExistingServer: true,
            timeout: 120_000,
          },
        ]
      : {
          command: 'npm run dev',
          url: 'http://localhost:5173',
          reuseExistingServer: true,
          timeout: 120_000,
        },
})
