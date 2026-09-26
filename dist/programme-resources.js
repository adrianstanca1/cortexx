'use strict'

function round(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0
}

function dayKey(value) {
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function eachDay(startValue, endValue, maxDays = 366) {
  const start = new Date(startValue)
  const end = new Date(endValue)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return []
  start.setUTCHours(0, 0, 0, 0); end.setUTCHours(0, 0, 0, 0)
  const out = []
  for (let d = new Date(start); d <= end && out.length < maxDays; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10))
  return out
}

function buildResourceLoad({ activities = [], allocations = [] } = {}) {
  const activityById = new Map(activities.map(a => [a.id, a]))
  const daily = new Map()
  const memberDays = new Map()
  const equipmentDays = new Map()
  const materialTotals = new Map()
  const getDay = date => {
    if (!daily.has(date)) daily.set(date, { date, labourPeople: 0, labourHours: 0, equipmentUnits: 0, materialNeeds: [] })
    return daily.get(date)
  }

  for (const allocation of allocations) {
    const activity = allocation.activity || activityById.get(allocation.activityId)
    if (!activity) continue
    const quantity = Math.max(0, Number(allocation.quantity) || 0)
    const days = eachDay(activity.plannedStart, activity.plannedEnd)
    if (allocation.resourceType === 'labour') {
      const hours = Math.max(0, Number(allocation.hoursPerDay) || 0)
      for (const date of days) {
        const bucket = getDay(date)
        bucket.labourPeople = round(bucket.labourPeople + quantity)
        bucket.labourHours = round(bucket.labourHours + quantity * hours)
        if (allocation.teamMemberId) {
          const key = `${allocation.teamMemberId}:${date}`
          if (!memberDays.has(key)) memberDays.set(key, [])
          memberDays.get(key).push(allocation)
        }
      }
    } else if (allocation.resourceType === 'equipment') {
      for (const date of days) {
        const bucket = getDay(date)
        bucket.equipmentUnits = round(bucket.equipmentUnits + quantity)
        if (allocation.equipmentId) {
          const key = `${allocation.equipmentId}:${date}`
          if (!equipmentDays.has(key)) equipmentDays.set(key, [])
          equipmentDays.get(key).push(allocation)
        }
      }
    } else if (allocation.resourceType === 'material') {
      const date = dayKey(allocation.needBy || activity.plannedStart)
      if (date) getDay(date).materialNeeds.push({ allocationId: allocation.id, materialId: allocation.materialId || null, label: allocation.material?.name || allocation.label || 'Material', quantity: round(quantity), unit: allocation.unit || allocation.material?.unit || 'unit' })
      const key = allocation.materialId || `generic:${allocation.label || allocation.id}`
      if (!materialTotals.has(key)) materialTotals.set(key, { materialId: allocation.materialId || null, label: allocation.material?.name || allocation.label || 'Material', unit: allocation.unit || allocation.material?.unit || 'unit', required: 0, stockLevel: allocation.material ? Number(allocation.material.stockLevel) || 0 : null })
      materialTotals.get(key).required = round(materialTotals.get(key).required + quantity)
    }
  }

  const conflicts = []
  for (const [key, rows] of memberDays) if (rows.length > 1) {
    const date = key.slice(key.lastIndexOf(':') + 1)
    conflicts.push({ type: 'labour_overlap', date, resourceId: rows[0].teamMemberId, resourceName: rows[0].teamMember?.name || rows[0].label || 'Team member', activityIds: [...new Set(rows.map(r => r.activityId))] })
  }
  for (const [key, rows] of equipmentDays) if (rows.length > 1) {
    const date = key.slice(key.lastIndexOf(':') + 1)
    conflicts.push({ type: 'equipment_overlap', date, resourceId: rows[0].equipmentId, resourceName: rows[0].equipment?.name || rows[0].label || 'Equipment', activityIds: [...new Set(rows.map(r => r.activityId))] })
  }
  const shortages = [...materialTotals.values()].filter(row => row.stockLevel !== null && row.required > row.stockLevel).map(row => ({ ...row, shortage: round(row.required - row.stockLevel) }))
  const days = [...daily.values()].sort((a, b) => a.date.localeCompare(b.date))
  return {
    daily: days,
    conflicts,
    materialShortages: shortages,
    peakLabourPeople: Math.max(0, ...days.map(d => d.labourPeople)),
    peakLabourHours: Math.max(0, ...days.map(d => d.labourHours)),
    peakEquipmentUnits: Math.max(0, ...days.map(d => d.equipmentUnits)),
    totalAllocations: allocations.length,
  }
}

module.exports = { round, dayKey, eachDay, buildResourceLoad }
