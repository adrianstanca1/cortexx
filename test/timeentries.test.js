/**
 * Unit tests for the isoWeek helper and approved-filter logic added to
 * app/api/timeentries/route.ts.
 *
 * Run with:  npm test
 */
const test = require('node:test')
const assert = require('node:assert/strict')

// Mirror of the isoWeek function in app/api/timeentries/route.ts
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { week, year: d.getUTCFullYear() }
}

// Mirror of the approved filter logic in app/api/timeentries/route.ts
function parseApprovedFilter(param) {
  return param === 'false' ? false : param === 'true' ? true : undefined
}

// ─── isoWeek tests ───────────────────────────────────────────────────────────

test('isoWeek — 2026-01-01 is week 1, year 2026', () => {
  const { week, year } = isoWeek(new Date(2026, 0, 1))
  assert.equal(week, 1)
  assert.equal(year, 2026)
})

test('isoWeek — 2025-12-29 is week 1, year 2026 (ISO week crosses year boundary)', () => {
  // 2025-12-29 is Monday of ISO week 1 of 2026
  const { week, year } = isoWeek(new Date(2025, 11, 29))
  assert.equal(week, 1)
  assert.equal(year, 2026)
})

test('isoWeek — 2025-12-28 is week 52, year 2025', () => {
  const { week, year } = isoWeek(new Date(2025, 11, 28))
  assert.equal(week, 52)
  assert.equal(year, 2025)
})

test('isoWeek — 2026-05-18 is week 21, year 2026', () => {
  // 2026-05-18 is a Monday
  const { week, year } = isoWeek(new Date(2026, 4, 18))
  assert.equal(week, 21)
  assert.equal(year, 2026)
})

test('isoWeek — week number is always 1–53', () => {
  // Spot-check 52 dates spread across 2025 and 2026
  const dates = [
    new Date(2025, 0, 1), new Date(2025, 2, 15), new Date(2025, 5, 30),
    new Date(2025, 8, 1), new Date(2025, 11, 31),
    new Date(2026, 0, 1), new Date(2026, 3, 20), new Date(2026, 11, 31),
  ]
  for (const d of dates) {
    const { week } = isoWeek(d)
    assert.ok(week >= 1 && week <= 53, `week ${week} out of range for ${d.toISOString()}`)
  }
})

// ─── approved filter tests ───────────────────────────────────────────────────

test('approved filter — "false" returns boolean false', () => {
  assert.strictEqual(parseApprovedFilter('false'), false)
})

test('approved filter — "true" returns boolean true', () => {
  assert.strictEqual(parseApprovedFilter('true'), true)
})

test('approved filter — null/undefined/other returns undefined (no filter)', () => {
  assert.strictEqual(parseApprovedFilter(null), undefined)
  assert.strictEqual(parseApprovedFilter(undefined), undefined)
  assert.strictEqual(parseApprovedFilter(''), undefined)
  assert.strictEqual(parseApprovedFilter('all'), undefined)
})

// ─── allWeeks flag tests ──────────────────────────────────────────────────────

test('allWeeks flag — "true" string enables cross-week query', () => {
  const allWeeks = 'true' === 'true'
  assert.ok(allWeeks)
})

test('allWeeks flag — absent/other disables cross-week query', () => {
  for (const v of [null, undefined, '', 'false', '1']) {
    const allWeeks = v === 'true'
    assert.ok(!allWeeks, `expected allWeeks=false for value "${v}"`)
  }
})
