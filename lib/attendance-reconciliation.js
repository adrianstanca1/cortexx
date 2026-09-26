'use strict'

function moneyHours(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function dateKey(value) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function hoursBetween(start, end) {
  const a = new Date(start)
  const b = new Date(end)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  return moneyHours(Math.max(0, Math.min(24, (b.getTime() - a.getTime()) / 3600000)))
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { week, year: d.getUTCFullYear() }
}

function isoWeekRange(week, year) {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const start = new Date(jan4)
  start.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 7)
  return { start, end }
}

function buildAttendanceReconciliation({ checkins = [], timeEntries = [], varianceThreshold = 0.5 } = {}) {
  const rows = new Map()
  const ensure = ({ memberId, projectId, date, member, project }) => {
    const key = `${memberId || 'unknown'}:${projectId || 'none'}:${date}`
    if (!rows.has(key)) {
      rows.set(key, {
        key,
        memberId: memberId || null,
        memberName: member?.name || 'Unknown member',
        projectId: projectId || null,
        projectName: project?.name || 'No project',
        date,
        observedHours: 0,
        loggedHours: 0,
        varianceHours: 0,
        openCheckins: 0,
        checkinIds: [],
        timeEntryIds: [],
        approvedAny: false,
        issues: [],
        status: 'matched',
        canApplyAttendance: false,
      })
    }
    return rows.get(key)
  }

  for (const checkin of checkins) {
    const date = dateKey(checkin.checkedInAt)
    if (!date) continue
    const row = ensure({ memberId: checkin.memberId, projectId: checkin.projectId, date, member: checkin.member, project: checkin.project })
    row.checkinIds.push(checkin.id)
    if (checkin.checkedOutAt) row.observedHours = moneyHours(row.observedHours + hoursBetween(checkin.checkedInAt, checkin.checkedOutAt))
    else row.openCheckins += 1
  }

  for (const entry of timeEntries) {
    const date = dateKey(entry.date)
    if (!date) continue
    const row = ensure({ memberId: entry.memberId, projectId: entry.projectId, date, member: entry.member, project: entry.project })
    row.timeEntryIds.push(entry.id)
    row.loggedHours = moneyHours(row.loggedHours + (Number(entry.hours) || 0))
    if (entry.approved) row.approvedAny = true
  }

  for (const row of rows.values()) {
    row.observedHours = moneyHours(row.observedHours)
    row.loggedHours = moneyHours(row.loggedHours)
    row.varianceHours = moneyHours(row.loggedHours - row.observedHours)
    if (row.openCheckins > 0) row.issues.push('missing_checkout')
    if (row.observedHours > 0 && row.loggedHours === 0) row.issues.push('missing_time')
    else if (row.observedHours === 0 && row.loggedHours > 0) row.issues.push('time_without_attendance')
    else if (row.observedHours > 0 && row.loggedHours > 0 && Math.abs(row.varianceHours) >= varianceThreshold) row.issues.push('variance')
    row.status = row.issues.length ? 'exception' : 'matched'
    row.canApplyAttendance = Boolean(
      row.projectId &&
      row.observedHours > 0 &&
      row.openCheckins === 0 &&
      !row.approvedAny &&
      row.timeEntryIds.length <= 1,
    )
  }

  return [...rows.values()].sort((a, b) => b.date.localeCompare(a.date) || a.memberName.localeCompare(b.memberName) || a.projectName.localeCompare(b.projectName))
}

module.exports = { moneyHours, dateKey, hoursBetween, isoWeek, isoWeekRange, buildAttendanceReconciliation }
