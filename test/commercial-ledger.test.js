const test = require('node:test')
const assert = require('node:assert/strict')
const { calculateCertificate, paymentSummary, certificateNumber, roundMoney } = require('../lib/commercial-ledger')

test('certificate arithmetic applies retention and previous certified value', () => {
  assert.deepEqual(calculateCertificate({ grossToDate: 100000, retentionPct: 3, previousCertified: 60000 }), {
    grossToDate: 100000, retentionPct: 3, retentionAmount: 3000, previousCertified: 60000, retentionRelease: 0, amountCertified: 37000,
  })
})

test('retention release increases current certificate without going negative', () => {
  const result = calculateCertificate({ grossToDate: 100000, retentionPct: 3, previousCertified: 97000, retentionRelease: 1500 })
  assert.equal(result.amountCertified, 1500)
})

test('certificate calculation rounds monetary values to pennies', () => {
  const result = calculateCertificate({ grossToDate: 1234.567, retentionPct: 3, previousCertified: 100 })
  assert.equal(result.grossToDate, 1234.57)
  assert.equal(result.retentionAmount, 37.04)
  assert.equal(result.amountCertified, 1097.53)
  assert.equal(roundMoney(1.005), 1.01)
})

test('payment summary handles partial and settled certificates', () => {
  assert.deepEqual(paymentSummary(1000, [{ amount: 250 }, { amount: 300 }]), { paid: 550, outstanding: 450, settled: false })
  assert.deepEqual(paymentSummary(1000, [{ amount: 1000 }]), { paid: 1000, outstanding: 0, settled: true })
})

test('retention release cannot exceed retention held', () => {
  assert.throws(() => calculateCertificate({ grossToDate: 10000, retentionPct: 3, previousCertified: 0, retentionRelease: 301 }), /exceeds retention held/)
})

test('certificate numbering is stable per application revision', () => {
  assert.equal(certificateNumber(7, 2), 'CERT-007-R2')
})
