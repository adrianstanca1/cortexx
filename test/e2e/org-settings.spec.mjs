import { test, expect } from '@playwright/test'
import { signIn as signInWithPassword } from './helpers/auth.mjs'

const email = process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.tech'
const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-local-role-password'
const organizationId = 'org-settings-page-e2e'

async function signIn(page) {
  await signInWithPassword(page, email, password, { dashboard: true })
}

async function mockOrganization(page, { role = 'admin', canManage = true } = {}) {
  await page.route('**/api/orgs', route => route.fulfill({ json: {
    organizations: [{
      id: organizationId,
      slug: 'settings-e2e',
      name: 'Settings E2E Workspace',
      role,
      active: true,
    }],
  } }))
  await page.route(`**/api/orgs/${organizationId}/members`, route => route.fulfill({ json: {
    members: [{
      id: 'member-settings-e2e',
      userId: 'user-settings-e2e',
      email,
      name: 'Settings Test Admin',
      role,
      personaRole: 'company_admin',
      joinedAt: '2026-01-01T00:00:00.000Z',
    }],
    canManage,
  } }))
  await page.route('**/api/billing/plans', route => route.fulfill({ json: { plans: [] } }))
  await page.route(`**/api/orgs/${organizationId}`, route => route.fulfill({ json: { organization: null } }))
}

test('Revoke invite control submits DELETE for the selected pending invite', async ({ page }) => {
  await signIn(page)
  await mockOrganization(page)

  const invite = {
    id: 'invite-selected-e2e',
    email: 'selected-invite@example.test',
    role: 'member',
    personaRole: 'operative',
    expiresAt: '2027-01-01T00:00:00.000Z',
  }
  let revoked = false
  let revokeRequest
  await page.route(`**/api/orgs/${organizationId}/invites`, async route => {
    if (route.request().method() === 'DELETE') {
      revokeRequest = {
        method: route.request().method(),
        body: route.request().postDataJSON(),
      }
      revoked = true
      return route.fulfill({ json: { ok: true } })
    }
    return route.fulfill({ json: { invites: revoked ? [] : [invite] } })
  })
  page.on('dialog', dialog => dialog.accept())

  await page.goto('/settings/organization')
  const revokeButton = page.getByRole('button', { name: 'Revoke invite for selected-invite@example.test' })
  await expect(revokeButton).toBeVisible()
  await revokeButton.click()

  await expect(page.getByRole('status')).toContainText('Invite to selected-invite@example.test revoked')
  expect(revokeRequest).toEqual({
    method: 'DELETE',
    body: { inviteId: 'invite-selected-e2e' },
  })
  await expect(revokeButton).toHaveCount(0)
})

test('non-manager organization page does not request pending invites', async ({ page }) => {
  await signIn(page)
  await mockOrganization(page, { role: 'member', canManage: false })

  let inviteListRequests = 0
  await page.route(`**/api/orgs/${organizationId}/invites`, async route => {
    inviteListRequests += 1
    return route.fulfill({ json: { invites: [] } })
  })

  await page.goto('/settings/organization')
  await expect(page.getByText('Team members (1)', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Invite', exact: true })).toHaveCount(0)
  expect(inviteListRequests).toBe(0)
})

test('audit-log page requests the active organization selected from the organization list', async ({ page }) => {
  await signIn(page)

  await page.route('**/api/orgs', route => route.fulfill({ json: {
    organizations: [
      { id: 'org-first-e2e', slug: 'first', name: 'First Workspace', role: 'admin', active: false },
      { id: 'org-active-e2e', slug: 'active', name: 'Active Workspace', role: 'admin', active: true },
    ],
  } }))

  let auditLogRequest
  await page.route('**/api/orgs/org-active-e2e/audit-log**', async route => {
    auditLogRequest = new URL(route.request().url())
    return route.fulfill({ json: { events: [], total: 0, hasMore: false } })
  })

  await page.goto('/settings/audit-log')
  await expect(page.getByRole('heading', { name: 'Audit log', exact: true })).toBeVisible()
  await expect(page.getByText('No events yet.', { exact: true })).toBeVisible()
  expect(auditLogRequest?.pathname).toBe('/api/orgs/org-active-e2e/audit-log')
  expect(auditLogRequest?.searchParams.get('take')).toBe('100')
})
