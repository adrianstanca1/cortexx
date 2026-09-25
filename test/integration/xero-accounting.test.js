'use strict'
const assert = require('node:assert/strict')
const { suite, SKIP, getPrismaAndTenancy, truncate, seedTwoOrgs } = require('./setup')

suite('Xero accounting connection tenant isolation', async t => {
  if (SKIP) return
  const { prisma, tenancy } = getPrismaAndTenancy()
  await truncate(prisma)
  const { userA, userB, orgA, orgB } = await seedTwoOrgs(prisma)

  await t.test('connection stays inside the active company', async () => {
    const connection = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, async () =>
      prisma.accountingConnection.create({ data: { provider: 'xero', status: 'connected', externalTenantId: 'tenant-a', externalConnectionId: 'conn-a', externalTenantName: 'Org A Xero' } }),
    )
    const own = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () => prisma.accountingConnection.findMany())
    const foreign = await tenancy.runWithOrg({ organizationId: orgB.id, userId: userB.id, role: 'owner' }, () => prisma.accountingConnection.findMany())
    assert.equal(own.length, 1)
    assert.deepEqual(foreign, [])
  })

  await t.test('OAuth state is tenant-owned and cannot be read from another company context', async () => {
    await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () => prisma.accountingOAuthState.create({ data: { provider: 'xero', stateHash: 'state-a', expiresAt: new Date(Date.now() + 60000) } }))
    const foreign = await tenancy.runWithOrg({ organizationId: orgB.id, userId: userB.id, role: 'owner' }, () => prisma.accountingOAuthState.findMany({}))
    assert.deepEqual(foreign, [])
  })

  await t.test('imported Xero bank evidence is idempotent, tenant-scoped and preserves reconciliation', async () => {
    const { upsertXeroBankTransactions } = require('../../lib/xero-bank-import')
    const connection = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () =>
      prisma.accountingConnection.findFirstOrThrow({ where: { provider: 'xero' } }),
    )
    const initial = [{ externalId: 'xero-bank-1', occurredAt: new Date('2026-09-25'), amount: -125, currency: 'GBP', description: 'Supplier payment', reference: 'PO-1', accountName: 'Current' }]
    const first = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () => upsertXeroBankTransactions(connection.id, initial))
    assert.deepEqual(first, { created: 1, updated: 0, unchanged: 0 })
    const row = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () => prisma.bankTransaction.findFirstOrThrow({ where: { source: 'xero', externalId: 'xero-bank-1' } }))
    await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () => prisma.bankTransaction.update({ where: { id: row.id }, data: { status: 'reconciled', reconciled: true } }))
    const refreshed = [{ ...initial[0], amount: -126, description: 'Supplier payment updated' }]
    const second = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () => upsertXeroBankTransactions(connection.id, refreshed))
    assert.deepEqual(second, { created: 0, updated: 1, unchanged: 0 })
    const third = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () => upsertXeroBankTransactions(connection.id, refreshed))
    assert.deepEqual(third, { created: 0, updated: 0, unchanged: 1 })
    const current = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () => prisma.bankTransaction.findUnique({ where: { id: row.id } }))
    assert.equal(current.status, 'reconciled')
    assert.equal(current.reconciled, true)
    assert.equal(current.amount, -126)
    assert.equal(current.description, 'Supplier payment updated')
    const foreign = await tenancy.runWithOrg({ organizationId: orgB.id, userId: userB.id, role: 'owner' }, () => prisma.bankTransaction.findMany({ where: { source: 'xero' } }))
    assert.deepEqual(foreign, [])
  })

})
