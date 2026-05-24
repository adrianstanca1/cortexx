import { type Page, type Locator } from '@playwright/test'

export class DashboardPage {
  readonly page: Page
  readonly kpiCards: Locator
  readonly revenueChart: Locator
  readonly projectStatusWidget: Locator
  readonly alertsWidget: Locator
  readonly activityFeed: Locator
  readonly safetyChart: Locator
  readonly customizeButton: Locator

  constructor(page: Page) {
    this.page = page
    this.kpiCards = page.locator('[data-kpi-card], [class*="kpi"]')
    this.revenueChart = page.locator('[data-chart="revenue"], [class*="revenue-chart"]')
    this.projectStatusWidget = page.locator('[data-widget="project-status"]')
    this.alertsWidget = page.locator('[data-widget="alerts"]')
    this.activityFeed = page.locator('[data-widget="activity-feed"]')
    this.safetyChart = page.locator('[data-chart="safety"]')
    this.customizeButton = page.locator('button').filter({ hasText: /customize/i })
  }

  async goto() {
    await this.page.goto('/')
    // Navigate to dashboard if not already there
    const dashboardLink = this.page.locator('[data-sidebar] a').filter({ hasText: /dashboard/i }).first()
    if (await dashboardLink.isVisible()) {
      await dashboardLink.click()
      await this.page.waitForTimeout(1000)
    }
  }

  async getKpiValue(kpiName: string): Promise<string | null> {
    const kpiCard = this.kpiCards.filter({ hasText: new RegExp(kpiName, 'i') }).first()
    const value = kpiCard.locator('[data-kpi-value]').first()
    if (await value.isVisible()) {
      return value.textContent()
    }
    return null
  }

  async toggleWidget(widgetName: string): Promise<void> {
    await this.customizeButton.click()
    await this.page.waitForTimeout(500)
    
    const widgetToggle = this.page
      .locator('[data-customize-panel]')
      .locator('label, input[type="checkbox"]')
      .filter({ hasText: new RegExp(widgetName, 'i') })
      .first()
    
    await widgetToggle.click()
    await this.page.waitForTimeout(500)
    
    // Close the customize panel
    await this.customizeButton.click()
    await this.page.waitForTimeout(500)
  }
}
