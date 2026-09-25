'use strict'
const assert = require('node:assert/strict')
const { suite, getPrismaAndTenancy, truncate, seedTwoOrgs } = require('./setup')

suite('programme baseline revision and delay ledger', async t => {
  const { prisma, tenancy } = getPrismaAndTenancy()
  const { commitProgrammeBaseline, lockProgrammeProject } = await import('../../lib/programme-change-control-server.ts')
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


  await t.test('baseline commit waits for a concurrent programme writer before snapshotting', async () => {
    const lockedProject = await tenancy.runWithOrg(ctxA, () => prisma.project.create({ data: { name: 'Lock Test', address: '2 Lock Rd', postcode: 'E1 2AA' } }))
    const lockedActivity = await tenancy.runWithOrg(ctxA, () => prisma.programmeActivity.create({ data: {
      projectId: lockedProject.id, title: 'Locked activity',
      baselineStart: new Date('2026-11-01'), baselineEnd: new Date('2026-11-02'),
      plannedStart: new Date('2026-11-03'), plannedEnd: new Date('2026-11-04'),
      progress: 0, status: 'not_started',
    } }))

    let releaseWriter
    let signalWriterLocked
    const writerLocked = new Promise(resolve => { signalWriterLocked = resolve })
    const writerRelease = new Promise(resolve => { releaseWriter = resolve })

    const writer = tenancy.runWithOrg(ctxA, () => prisma.$transaction(async tx => {
      await lockProgrammeProject(tx, lockedProject.id)
      signalWriterLocked()
      await writerRelease
      await tx.programmeActivity.update({
        where: { id: lockedActivity.id },
        data: { plannedStart: new Date('2026-11-10'), plannedEnd: new Date('2026-11-12') },
      })
    }))

    await writerLocked
    const baselinePromise = tenancy.runWithOrg(ctxA, () => prisma.$transaction(tx => commitProgrammeBaseline(tx, {
      projectId: lockedProject.id,
      organizationId: orgA.id,
      createdByUserId: userA.id,
      reason: 'Concurrent writer lock test',
    })))

    await new Promise(resolve => setTimeout(resolve, 75))
    releaseWriter()
    const [, baseline] = await Promise.all([writer, baselinePromise])
    assert.equal(baseline.snapshot.activities[0].baselineStart, '2026-11-10T00:00:00.000Z')
    assert.equal(baseline.snapshot.activities[0].baselineEnd, '2026-11-12T00:00:00.000Z')
  })

  await t.test('conditional delay decisions allow only one concurrent status winner', async () => {
    const delay = await tenancy.runWithOrg(ctxA, () => prisma.programmeDelayEvent.create({ data: {
      projectId: project.id,
      title: 'Concurrent decision',
      category: 'client',
      startDate: new Date('2026-09-20'),
      delayDays: 1,
      organizationId: orgA.id,
    } }))

    const [accepted, rejected] = await Promise.all([
      tenancy.runWithOrg(ctxA, () => prisma.programmeDelayEvent.updateMany({ where: { id: delay.id, projectId: project.id, status: 'open' }, data: { status: 'accepted' } })),
      tenancy.runWithOrg(ctxA, () => prisma.programmeDelayEvent.updateMany({ where: { id: delay.id, projectId: project.id, status: 'open' }, data: { status: 'rejected' } })),
    ])
    assert.equal(accepted.count + rejected.count, 1)
    const final = await tenancy.runWithOrg(ctxA, () => prisma.programmeDelayEvent.findUnique({ where: { id: delay.id } }))
    assert.ok(final)
    assert.ok(['accepted', 'rejected'].includes(final.status))
  })

  await t.test('conditional delete cannot remove a delay once a concurrent decision wins', async () => {
    const delay = await tenancy.runWithOrg(ctxA, () => prisma.programmeDelayEvent.create({ data: {
      projectId: project.id,
      title: 'Concurrent delete',
      category: 'client',
      startDate: new Date('2026-09-21'),
      delayDays: 1,
      organizationId: orgA.id,
    } }))

    const [accepted, deleted] = await Promise.all([
      tenancy.runWithOrg(ctxA, () => prisma.programmeDelayEvent.updateMany({ where: { id: delay.id, projectId: project.id, status: 'open' }, data: { status: 'accepted' } })),
      tenancy.runWithOrg(ctxA, () => prisma.programmeDelayEvent.deleteMany({ where: { id: delay.id, projectId: project.id, status: 'open' } })),
    ])
    assert.equal(accepted.count + deleted.count, 1)
    const final = await tenancy.runWithOrg(ctxA, () => prisma.programmeDelayEvent.findUnique({ where: { id: delay.id } }))
    if (accepted.count === 1) assert.equal(final?.status, 'accepted')
    else assert.equal(final, null)
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
