/**
 * Unit tests for the AI-draft response parser in /api/quotes/draft.
 * The parser is the most fragile piece — local LLMs sometimes wrap JSON
 * in markdown fences or include stray keys.
 *
 * Run with:  npm test
 */
const test = require('node:test')
const assert = require('node:assert/strict')

// Pure mirror of the parsing rules in app/api/quotes/draft/route.ts.
const COMMON_UNITS = ['hour', 'day', 'item', 'm', 'm²', 'm³', 'kg', 'tonne', 'job']
const MAX_ITEMS = 12
const MAX_DESC_LEN = 140

function parseDraftResponse(raw) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    parsed = JSON.parse(cleaned)
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Model did not return a JSON object')
  const rawItems = Array.isArray(parsed.items) ? parsed.items : []
  const items = []
  for (const it of rawItems) {
    if (!it || typeof it !== 'object') continue
    const description = typeof it.description === 'string' ? it.description.trim().slice(0, MAX_DESC_LEN) : ''
    if (!description) continue
    const quantity = Math.max(0.1, Math.min(10000, Number(it.quantity) || 1))
    let unit = typeof it.unit === 'string' ? it.unit.trim().toLowerCase() : 'item'
    if (!COMMON_UNITS.includes(unit)) unit = 'item'
    const unitPrice = Math.max(0, Math.min(1_000_000, Number(it.unitPrice ?? it.unit_price) || 0))
    items.push({ description, quantity, unit, unitPrice })
    if (items.length >= MAX_ITEMS) break
  }
  if (items.length === 0) throw new Error('Model did not return any usable line items')
  return { items, notes: typeof parsed.notes === 'string' ? parsed.notes.trim().slice(0, 280) : undefined }
}

test('parser — accepts clean JSON', () => {
  const out = parseDraftResponse('{"items":[{"description":"Excavation","quantity":10,"unit":"m³","unitPrice":85}]}')
  assert.equal(out.items.length, 1)
  assert.equal(out.items[0].description, 'Excavation')
  assert.equal(out.items[0].unit, 'm³')
  assert.equal(out.items[0].unitPrice, 85)
})

test('parser — strips markdown fences (```json ... ```)', () => {
  const raw = '```json\n{"items":[{"description":"Brickwork","quantity":50,"unit":"m²","unitPrice":120}]}\n```'
  const out = parseDraftResponse(raw)
  assert.equal(out.items.length, 1)
  assert.equal(out.items[0].description, 'Brickwork')
})

test('parser — strips plain ``` fences', () => {
  const raw = '```\n{"items":[{"description":"Skip hire","quantity":1,"unit":"item","unitPrice":280}]}\n```'
  const out = parseDraftResponse(raw)
  assert.equal(out.items[0].unitPrice, 280)
})

test('parser — falls back to unit:"item" when model returns an unknown unit', () => {
  const raw = '{"items":[{"description":"Labour","quantity":2,"unit":"weeks","unitPrice":2400}]}'
  const out = parseDraftResponse(raw)
  assert.equal(out.items[0].unit, 'item')
})

test('parser — accepts both unitPrice and unit_price keys', () => {
  const raw = '{"items":[{"description":"Plaster","quantity":40,"unit":"m²","unit_price":18}]}'
  const out = parseDraftResponse(raw)
  assert.equal(out.items[0].unitPrice, 18)
})

test('parser — drops items with empty descriptions', () => {
  const raw = '{"items":[{"description":"","quantity":1,"unit":"item","unitPrice":10},{"description":"Valid","quantity":1,"unit":"item","unitPrice":20}]}'
  const out = parseDraftResponse(raw)
  assert.equal(out.items.length, 1)
  assert.equal(out.items[0].description, 'Valid')
})

test('parser — trims long descriptions to MAX_DESC_LEN', () => {
  const long = 'x'.repeat(200)
  const raw = JSON.stringify({ items: [{ description: long, quantity: 1, unit: 'item', unitPrice: 1 }] })
  const out = parseDraftResponse(raw)
  assert.equal(out.items[0].description.length, MAX_DESC_LEN)
})

test('parser — clamps quantity and unitPrice to safe ranges', () => {
  const raw = JSON.stringify({ items: [
    { description: 'Tiny', quantity: -5, unit: 'item', unitPrice: -10 },
    { description: 'Huge', quantity: 99999999, unit: 'item', unitPrice: 99999999 },
  ] })
  const out = parseDraftResponse(raw)
  assert.equal(out.items[0].quantity, 0.1)   // floor
  assert.equal(out.items[0].unitPrice, 0)    // floor (negative → 0)
  assert.equal(out.items[1].quantity, 10000) // ceil
  assert.equal(out.items[1].unitPrice, 1_000_000) // ceil
})

test('parser — caps total items at MAX_ITEMS', () => {
  const items = Array.from({ length: 30 }, (_, i) => ({ description: `Item ${i}`, quantity: 1, unit: 'item', unitPrice: 1 }))
  const out = parseDraftResponse(JSON.stringify({ items }))
  assert.equal(out.items.length, MAX_ITEMS)
})

test('parser — throws when no usable items remain', () => {
  assert.throws(() => parseDraftResponse('{"items":[]}'), /any usable/)
  assert.throws(() => parseDraftResponse('{"items":[{"description":"","quantity":1}]}'), /any usable/)
})

test('parser — throws on non-JSON garbage', () => {
  assert.throws(() => parseDraftResponse('not json at all'))
})

test('parser — extracts optional notes', () => {
  const raw = '{"items":[{"description":"X","quantity":1,"unit":"item","unitPrice":10}],"notes":"Assumes existing foundations are sound."}'
  const out = parseDraftResponse(raw)
  assert.equal(out.notes, 'Assumes existing foundations are sound.')
})

test('parser — trims notes to 280 chars', () => {
  const longNote = 'A'.repeat(400)
  const raw = JSON.stringify({ items: [{ description: 'X', quantity: 1, unit: 'item', unitPrice: 1 }], notes: longNote })
  const out = parseDraftResponse(raw)
  assert.equal(out.notes.length, 280)
})
