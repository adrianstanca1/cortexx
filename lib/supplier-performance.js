const { money, countsAsCommitment } = require('./procurement-control')
const ACTIVE = new Set(['approved', 'sent', 'part_received'])
const ORDERED = new Set(['approved', 'sent', 'part_received', 'received', 'closed'])
function day(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function supplierPerformance(orders, now = new Date()) {
  const today = day(now)
  let orderedNet = 0, receivedNet = 0, outstandingNet = 0
  let completed = 0, assessed = 0, onTime = 0, overdue = 0, missingDates = 0
  const rows = orders.map(po => {
    const receipts = Array.isArray(po.goodsReceipts) ? po.goodsReceipts : []
    const netReceived = money(receipts.reduce((sum, r) => sum + Number(r.netReceived || 0), 0))
    const expected = day(po.expectedDelivery)
    // Use the latest recorded delivery, even when receipts were entered out of order.
    const deliveryDays = [day(po.receivedAt), ...receipts.map(r => day(r.deliveredAt))].filter(Boolean).sort()
    const delivered = po.receivedAt ? deliveryDays.at(-1) || null : null
    const isCompleted = ['received', 'closed'].includes(po.status) && !!delivered
    let delivery = 'not_assessed'
    if (ORDERED.has(po.status)) {
      orderedNet += Number(po.subtotal || 0)
      receivedNet += netReceived
      if (countsAsCommitment(po.status)) outstandingNet += Math.max(0, Number(po.subtotal || 0) - netReceived)
      if (!expected || (['received', 'closed'].includes(po.status) && !delivered)) missingDates++
      if (isCompleted) {
        completed++
        if (expected) {
          assessed++
          delivery = delivered <= expected ? 'on_time' : 'late'
          if (delivery === 'on_time') onTime++
        }
      } else if (ACTIVE.has(po.status) && expected && today && expected < today) {
        overdue++
        delivery = 'overdue'
      }
    }
    return { id: po.id, number: po.number, status: po.status, orderedNet: money(po.subtotal), receivedNet: netReceived, expectedDelivery: expected, completedDelivery: delivered, delivery }
  })
  return {
    orderCount: orders.length, orderedNet: money(orderedNet), receivedNet: money(receivedNet), outstandingNet: money(outstandingNet),
    completed, assessed, onTime, late: assessed - onTime, overdue, missingDates,
    onTimePercent: assessed ? Math.round(onTime / assessed * 100) : null,
    orders: rows,
  }
}
module.exports = { supplierPerformance }
