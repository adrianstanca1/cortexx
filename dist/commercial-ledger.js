'use strict'

function roundMoney(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) throw new TypeError('Money value must be finite')
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function calculateCertificate({ grossToDate, retentionPct, previousCertified, retentionRelease = 0 }) {
  const gross = roundMoney(grossToDate)
  const pct = Number(retentionPct)
  const previous = roundMoney(previousCertified)
  const release = roundMoney(retentionRelease)
  if (gross < 0 || !Number.isFinite(pct) || pct < 0 || pct > 20 || previous < 0 || release < 0) {
    throw new RangeError('Invalid certificate values')
  }
  const retentionAmount = roundMoney(gross * pct / 100)
  if (release > retentionAmount) throw new RangeError('Retention release exceeds retention held')
  const amountCertified = roundMoney(Math.max(0, gross - retentionAmount - previous + release))
  return { grossToDate: gross, retentionPct: pct, retentionAmount, previousCertified: previous, retentionRelease: release, amountCertified }
}

function paymentSummary(amountCertified, payments) {
  const certified = roundMoney(amountCertified)
  const paid = roundMoney((payments || []).reduce((sum, payment) => sum + Math.max(0, Number(payment.amount) || 0), 0))
  return { paid, outstanding: roundMoney(Math.max(0, certified - paid)), settled: paid >= certified }
}

function certificateNumber(applicationNumber, revision) {
  const app = Math.max(1, Math.trunc(Number(applicationNumber) || 1))
  const rev = Math.max(1, Math.trunc(Number(revision) || 1))
  return `CERT-${String(app).padStart(3, '0')}-R${rev}`
}

module.exports = { roundMoney, calculateCertificate, paymentSummary, certificateNumber }
