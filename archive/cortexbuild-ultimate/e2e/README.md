# E2E Testing Guide

## Overview

CortexBuild Ultimate uses [Playwright](https://playwright.dev) for end-to-end testing across the application.

**Test Count:** 51 total (45 passing, 6 skipped for CI-only API tests)

## Quick Start

```bash
# Install dependencies (already in package.json)
npm install

# Run all E2E tests (headless)
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed
```

## Test Files & Coverage

| File | Tests | Description |
|------|-------|-------------|
| `auth.spec.ts` | 5 | Login/signup flow, validation, password toggle |
| `api.spec.ts` | 8 (6 skipped) | Backend API health & auth endpoints |
| `dashboard.spec.ts` | 3 | Dashboard widgets, charts, responsive |
| `projects.spec.ts` | 4 | Projects module, bulk actions, responsive |
| `safety.spec.ts` | 7 | HSE/safety incident management |
| `rfis.spec.ts` | 7 | Request for Information workflow |
| `teams.spec.ts` | 7 | Workforce/team member management |
| `documents.spec.ts` | 7 | Document control and uploads |

## Module Test Coverage

Each module test includes:
- ✅ Page navigation and load
- ✅ Content structure verification (table/grid/cards)
- ✅ Action buttons (create, upload, add)
- ✅ Module-specific content
- ✅ Search/filter functionality
- ✅ Bulk actions with selection
- ✅ Mobile responsive layout

## Page Objects

Located in `e2e/pages/`:

- `LoginPage.ts` - Login/signup page interactions
- `DashboardPage.ts` - Dashboard widget interactions

## Configuration

Edit `playwright.config.ts` to customize:

```typescript
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html'], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
})
```

## Environment Variables

```bash
# Base URL for E2E tests (default: http://localhost:5173)
E2E_BASE_URL=http://localhost:5173

# API base URL for API tests (default: http://72.62.132.43:3001/api)
API_BASE_URL=http://localhost:3001/api

# Test user credentials for authenticated tests
TEST_USER_EMAIL=adrian.stanca1@gmail.com
TEST_USER_PASSWORD=Lolozania1
```

## Running Specific Tests

```bash
# Run a single test file
npx playwright test e2e/auth.spec.ts

# Run tests by name pattern
npx playwright test -g "login"

# Run tests in a specific project (browser)
npx playwright test --project=chromium

# Run tests with debug mode
npx playwright test --debug
```

## Test Structure

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/')
  })

  test('test description', async ({ page }) => {
    // Test steps
    await expect(page.locator('h1')).toBeVisible()
  })
})
```

## Best Practices

1. **Use Page Objects**: Encapsulate page interactions in `e2e/pages/`
2. **Wait for selectors**: Use `waitForSelector` instead of fixed timeouts
3. **Test user flows**: Focus on real user scenarios
4. **Use data-testid**: Add `data-testid` attributes for stable selectors
5. **Parallel execution**: Tests run in parallel by default
6. **Cleanup**: Use `test.afterEach` for cleanup if needed

## CI/CD Integration

Tests automatically run in CI with:
- Chromium only (faster)
- 2 retries on failure
- Single worker for stability

```yaml
# GitHub Actions example
- name: Install Playwright
  run: npx playwright install --with-deps chromium

- name: Run E2E tests
  run: npm run test:e2e
```

## Troubleshooting

### Tests fail locally
- Ensure dev server is running: `npm run dev`
- Check base URL: `echo $E2E_BASE_URL`
- Clear browser cache: `rm -rf playwright-report test-results`

### Tests timeout
- Increase timeout in `playwright.config.ts`
- Use `test.setTimeout(60000)` for specific tests
- Check if backend API is responding

### Flaky tests
- Add explicit waits: `await page.waitForSelector(...)`
- Use retries: `test.retry(2)`
- Avoid race conditions with proper selectors

## Reports

After running tests, open the HTML report:

```bash
npx playwright show-report
```

Reports are saved to `playwright-report/` with:
- Test results and duration
- Screenshots on failure
- Trace files for debugging
- Video recordings (on failure)

## Coverage

To check E2E test coverage, run:

```bash
# Run all tests
npm run test:e2e

# View summary
cat playwright-report/index.html
```

## Contributing

When adding new features:
1. Add corresponding E2E tests
2. Update page objects if needed
3. Run tests locally before pushing
4. Ensure tests pass in CI

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Test Examples](https://github.com/microsoft/playwright-test-examples)
- [Testing Library Best Practices](https://testing-library.com/docs/react-testing-library/intro)
