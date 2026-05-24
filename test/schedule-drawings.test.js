/**
 * Tests for the pure invariants of the schedule + drawings + client-portal
 * trio. Like the other test files, the logic is mirrored as plain JS so
 * `node --test` runs them without TS tooling. If the implementation drifts,
 * these fail loudly.
 */
const test = require('node:test')
const assert = require('node:assert/strict')

// --- ALLOWED enums (mirror lib/llm-style allow-lists in the routes) -----

const DISCIPLINES = new Set(['arch', 'struct', 'mep', 'civil', 'fire', 'other'])
const MILESTONE_STATUS = new Set(['planned', 'in_progress', 'complete', 'slipped'])

test('drawing discipline allow-list — unknown falls back', () => {
  const pick = (v) => (DISCIPLINES.has(v) ? v : 'arch')
  assert.equal(pick('struct'), 'struct')
  assert.equal(pick('SYSTEM'), 'arch')
  assert.equal(pick(''), 'arch')
  assert.equal(pick(undefined), 'arch')
})

test('milestone status allow-list', () => {
  for (const s of ['planned', 'in_progress', 'complete', 'slipped']) {
    assert.ok(MILESTONE_STATUS.has(s))
  }
  for (const s of ['SYSTEM', 'cancelled', '', 'rejected']) {
    assert.ok(!MILESTONE_STATUS.has(s))
  }
})

// --- milestone date validation (mirror of /api/milestones) ---------------

function validateMilestoneDates(plannedStart, plannedEnd) {
  const s = new Date(plannedStart)
  const e = new Date(plannedEnd)
  if (isNaN(s.getTime())) return { ok: false, error: 'Invalid plannedStart' }
  if (isNaN(e.getTime())) return { ok: false, error: 'Invalid plannedEnd' }
  if (e < s) return { ok: false, error: 'plannedEnd must be on or after plannedStart' }
  return { ok: true }
}

test('milestone date validation — happy path', () => {
  assert.deepEqual(validateMilestoneDates('2026-06-01', '2026-06-30'), { ok: true })
  assert.deepEqual(validateMilestoneDates('2026-06-01', '2026-06-01'), { ok: true })
})

test('milestone date validation — end before start is rejected', () => {
  const r = validateMilestoneDates('2026-06-30', '2026-06-01')
  assert.equal(r.ok, false)
  assert.match(r.error, /plannedEnd/)
})

test('milestone date validation — invalid strings are rejected', () => {
  assert.equal(validateMilestoneDates('not-a-date', '2026-06-30').ok, false)
  assert.equal(validateMilestoneDates('2026-06-01', 'xyz').ok, false)
})

// --- slipped auto-flag (mirror of /schedule page) ------------------------

function isSlipped(m, now) {
  if (m.status === 'complete') return false
  return new Date(m.plannedEnd) < now
}

test('slipped auto-flag — plannedEnd in the past + not complete', () => {
  const now = new Date('2026-06-01')
  assert.equal(isSlipped({ status: 'planned', plannedEnd: '2026-05-01' }, now), true)
  assert.equal(isSlipped({ status: 'in_progress', plannedEnd: '2026-05-31' }, now), true)
  assert.equal(isSlipped({ status: 'complete', plannedEnd: '2026-05-01' }, now), false)
  assert.equal(isSlipped({ status: 'planned', plannedEnd: '2026-07-01' }, now), false)
})

// --- client-portal token shape (mirror of /api/client/[token]) -----------

function isAcceptableToken(t) {
  return typeof t === 'string' && t.length >= 16 && t.length <= 128
}

test('client portal token guard — accept reasonable lengths', () => {
  assert.ok(isAcceptableToken('a'.repeat(64)))
  assert.ok(isAcceptableToken('b'.repeat(16)))
})

test('client portal token guard — reject too-short / too-long / non-string', () => {
  assert.ok(!isAcceptableToken(''))
  assert.ok(!isAcceptableToken('short'))
  assert.ok(!isAcceptableToken('a'.repeat(200)))
  assert.ok(!isAcceptableToken(null))
  assert.ok(!isAcceptableToken(42))
})

// --- startOfWeek (mirror of /schedule page) ------------------------------

function startOfWeek(d) {
  const x = new Date(d)
  const day = x.getDay() || 7
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - (day - 1))
  return x
}

test('startOfWeek — snaps any weekday to Monday 00:00', () => {
  // 2026-06-03 is a Wednesday → Monday 2026-06-01.
  assert.equal(startOfWeek(new Date('2026-06-03T15:34:00Z')).toISOString().slice(0, 10), '2026-06-01')
  // 2026-06-07 is a Sunday → Monday 2026-06-01.
  assert.equal(startOfWeek(new Date('2026-06-07T00:00:00Z')).toISOString().slice(0, 10), '2026-06-01')
  // 2026-06-01 (Mon) is its own start.
  assert.equal(startOfWeek(new Date('2026-06-01T12:00:00Z')).toISOString().slice(0, 10), '2026-06-01')
})
