const test = require('node:test')
const assert = require('node:assert/strict')
const { calculateCriticalPath, dependencyViolations, programmeSummary, wouldCreateCycle } = require('../lib/programme')

const activities = [
  { id: 'a', plannedStart: '2026-09-01', plannedEnd: '2026-09-04', status: 'complete', progress: 100 },
  { id: 'b', plannedStart: '2026-09-04', plannedEnd: '2026-09-09', status: 'in_progress', progress: 50 },
  { id: 'c', plannedStart: '2026-09-04', plannedEnd: '2026-09-06', status: 'not_started', progress: 0 },
  { id: 'd', plannedStart: '2026-09-09', plannedEnd: '2026-09-11', status: 'not_started', progress: 0 },
]
const deps = [
  { id: 'ab', predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: 0 },
  { id: 'ac', predecessorId: 'a', successorId: 'c', type: 'FS', lagDays: 0 },
  { id: 'bd', predecessorId: 'b', successorId: 'd', type: 'FS', lagDays: 0 },
  { id: 'cd', predecessorId: 'c', successorId: 'd', type: 'FS', lagDays: 0 },
]

test('CPM identifies the longest dependency chain and float', () => {
  const cpm = calculateCriticalPath(activities, deps)
  assert.equal(cpm.hasCycle, false)
  assert.deepEqual(new Set(cpm.criticalActivityIds), new Set(['a', 'b', 'd']))
  assert.equal(cpm.activities.find(x => x.id === 'c').totalFloatDays, 3)
})

test('dependency validation covers finish-start constraint', () => {
  const violations = dependencyViolations([
    { id: 'a', plannedStart: '2026-09-01', plannedEnd: '2026-09-05' },
    { id: 'b', plannedStart: '2026-09-03', plannedEnd: '2026-09-07' },
  ], [{ id: 'x', predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: 1 }])
  assert.equal(violations.length, 1)
  assert.equal(violations[0].shortfallDays, 3)
})

test('cycle check rejects a dependency that closes a loop', () => {
  assert.equal(wouldCreateCycle(activities, deps, { predecessorId: 'd', successorId: 'a', type: 'FS', lagDays: 0 }), true)
})

test('lookahead summary reports weighted progress, overdue and window activities', () => {
  const summary = programmeSummary(activities, deps, { now: '2026-09-05T00:00:00Z', lookaheadDays: 7 })
  assert.equal(summary.totalActivities, 4)
  assert.equal(summary.complete, 1)
  assert.equal(summary.lookaheadCount, 3)
  assert.equal(summary.overdue, 0)
  assert.ok(summary.progressPct > 0 && summary.progressPct < 100)
})
