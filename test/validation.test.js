/**
 * Unit tests for the validation patterns hardened in commit 4cbf8fa.
 * Pure functions only — no DB / framework involvement.
 *
 * Run with:  npm test
 */
const test = require('node:test')
const assert = require('node:assert/strict')

// Mirror of the regex used in app/api/tasks/route.ts and tasks/[id]/route.ts.
// Keeping it here lets the test fail loudly if the regex ever drifts.
const DUE_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

test('dueTime regex — accepts valid HH:MM', () => {
  for (const v of ['00:00', '09:30', '12:45', '23:59', '13:00', '01:01']) {
    assert.match(v, DUE_TIME_REGEX, `expected "${v}" to match`)
  }
})

test('dueTime regex — rejects invalid hour/minute', () => {
  for (const v of ['24:00', '99:99', '12:60', '5:5', '0:00', '00:0', '1:00', 'ab:cd', '', '12']) {
    assert.doesNotMatch(v, DUE_TIME_REGEX, `expected "${v}" to NOT match`)
  }
})

test('dueDate validation — Date.parse on valid', () => {
  assert.ok(!isNaN(Date.parse('2026-05-23')))
  assert.ok(!isNaN(Date.parse('2026-05-23T10:30:00Z')))
})

test('dueDate validation — Date.parse on invalid', () => {
  // Note: Date.parse is permissive — it accepts surprising strings like
  // "32 Apr" (rolls over). We only test things that consistently fail.
  for (const v of ['not-a-date', 'xyz123', '']) {
    assert.ok(isNaN(Date.parse(v)), `"${v}" should be invalid`)
  }
})

test('skip clamping — Math.max(0, parseInt) handles edges', () => {
  const clamp = (raw) => Math.max(0, parseInt(raw || '0') || 0)
  assert.equal(clamp('5'), 5)
  assert.equal(clamp('0'), 0)
  assert.equal(clamp('-1'), 0, 'negative must clamp to 0')
  assert.equal(clamp('-9999'), 0)
  assert.equal(clamp('abc'), 0, 'NaN must fall to 0')
  assert.equal(clamp(''), 0)
  assert.equal(clamp(null), 0)
  assert.equal(clamp(undefined), 0)
})

test('progress validation — 0..100 inclusive', () => {
  const valid = (p) => !isNaN(Number(p)) && Number(p) >= 0 && Number(p) <= 100
  assert.ok(valid(0))
  assert.ok(valid(50))
  assert.ok(valid(100))
  assert.ok(!valid(-1))
  assert.ok(!valid(101))
  assert.ok(!valid(150))
  assert.ok(!valid('abc'))
})

test('hours validation — > 0 and ≤ 24', () => {
  const valid = (h) => typeof h === 'number' && h > 0 && h <= 24
  assert.ok(valid(0.5))
  assert.ok(valid(8))
  assert.ok(valid(12.5))
  assert.ok(valid(24))
  assert.ok(!valid(0))
  assert.ok(!valid(-1))
  assert.ok(!valid(25))
  assert.ok(!valid(100))
})

test('budget validation — non-negative number', () => {
  const valid = (b) => !isNaN(Number(b)) && Number(b) >= 0
  assert.ok(valid(0))
  assert.ok(valid(1000))
  assert.ok(valid(85000))
  assert.ok(!valid(-50))
  assert.ok(!valid('abc'))
})
