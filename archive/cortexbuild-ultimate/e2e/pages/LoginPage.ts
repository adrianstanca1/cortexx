import { type Page, type Locator, expect } from '@playwright/test'

export class LoginPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly nameInput: Locator
  readonly companyInput: Locator
  readonly modeToggle: Locator
  readonly errorMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.locator('input[type="email"]')
    this.passwordInput = page.locator('input[type="password"]')
    this.submitButton = page.locator('button[type="submit"]')
    this.nameInput = page.locator('input[placeholder="Your full name"]')
    this.companyInput = page.locator('input[placeholder="Your company"]')
    this.modeToggle = page.locator('button.mode-link')
    this.errorMessage = page.locator('[class*="error"], [role="alert"]')
  }

  async goto() {
    await this.page.goto('/login')
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }

  async signup(name: string, company: string, email: string, password: string) {
    await this.modeToggle.click()
    await this.nameInput.fill(name)
    await this.companyInput.fill(company)
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }

  async expectLoading() {
    await expect(this.submitButton).toBeDisabled()
  }

  async expectError() {
    await expect(this.errorMessage).toBeVisible()
  }
}
