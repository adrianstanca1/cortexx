const test = require('node:test')
const assert = require('node:assert/strict')
const { parseReceiptVision, money, date } = require('../lib/receipt-vision')

test('receipt parser normalizes a typical UK trade receipt', () => {
  const r = parseReceiptVision(JSON.stringify({
    vendor: 'Travis Perkins', totalAmount: '£120.00', vatAmount: 20, date: '2026-09-24',
    category: 'Materials', confidence: 0.94, items: [{ d: 'Timber', qty: 2, price: 50 }],
  }))
  assert.equal(r.vendor, 'Travis Perkins')
  assert.equal(r.totalAmount, 120)
  assert.equal(r.vatAmount, 20)
  assert.equal(r.subtotal, 100)
  assert.equal(r.category, 'materials')
  assert.equal(r.receiptDate, '2026-09-24')
  assert.deepEqual(r.items[0], { description: 'Timber', quantity: 2, unitPrice: 50, total: 100 })
})

test('receipt parser strips markdown fences and clamps confidence', () => {
  const r = parseReceiptVision('```json\n{"merchant":"Selco","amount":42.5,"confidence":4,"category":"unknown"}\n```')
  assert.equal(r.vendor, 'Selco')
  assert.equal(r.totalAmount, 42.5)
  assert.equal(r.confidence, 1)
  assert.equal(r.category, 'other')
})

test('receipt parser rejects hallucinated shape with no vendor or total', () => {
  assert.throws(() => parseReceiptVision('{"notes":"blurred"}'), /vendor or total/)
})

test('money parser handles formatted values and rejects negative/non-finite values', () => {
  assert.equal(money('£1,234.567'), 1234.57)
  assert.equal(money(-2), null)
  assert.equal(money('abc'), null)
})

test('date parser only accepts real ISO calendar dates', () => {
  assert.equal(date('2026-02-28'), '2026-02-28')
  assert.equal(date('2026-02-31'), null)
  assert.equal(date('24/09/2026'), null)
})
