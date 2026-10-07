'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { suite, SKIP, getPrismaAndTenancy, truncate, seedTwoOrgs } = require('./setup')

if (SKIP) suite('quality closeout integration skipped (no TEST_DATABASE_URL)', () => {})
const { prisma, tenancy } = SKIP ? {} : getPrismaAndTenancy()

suite('quality closeout evidence', async (t) => {
  await truncate(prisma)
  const { userA, userB, orgA, orgB } = await seedTwoOrgs(prisma)
  let projectA, snagA, inspectionA
  await tenancy.bypassTenancy(async () => {
    projectA = await prisma.project.create({ data: { organizationId: orgA.id, name: 'Quality Site', address: '1 Quality Way', postcode: 'E1 1AA' } })
    snagA = await prisma.snag.create({
      data: {
        organizationId: orgA.id,
        projectId: projectA.id,
        title: 'Loose cassette',
        status: 'closed',
        resolution: 'Cassette re-fixed and checked',
        closeoutEvidence: { photoUrls: ['/api/uploads/snag-fixed.jpg'] },
        closedBy: 'QA Manager',
        closeoutVerifiedAt: new Date('2026-09-26T09:00:00Z'),
        closedAt: new Date('2026-09-26T09:00:00Z'),
      },
    })
    inspectionA = await prisma.inspection.create({
      data: {
        organizationId: orgA.id,
        projectId: projectA.id,
        title: 'Panel alignment',
        type: 'quality',
        status: 'passed',
        overallResult: 'pass',
        completedAt: new Date('2026-09-26T09:10:00Z'),
        evidence: { photoUrls: ['/api/uploads/qa-rework.jpg'] },
        closeoutVerifiedBy: 'QA Manager',
        closeoutVerifiedAt: new Date('2026-09-26T09:10:00Z'),
      },
    })
  })

  await t.test('snag closeout evidence and verification persist in tenant', async () => {
    const snag = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () => prisma.snag.findUnique({ where: { id: snagA.id } }))
    assert.equal(snag.resolution, 'Cassette re-fixed and checked')
    assert.equal(snag.closedBy, 'QA Manager')
    assert.deepEqual(snag.closeoutEvidence.photoUrls, ['/api/uploads/snag-fixed.jpg'])
    assert.ok(snag.closeoutVerifiedAt)
  })

  await t.test('inspection closeout verifier persists in tenant', async () => {
    const inspection = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () => prisma.inspection.findUnique({ where: { id: inspectionA.id } }))
    assert.equal(inspection.closeoutVerifiedBy, 'QA Manager')
    assert.ok(inspection.closeoutVerifiedAt)
    assert.deepEqual(inspection.evidence.photoUrls, ['/api/uploads/qa-rework.jpg'])
  })

  await t.test('another tenant cannot read snag or inspection closeout evidence by id', async () => {
    const ctxB = { organizationId: orgB.id, userId: userB.id, role: 'owner' }
    const [snag, inspection] = await tenancy.runWithOrg(ctxB, () => Promise.all([
      prisma.snag.findUnique({ where: { id: snagA.id } }),
      prisma.inspection.findUnique({ where: { id: inspectionA.id } }),
    ]))
    assert.equal(snag, null)
    assert.equal(inspection, null)
  })

  await tenancy.bypassTenancy(() => prisma.$disconnect())
})
