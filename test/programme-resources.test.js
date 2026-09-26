const test = require('node:test')
const assert = require('node:assert/strict')
const { buildResourceLoad, eachDay } = require('../lib/programme-resources')

const activity = { id: 'a1', plannedStart: new Date('2026-09-28T00:00:00Z'), plannedEnd: new Date('2026-09-30T00:00:00Z') }

test('daily load spreads labour and plant across activity planned dates', () => {
  const out = buildResourceLoad({ activities: [activity], allocations: [
    { id: 'l1', activityId: 'a1', resourceType: 'labour', quantity: 4, hoursPerDay: 8 },
    { id: 'e1', activityId: 'a1', resourceType: 'equipment', quantity: 2 },
  ] })
  assert.equal(out.daily.length, 3)
  assert.equal(out.daily[0].labourPeople, 4)
  assert.equal(out.daily[0].labourHours, 32)
  assert.equal(out.daily[0].equipmentUnits, 2)
  assert.equal(out.peakLabourHours, 32)
})

test('named team member and equipment overlaps are explicit conflicts', () => {
  const a2 = { id: 'a2', plannedStart: new Date('2026-09-29T00:00:00Z'), plannedEnd: new Date('2026-10-01T00:00:00Z') }
  const out = buildResourceLoad({ activities: [activity, a2], allocations: [
    { id: 'l1', activityId: 'a1', resourceType: 'labour', quantity: 1, hoursPerDay: 8, teamMemberId: 'm1', teamMember: { name: 'Alex' } },
    { id: 'l2', activityId: 'a2', resourceType: 'labour', quantity: 1, hoursPerDay: 8, teamMemberId: 'm1', teamMember: { name: 'Alex' } },
    { id: 'e1', activityId: 'a1', resourceType: 'equipment', quantity: 1, equipmentId: 'eq1', equipment: { name: 'Scissor lift' } },
    { id: 'e2', activityId: 'a2', resourceType: 'equipment', quantity: 1, equipmentId: 'eq1', equipment: { name: 'Scissor lift' } },
  ] })
  assert.equal(out.conflicts.filter(x => x.type === 'labour_overlap').length, 2)
  assert.equal(out.conflicts.filter(x => x.type === 'equipment_overlap').length, 2)
})

test('material need is recorded once and stock gap is factual', () => {
  const out = buildResourceLoad({ activities: [activity], allocations: [
    { id: 'm1', activityId: 'a1', resourceType: 'material', quantity: 120, unit: 'm2', needBy: new Date('2026-09-27T00:00:00Z'), materialId: 'mat1', material: { name: 'Insulation', unit: 'm2', stockLevel: 80 } },
  ] })
  assert.equal(out.daily.find(x => x.date === '2026-09-27').materialNeeds[0].quantity, 120)
  assert.deepEqual(out.materialShortages[0], { materialId: 'mat1', label: 'Insulation', unit: 'm2', required: 120, stockLevel: 80, shortage: 40 })
})

test('generic material demand without stock data is not mislabeled as a shortage', () => {
  const out = buildResourceLoad({ activities: [activity], allocations: [{ id: 'm1', activityId: 'a1', resourceType: 'material', quantity: 20, unit: 'packs', label: 'Fixings' }] })
  assert.equal(out.materialShortages.length, 0)
})

test('date expansion is inclusive and safely bounded', () => {
  assert.deepEqual(eachDay('2026-09-28', '2026-09-30'), ['2026-09-28', '2026-09-29', '2026-09-30'])
  assert.equal(eachDay('2026-01-01', '2028-01-01').length, 366)
})
