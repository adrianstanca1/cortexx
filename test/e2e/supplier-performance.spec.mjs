import { test, expect } from '@playwright/test'

test('supplier performance renders delivery evidence and missing-history state', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.com')
  await page.getByLabel('Password').fill(process.env.E2E_ADMIN_PASSWORD || 'e2e-local-role-password')
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL(url => !url.pathname.includes('/login'))
  await page.route('**/api/suppliers/scorecard-fixture/performance', route => route.fulfill({ json: {
    supplier: { name: 'Facade Supply', archivedAt: null }, truncated: false,
    performance: { orderCount: 1, orderedNet: 120, receivedNet: 120, outstandingNet: 0, completed: 1, assessed: 1, onTime: 1, late: 0, overdue: 0, missingDates: 0, onTimePercent: 100,
      orders: [{ id: 'po1', number: 'PO-0001', status: 'received', orderedNet: 120, receivedNet: 120, expectedDelivery: '2026-09-24', completedDelivery: '2026-09-23', delivery: 'on_time' }] },
  } }))
  await page.goto('/suppliers/scorecard-fixture/performance')
  await expect(page.getByRole('heading', { name: 'Supplier performance' })).toBeVisible()
  await expect(page.getByText('100%', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'PO-0001' })).toHaveAttribute('href', '/api/pos/po1/pdf')
  await expect(page.getByRole('cell', { name: 'On time', exact: true })).toBeVisible()
  await page.unroute('**/api/suppliers/scorecard-fixture/performance')
  await page.route('**/api/suppliers/scorecard-fixture/performance', route => route.fulfill({ status: 403, json: { error: 'Company Admin permission required' } }))
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Company Admin permission required')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})
