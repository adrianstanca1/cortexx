/**
 * Unit tests for the vision-response parsers in:
 *   - /api/documents/[id]/tag       (photo classification)
 *   - /api/photos/compare           (two-image change description)
 *   - /api/drawings/[id]/compare    (revision design diff)
 *
 * Pure mirrors of the parsers in each route — kept in sync.
 *
 * Run with:  npm test
 */
const test = require('node:test')
const assert = require('node:assert/strict')

// ─── /api/documents/[id]/tag ──────────────────────────────────────────

const TAG_CATEGORIES = ['foundation', 'groundwork', 'steel', 'concrete', 'brickwork', 'roofing', 'electrical', 'plumbing', 'plastering', 'flooring', 'joinery', 'tiling', 'painting', 'glazing', 'landscaping', 'snagging', 'safety', 'progress', 'site_setup', 'other']

function parseTagResponse(raw) {
  let parsed
  try { parsed = JSON.parse(raw) }
  catch { parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()) }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not a JSON object')
  const rawTags = Array.isArray(parsed.tags) ? parsed.tags : []
  const seen = new Set()
  const tags = []
  for (const t of rawTags) {
    if (typeof t !== 'string') continue
    const trimmed = t.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 40)
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    tags.push(trimmed)
    if (tags.length >= 8) break
  }
  let category = 'other'
  if (typeof parsed.category === 'string') {
    const c = parsed.category.trim().toLowerCase()
    if (TAG_CATEGORIES.includes(c)) category = c
  }
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 280) : 'No summary provided.'
  return { tags, category, summary }
}

test('tag parser — clean response', () => {
  const out = parseTagResponse(JSON.stringify({
    tags: ['rebar', 'concrete_pour', 'wet'],
    category: 'foundation',
    summary: 'Freshly-poured slab with rebar visible.',
  }))
  assert.deepEqual(out.tags, ['rebar', 'concrete_pour', 'wet'])
  assert.equal(out.category, 'foundation')
})

test('tag parser — normalises spaces and case in tags', () => {
  const out = parseTagResponse(JSON.stringify({ tags: ['Rebar  Cage', 'CONCRETE Pour'] }))
  assert.deepEqual(out.tags, ['rebar_cage', 'concrete_pour'])
})

test('tag parser — dedupes tags', () => {
  const out = parseTagResponse(JSON.stringify({ tags: ['rebar', 'rebar', 'REBAR', 'concrete'] }))
  assert.equal(out.tags.length, 2)
})

test('tag parser — caps at 8 tags', () => {
  const out = parseTagResponse(JSON.stringify({ tags: Array.from({ length: 20 }, (_, i) => `tag${i}`) }))
  assert.equal(out.tags.length, 8)
})

test('tag parser — falls back to "other" on unknown category', () => {
  const out = parseTagResponse(JSON.stringify({ tags: ['x'], category: 'demolition_2_electric_boogaloo' }))
  assert.equal(out.category, 'other')
})

test('tag parser — strips markdown fences', () => {
  const out = parseTagResponse('```json\n{"tags":["bricks"],"category":"brickwork"}\n```')
  assert.equal(out.tags[0], 'bricks')
})

test('tag parser — drops non-string tag entries', () => {
  const out = parseTagResponse(JSON.stringify({ tags: ['valid', 42, null, { hi: 1 }, 'also_valid'] }))
  assert.deepEqual(out.tags, ['valid', 'also_valid'])
})

// ─── /api/photos/compare ─────────────────────────────────────────────

const PROGRESS_VALUES = ['progressed', 'reversed', 'stalled', 'unrelated']

function parseCompareResponse(raw) {
  let parsed
  try { parsed = JSON.parse(raw) }
  catch { parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()) }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not a JSON object')
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 400) : 'No summary provided.'
  const rawChanges = Array.isArray(parsed.changes) ? parsed.changes : []
  const changes = []
  for (const c of rawChanges) {
    if (typeof c !== 'string') continue
    const trimmed = c.trim().slice(0, 280)
    if (!trimmed) continue
    changes.push(trimmed)
    if (changes.length >= 10) break
  }
  let progress = 'unrelated'
  if (typeof parsed.progress === 'string') {
    const p = parsed.progress.trim().toLowerCase()
    if (PROGRESS_VALUES.includes(p)) progress = p
  }
  return { summary, changes, progress }
}

test('photo-compare parser — full success', () => {
  const out = parseCompareResponse(JSON.stringify({
    summary: 'Roof structure now complete; was just rafters before.',
    changes: ['Roof tiles laid', 'Skip removed', 'Scaffold partially down'],
    progress: 'progressed',
  }))
  assert.equal(out.summary, 'Roof structure now complete; was just rafters before.')
  assert.equal(out.changes.length, 3)
  assert.equal(out.progress, 'progressed')
})

test('photo-compare parser — caps changes at 10', () => {
  const out = parseCompareResponse(JSON.stringify({ changes: Array.from({ length: 25 }, (_, i) => `Change ${i}`) }))
  assert.equal(out.changes.length, 10)
})

