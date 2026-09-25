'use strict'
const assert = require('node:assert/strict')
const { suite, getPrismaAndTenancy, truncate, seedTwoOrgs } = require('./setup')

suite('project programme tenant ledger', async t => {
  const { prisma, tenancy } = getPrismaAndTenancy()
  const { syncProjectProgrammeProgress } = await import('../../lib/programme-server.ts')
  await truncate(prisma)
  const { orgA, orgB, userA, userB } = await seedTwoOrgs(prisma)
  const ctxA = { organizationId: orgA.id, userId: userA.id, role: 'owner' }
  const ctxB = { organizationId: orgB.id, userId: userB.id, role: 'owner' }
  const project = await tenancy.runWithOrg(ctxA, () => prisma.project.create({ data: { name: 'Programme Test', address: '1 Programme Way', postcode: 'E1 1AA', progress: 0 } }))

  await t.test('programme progress rolls up from weighted activity durations', async () => {
    await tenancy.runWithOrg(ctxA, async () => {
      await prisma.programmeActivity.create({ data: { projectId: project.id, title: 'Short complete', baselineStart: new Date('2026-09-01'), baselineEnd: new Date('2026-09-03'), plannedStart: new Date('2026-09-01'), plannedEnd: new Date('2026-09-03'), progress: 100, status: 'complete' } })
      await prisma.programmeActivity.create({ data: { projectId: project.id, title: 'Long open', baselineStart: new Date('2026-09-03'), baselineEnd: new Date('2026-09-09'), plannedStart: new Date('2026-09-03'), plannedEnd: new Date('2026-09-09'), progress: 0, status: 'not_started' } })
      await prisma.$transaction(tx => syncProjectProgrammeProgress(tx, project.id, orgA.id))
    })
    const updated = await tenancy.runWithOrg(ctxA, () => prisma.project.findUnique({ where: { id: project.id } }))
    assert.equal(updated.progress, 25)
  })

  await t.test('dependency deletion cascades when an activity is removed', async () => {
    await tenancy.runWithOrg(ctxA, async () => {
      const rows = await prisma.programmeActivity.findMany({ where: { projectId: project.id }, orderBy: { plannedStart: 'asc' } })
      const dep = await prisma.programmeDependency.create({ data: { projectId: project.id, predecessorId: rows[0].id, successorId: rows[1].id, type: 'FS' } })
      await prisma.programmeActivity.delete({ where: { id: rows[0].id } })
      const gone = await prisma.programmeDependency.findUnique({ where: { id: dep.id } })
      assert.equal(gone, null)
    })
  })

  await t.test('programme activities and dependencies stay inside the tenant', async () => {
    const foreignActivities = await tenancy.runWithOrg(ctxB, () => prisma.programmeActivity.findMany())
    const foreignDependencies = await tenancy.runWithOrg(ctxB, () => prisma.programmeDependency.findMany())
    assert.deepEqual(foreignActivities, [])
    assert.deepEqual(foreignDependencies, [])
  })
})
