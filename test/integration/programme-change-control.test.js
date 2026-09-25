'use strict'
const assert = require('node:assert/strict')
const { suite, getPrismaAndTenancy, truncate, seedTwoOrgs } = require('./setup')

suite('programme baseline revision and delay ledger', async t => {
  const { prisma, tenancy } = getPrismaAndTenancy()
  const { commitProgrammeBaseline } = await import('../../lib/programme-change-control-server.ts')
  await truncate(prisma)
  const { orgA, orgB, userA, userB } = await seedTwoOrgs(prisma)
  const ctxA = { organizationId: orgA.id, userId: userA.id, role: 'owner' }
  const ctxB = { organizationId: orgB.id, userId: userB.id, role: 'owner' }
  const project = await tenancy.runWithOrg(ctxA, () => prisma.project.create({ data: { name: 'Baseline Test', address: '1 Baseline Rd', postcode: 'E1 1AA' } }))

  let activity
  await tenancy.runWithOrg(ctxA, async () => {
    activity = await prisma.programmeActivity.create({ data: {
      projectId: project.id, title: 'Facade zone A',
      baselineStart: new Date('2026-09-01'), baselineEnd: new Date('2026-09-05'),
      plannedStart: new Date('2026-09-03'), plannedEnd: new Date('2026-09-09'),
      progress: 0, status: 'not_started',
    } })
  })

  await t.test('baseline revision snapshots history and adopts current planned dates', async () => {
    const first = await tenancy.runWithOrg(ctxA, () => prisma.$transaction(tx => commitProgrammeBaseline(tx, {
      projectId: project.id, organizationId: orgA.id, createdByUserId: userA.id, reason: 'Client approved Rev 1', label: 'Rev 1',
    })))
    assert.equal(first.revision, 1)
    assert.equal(first.status, 'active')
    const refreshed = await tenancy.runWithOrg(ctxA, () => prisma.programmeActivity.findUnique({ where: { id: activity.id } }))
    assert.equal(refreshed.baselineStart.toISOString(), '2026-09-03T00:00:00.000Z')
    assert.equal(refreshed.baselineEnd.toISOString(), '2026-09-09T00:00:00.000Z')
    const snap = first.snapshot
    assert.equal(snap.activities[0].previousBaselineStart, '2026-09-01T00:00:00.000Z')
    assert.equal(snap.activities[0].baselineStart, '2026-09-03T00:00:00.000Z')
  })

  await t.test('new revision supersedes previous without rewriting its snapshot', async () => {
    await tenancy.runWithOrg(ctxA, () => prisma.programmeActivity.update({ where: { id: activity.id }, data: { plannedStart: new Date('2026-09-06'), plannedEnd: new Date('2026-09-12') } }))
    const second = await tenancy.runWithOrg(ctxA, () => prisma.$transaction(tx => commitProgrammeBaseline(tx, {
      projectId: project.id, organizationId: orgA.id, createdByUserId: userA.id, reason: 'Approved design change', label: 'Rev 2',
    })))
    assert.equal(second.revision, 2)
    const revisions = await tenancy.runWithOrg(ctxA, () => prisma.programmeBaselineRevision.findMany({ where: { projectId: project.id }, orderBy: { revision: 'asc' } }))
    assert.deepEqual(revisions.map(r => [r.revision, r.status]), [[1, 'superseded'], [2, 'active']])
    assert.equal(revisions[0].snapshot.activities[0].baselineStart, '2026-09-03T00:00:00.000Z')
    assert.equal(revisions[1].snapshot.activities[0].baselineStart, '2026-09-06T00:00:00.000Z')
  })

  await t.test('delay evidence and baseline revisions are tenant-isolated', async () => {
    await tenancy.runWithOrg(ctxA, () => prisma.programmeDelayEvent.create({ data: {
      projectId: project.id, activityId: activity.id, title: 'Material delay', category: 'supply', startDate: new Date('2026-09-10'), delayDays: 3, organizationId: orgA.id,
    } }))
    const [foreignBaselines, foreignDelays] = await Promise.all([
      tenancy.runWithOrg(ctxB, () => prisma.programmeBaselineRevision.findMany()),
      tenancy.runWithOrg(ctxB, () => prisma.programmeDelayEvent.findMany()),
    ])
    assert.deepEqual(foreignBaselines, [])
    assert.deepEqual(foreignDelays, [])
  })
})
