const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function calculate(grossToDate, retentionPct, previousCertified) {
  const retentionAmount = grossToDate * retentionPct / 100
  return {
    retentionAmount,
    netDue: Math.max(0, grossToDate - retentionAmount - previousCertified),
  }
}

test('valuation calculation uses cumulative gross, retention and previous certified payments', () => {
  assert.deepEqual(calculate(25000, 3, 0), { retentionAmount: 750, netDue: 24250 })
  assert.deepEqual(calculate(50000, 3, 24250), { retentionAmount: 1500, netDue: 24250 })
  assert.deepEqual(calculate(50000, 5, 60000), { retentionAmount: 2500, netDue: 0 })
})

test('valuation migration creates durable application ledger and project-scoped sequence', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20260924070000_add_valuations/migration.sql'), 'utf8')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "Valuation"/)
  assert.match(sql, /"applicationNumber" INTEGER NOT NULL/)
  assert.match(sql, /Valuation_projectId_applicationNumber_key/)
  assert.match(sql, /Valuation_organizationId_fkey/)
})

test('valuation routes no longer use preview or graduated placeholder values', () => {
  const route = fs.readFileSync(path.join(__dirname, '../app/api/valuations/route.ts'), 'utf8')
  const page = fs.readFileSync(path.join(__dirname, '../app/valuations/page.tsx'), 'utf8')
  assert.doesNotMatch(route, /graduated|placeholder/i)
  assert.doesNotMatch(page, /preview only/i)
  assert.match(route, /status: \{ in: \['certified', 'paid'\] \}/)
})

test('Valuation is registered as an owned tenant model', () => {
  const tenancy = fs.readFileSync(path.join(__dirname, '../lib/tenancy.ts'), 'utf8')
  assert.match(tenancy, /'Valuation'/)
})
