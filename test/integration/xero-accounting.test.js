'use strict'
const assert = require('node:assert/strict')
const { suite, SKIP, getPrismaAndTenancy, truncate, seedTwoOrgs } = require('./setup')

suite('Xero accounting connection tenant isolation', async t => {
  if (SKIP) return
  const { prisma, tenancy } = getPrismaAndTenancy()
  await truncate(prisma)
  const { userA, userB, orgA, orgB } = await seedTwoOrgs(prisma)

  await t.test('connection and sync links stay inside the active company', async () => {
    const connection = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, async () =>
      prisma.accountingConnection.create({ data: { provider: 'xero', status: 'connected', externalTenantId: 'tenant-a', externalConnectionId: 'conn-a', externalTenantName: 'Org A Xero' } }),
    )
    await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, async () =>
      prisma.accountingSyncLink.create({ data: { connectionId: connection.id, provider: 'xero', resourceType: 'invoice', localId: 'inv-a', status: 'synced', remoteId: 'remote-a' } }),
    )
    const own = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () => prisma.accountingConnection.findMany({ include: { syncLinks: true } }))
    const foreign = await tenancy.runWithOrg({ organizationId: orgB.id, userId: userB.id, role: 'owner' }, () => prisma.accountingConnection.findMany({ include: { syncLinks: true } }))
    assert.equal(own.length, 1)
    assert.equal(own[0].syncLinks.length, 1)
    assert.deepEqual(foreign, [])
  })

  await t.test('OAuth state is tenant-owned and cannot be read from another company context', async () => {
    await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () => prisma.accountingOAuthState.create({ data: { provider: 'xero', stateHash: 'state-a', expiresAt: new Date(Date.now() + 60000) } }))
    const foreign = await tenancy.runWithOrg({ organizationId: orgB.id, userId: userB.id, role: 'owner' }, () => prisma.accountingOAuthState.findMany({}))
    assert.deepEqual(foreign, [])
  })
})
