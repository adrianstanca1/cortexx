const test = require("node:test")
const assert = require("node:assert/strict")
const { canTransitionPurchaseOrder, receiptValue, evaluateThreeWayMatch, countsAsCommitment } = require("../lib/procurement-control")

test("PO approval transitions require a manager", () => {
  assert.equal(canTransitionPurchaseOrder("draft", "pending_approval", false), true)
  assert.equal(canTransitionPurchaseOrder("pending_approval", "approved", false), false)
  assert.equal(canTransitionPurchaseOrder("pending_approval", "approved", true), true)
  assert.equal(canTransitionPurchaseOrder("approved", "sent", false), true)
  assert.equal(canTransitionPurchaseOrder("sent", "draft", true), false)
})

test("goods receipt values ordered lines and prevents over-receipt", () => {
  const po = [{ description: "Board", quantity: 10, unit: "item", unitPrice: 12.5 }]
  const first = receiptValue(po, [{ lineIndex: 0, quantity: 4 }])
  assert.equal(first.netReceived, 50)
  assert.equal(first.fullyReceived, false)
  const final = receiptValue(po, [{ lineIndex: 0, quantity: 6 }], [{ lineItems: first.lineItems }])
  assert.equal(final.netReceived, 75)
  assert.equal(final.fullyReceived, true)
  assert.throws(() => receiptValue(po, [{ lineIndex: 0, quantity: 7 }], [{ lineItems: first.lineItems }]), /OVER_RECEIPT/)
})

test("three-way match supports partial invoices and catches receipt/order overruns", () => {
  assert.equal(evaluateThreeWayMatch({ orderedNet: 1000, receivedNet: 600, invoiceNet: 500 }).status, "matched")
  assert.equal(evaluateThreeWayMatch({ orderedNet: 1000, receivedNet: 400, invoiceNet: 500 }).status, "over_received")
  assert.equal(evaluateThreeWayMatch({ orderedNet: 1000, receivedNet: 1000, previousApprovedNet: 800, invoiceNet: 250 }).status, "over_order")
  assert.equal(evaluateThreeWayMatch({ orderedNet: 1000, receivedNet: 0, invoiceNet: 100 }).status, "pending_delivery")
})

test("only approved/issued procurement states count as commitments", () => {
  assert.equal(countsAsCommitment("draft"), false)
  assert.equal(countsAsCommitment("pending_approval"), false)
  assert.equal(countsAsCommitment("rejected"), false)
  assert.equal(countsAsCommitment("approved"), true)
  assert.equal(countsAsCommitment("part_received"), true)
})
