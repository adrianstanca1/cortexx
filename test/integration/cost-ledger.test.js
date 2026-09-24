'use strict'

const assert = require('node:assert/strict')
const { suite, getPrismaAndTenancy, truncate, seedTwoOrgs } = require('./setup')

suite('project cost ledger', async t => {
  const { prisma, tenancy } = getPrismaAndTenancy()
  const { postSourceCost, voidSourceCost } = await import('../../lib/cost-ledger-server.ts')
  await truncate(prisma)
  const { orgA, orgB, userA } = await seedTwoOrgs(prisma)

  const project = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () =>
    prisma.project.create({ data: { name: 'Cost Test', address: '1 Site Rd', postcode: 'E1 1AA', budget: 10000, spent: 0 } }),
  )
  const code = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () =>
    prisma.costCode.create({ data: { code: 'MAT', name: 'Materials' } }),
  )

  await t.test('posting source cost mirrors net actual into project spent', async () => {
    await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () =>
      prisma.$transaction(tx => postSourceCost(tx, {
        organizationId: orgA.id, projectId: project.id, sourceType: 'receipt', sourceId: 'r1',
        description: 'Fixings', netAmount: 100, vatAmount: 20, grossAmount: 120, costCodeId: code.id,
      })),
    )
    const p = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () => prisma.project.findUnique({ where: { id: project.id } }))
    assert.equal(p.spent, 100)
  })

  await t.test('reposting the same source updates instead of duplicating', async () => {
    await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () =>
      prisma.$transaction(tx => postSourceCost(tx, {
        organizationId: orgA.id, projectId: project.id, sourceType: 'receipt', sourceId: 'r1',
        description: 'Fixings corrected', netAmount: 125, vatAmount: 25, grossAmount: 150, costCodeId: code.id,
      })),
    )
    const [count, p] = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () => Promise.all([
      prisma.projectCostEntry.count({ where: { sourceType: 'receipt', sourceId: 'r1' } }),
      prisma.project.findUnique({ where: { id: project.id } }),
    ]))
    assert.equal(count, 1)
    assert.equal(p.spent, 125)
  })

  await t.test('voiding source cost removes it from actual spend', async () => {
    await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () =>
      prisma.$transaction(tx => voidSourceCost(tx, orgA.id, 'receipt', 'r1')),
    )
    const p = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () => prisma.project.findUnique({ where: { id: project.id } }))
    assert.equal(p.spent, 0)
  })

  await t.test('tenant extension hides ledger entries across organisations', async () => {
    const entries = await tenancy.runWithOrg({ organizationId: orgB.id, userId: null, role: 'owner' }, () => prisma.projectCostEntry.findMany())
    assert.equal(entries.length, 0)
  })
})
