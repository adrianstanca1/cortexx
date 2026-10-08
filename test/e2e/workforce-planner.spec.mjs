import { test, expect } from '@playwright/test'
import { signIn } from './helpers/auth.mjs'

const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-local-role-password'
const accounts = {
  admin: process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.tech',
  pm: process.env.E2E_PM_EMAIL || 'pm@cortexbuildpro.tech',
  operative: process.env.E2E_OPERATIVE_EMAIL || 'operative@cortexbuildpro.tech',
}

test('company admin workforce planner shows persisted project memberships and edit controls', async ({ page }) => {
  await signIn(page, accounts.admin, password, { dashboard: true })
  await page.goto('/workforce', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Workforce planner' })).toBeVisible()
  await expect(page.getByLabel('Project', { exact: true })).toBeVisible()
  await expect(page.getByText('Changes are saved to the company database')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Assigned team' })).toBeVisible()
})

test('operative workforce planner stays view-only and assigned-project scoped', async ({ page }) => {
  await signIn(page, accounts.operative, password, { dashboard: true })
  await page.goto('/workforce', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Workforce planner' })).toBeVisible()
  await expect(page.getByText('View only — your role cannot change assignments')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Assign .* to / })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Remove .* from / })).toHaveCount(0)
  await expect(page.getByLabel('Project', { exact: true })).not.toContainText('E2E Admin Only Project')
})

test('project manager only sees authorized projects in workforce planner', async ({ page }) => {
  await signIn(page, accounts.pm, password, { dashboard: true })
  await page.goto('/workforce', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Workforce planner' })).toBeVisible()
  await expect(page.getByLabel('Project', { exact: true })).not.toContainText('E2E Admin Only Project')
})