test('photo-compare parser — unknown progress → unrelated', () => {
  const out = parseCompareResponse(JSON.stringify({ progress: 'maybe_idk' }))
  assert.equal(out.progress, 'unrelated')
})

test('photo-compare parser — drops empty / non-string changes', () => {
  const out = parseCompareResponse(JSON.stringify({ changes: ['real', '', '   ', 42, 'also real'] }))
  assert.equal(out.changes.length, 2)
})

// ─── /api/drawings/[id]/compare ──────────────────────────────────────

const SEVERITIES = ['minor', 'moderate', 'major']
const AFFECTS = ['structural', 'mep', 'finishes', 'layout', 'annotation', 'other']

function parseRevCompareResponse(raw) {
  let parsed
  try { parsed = JSON.parse(raw) }
  catch { parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()) }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not a JSON object')
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 400) : 'No summary provided.'
  const rawChanges = Array.isArray(parsed.changes) ? parsed.changes : []
  const changes = []
  for (const c of rawChanges) {
    if (!c || typeof c !== 'object') continue
    const description = typeof c.description === 'string' ? c.description.trim().slice(0, 280) : ''
    if (!description) continue
    let severity = 'moderate'
    if (typeof c.severity === 'string') {
      const s = c.severity.trim().toLowerCase()
      if (SEVERITIES.includes(s)) severity = s
    }
    let affects
    if (typeof c.affects === 'string') {
      const a = c.affects.trim().toLowerCase()
      if (AFFECTS.includes(a)) affects = a
    }
    changes.push(affects ? { description, severity, affects } : { description, severity })
    if (changes.length >= 12) break
  }
  let designIntent = 'unclear'
  if (typeof parsed.designIntent === 'string') {
    const d = parsed.designIntent.trim().toLowerCase()
    if (d === 'preserved' || d === 'modified') designIntent = d
  }
  const reviewRecommended = typeof parsed.reviewRecommended === 'boolean'
    ? parsed.reviewRecommended
    : changes.some(c => c.severity === 'major') || designIntent === 'modified'
  return { summary, changes, designIntent, reviewRecommended }
}

test('drawing-compare parser — affects whitelist applied', () => {
  const out = parseRevCompareResponse(JSON.stringify({
    changes: [
      { description: 'Beam size updated', severity: 'major', affects: 'STRUCTURAL' },
      { description: 'Note added', severity: 'minor', affects: 'random_bucket' },
    ],
  }))
  assert.equal(out.changes[0].affects, 'structural')
  assert.equal(out.changes[1].affects, undefined)
})

test('drawing-compare parser — reviewRecommended auto-true on major', () => {
  const out = parseRevCompareResponse(JSON.stringify({
    changes: [{ description: 'Removed load-bearing wall', severity: 'major' }],
    designIntent: 'modified',
  }))
  assert.equal(out.reviewRecommended, true)
})

test('drawing-compare parser — reviewRecommended auto-true on modified intent alone', () => {
  const out = parseRevCompareResponse(JSON.stringify({
    changes: [{ description: 'Minor relocation', severity: 'moderate' }],
    designIntent: 'modified',
  }))
  assert.equal(out.reviewRecommended, true)
})

test('drawing-compare parser — reviewRecommended false when preserved + only minor', () => {
  const out = parseRevCompareResponse(JSON.stringify({
    changes: [{ description: 'Annotation tightened', severity: 'minor' }],
    designIntent: 'preserved',
  }))
  assert.equal(out.reviewRecommended, false)
})

test('drawing-compare parser — explicit reviewRecommended=false wins over heuristic', () => {
  const out = parseRevCompareResponse(JSON.stringify({
    changes: [{ description: 'Big change', severity: 'major' }],
    designIntent: 'modified',
    reviewRecommended: false,
  }))
  assert.equal(out.reviewRecommended, false)
})

test('drawing-compare parser — caps changes at 12', () => {
  const changes = Array.from({ length: 30 }, (_, i) => ({ description: `Change ${i}`, severity: 'moderate' }))
  const out = parseRevCompareResponse(JSON.stringify({ changes }))
  assert.equal(out.changes.length, 12)
})

test('drawing-compare parser — unknown severity falls back to moderate', () => {
  const out = parseRevCompareResponse(JSON.stringify({ changes: [{ description: 'X', severity: 'KABOOM' }] }))
  assert.equal(out.changes[0].severity, 'moderate')
})

// ─── shared: all parsers reject array-as-root ────────────────────────

test('all 3 parsers reject array root', () => {
  for (const parser of [parseTagResponse, parseCompareResponse, parseRevCompareResponse]) {
    assert.throws(() => parser('[]'), /not a JSON object/)
    assert.throws(() => parser('["a","b"]'), /not a JSON object/)
  }
})

test('all 3 parsers reject garbage', () => {
  for (const parser of [parseTagResponse, parseCompareResponse, parseRevCompareResponse]) {
    assert.throws(() => parser('not json at all'))
  }
})
