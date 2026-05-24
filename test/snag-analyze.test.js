/**
 * Unit tests for the vision-response parser in /api/snags/[id]/analyze.
 * Pure mirror of the parsing rules in the route — kept in sync.
 *
 * Run with:  npm test
 */
const test = require('node:test')
const assert = require('node:assert/strict')

const SEVERITIES = ['cosmetic', 'minor', 'major', 'safety']
const MAX_DEFECTS = 12
const MAX_DESC = 280

function parseVisionResponse(raw) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    parsed = JSON.parse(cleaned)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not a JSON object')
  const rawDefects = Array.isArray(parsed.defects) ? parsed.defects : []
  const defects = []
  for (const d of rawDefects) {
    if (!d || typeof d !== 'object') continue
    const description = typeof d.description === 'string' ? d.description.trim().slice(0, MAX_DESC) : ''
    if (!description) continue
    let severity = 'minor'
    if (typeof d.severity === 'string') {
      const s = d.severity.trim().toLowerCase()
      if (SEVERITIES.includes(s)) severity = s
    }
    const location = typeof d.location === 'string' ? d.location.trim().slice(0, 120) : undefined
    defects.push(location ? { description, severity, location } : { description, severity })
    if (defects.length >= MAX_DEFECTS) break
  }
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 400) : 'No summary provided.'
  const notes = typeof parsed.notes === 'string' ? parsed.notes.trim().slice(0, 280) : undefined
  return { defects, summary, notes }
}

test('parser — clean JSON with all fields', () => {
  const raw = JSON.stringify({
    defects: [
      { description: 'Visible crack in plasterboard', severity: 'major', location: 'top-right corner' },
      { description: 'Paint scuff', severity: 'cosmetic' },
    ],
    summary: 'One major and one cosmetic defect visible',
    notes: 'Lighting in the photo is poor; recommend re-photographing',
  })
  const out = parseVisionResponse(raw)
  assert.equal(out.defects.length, 2)
  assert.equal(out.defects[0].severity, 'major')
  assert.equal(out.defects[0].location, 'top-right corner')
  assert.equal(out.defects[1].location, undefined)
  assert.equal(out.summary, 'One major and one cosmetic defect visible')
  assert.match(out.notes, /Lighting/)
})

test('parser — falls back to default severity on unknown value', () => {
  const out = parseVisionResponse(JSON.stringify({ defects: [{ description: 'X', severity: 'CATASTROPHIC' }] }))
  assert.equal(out.defects[0].severity, 'minor')
})

test('parser — accepts severity case-insensitively', () => {
  const out = parseVisionResponse(JSON.stringify({ defects: [{ description: 'X', severity: 'SAFETY' }] }))
  assert.equal(out.defects[0].severity, 'safety')
})

test('parser — drops entries without description', () => {
  const out = parseVisionResponse(JSON.stringify({ defects: [
    { description: '', severity: 'major' },
    { severity: 'minor' },
    { description: 'kept', severity: 'cosmetic' },
  ] }))
  assert.equal(out.defects.length, 1)
  assert.equal(out.defects[0].description, 'kept')
})

test('parser — trims long descriptions to 280 chars', () => {
  const long = 'x'.repeat(500)
  const out = parseVisionResponse(JSON.stringify({ defects: [{ description: long, severity: 'minor' }] }))
  assert.equal(out.defects[0].description.length, MAX_DESC)
})

test('parser — caps total defects at 12', () => {
  const defects = Array.from({ length: 30 }, (_, i) => ({ description: `D${i}`, severity: 'minor' }))
  const out = parseVisionResponse(JSON.stringify({ defects }))
  assert.equal(out.defects.length, MAX_DEFECTS)
})

test('parser — strips markdown fences', () => {
  const raw = '```json\n{"defects":[{"description":"Tile gap","severity":"minor"}],"summary":"Tile gap visible"}\n```'
  const out = parseVisionResponse(raw)
  assert.equal(out.defects.length, 1)
  assert.equal(out.defects[0].description, 'Tile gap')
})

test('parser — empty defects array + summary still parses (good photo)', () => {
  const out = parseVisionResponse(JSON.stringify({ defects: [], summary: 'Tidy site, no defects visible.' }))
  assert.equal(out.defects.length, 0)
  assert.equal(out.summary, 'Tidy site, no defects visible.')
})

test('parser — missing summary uses default', () => {
  const out = parseVisionResponse(JSON.stringify({ defects: [{ description: 'X', severity: 'minor' }] }))
  assert.equal(out.summary, 'No summary provided.')
})

test('parser — non-object location ignored', () => {
  const out = parseVisionResponse(JSON.stringify({ defects: [{ description: 'X', severity: 'minor', location: 42 }] }))
  assert.equal(out.defects[0].location, undefined)
})

test('parser — throws on garbage input', () => {
  assert.throws(() => parseVisionResponse('not json at all'))
})

test('parser — throws on non-object JSON', () => {
  assert.throws(() => parseVisionResponse('["array", "not", "object"]'), /not a JSON object/)
})
