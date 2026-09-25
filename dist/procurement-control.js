function money(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0
}

const MANAGER_STATUSES = new Set(["approved", "rejected", "closed", "cancelled"])
const TRANSITIONS = {
  draft: new Set(["pending_approval", "approved", "cancelled"]),
  pending_approval: new Set(["draft", "approved", "rejected", "cancelled"]),
  rejected: new Set(["draft", "pending_approval", "cancelled"]),
  approved: new Set(["sent", "cancelled"]),
  sent: new Set(["part_received", "received", "closed", "cancelled"]),
  part_received: new Set(["received", "closed"]),
  received: new Set(["closed"]),
  closed: new Set(),
  cancelled: new Set(),
}

function canTransitionPurchaseOrder(from, to, isManager) {
  if (from === to) return true
  if (!TRANSITIONS[from] || !TRANSITIONS[from].has(to)) return false
  if (MANAGER_STATUSES.has(to) && !isManager) return false
  return true
}

function receiptValue(poLineItems, receiptLines, previousReceipts = []) {
  const items = Array.isArray(poLineItems) ? poLineItems : []
  if (!items.length) throw new Error("PO_HAS_NO_LINE_ITEMS")
  if (!Array.isArray(receiptLines) || !receiptLines.length) throw new Error("RECEIPT_LINES_REQUIRED")
  const receivedQty = new Map()
  for (const receipt of previousReceipts) {
    for (const row of (Array.isArray(receipt?.lineItems) ? receipt.lineItems : [])) {
      const i = Number(row?.lineIndex)
      const q = Number(row?.quantity)
      if (Number.isInteger(i) && Number.isFinite(q) && q > 0) receivedQty.set(i, (receivedQty.get(i) || 0) + q)
    }
  }
  const normalized = []
  for (const row of receiptLines) {
    const lineIndex = Number(row?.lineIndex)
    const quantity = Number(row?.quantity)
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= items.length) throw new Error("INVALID_LINE_INDEX")
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("INVALID_RECEIPT_QUANTITY")
    const po = items[lineIndex] || {}
    const ordered = Number(po.quantity) || 0
    const prior = receivedQty.get(lineIndex) || 0
    if (quantity > ordered - prior + 1e-9) throw new Error("OVER_RECEIPT")
    receivedQty.set(lineIndex, prior + quantity)
    const unitPrice = Number(po.unitPrice) || 0
    normalized.push({
      lineIndex,
      description: String(po.description || ""),
      quantity,
      unit: po.unit ? String(po.unit) : undefined,
      unitPrice: money(unitPrice),
      total: money(quantity * unitPrice),
    })
  }
  const fullyReceived = items.every((po, index) => (receivedQty.get(index) || 0) + 1e-9 >= (Number(po.quantity) || 0))
  return {
    lineItems: normalized,
    netReceived: money(normalized.reduce((sum, row) => sum + row.total, 0)),
    fullyReceived,
  }
}

function evaluateThreeWayMatch(input = {}) {
  const orderedNet = money(input.orderedNet)
  const receivedNet = money(input.receivedNet)
  const previousApprovedNet = money(input.previousApprovedNet)
  const invoiceNet = money(input.invoiceNet)
  const cumulativeInvoiceNet = money(previousApprovedNet + invoiceNet)
  const tolerance = Math.max(money(input.toleranceAbs ?? 5), money(orderedNet * Number(input.tolerancePct ?? 0.02)))
  const orderVariance = money(cumulativeInvoiceNet - orderedNet)
  const receiptVariance = money(cumulativeInvoiceNet - receivedNet)
  let status = "matched"
  if (invoiceNet < 0 || orderedNet <= 0) status = "invalid"
  else if (receivedNet <= 0) status = "pending_delivery"
  else if (orderVariance > tolerance) status = "over_order"
  else if (receiptVariance > tolerance) status = "over_received"
  return { status, orderedNet, receivedNet, previousApprovedNet, invoiceNet, cumulativeInvoiceNet, orderVariance, receiptVariance, tolerance }
}

function countsAsCommitment(status) {
  return ["approved", "sent", "part_received", "received"].includes(status)
}

module.exports = { money, canTransitionPurchaseOrder, receiptValue, evaluateThreeWayMatch, countsAsCommitment }
