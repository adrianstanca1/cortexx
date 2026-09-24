/**
 * Unit tests for safety incident logic mirrored from app/api/safety/route.ts.
 * Pure functions only — no DB / framework involvement.
 *
 * Run with:  npm test
 */
const test = require('node:test')
const assert = require('node:assert/strict')

const INCIDENT_TYPES = ['near_miss', 'first_aid', 'accident', 'dangerous_occurrence', 'environmental', 'security']
const SEVERITIES = ['near_miss', 'low', 'medium', 'high', 'critical']
const STATUSES = ['open', 'investigating', 'closed']

// Serious events should trigger a RIDDOR assessment, not an automatic legal conclusion.
function riddorReviewRequired(type, severity) {
  return type === 'accident' || type === 'dangerous_occurrence' || severity === 'critical'
}

// Mirror the days-without-incident computation from the list handler.
function daysWithoutIncident(mostRecentOccurredAt, now = Date.now()) {
  if (!mostRecentOccurredAt) return 0
  const ms = now - new Date(mostRecentOccurredAt).getTime()
  return Math.max(0, Math.floor(ms / 86400000))
}

test('RIDDOR review — serious incidents are flagged for assessment without deciding reportability', () => {
  assert.equal(riddorReviewRequired('accident', 'low'), true)
  assert.equal(riddorReviewRequired('dangerous_occurrence', 'medium'), true)
  assert.equal(riddorReviewRequired('near_miss', 'critical'), true)
  assert.equal(riddorReviewRequired('near_miss', 'low'), false)
})

test('daysWithoutIncident — 0 when no incidents', () => {
  assert.equal(daysWithoutIncident(null), 0)
  assert.equal(daysWithoutIncident(undefined), 0)
})

test('daysWithoutIncident — clamps negative to 0 (clock skew)', () => {
  const future = new Date(Date.now() + 86400000).toISOString()
  assert.equal(daysWithoutIncident(future), 0)
})

test('daysWithoutIncident — accurate day count', () => {
  const now = Date.UTC(2026, 4, 24, 12, 0, 0)
  const fiveDaysAgo = new Date(now - 5 * 86400000).toISOString()
  assert.equal(daysWithoutIncident(fiveDaysAgo, now), 5)
})

test('daysWithoutIncident — partial day rounds down', () => {
  const now = Date.UTC(2026, 4, 24, 12, 0, 0)
  // 5 days + 6 hours ago → floor to 5 days
  const partial = new Date(now - (5 * 86400000 + 6 * 3600000)).toISOString()
  assert.equal(daysWithoutIncident(partial, now), 5)
})

test('allowlists — types / severities / statuses are fixed sets', () => {
  assert.equal(INCIDENT_TYPES.length, 6)
  assert.equal(SEVERITIES.length, 5)
  assert.equal(STATUSES.length, 3)
  // Ensure no typos
  assert.ok(INCIDENT_TYPES.every(t => /^[a-z_]+$/.test(t)))
  assert.ok(SEVERITIES.every(s => /^[a-z_]+$/.test(s)))
  assert.ok(STATUSES.every(s => /^[a-z]+$/.test(s)))
})

test('status transitions — closed should stamp closedAt; reopening should clear it', () => {
  // Mirror of the PUT handler's transition guard
  function nextClosedAt(prevStatus, nextStatus, prevClosedAt) {
    if (nextStatus === 'closed' && prevStatus !== 'closed') return 'now'
    if (nextStatus !== 'closed' && prevStatus === 'closed') return null
    return prevClosedAt
  }
  assert.equal(nextClosedAt('open', 'closed', null), 'now')
  assert.equal(nextClosedAt('closed', 'open', 'some-date'), null)
  assert.equal(nextClosedAt('closed', 'closed', 'some-date'), 'some-date') // idempotent
  assert.equal(nextClosedAt('investigating', 'open', null), null)
})
