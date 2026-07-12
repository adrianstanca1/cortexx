/**
 * Tests for the pure invariants of the daily-ops trio.
 * Mirrored as plain JS so node:test runs them without TS tooling.
 */
const test = require('node:test')
const assert = require('node:assert/strict')

// --- Allow-lists (mirror of the API routes) -----------------------------

const MAINT_TYPE = new Set(['service', 'inspection', 'calibration', 'repair'])
const MAINT_STATUS = new Set(['scheduled', 'due', 'completed', 'overdue', 'cancelled'])
const SUPPLIER_CATEGORY = new Set(['materials', 'plant', 'services', 'other'])

test('maintenance type allow-list', () => {
  for (const t of ['service', 'inspection', 'calibration', 'repair']) assert.ok(MAINT_TYPE.has(t))
  for (const t of ['cleaning', '', 'SYSTEM']) assert.ok(!MAINT_TYPE.has(t))
})

test('maintenance status pipeline', () => {
  for (const s of ['scheduled', 'due', 'completed', 'overdue', 'cancelled']) assert.ok(MAINT_STATUS.has(s))
  for (const s of ['draft', 'archived']) assert.ok(!MAINT_STATUS.has(s))
})

test('supplier category allow-list', () => {
  for (const c of ['materials', 'plant', 'services', 'other']) assert.ok(SUPPLIER_CATEGORY.has(c))
  for (const c of ['food', '', 'SYSTEM']) assert.ok(!SUPPLIER_CATEGORY.has(c))
})

// --- Toolbox attendee count derivation (mirror of /api/toolbox-talks) ---

function deriveAttendeeCount(attendees, explicit) {
  const e = Number(explicit)
  if (isFinite(e) && e >= 0) return Math.min(500, Math.floor(e))
  if (typeof attendees !== 'string' || !attendees) return 0
  return attendees.split(/\n/).map(l => l.trim()).filter(Boolean).length
}

test('attendee count — explicit number wins (clamped 0..500, floored)', () => {
  assert.equal(deriveAttendeeCount('a\nb\nc', 10), 10)
  assert.equal(deriveAttendeeCount('a\nb\nc', 0), 0)
  assert.equal(deriveAttendeeCount('a\nb\nc', 1000), 500)
  assert.equal(deriveAttendeeCount('a\nb\nc', 4.9), 4)
})

test('attendee count — falls back to non-empty line count', () => {
  assert.equal(deriveAttendeeCount('John Smith\nJane Doe', undefined), 2)
  assert.equal(deriveAttendeeCount('  spaces  \n\n\nFoo\n', undefined), 2)
  assert.equal(deriveAttendeeCount('', undefined), 0)
  assert.equal(deriveAttendeeCount(null, undefined), 0)
})

test('attendee count — negative or NaN explicit falls through to lines', () => {
  assert.equal(deriveAttendeeCount('a\nb', -1), 2)
  assert.equal(deriveAttendeeCount('a\nb', 'oops'), 2)
})

// --- maintenance interval clamp (mirror of /api/maintenance) ------------

function clampInterval(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!isFinite(n) || n < 1 || n > 3650) return 'INVALID'
  return Math.floor(n)
}

test('maintenance interval — clamps and rejects out-of-range', () => {
  assert.equal(clampInterval(180), 180)
  assert.equal(clampInterval('365'), 365)
  assert.equal(clampInterval(null), null)
  assert.equal(clampInterval(''), null)
  assert.equal(clampInterval(0), 'INVALID')
  assert.equal(clampInterval(3651), 'INVALID')
  assert.equal(clampInterval('not'), 'INVALID')
  assert.equal(clampInterval(180.7), 180)
})

// --- maintenance auto-schedule of the next occurrence (mirror of /api/maintenance/:id) ---

function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }

function decideNextScheduleDate(existing, completedAt) {
  if (!existing.intervalDays || existing.intervalDays < 1) return null
  return addDays(completedAt, existing.intervalDays)
}

test('maintenance auto-schedule — interval set produces next dueDate', () => {
  const completed = new Date('2026-06-01')
  const next = decideNextScheduleDate({ intervalDays: 180 }, completed)
  assert.ok(next instanceof Date)
  // Account for DST boundary crossing: the difference should be very close to 180 days
  // allowing for ±2 hours tolerance due to timezone/DST handling
  const expectedDiff = 180 * 86400000
  const actualDiff = next.getTime() - completed.getTime()
  const tolerance = 2 * 3600000 // 2 hours in milliseconds
  assert.ok(
    Math.abs(actualDiff - expectedDiff) <= tolerance,
    `Expected ~${expectedDiff}ms but got ${actualDiff}ms (difference: ${actualDiff - expectedDiff}ms)`
  )
})

test('maintenance auto-schedule — interval null produces no next', () => {
  const next = decideNextScheduleDate({ intervalDays: null }, new Date())
  assert.equal(next, null)
})
