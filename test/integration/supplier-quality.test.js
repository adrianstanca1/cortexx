'use strict'

const assert = require('node:assert/strict')
const { suite, getPrismaAndTenancy, truncate, seedTwoOrgs } = require('./setup')

suite('supplier quality attribution has tenant/project integrity and retained source history', async t => {
  const { prisma, tenancy } = getPrismaAndTenancy()
  const { loadSupplierQuality } = require('../../lib/supplier-quality-server')
  await truncate(prisma)
  t.after(() => prisma.$disconnect())
  const { orgA, orgB, userA } = await seedTwoOrgs(prisma)
  const asA = fn => tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, fn)
  const seeded = await tenancy.bypassTenancy(async () => {
    const project = await prisma.project.create({ data: { organizationId: orgA.id, name: 'Facade Site', address: '1 Site Road', postcode: 'E1 1AA', budget: 1000 } })
    const otherProject = await prisma.project.create({ data: { organizationId: orgA.id, name: 'Roof Site', address: '2 Site Road', postcode: 'E1 1AB', budget: 1000 } })
    const foreignProject = await prisma.project.create({ data: { organizationId: orgB.id, name: 'Other Company', address: '3 Site Road', postcode: 'E1 1AC', budget: 1000 } })
    const supplier = await prisma.supplier.create({ data: { organizationId: orgA.id, name: 'Facade Supply' } })
    const otherSupplier = await prisma.supplier.create({ data: { organizationId: orgA.id, name: 'Other Supply' } })
    const foreignSupplier = await prisma.supplier.create({ data: { organizationId: orgB.id, name: 'Other Company Supply' } })
    const snag = await prisma.snag.create({ data: { organizationId: orgA.id, projectId: project.id, title: 'Damaged panel', status: 'open', priority: 'high', dueDate: new Date('2026-10-03T00:00:00Z') } })
    const unlinkedSnag = await prisma.snag.create({ data: { organizationId: orgA.id, projectId: project.id, title: 'Unattributed defect' } })
    const foreignSnag = await prisma.snag.create({ data: { organizationId: orgB.id, projectId: foreignProject.id, title: 'Other Company defect' } })
    const inspection = await prisma.inspection.create({ data: { organizationId: orgA.id, projectId: project.id, title: 'Panel inspection', type: 'quality', status: 'passed', overallResult: 'pass', completedAt: new Date('2026-10-04T12:00:00Z') } })
    const order = await prisma.purchaseOrder.create({ data: { organizationId: orgA.id, projectId: project.id, supplierId: supplier.id, supplier: supplier.name, number: 'PO-0001', status: 'received' } })
    const otherOrder = await prisma.purchaseOrder.create({ data: { organizationId: orgA.id, projectId: otherProject.id, supplierId: supplier.id, supplier: supplier.name, number: 'PO-0002', status: 'received' } })
    const wrongSupplierOrder = await prisma.purchaseOrder.create({ data: { organizationId: orgA.id, projectId: project.id, supplierId: otherSupplier.id, supplier: otherSupplier.name, number: 'PO-0003', status: 'received' } })
    return { project, otherProject, supplier, otherSupplier, foreignSupplier, snag, unlinkedSnag, foreignSnag, inspection, order, otherOrder, wrongSupplierOrder }
  })
  const data = {
    organizationId: orgA.id, supplierId: seeded.supplier.id, projectId: seeded.project.id,
    snagId: seeded.snag.id, reason: 'Panel damage confirmed as supplied', createdBy: userA.id,
  }
  const foreignKeyFailure = action => assert.rejects(action, error => error.code === 'P2003')

  await t.test('database rejects foreign suppliers, sources, source projects and mismatched purchase orders', async () => {
    await foreignKeyFailure(() => asA(() => prisma.supplierQualityEvidence.create({ data: { ...data, supplierId: seeded.foreignSupplier.id } })))
    await foreignKeyFailure(() => asA(() => prisma.supplierQualityEvidence.create({ data: { ...data, snagId: seeded.foreignSnag.id } })))
    await foreignKeyFailure(() => asA(() => prisma.supplierQualityEvidence.create({ data: { ...data, projectId: seeded.otherProject.id } })))
    for (const purchaseOrderId of [seeded.otherOrder.id, seeded.wrongSupplierOrder.id]) {
      await foreignKeyFailure(() => asA(() => prisma.supplierQualityEvidence.create({ data: { ...data, purchaseOrderId } })))
    }
    assert.equal(await asA(() => prisma.supplierQualityEvidence.count()), 0)
  })

  await t.test('database requires one source and complete attribution/withdrawal reasons', async () => {
    const invalid = [
      { ...data, snagId: null }, { ...data, inspectionId: seeded.inspection.id },
      { ...data, reason: ' ' }, { ...data, reason: 'x'.repeat(2001) },
      { ...data, withdrawnAt: new Date() },
      { ...data, withdrawnAt: new Date(), withdrawnBy: userA.id, withdrawalReason: ' ' },
    ]
    for (const item of invalid) await assert.rejects(() => asA(() => prisma.supplierQualityEvidence.create({ data: item })))
    assert.equal(await asA(() => prisma.supplierQualityEvidence.count()), 0)
  })

  let defectEvidence, inspectionEvidence
  await t.test('live source outcomes are assessed only for explicitly attributed evidence', async () => {
    defectEvidence = await asA(() => prisma.supplierQualityEvidence.create({ data: { ...data, purchaseOrderId: seeded.order.id } }))
    inspectionEvidence = await asA(() => prisma.supplierQualityEvidence.create({ data: { ...data, snagId: null, inspectionId: seeded.inspection.id } }))
    const quality = await asA(() => loadSupplierQuality(prisma, orgA.id, seeded.supplier.id, new Date('2026-10-04T12:00:00Z')))
    assert.equal(quality.defectCount, 1)
    assert.equal(quality.openDefects, 1)
    assert.equal(quality.overdueDefects, 1)
    assert.equal(quality.inspectionPassPercent, 100)
    assert.equal(quality.rows.find(row => row.id === defectEvidence.id).purchaseOrder.id, seeded.order.id)
    const otherCompany = await tenancy.runWithOrg({ organizationId: orgB.id, userId: null, role: 'owner' }, () => Promise.all([
      prisma.supplierQualityEvidence.findMany(), prisma.supplierQualityEvidence.findUnique({ where: { id: defectEvidence.id } }),
      loadSupplierQuality(prisma, orgB.id, seeded.supplier.id),
    ]))
    assert.equal(otherCompany[0].length, 0)
    assert.equal(otherCompany[1], null)
    assert.equal(otherCompany[2].evidenceCount, 0)
    await asA(() => prisma.snag.update({ where: { id: seeded.snag.id }, data: { status: 'closed', closedAt: new Date() } }))
    const closed = await asA(() => loadSupplierQuality(prisma, orgA.id, seeded.supplier.id))
    assert.equal(closed.openDefects, 0)
    assert.equal(closed.closedDefects, 1)
    assert.equal(closed.rows.find(row => row.id === defectEvidence.id).reason, data.reason)
  })

  await t.test('source/supplier/project/order deletion and reassignment preserve retained attribution', async () => {
    const actions = [
      () => prisma.snag.delete({ where: { id: seeded.snag.id } }),
      () => prisma.inspection.delete({ where: { id: seeded.inspection.id } }),
      () => prisma.supplier.delete({ where: { id: seeded.supplier.id } }),
      () => prisma.project.delete({ where: { id: seeded.project.id } }),
      () => prisma.purchaseOrder.delete({ where: { id: seeded.order.id } }),
      () => prisma.snag.update({ where: { id: seeded.snag.id }, data: { projectId: seeded.otherProject.id } }),
      () => prisma.inspection.update({ where: { id: seeded.inspection.id }, data: { projectId: seeded.otherProject.id } }),
      () => prisma.purchaseOrder.update({ where: { id: seeded.order.id }, data: { supplierId: seeded.otherSupplier.id } }),
      () => prisma.purchaseOrder.update({ where: { id: seeded.order.id }, data: { projectId: seeded.otherProject.id } }),
    ]
    for (const action of actions) await foreignKeyFailure(() => asA(action))
    assert.equal(await asA(() => prisma.supplierQualityEvidence.count()), 2)
  })

  await t.test('withdrawn evidence keeps provenance, stays unique and contributes no result', async () => {
    await asA(() => prisma.supplierQualityEvidence.update({ where: { id: inspectionEvidence.id }, data: {
      withdrawnAt: new Date(), withdrawnBy: userA.id, withdrawalReason: 'Incorrect supplier attribution',
    } }))
    const quality = await asA(() => loadSupplierQuality(prisma, orgA.id, seeded.supplier.id))
    assert.equal(quality.withdrawnCount, 1)
    assert.equal(quality.inspectionPassPercent, null)
    assert.equal(quality.inspectionCount, 0)
    const row = quality.rows.find(row => row.id === inspectionEvidence.id)
    assert.equal(row.reason, data.reason)
    assert.equal(row.createdBy, userA.id)
    assert.equal(row.source.id, seeded.inspection.id)
    await assert.rejects(() => asA(() => prisma.supplierQualityEvidence.create({ data: { ...data, snagId: null, inspectionId: seeded.inspection.id } })), error => error.code === 'P2002')
    await foreignKeyFailure(() => asA(() => prisma.inspection.delete({ where: { id: seeded.inspection.id } })))
  })

  await t.test('attribution and audit writes roll back together if audit persistence fails', async () => {
    await assert.rejects(() => asA(() => prisma.$transaction(async tx => {
      await tx.supplierQualityEvidence.create({ data: { ...data, snagId: seeded.unlinkedSnag.id } })
      await tx.auditEvent.create({ data: { organizationId: 'missing-organization', userId: userA.id, action: 'supplier.quality.link', resourceType: 'SupplierQualityEvidence', resourceId: 'test-record' } })
    }, { isolationLevel: 'Serializable' })))
    assert.equal(await asA(() => prisma.supplierQualityEvidence.count({ where: { snagId: seeded.unlinkedSnag.id } })), 0)
  })
})
