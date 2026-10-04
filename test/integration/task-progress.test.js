'use strict'
const assert = require('node:assert/strict')
const { suite, getPrismaAndTenancy, truncate, seedTwoOrgs } = require('./setup')

suite('task progress respects programme ownership and tenant boundaries', async t => {
  const { prisma, tenancy } = getPrismaAndTenancy()
  const progressModule = await import('../../lib/task-progress.ts')
  const syncTaskProjectProgress = progressModule.syncTaskProjectProgress || progressModule.default?.syncTaskProjectProgress
  assert.equal(typeof syncTaskProjectProgress, 'function')
  await truncate(prisma)
  const { orgA, orgB, userA } = await seedTwoOrgs(prisma)
  const ctx = { organizationId: orgA.id, userId: userA.id, role: 'owner' }
  await tenancy.runWithOrg(ctx, async () => {
    const project = await prisma.project.create({ data: { name: 'Task fallback', address: '', postcode: 'E1' } })
    const target = await prisma.project.create({ data: { name: 'Move destination', address: '', postcode: 'E1' } })
    const mutate = fn => prisma.$transaction(async tx => {
      const result = await fn(tx)
      await syncTaskProjectProgress(tx, [project.id, target.id], orgA.id)
      return result
    })
    const progress = async id => (await prisma.project.findUnique({ where: { id } })).progress
    let complete, open
    await t.test('creation and status changes refresh fallback progress', async () => {
      complete = await mutate(tx => tx.task.create({ data: { title: 'Complete', status: 'done', projectId: project.id } }))
      assert.equal(await progress(project.id), 100)
      open = await mutate(tx => tx.task.create({ data: { title: 'Open', projectId: project.id } }))
      assert.equal(await progress(project.id), 50)
      await mutate(tx => tx.task.update({ where: { id: open.id }, data: { status: 'done' } }))
      assert.equal(await progress(project.id), 100)
    })
    await t.test('moving and deleting tasks refresh both affected projects', async () => {
      await mutate(tx => tx.task.update({ where: { id: open.id }, data: { status: 'todo', projectId: target.id } }))
      assert.equal(await progress(project.id), 100)
      assert.equal(await progress(target.id), 0)
      await mutate(tx => tx.task.delete({ where: { id: complete.id } }))
      assert.equal(await progress(project.id), 0)
    })
    await t.test('task mutations preserve programme-derived progress', async () => {
      await prisma.programmeActivity.create({ data: { projectId: project.id, title: 'Cladding', baselineStart: new Date('2026-09-01'), baselineEnd: new Date('2026-09-10'), plannedStart: new Date('2026-09-01'), plannedEnd: new Date('2026-09-10'), progress: 37 } })
      await prisma.project.update({ where: { id: project.id }, data: { progress: 37 } })
      await mutate(tx => tx.task.create({ data: { title: 'Small completed task', status: 'done', projectId: project.id } }))
      assert.equal(await progress(project.id), 37)
    })
    await t.test('an explicit foreign tenant cannot update local progress', async () => {
      await prisma.project.update({ where: { id: target.id }, data: { progress: 61 } })
      await prisma.$transaction(tx => syncTaskProjectProgress(tx, [target.id], orgB.id))
      assert.equal(await progress(target.id), 61)
    })
    await t.test('a failed task transaction rolls back its progress change', async () => {
      await assert.rejects(prisma.$transaction(async tx => {
        await tx.task.update({ where: { id: open.id }, data: { status: 'done' } })
        await syncTaskProjectProgress(tx, [target.id], orgA.id)
        throw new Error('rollback probe')
      }), /rollback probe/)
      assert.equal(await progress(target.id), 61)
      assert.equal((await prisma.task.findUnique({ where: { id: open.id } })).status, 'todo')
    })
  })
})
