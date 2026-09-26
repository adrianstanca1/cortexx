const test = require('node:test')
const assert = require('node:assert/strict')
const { buildAttendanceReconciliation, isoWeekRange } = require('../lib/attendance-reconciliation')

const member = { id: 'm1', name: 'Alex' }
const project = { id: 'p1', name: 'Facade A' }
const baseCheckin = { id: 'c1', memberId: 'm1', projectId: 'p1', member, project, checkedInAt: new Date('2026-09-21T07:00:00Z'), checkedOutAt: new Date('2026-09-21T15:00:00Z') }
const baseTime = { id: 't1', memberId: 'm1', projectId: 'p1', member, project, date: new Date('2026-09-21T00:00:00Z'), hours: 8, approved: false }

test('matching attendance and time is not an exception', () => {
  const [row] = buildAttendanceReconciliation({ checkins: [baseCheckin], timeEntries: [baseTime] })
  assert.equal(row.observedHours, 8)
  assert.equal(row.loggedHours, 8)
  assert.deepEqual(row.issues, [])
  assert.equal(row.canApplyAttendance, true)
})

test('missing checkout is always surfaced and blocks auto-reconciliation', () => {
  const open = { ...baseCheckin, checkedOutAt: null }
  const [row] = buildAttendanceReconciliation({ checkins: [open], timeEntries: [] })
  assert.deepEqual(row.issues, ['missing_checkout'])
  assert.equal(row.canApplyAttendance, false)
})

test('completed attendance without time creates a missing-time exception', () => {
  const [row] = buildAttendanceReconciliation({ checkins: [baseCheckin], timeEntries: [] })
  assert.deepEqual(row.issues, ['missing_time'])
  assert.equal(row.observedHours, 8)
  assert.equal(row.loggedHours, 0)
  assert.equal(row.canApplyAttendance, true)
})

test('variance uses total daily hours across multiple shifts and entries', () => {
  const second = { ...baseCheckin, id: 'c2', checkedInAt: new Date('2026-09-21T16:00:00Z'), checkedOutAt: new Date('2026-09-21T18:00:00Z') }
  const [row] = buildAttendanceReconciliation({ checkins: [baseCheckin, second], timeEntries: [{ ...baseTime, hours: 8 }] })
  assert.equal(row.observedHours, 10)
  assert.equal(row.varianceHours, -2)
  assert.deepEqual(row.issues, ['variance'])
})

test('logged time without site evidence is visible but cannot be auto-corrected', () => {
  const [row] = buildAttendanceReconciliation({ checkins: [], timeEntries: [baseTime] })
  assert.deepEqual(row.issues, ['time_without_attendance'])
  assert.equal(row.canApplyAttendance, false)
})

test('approved or split time requires manual review even when attendance exists', () => {
  const approved = { ...baseTime, approved: true }
  const [a] = buildAttendanceReconciliation({ checkins: [baseCheckin], timeEntries: [approved] })
  assert.equal(a.canApplyAttendance, false)
  const [b] = buildAttendanceReconciliation({ checkins: [baseCheckin], timeEntries: [baseTime, { ...baseTime, id: 't2', hours: 1 }] })
  assert.equal(b.canApplyAttendance, false)
})

test('ISO week range is Monday-to-Monday in UTC', () => {
  const { start, end } = isoWeekRange(39, 2026)
  assert.equal(start.toISOString(), '2026-09-21T00:00:00.000Z')
  assert.equal(end.toISOString(), '2026-09-28T00:00:00.000Z')
})
