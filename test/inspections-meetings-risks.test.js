/**
 * Tests for the pure invariants of the quality & governance trio
 * (inspections / meetings / risks). Mirrored as plain JS so node:test runs
 * them without TS tooling.
 */
const test = require('node:test')
const assert = require('node:assert/strict')

// --- Allow-lists ---------------------------------------------------------

const INSPECTION_TYPE = new Set(['general', 'safety', 'quality', 'scaffold', 'electrical'])
const INSPECTION_STATUS = new Set(['draft', 'in_progress', 'passed', 'failed'])
const ITEM_RESULT = new Set(['pass', 'fail', 'na'])
const MEETING_STATUS = new Set(['scheduled', 'completed', 'cancelled'])
const RISK_CATEGORY = new Set(['operational', 'financial', 'schedule', 'safety', 'quality', 'environmental'])
const RISK_STATUS = new Set(['open', 'mitigated', 'accepted', 'closed'])

test('inspection allow-lists', () => {
  for (const t of ['general', 'safety', 'quality', 'scaffold', 'electrical']) assert.ok(INSPECTION_TYPE.has(t))
  for (const s of ['draft', 'in_progress', 'passed', 'failed']) assert.ok(INSPECTION_STATUS.has(s))
  for (const r of ['pass', 'fail', 'na']) assert.ok(ITEM_RESULT.has(r))
  assert.ok(!INSPECTION_TYPE.has('SYSTEM'))
})

test('meeting status allow-list', () => {
  for (const s of ['scheduled', 'completed', 'cancelled']) assert.ok(MEETING_STATUS.has(s))
  for (const s of ['planned', 'archived']) assert.ok(!MEETING_STATUS.has(s))
})

test('risk category + status allow-lists', () => {
  for (const c of ['operational', 'financial', 'schedule', 'safety', 'quality', 'environmental']) assert.ok(RISK_CATEGORY.has(c))
  for (const s of ['open', 'mitigated', 'accepted', 'closed']) assert.ok(RISK_STATUS.has(s))
})

// --- inspection checklist sanitization (mirror of /api/inspections) ------

function sanitizeChecklist(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(i => !!i && typeof i === 'object' && typeof i.label === 'string' && i.label.trim().length > 0)
    .slice(0, 100)
    .map((i, idx) => ({
      id: typeof i.id === 'string' && i.id ? i.id.slice(0, 40) : `item-${idx}`,
      label: i.label.trim().slice(0, 200),
      result: i.result && ITEM_RESULT.has(i.result) ? i.result : undefined,
      note: typeof i.note === 'string' && i.note ? i.note.slice(0, 500) : undefined,
    }))
}

test('checklist sanitize — drops items without labels', () => {
  const r = sanitizeChecklist([{ label: 'good' }, { label: '' }, { result: 'pass' }, null, 'not-object'])
  assert.equal(r.length, 1)
  assert.equal(r[0].label, 'good')
})

test('checklist sanitize — rejects unknown result values', () => {
  const r = sanitizeChecklist([{ label: 'x', result: 'maybe' }])
  assert.equal(r[0].result, undefined)
})

test('checklist sanitize — caps to 100 items', () => {
  const arr = Array.from({ length: 200 }, (_, i) => ({ label: `item ${i}` }))
  assert.equal(sanitizeChecklist(arr).length, 100)
})

test('checklist sanitize — synthesizes ids when missing', () => {
  const r = sanitizeChecklist([{ label: 'a' }, { label: 'b' }])
  assert.equal(r[0].id, 'item-0')
  assert.equal(r[1].id, 'item-1')
})

// --- meeting duration clamp (mirror of /api/meetings) -------------------

function clampDuration(v, fallback = 60) {
  const n = Number(v)
  if (!isFinite(n)) return fallback
  return Math.max(5, Math.min(480, n))
}

test('meeting duration — clamps to 5..480', () => {
  assert.equal(clampDuration(0), 5)
  assert.equal(clampDuration(1000), 480)
  assert.equal(clampDuration(60), 60)
  assert.equal(clampDuration('not a number'), 60)
})

// --- risk score computation (mirror of /api/risks) ----------------------

function clamp1to5(v) {
  const n = Number(v)
  if (!isFinite(n)) return 3
  return Math.max(1, Math.min(5, Math.round(n)))
}

function computeScore(likelihood, impact) {
  return clamp1to5(likelihood) * clamp1to5(impact)
}

test('risk likelihood/impact — clamps and rounds to 1..5', () => {
  assert.equal(clamp1to5(0), 1)
  assert.equal(clamp1to5(10), 5)
  assert.equal(clamp1to5(2.4), 2)
  assert.equal(clamp1to5(2.6), 3)
  assert.equal(clamp1to5('not a number'), 3)
})

test('risk score — likelihood × impact, both clamped', () => {
  assert.equal(computeScore(3, 4), 12)
  assert.equal(computeScore(5, 5), 25)
  assert.equal(computeScore(1, 1), 1)
  assert.equal(computeScore(99, 99), 25, 'unbounded inputs are clamped before multiply')
})

// --- risk severity bucketing (mirror of /risks page) --------------------

function riskLabel(score) {
  if (score >= 15) return 'HIGH'
  if (score >= 8) return 'MEDIUM'
  return 'LOW'
}

test('risk severity bands', () => {
  assert.equal(riskLabel(25), 'HIGH')
  assert.equal(riskLabel(15), 'HIGH')
  assert.equal(riskLabel(14), 'MEDIUM')
  assert.equal(riskLabel(8), 'MEDIUM')
  assert.equal(riskLabel(7), 'LOW')
  assert.equal(riskLabel(1), 'LOW')
})

// --- inspection terminal-status auto-stamps (mirror of /api/inspections/:id) ----

function applyInspectionStatus(existing, nextStatus, now) {
  const out = { status: nextStatus, overallResult: existing.overallResult, completedAt: existing.completedAt }
  if (nextStatus === 'passed' || nextStatus === 'failed') {
    out.overallResult = nextStatus
    out.completedAt = existing.completedAt || now
  }
  if (nextStatus === 'draft' || nextStatus === 'in_progress') {
    out.overallResult = null
    out.completedAt = null
  }
  return out
}

test('inspection status — pass/fail stamps overallResult + completedAt once', () => {
  const now = new Date('2026-06-01')
  const r = applyInspectionStatus({ overallResult: null, completedAt: null }, 'passed', now)
  assert.equal(r.overallResult, 'passed')
  assert.equal(r.completedAt, now)
})

test('inspection status — re-passing preserves original completedAt', () => {
  const now = new Date('2026-06-01')
  const original = new Date('2026-05-01')
  const r = applyInspectionStatus({ overallResult: 'passed', completedAt: original }, 'passed', now)
  assert.equal(r.completedAt, original)
})

test('inspection status — reopening to in_progress wipes the result', () => {
  const r = applyInspectionStatus({ overallResult: 'failed', completedAt: new Date() }, 'in_progress', new Date())
  assert.equal(r.overallResult, null)
  assert.equal(r.completedAt, null)
})
