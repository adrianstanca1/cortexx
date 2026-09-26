'use strict'

const assert = require('node:assert/strict')
const { suite, getPrismaAndTenancy, truncate, seedTwoOrgs } = require('./setup')

suite('programme resource loading tenant ledger', async t => {
  const { prisma, tenancy } = getPrismaAndTenancy()
  await truncate(prisma)
  const { userA, userB, orgA, orgB } = await seedTwoOrgs(prisma)

  const seeded = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, async () => {
    const project = await prisma.project.create({ data: { name: 'Facade A', address: 'Site A', postcode: 'A1' } })
    const member = await prisma.teamMember.create({ data: { name: 'Alex', role: 'operative', email: 'alex@orga.test' } })
    await prisma.assignment.create({ data: { projectId: project.id, memberId: member.id, role: 'installer' } })
    const equipment = await prisma.equipment.create({ data: { name: 'Scissor Lift 01', status: 'in_service' } })
    const material = await prisma.material.create({ data: { name: 'Insulation', unit: 'm2', stockLevel: 80 } })
    const activity = await prisma.programmeActivity.create({ data: {
      projectId: project.id, title: 'Install insulation', baselineStart: new Date('2026-09-28'), baselineEnd: new Date('2026-09-30'), plannedStart: new Date('2026-09-28'), plannedEnd: new Date('2026-09-30'),
    } })
    const labour = await prisma.programmeResourceAllocation.create({ data: { projectId: project.id, activityId: activity.id, resourceType: 'labour', teamMemberId: member.id, label: member.name, quantity: 1, unit: 'people', hoursPerDay: 8 } })
    const plant = await prisma.programmeResourceAllocation.create({ data: { projectId: project.id, activityId: activity.id, resourceType: 'equipment', equipmentId: equipment.id, label: equipment.name, quantity: 1, unit: 'unit' } })
    const mat = await prisma.programmeResourceAllocation.create({ data: { projectId: project.id, activityId: activity.id, resourceType: 'material', materialId: material.id, label: material.name, quantity: 120, unit: 'm2', needBy: new Date('2026-09-27') } })
    return { project, activity, labour, plant, mat }
  })

  await t.test('allocation rows are stored in the active tenant with programme traceability', async () => {
    await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, async () => {
      const rows = await prisma.programmeResourceAllocation.findMany({ where: { projectId: seeded.project.id }, include: { activity: true, teamMember: true, equipment: true, material: true } })
      assert.equal(rows.length, 3)
      assert.ok(rows.every(r => r.organizationId === orgA.id))
      assert.ok(rows.every(r => r.activityId === seeded.activity.id))
    })
  })

  await t.test('another tenant cannot read named resource allocations by id', async () => {
    await tenancy.runWithOrg({ organizationId: orgB.id, userId: userB.id, role: 'owner' }, async () => {
      const hidden = await prisma.programmeResourceAllocation.findUnique({ where: { id: seeded.labour.id } })
      assert.equal(hidden, null)
      assert.equal(await prisma.programmeResourceAllocation.count(), 0)
    })
  })

  await t.test('deleting a programme activity cascades its resource loading rows', async () => {
    await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, async () => {
      await prisma.programmeActivity.delete({ where: { id: seeded.activity.id } })
      assert.equal(await prisma.programmeResourceAllocation.count({ where: { projectId: seeded.project.id } }), 0)
    })
  })
})
