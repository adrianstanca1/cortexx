'use strict'
const assert = require('node:assert/strict')
const { suite, getPrismaAndTenancy, truncate, seedTwoOrgs } = require('./setup')

suite('drawing revision distribution and acknowledgement', async t => {
  const { prisma, tenancy } = getPrismaAndTenancy()
  await truncate(prisma)
  const { orgA, orgB, userA, userB } = await seedTwoOrgs(prisma)
  const ctxA = { organizationId: orgA.id, userId: userA.id, role: 'owner' }
  const ctxB = { organizationId: orgB.id, userId: userB.id, role: 'owner' }

  const seeded = await tenancy.runWithOrg(ctxA, async () => {
    const project = await prisma.project.create({ data: { name: 'Drawing Control', address: '1 Site Rd', postcode: 'E1 1AA' } })
    const drawing = await prisma.drawing.create({ data: { projectId: project.id, number: 'A-101', title: 'Facade GA', status: 'approved' } })
    const revision = await prisma.drawingRevision.create({ data: { drawingId: drawing.id, revision: 'C03', fileUrl: '/uploads/a101-c03.pdf', fileName: 'A101-C03.pdf' } })
    return { project, drawing, revision }
  })

  let distribution
  await t.test('issue records the exact revision and deduplicated recipient evidence', async () => {
    distribution = await tenancy.runWithOrg(ctxA, () => prisma.drawingDistribution.create({
      data: {
        drawingId: seeded.drawing.id,
        revisionId: seeded.revision.id,
        purpose: 'For construction',
        issuedByUserId: userA.id,
        recipients: { create: [{ email: 'foreman@example.test', name: 'Foreman', organizationId: orgA.id }, { email: 'operative@example.test', name: 'Operative', organizationId: orgA.id }] },
      },
      include: { revision: true, recipients: true },
    }))
    assert.equal(distribution.revision.revision, 'C03')
    assert.equal(distribution.recipients.length, 2)
    assert.ok(distribution.recipients.every(r => r.acknowledgedAt === null))
  })

  await t.test('recipient acknowledgement is persistent and attributable', async () => {
    const recipient = distribution.recipients.find(r => r.email === 'foreman@example.test')
    const updated = await tenancy.runWithOrg(ctxA, () => prisma.drawingDistributionRecipient.update({
      where: { id: recipient.id }, data: { acknowledgedAt: new Date('2026-09-26T08:00:00Z'), acknowledgedBy: 'foreman@example.test' },
    }))
    assert.equal(updated.acknowledgedBy, 'foreman@example.test')
    assert.equal(updated.acknowledgedAt.toISOString(), '2026-09-26T08:00:00.000Z')
  })

  await t.test('tenant B cannot see tenant A distributions or acknowledgements', async () => {
    const [foreignDistributions, foreignRecipients] = await Promise.all([
      tenancy.runWithOrg(ctxB, () => prisma.drawingDistribution.findMany()),
      tenancy.runWithOrg(ctxB, () => prisma.drawingDistributionRecipient.findMany()),
    ])
    assert.deepEqual(foreignDistributions, [])
    assert.deepEqual(foreignRecipients, [])
  })

  await t.test('same recipient cannot be duplicated within one issue', async () => {
    await assert.rejects(
      tenancy.runWithOrg(ctxA, () => prisma.drawingDistributionRecipient.create({ data: { distributionId: distribution.id, email: 'foreman@example.test', organizationId: orgA.id } })),
      error => error && error.code === 'P2002',
    )
  })
})
