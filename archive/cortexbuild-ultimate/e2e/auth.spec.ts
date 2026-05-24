import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'

test.describe('Authentication', () => {
  // Unauthenticated flows — do not reuse JWT from global setup
  test.use({ storageState: { cookies: [], origins: [] } })
  test('login page renders correctly', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    // Verify key elements are visible
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('can toggle between login and signup modes', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    // Login mode shows Sign In button
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In')

    // Toggle to signup mode
    await loginPage.modeToggle.click()

    // Signup mode shows Create Account and additional fields
    await expect(page.locator('button[type="submit"]')).toContainText('Create Account')
    await expect(loginPage.nameInput).toBeVisible()
    await expect(loginPage.companyInput).toBeVisible()
  })

  test('login with empty fields shows validation', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    // Submit without filling fields
    await loginPage.submitButton.click()

    // HTML5 validation should prevent submission (form won't submit)
    // The button should remain enabled (no loading state)
    await expect(loginPage.submitButton).toBeEnabled()
  })

  test('signup with empty fields shows validation', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    // Switch to signup mode
    await loginPage.modeToggle.click()

    // Wait for signup form fields to appear (reliable wait over arbitrary timeout)
    await expect(loginPage.nameInput).toBeVisible()

    // Submit without filling fields
    await loginPage.submitButton.click()

    // HTML5 validation should prevent submission
    await expect(loginPage.submitButton).toBeEnabled()
  })

  test('password visibility toggle works', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    // Password should be masked by default (use placeholder to find input)
    const passwordInput = page.locator('input[placeholder="••••••••"]')
    await expect(passwordInput).toHaveAttribute('type', 'password')

    // Click the visibility toggle button (after the password input)
    await page.locator('input[placeholder="••••••••"] + button').click()

    // Password should now be visible (type changes to text)
    await expect(passwordInput).toHaveAttribute('type', 'text')
  })
})
