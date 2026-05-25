/**
 * Integration-test setup: connects to TEST_DATABASE_URL, truncates the
 * tenant-data tables before each suite, returns the configured Prisma
 * client (with the tenancy extension attached).
 *
 * Auto-skips when TEST_DATABASE_URL is unset — `npm test` still works
 * locally without Postgres, and these tests only run in CI / when an
 * operator explicitly opts in.
 */
'use strict'

const test = require('node:test')

const TEST_URL = process.env.TEST_DATABASE_URL
const SKIP = !TEST_URL

/** Wraps node:test so the whole suite skips cleanly without a DB. */
function suite(name, body) {
  test(name, { skip: SKIP && 'TEST_DATABASE_URL not set — integration suite skipped' }, body)
}

/** Lazy-import the Prisma client + tenancy so test environments without
 *  a generated client (e.g. fresh clone) don't crash on require. */
function getPrismaAndTenancy() {
  // Force the env so lib/db / lib/tenancy see what we want before they
  // initialise their module-scoped state.
  process.env.DATABASE_URL = TEST_URL
  process.env.MULTITENANT_ENFORCED = 'true'
  const { prisma } = require('../../lib/db')
  const tenancy = require('../../lib/tenancy')
  return { prisma, tenancy }
}

/** Wipe the owned-model + tenant-management tables. Order matters because
 *  of FK chains — children before parents. */
async function truncate(prisma) {
  // Use TRUNCATE … CASCADE to handle the FK web in one shot. Wraps in
  // bypassTenancy so the extension doesn't block the meta query.
  const { tenancy } = getPrismaAndTenancy()
  await tenancy.bypassTenancy(async () => {
    const TABLES = [
      // Owned models (will cascade via Organization FK anyway when we
      // delete orgs, but explicit truncate is faster for setup).
      'Activity', 'Comment', 'Assignment', 'TimeEntry', 'MileageEntry',
      'SiteCheckIn', 'Task', 'Invoice', 'SubInvoice', 'PurchaseOrder',
      'Material', 'Equipment', 'Snag', 'Rfi', 'Announcement', 'Observation',
      'Variation', 'Permit', 'Rams', 'Inspection', 'Meeting', 'Risk',
      'ToolboxTalk', 'MaintenanceSchedule', 'SafetyIncident', 'Certification',
      'DrawingRevision', 'Drawing', 'Milestone', 'Document', 'CostItem',
      'Subcontractor', 'Supplier', 'Lead', 'Customer', 'Quote', 'Tender',
      'TeamMember', 'Project',
      // Legacy-parity v1.1 modules
      'PayrollRun', 'LeaveRequest', 'BankTransaction', 'CarbonEntry',
      'WasteEntry', 'Appraisal', 'DocumentTemplate', 'FormDefinition',
      'Reminder', 'SavedView', 'Tag', 'Goal', 'Improvement', 'KaizenCard',
      'ProcessDoc', 'SiteReview', 'Apprenticeship', 'InsuranceClaim',
      'CurrencyRate', 'Persona', 'ServiceCatalogItem', 'SubPortalSession',
      'ApiKey', 'InfraSnapshot',
      // Tenant management
      'OrganizationInvite', 'UserOrganization', 'AuditEvent',
      'NotificationPreference', 'Organization',
      // Auth (PushSubscription has user FK; clear first)
      'PushSubscription', 'Session', 'Account', 'VerificationToken', 'User',
    ]
    for (const table of TABLES) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`)
    }
  })
}

/**
 * Seed two orgs (orgA + orgB), each with one user as owner. Returns the
 * ids the tests need.
 */
async function seedTwoOrgs(prisma) {
  const { tenancy } = getPrismaAndTenancy()
  return tenancy.bypassTenancy(async () => {
    const userA = await prisma.user.create({
      data: { email: 'alice@orgA.test', name: 'Alice', role: 'admin' },
    })
    const userB = await prisma.user.create({
      data: { email: 'bob@orgB.test', name: 'Bob', role: 'admin' },
    })
    const orgA = await prisma.organization.create({
      data: { slug: 'org-a', name: 'Org A', plan: 'pro' },
    })
    const orgB = await prisma.organization.create({
      data: { slug: 'org-b', name: 'Org B', plan: 'pro' },
    })
    await prisma.userOrganization.create({
      data: { userId: userA.id, organizationId: orgA.id, role: 'owner' },
    })
    await prisma.userOrganization.create({
      data: { userId: userB.id, organizationId: orgB.id, role: 'owner' },
    })
    return { userA, userB, orgA, orgB }
  })
}

module.exports = { suite, SKIP, getPrismaAndTenancy, truncate, seedTwoOrgs }
