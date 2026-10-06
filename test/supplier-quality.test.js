const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const exportsUnderTest = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/supplier-quality.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsUnderTest, Date })
const { supplierQuality } = exportsUnderTest
const now = new Date('2026-10-04T12:00:00Z')
const record = source => ({ id: 'e1', reason: 'Attributed after source review', createdBy: 'u1', createdAt: now,
  withdrawnAt: null, withdrawnBy: null, withdrawalReason: null, source, purchaseOrder: null })
const source = { id: 'source1', title: 'Quality record', project: { id: 'p1', name: 'Site' }, updatedAt: now }
const defect = { ...source, sourceType: 'snag', priority: 'high', status: 'open', dueDate: '2026-10-03' }
const inspection = { ...source, sourceType: 'inspection', type: 'quality', status: 'passed', overallResult: 'pass', completedAt: now }

test('missing quality evidence has an unknown inspection rate rather than a perfect score', () => {
  const p = supplierQuality([], now)
  assert.equal(p.inspectionPassPercent, null)
  assert.equal(p.openDefects, 0)
  assert.equal(p.evidenceCount, 0)
})
test('defects use current resolution, due dates and priority with UTC day boundaries', () => {
  const p = supplierQuality([
    record(defect), record({ ...defect, priority: 'low', dueDate: '2026-10-04T00:00:00Z' }),
    record({ ...defect, status: 'closed' }), record({ ...defect, status: 'unknown' }),
  ], now)
  assert.equal(p.defectCount, 4)
  assert.equal(p.openDefects, 2)
  assert.equal(p.closedDefects, 1)
  assert.equal(p.overdueDefects, 1)
  assert.equal(p.urgentOpenDefects, 1)
  assert.equal(p.unassessedDefects, 1)
})
test('only completed inspections with consistent status/result enter the pass-rate denominator', () => {
  const p = supplierQuality([
    record(inspection), record({ ...inspection, status: 'failed', overallResult: 'fail' }),
    record({ ...inspection, status: 'draft' }), record({ ...inspection, completedAt: null }),
    record({ ...inspection, overallResult: 'fail' }), record({ ...inspection, completedAt: 'invalid' }),
  ], now)
  assert.equal(p.inspectionCount, 6)
  assert.equal(p.inspectionPassPercent, 50)
  assert.equal(p.assessedInspections, 2)
  assert.equal(p.failedInspections, 1)
  assert.equal(p.unassessedInspections, 4)
})
test('withdrawn attribution remains visible but contributes to no defect or inspection metric', () => {
  const p = supplierQuality([defect, inspection].map(s => ({ ...record(s), withdrawnAt: now, withdrawnBy: 'u2', withdrawalReason: 'Incorrect attribution' })), now)
  assert.equal(p.withdrawnCount, 2)
  assert.equal(p.defectCount, 0)
  assert.equal(p.inspectionCount, 0)
  assert.equal(p.inspectionPassPercent, null)
  assert.equal(p.rows[0].reason, 'Attributed after source review')
  assert.equal(p.rows[0].source.id, 'source1')
  assert.equal(p.rows[0].withdrawalReason, 'Incorrect attribution')
  assert.equal(p.rows[0].assessment, 'withdrawn')
})
test('missing sources and inspections reclassified out of quality do not fabricate a result', () => {
  const p = supplierQuality([record(null), record({ ...inspection, type: 'safety' })], now)
  assert.equal(p.unavailableSources, 2)
  assert.equal(p.assessedInspections, 0)
  assert.equal(p.rows[0].assessment, 'source_unavailable')
})
test('source updates change assessment without changing attribution provenance', () => {
  const evidence = record(defect)
  assert.equal(supplierQuality([evidence], now).openDefects, 1)
  evidence.source = { ...defect, status: 'closed', closedAt: now }
  const closed = supplierQuality([evidence], now)
  assert.equal(closed.openDefects, 0)
  assert.equal(closed.closedDefects, 1)
  assert.equal(closed.rows[0].createdBy, 'u1')
  assert.equal(closed.rows[0].source.closedAt, now.toISOString())
})
