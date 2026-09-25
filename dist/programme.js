'use strict'

const DAY_MS = 86400000
const TYPES = new Set(['FS', 'SS', 'FF', 'SF'])

function daysBetween(start, end) {
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1
  return Math.max(1, Math.ceil((b - a) / DAY_MS) || 1)
}

function edgeWeight(dep, durations) {
  const type = TYPES.has(dep.type) ? dep.type : 'FS'
  const lag = Number.isFinite(Number(dep.lagDays)) ? Number(dep.lagDays) : 0
  const pred = durations.get(dep.predecessorId) || 1
  const succ = durations.get(dep.successorId) || 1
  if (type === 'SS') return lag
  if (type === 'FF') return pred + lag - succ
  if (type === 'SF') return lag - succ
  return pred + lag
}

function calculateCriticalPath(activities = [], dependencies = []) {
  const byId = new Map(activities.map(a => [a.id, a]))
  const durations = new Map(activities.map(a => [a.id, daysBetween(a.plannedStart, a.plannedEnd)]))
  const incoming = new Map(activities.map(a => [a.id, []]))
  const outgoing = new Map(activities.map(a => [a.id, []]))
  const indegree = new Map(activities.map(a => [a.id, 0]))

  const edges = []
  for (const dep of dependencies) {
    if (!byId.has(dep.predecessorId) || !byId.has(dep.successorId) || dep.predecessorId === dep.successorId) continue
    const edge = { ...dep, weight: edgeWeight(dep, durations) }
    edges.push(edge)
    outgoing.get(dep.predecessorId).push(edge)
    incoming.get(dep.successorId).push(edge)
    indegree.set(dep.successorId, (indegree.get(dep.successorId) || 0) + 1)
  }

  const queue = activities.filter(a => (indegree.get(a.id) || 0) === 0).map(a => a.id)
  const order = []
  while (queue.length) {
    const id = queue.shift()
    order.push(id)
    for (const edge of outgoing.get(id) || []) {
      const n = (indegree.get(edge.successorId) || 0) - 1
      indegree.set(edge.successorId, n)
      if (n === 0) queue.push(edge.successorId)
    }
  }
  if (order.length !== activities.length) return { hasCycle: true, projectDurationDays: 0, activities: [], criticalActivityIds: [] }

  const es = new Map(activities.map(a => [a.id, 0]))
  for (const id of order) {
    for (const edge of outgoing.get(id) || []) {
      es.set(edge.successorId, Math.max(es.get(edge.successorId) || 0, (es.get(id) || 0) + edge.weight))
    }
  }
  let projectDurationDays = 0
  for (const a of activities) projectDurationDays = Math.max(projectDurationDays, (es.get(a.id) || 0) + (durations.get(a.id) || 1))

  const ls = new Map(activities.map(a => [a.id, projectDurationDays - (durations.get(a.id) || 1)]))
  for (const id of [...order].reverse()) {
    for (const edge of outgoing.get(id) || []) {
      ls.set(id, Math.min(ls.get(id), (ls.get(edge.successorId) || 0) - edge.weight))
    }
  }

  const result = activities.map(a => {
    const earliestStartDay = es.get(a.id) || 0
    const latestStartDay = ls.get(a.id) || 0
    const totalFloatDays = Math.max(0, latestStartDay - earliestStartDay)
    return {
      id: a.id,
      durationDays: durations.get(a.id) || 1,
      earliestStartDay,
      latestStartDay,
      totalFloatDays,
      critical: totalFloatDays < 0.0001,
    }
  })
  return {
    hasCycle: false,
    projectDurationDays,
    activities: result,
    criticalActivityIds: result.filter(a => a.critical).map(a => a.id),
  }
}

function dependencyViolations(activities = [], dependencies = []) {
  const byId = new Map(activities.map(a => [a.id, a]))
  const out = []
  for (const dep of dependencies) {
    const pred = byId.get(dep.predecessorId)
    const succ = byId.get(dep.successorId)
    if (!pred || !succ) continue
    const type = TYPES.has(dep.type) ? dep.type : 'FS'
    const lagMs = (Number(dep.lagDays) || 0) * DAY_MS
    const ps = new Date(pred.plannedStart).getTime()
    const pe = new Date(pred.plannedEnd).getTime()
    const ss = new Date(succ.plannedStart).getTime()
    const se = new Date(succ.plannedEnd).getTime()
    let required = 0
    let actual = 0
    if (type === 'SS') { required = ps + lagMs; actual = ss }
    else if (type === 'FF') { required = pe + lagMs; actual = se }
    else if (type === 'SF') { required = ps + lagMs; actual = se }
    else { required = pe + lagMs; actual = ss }
    if (actual < required) out.push({ dependencyId: dep.id, predecessorId: pred.id, successorId: succ.id, type, shortfallDays: Math.ceil((required - actual) / DAY_MS) })
  }
  return out
}

function programmeSummary(activities = [], dependencies = [], options = {}) {
  const now = options.now ? new Date(options.now) : new Date()
  const lookaheadDays = Math.max(1, Math.min(84, Number(options.lookaheadDays) || 21))
  const end = new Date(now.getTime() + lookaheadDays * DAY_MS)
  const cpm = calculateCriticalPath(activities, dependencies)
  const violations = dependencyViolations(activities, dependencies)
  const lookahead = activities.filter(a => {
    const start = new Date(a.plannedStart)
    const finish = new Date(a.plannedEnd)
    return start <= end && finish >= now && a.status !== 'complete'
  }).sort((a,b) => new Date(a.plannedStart) - new Date(b.plannedStart))
  const overdue = activities.filter(a => a.status !== 'complete' && new Date(a.plannedEnd) < now)
  const blocked = activities.filter(a => a.status === 'blocked')
  const weighted = activities.reduce((acc, a) => {
    const d = daysBetween(a.plannedStart, a.plannedEnd)
    acc.weight += d
    acc.progress += d * Math.max(0, Math.min(100, Number(a.progress) || 0))
    return acc
  }, { weight: 0, progress: 0 })
  return {
    lookaheadDays,
    progressPct: weighted.weight ? Math.round(weighted.progress / weighted.weight) : 0,
    totalActivities: activities.length,
    complete: activities.filter(a => a.status === 'complete').length,
    overdue: overdue.length,
    blocked: blocked.length,
    lookaheadCount: lookahead.length,
    lookahead,
    overdueActivities: overdue,
    dependencyViolations: violations,
    criticalPath: cpm,
  }
}

function wouldCreateCycle(activities = [], dependencies = [], candidate) {
  return calculateCriticalPath(activities, [...dependencies, candidate]).hasCycle
}

module.exports = { DAY_MS, daysBetween, calculateCriticalPath, dependencyViolations, programmeSummary, wouldCreateCycle }
