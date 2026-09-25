'use strict'

const assert = require('node:assert/strict')
const { suite, getPrismaAndTenancy, truncate, seedTwoOrgs } = require('./setup')

suite('procurement approval, receipt and match control', async t => {
  const { prisma, tenancy } = getPrismaAndTenancy()
  const { purchaseOrderMatch } = await import('../../lib/procurement-match-server.ts')
  await truncate(prisma)
  const { orgA, orgB, userA, userB } = await seedTwoOrgs(prisma)

  const project = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () =>
    prisma.project.create({ data: { name: 'Procurement Site', address: '1 Site Rd', postcode: 'E1 1AA', budget: 25000 } }),
  )
  const po = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () =>
    prisma.purchaseOrder.create({ data: {
      number: 'PO-0001', projectId: project.id, supplier: 'Test Supplier', status: 'sent',
      lineItems: [{ description: 'Boards', quantity: 10, unit: 'item', unitPrice: 100, total: 1000 }],
      subtotal: 1000, vatRate: 20, vatAmount: 200, total: 1200, approvedAt: new Date(), approvedBy: 'Alice', sentAt: new Date(),
    } }),
  )

  await t.test('goods receipt is tenant-scoped and drives invoice match headroom', async () => {
    await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () =>
      prisma.goodsReceipt.create({ data: {
        purchaseOrderId: po.id, deliveryNote: 'DN-1', lineItems: [{ lineIndex: 0, quantity: 5 }], netReceived: 500,
      } }),
    )
    const match = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () =>
      prisma.$transaction(tx => purchaseOrderMatch(tx, orgA.id, po.id, 400)),
    )
    assert.equal(match.status, 'matched')
    assert.equal(match.receivedNet, 500)
    assert.equal(match.invoiceNet, 400)
  })

  await t.test('invoice above received value is blocked by a visible mismatch result', async () => {
    const match = await tenancy.runWithOrg({ organizationId: orgA.id, userId: userA.id, role: 'owner' }, () =>
      prisma.$transaction(tx => purchaseOrderMatch(tx, orgA.id, po.id, 600)),
    )
    assert.equal(match.status, 'over_received')
    assert.equal(match.receiptVariance, 100)
  })

  await t.test('PO numbers are tenant-local and receipt data cannot cross tenants', async () => {
    const other = await tenancy.runWithOrg({ organizationId: orgB.id, userId: userB.id, role: 'owner' }, () =>
      prisma.purchaseOrder.create({ data: { number: 'PO-0001', supplier: 'Other Supplier', status: 'draft', lineItems: [{ description: 'Item', quantity: 1, unitPrice: 5, total: 5 }], subtotal: 5, total: 6 } }),
    )
    assert.equal(other.number, po.number)
    const receipts = await tenancy.runWithOrg({ organizationId: orgB.id, userId: userB.id, role: 'owner' }, () => prisma.goodsReceipt.findMany())
    assert.equal(receipts.length, 0)
    const hidden = await tenancy.runWithOrg({ organizationId: orgB.id, userId: userB.id, role: 'owner' }, () => prisma.purchaseOrder.findUnique({ where: { id: po.id } }))
    assert.equal(hidden, null)
  })
})
