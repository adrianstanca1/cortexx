/**
 * Tests for the pure invariants of the compliance trio (permits / tenders /
 * rams). Logic is mirrored as plain JS to run under `node --test` with no
 * TS toolchain.
 */
const test = require('node:test')
const assert = require('node:assert/strict')

// --- Allow-lists (mirror of the API routes) -----------------------------

const PERMIT_TYPE = new Set(['hot_work', 'confined_space', 'excavation', 'working_at_height', 'electrical', 'general'])
const PERMIT_STATUS = new Set(['draft', 'active', 'expired', 'cancelled'])
const PERMIT_RISK = new Set(['low', 'medium', 'high', 'critical'])
const TENDER_STATUS = new Set(['draft', 'submitted', 'won', 'lost', 'withdrawn'])
const RAMS_TYPE = new Set(['rams', 'risk_assessment', 'method_statement'])
const RAMS_STATUS = new Set(['draft', 'active', 'expired', 'archived'])

test('permit type allow-list — fall back to general for unknown', () => {
  const pick = (v) => (PERMIT_TYPE.has(v) ? v : 'general')
  assert.equal(pick('hot_work'), 'hot_work')
  assert.equal(pick('SYSTEM'), 'general')
  assert.equal(pick(''), 'general')
})

test('permit risk allow-list', () => {
  for (const r of ['low', 'medium', 'high', 'critical']) assert.ok(PERMIT_RISK.has(r))
  for (const r of ['extreme', '', 'severe']) assert.ok(!PERMIT_RISK.has(r))
})

test('tender status pipeline', () => {
  for (const s of ['draft', 'submitted', 'won', 'lost', 'withdrawn']) {
    assert.ok(TENDER_STATUS.has(s))
  }
  for (const s of ['pending', 'archived', 'rejected']) assert.ok(!TENDER_STATUS.has(s))
})

test('rams type + status allow-lists', () => {
  for (const t of ['rams', 'risk_assessment', 'method_statement']) assert.ok(RAMS_TYPE.has(t))
  for (const s of ['draft', 'active', 'expired', 'archived']) assert.ok(RAMS_STATUS.has(s))
})

// --- validity-window check (mirror of /api/permits) ----------------------

function validatePermitWindow(validFrom, validTo) {
  if (validFrom && validTo && new Date(validTo) < new Date(validFrom)) {
    return { ok: false, error: 'validTo must be on or after validFrom' }
  }
  return { ok: true }
}

test('permit validity window — happy path', () => {
  assert.deepEqual(validatePermitWindow('2026-06-01', '2026-06-30'), { ok: true })
  assert.deepEqual(validatePermitWindow(null, null), { ok: true })
  assert.deepEqual(validatePermitWindow('2026-06-01', '2026-06-01'), { ok: true })
})

test('permit validity window — reverse range rejected', () => {
  const r = validatePermitWindow('2026-06-30', '2026-06-01')
  assert.equal(r.ok, false)
  assert.match(r.error, /validTo/)
})

// --- tender totalValue validation (mirror of /api/tenders) --------------

function validateTotalValue(v) {
  const n = Number(v)
  if (!isFinite(n) || n < 0 || n > 1_000_000_000) return { ok: false }
  return { ok: true, value: n }
}

test('tender totalValue — accepts non-negative finite numbers up to 1B', () => {
  assert.deepEqual(validateTotalValue(0), { ok: true, value: 0 })
  assert.deepEqual(validateTotalValue(85_000), { ok: true, value: 85000 })
  assert.deepEqual(validateTotalValue('100000'), { ok: true, value: 100000 })
})

test('tender totalValue — rejects negative, NaN, infinite, or oversized', () => {
  assert.equal(validateTotalValue(-1).ok, false)
  assert.equal(validateTotalValue('abc').ok, false)
  assert.equal(validateTotalValue(Infinity).ok, false)
  assert.equal(validateTotalValue(2e9).ok, false)
})

// --- RAMS sign-off transition (mirror of /api/rams/:id) -----------------

function applySignOff(existing, signedBy) {
  const trimmed = (signedBy || '').trim().slice(0, 100)
  return {
    signedBy: trimmed || null,
    signedAt: trimmed ? new Date('2026-06-01T10:00:00Z') : null,
    // Activity event triggered when going from unsigned -> signed.
    triggersActivity: !!trimmed && !existing.signedBy,
  }
}

test('rams sign-off — sets signedAt when name is provided', () => {
  const r = applySignOff({ signedBy: null }, 'Adrian Stanca')
  assert.equal(r.signedBy, 'Adrian Stanca')
  assert.ok(r.signedAt)
  assert.equal(r.triggersActivity, true)
})

test('rams sign-off — clearing wipes the timestamp', () => {
  const r = applySignOff({ signedBy: 'Adrian' }, '')
  assert.equal(r.signedBy, null)
  assert.equal(r.signedAt, null)
  assert.equal(r.triggersActivity, false, 'clearing should not log an activity event')
})

test('rams sign-off — re-signing does not retrigger activity event', () => {
  const r = applySignOff({ signedBy: 'Adrian' }, 'Different Person')
  assert.equal(r.triggersActivity, false)
})

// --- tender lifecycle stamps (mirror of /api/tenders/:id) ---------------

function applyTenderStatus(existing, nextStatus, now) {
  const out = { status: nextStatus, submittedAt: existing.submittedAt, decidedAt: existing.decidedAt }
  if (nextStatus === 'submitted' && !existing.submittedAt) out.submittedAt = now
  if ((nextStatus === 'won' || nextStatus === 'lost') && !existing.decidedAt) out.decidedAt = now
  if (nextStatus === 'draft') { out.submittedAt = null; out.decidedAt = null }
  return out
}

test('tender lifecycle — first submission stamps submittedAt', () => {
  const now = new Date('2026-06-01')
  const r = applyTenderStatus({ submittedAt: null, decidedAt: null }, 'submitted', now)
  assert.equal(r.submittedAt, now)
})

test('tender lifecycle — won/lost stamps decidedAt', () => {
  const now = new Date('2026-06-01')
  const r = applyTenderStatus({ submittedAt: new Date('2026-05-01'), decidedAt: null }, 'won', now)
  assert.equal(r.decidedAt, now)
})

test('tender lifecycle — reopen to draft wipes both stamps', () => {
  const now = new Date('2026-06-01')
  const r = applyTenderStatus({ submittedAt: new Date('2026-05-01'), decidedAt: new Date('2026-05-15') }, 'draft', now)
  assert.equal(r.submittedAt, null)
  assert.equal(r.decidedAt, null)
})

test('tender lifecycle — re-submitting does not overwrite original submittedAt', () => {
  const original = new Date('2026-05-01')
  const now = new Date('2026-06-01')
  const r = applyTenderStatus({ submittedAt: original, decidedAt: null }, 'submitted', now)
  assert.equal(r.submittedAt, original, 'first submission timestamp should be preserved')
})
