'use strict'

const assert = require('node:assert/strict')
const { suite, getPrismaAndTenancy, truncate, seedTwoOrgs } = require('./setup')

suite('requisition to RFQ procurement chain', async t => {
  const { prisma, tenancy } = getPrismaAndTenancy()
  await truncate(prisma)
  const { orgA, orgB, userA, userB } = await seedTwoOrgs(prisma)

  const seeded = await tenancy.runWithOrg(
    { organizationId: orgA.id, userId: userA.id, role: 'owner' },
    async () => {
      const project = await prisma.project.create({
        data: {
          name: 'RFQ Site',
          address: '1 Procurement Way',
          postcode: 'E1 1AA',
          budget: 100000,
        },
      })
      const costCode = await prisma.costCode.create({
        data: { code: 'MAT-100', name: 'Facade materials' },
      })
      const supplier = await prisma.supplier.create({
        data: { name: 'Facade Supply Ltd', category: 'materials' },
      })
      const requisition = await prisma.procurementRequisition.create({
        data: {
          number: 'REQ-0001',
          projectId: project.id,
          costCodeId: costCode.id,
          requestedBy: 'Alice',
          status: 'rfq_open',
          lineItems: [{ description: 'Cladding board', quantity: 10, unit: 'item', unitPrice: 20, total: 200 }],
          estimatedNet: 200,
          approvedAt: new Date(),
          approvedBy: 'Alice',
        },
      })
      const rfq = await prisma.procurementRfq.create({
        data: {
          requisitionId: requisition.id,
          reference: 'RFQ-0001',
          status: 'sent',
          supplierIds: [supplier.id],
          sentAt: new Date(),
        },
      })
      const quote = await prisma.supplierQuote.create({
        data: {
          rfqId: rfq.id,
          supplierId: supplier.id,
          reference: 'Q-1',
          status: 'awarded',
          lineItems: [{ description: 'Cladding board', quantity: 10, unit: 'item', unitPrice: 18, total: 180 }],
          netAmount: 180,
          vatRate: 20,
          vatAmount: 36,
          totalAmount: 216,
          leadDays: 5,
          awardedAt: new Date(),
        },
      })
      const po = await prisma.purchaseOrder.create({
        data: {
          number: 'PO-0001',
          projectId: project.id,
          costCodeId: costCode.id,
          requisitionId: requisition.id,
          supplierQuoteId: quote.id,
          supplierId: supplier.id,
          supplier: supplier.name,
          status: 'approved',
          lineItems: quote.lineItems,
          subtotal: 180,
          vatRate: 20,
          vatAmount: 36,
          total: 216,
          approvedAt: new Date(),
          approvedBy: 'Alice',
        },
      })
      return { project, costCode, supplier, requisition, rfq, quote, po }
    },
  )

  await t.test('awarded PO retains requisition and quote/RFQ traceability', async () => {
    const po = await tenancy.runWithOrg(
      { organizationId: orgA.id, userId: userA.id, role: 'owner' },
      () => prisma.purchaseOrder.findUnique({
        where: { id: seeded.po.id },
        include: {
          requisition: true,
          supplierQuote: { include: { rfq: true } },
        },
      }),
    )
    assert.ok(po)
    assert.equal(po.requisition.number, 'REQ-0001')
    assert.equal(po.supplierQuote.reference, 'Q-1')
    assert.equal(po.supplierQuote.rfq.reference, 'RFQ-0001')
  })

  await t.test('procurement chain remains tenant-isolated', async () => {
    const [requisitions, rfqs, quotes, po] = await tenancy.runWithOrg(
      { organizationId: orgB.id, userId: userB.id, role: 'owner' },
      () => Promise.all([
        prisma.procurementRequisition.findMany(),
        prisma.procurementRfq.findMany(),
        prisma.supplierQuote.findMany(),
        prisma.purchaseOrder.findUnique({ where: { id: seeded.po.id } }),
      ]),
    )
    assert.equal(requisitions.length, 0)
    assert.equal(rfqs.length, 0)
    assert.equal(quotes.length, 0)
    assert.equal(po, null)
  })

  await t.test('requisition numbering can repeat safely in another tenant', async () => {
    const projectB = await tenancy.runWithOrg(
      { organizationId: orgB.id, userId: userB.id, role: 'owner' },
      () => prisma.project.create({
        data: { name: 'Other Site', address: '2 Other Rd', postcode: 'E2 2AA', budget: 5000 },
      }),
    )
    const reqB = await tenancy.runWithOrg(
      { organizationId: orgB.id, userId: userB.id, role: 'owner' },
      () => prisma.procurementRequisition.create({
        data: {
          number: 'REQ-0001',
          projectId: projectB.id,
          status: 'draft',
          lineItems: [{ description: 'Other item', quantity: 1, unit: 'item', unitPrice: 5, total: 5 }],
          estimatedNet: 5,
        },
      }),
    )
    assert.equal(reqB.number, seeded.requisition.number)
  })
})
