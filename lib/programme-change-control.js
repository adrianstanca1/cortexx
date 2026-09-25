'use strict'

const DELAY_TRANSITIONS = Object.freeze({
  open: new Set(['accepted', 'rejected']),
  accepted: new Set(['closed']),
  rejected: new Set(),
  closed: new Set(),
})

function iso(value) {
  if (value == null) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function buildBaselineSnapshot(activities = [], dependencies = [], capturedAt = new Date()) {
  return {
    version: 1,
    capturedAt: iso(capturedAt),
    activities: activities.map(activity => ({
      id: activity.id,
      code: activity.code || null,
      title: activity.title,
      baselineStart: iso(activity.plannedStart),
      baselineEnd: iso(activity.plannedEnd),
      previousBaselineStart: iso(activity.baselineStart),
      previousBaselineEnd: iso(activity.baselineEnd),
      plannedStart: iso(activity.plannedStart),
      plannedEnd: iso(activity.plannedEnd),
      responsibleMemberId: activity.responsibleMemberId || null,
      location: activity.location || null,
      sortOrder: Number(activity.sortOrder) || 0,
    })),
    dependencies: dependencies.map(dep => ({
      id: dep.id,
      predecessorId: dep.predecessorId,
      successorId: dep.successorId,
      type: dep.type,
      lagDays: Number(dep.lagDays) || 0,
    })),
  }
}

function canTransitionDelayStatus(from, to) {
  if (from === to) return true
  return Boolean(DELAY_TRANSITIONS[from]?.has(to))
}

function normalizeDelayDays(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const rounded = Math.round(n)
  return rounded >= 0 && rounded <= 3650 ? rounded : null
}

module.exports = { buildBaselineSnapshot, canTransitionDelayStatus, normalizeDelayDays }
