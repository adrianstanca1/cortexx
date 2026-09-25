const test = require('node:test')
const assert = require('node:assert/strict')
const { buildBaselineSnapshot, canTransitionDelayStatus, normalizeDelayDays } = require('../lib/programme-change-control')

test('baseline snapshot adopts planned dates while preserving previous baseline evidence', () => {
  const snapshot = buildBaselineSnapshot([{
    id: 'a', code: 'A10', title: 'Facade',
    baselineStart: '2026-09-01', baselineEnd: '2026-09-05',
    plannedStart: '2026-09-03', plannedEnd: '2026-09-09', sortOrder: 1,
  }], [{ id: 'd', predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: 2 }], new Date('2026-09-25T10:00:00Z'))
  assert.equal(snapshot.activities[0].baselineStart, '2026-09-03T00:00:00.000Z')
  assert.equal(snapshot.activities[0].previousBaselineStart, '2026-09-01T00:00:00.000Z')
  assert.equal(snapshot.dependencies[0].lagDays, 2)
})

test('delay lifecycle only allows governed forward decisions', () => {
  assert.equal(canTransitionDelayStatus('open', 'accepted'), true)
  assert.equal(canTransitionDelayStatus('open', 'rejected'), true)
  assert.equal(canTransitionDelayStatus('accepted', 'closed'), true)
  assert.equal(canTransitionDelayStatus('accepted', 'open'), false)
  assert.equal(canTransitionDelayStatus('rejected', 'accepted'), false)
  assert.equal(canTransitionDelayStatus('closed', 'open'), false)
})

test('delay days are whole, non-negative and bounded', () => {
  assert.equal(normalizeDelayDays('3.4'), 3)
  assert.equal(normalizeDelayDays(-1), null)
  assert.equal(normalizeDelayDays(5000), null)
  assert.equal(normalizeDelayDays('bad'), null)
})
