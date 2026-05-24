/**
 * Unit tests for pure helper logic in /api routes that previously had no
 * direct coverage. Pure functions only — no DB / framework calls.
 *
 * Covered:
 *   - app/api/rfis/route.ts      → RFI-NNN per-project number sequencing
 *   - app/api/weather/route.ts   → pickIcon condition matching
 *
 * Run with:  npm test
 */
const test = require('node:test')
const assert = require('node:assert/strict')

// ─── RFI numbering ────────────────────────────────────────────────────

// Mirror of the per-project RFI numbering logic in app/api/rfis/route.ts.
function nextRfiNumber(lastNumber) {
  const parsed = lastNumber ? parseInt(lastNumber.split('-').pop() || '0', 10) : 0
  const lastNum = Number.isFinite(parsed) ? parsed : 0
  return `RFI-${String(lastNum + 1).padStart(3, '0')}`
}

test('RFI number — first RFI for a project is RFI-001', () => {
  assert.equal(nextRfiNumber(null), 'RFI-001')
  assert.equal(nextRfiNumber(undefined), 'RFI-001')
})

test('RFI number — increments from existing', () => {
  assert.equal(nextRfiNumber('RFI-001'), 'RFI-002')
  assert.equal(nextRfiNumber('RFI-042'), 'RFI-043')
})

test('RFI number — pads to 3 digits', () => {
  assert.equal(nextRfiNumber('RFI-008'), 'RFI-009')
  assert.equal(nextRfiNumber('RFI-099'), 'RFI-100')
})

test('RFI number — handles 4+ digit numbers without truncation', () => {
  assert.equal(nextRfiNumber('RFI-999'), 'RFI-1000')
  assert.equal(nextRfiNumber('RFI-1234'), 'RFI-1235')
})

test('RFI number — broken/garbled input falls back to 1', () => {
  assert.equal(nextRfiNumber('NOTANUMBER'), 'RFI-001')
  assert.equal(nextRfiNumber('RFI-'), 'RFI-001')
  assert.equal(nextRfiNumber(''), 'RFI-001')
})

// ─── Weather pickIcon ─────────────────────────────────────────────────

// Mirror of the condition→icon match in app/api/weather/route.ts.
// Order matters — substring matches are first-wins.
const CONDITION_ICON = {
  sunny: '☀️',
  clear: '☀️',
  partly: '⛅',
  cloudy: '☁️',
  overcast: '☁️',
  mist: '🌫️',
  fog: '🌫️',
  rain: '🌧️',     // matches before drizzle / shower
  drizzle: '🌦️',
  shower: '🌦️',
  snow: '❄️',
  sleet: '🌨️',
  thunder: '⛈️',
  hail: '🌨️',
}

function pickIcon(desc) {
  const lc = String(desc).toLowerCase()
  for (const [key, icon] of Object.entries(CONDITION_ICON)) {
    if (lc.includes(key)) return icon
  }
  return '🌤️'
}

test('weather pickIcon — exact condition match', () => {
  assert.equal(pickIcon('Sunny'), '☀️')
  assert.equal(pickIcon('cloudy'), '☁️')
  assert.equal(pickIcon('Heavy rain'), '🌧️')
})

test('weather pickIcon — substring match', () => {
  assert.equal(pickIcon('Light drizzle showers'), '🌦️') // drizzle matches before shower (both same icon anyway)
  assert.equal(pickIcon('Patchy thunder storm'), '⛈️')
})

test('weather pickIcon — case insensitive', () => {
  assert.equal(pickIcon('SUNNY'), '☀️')
  assert.equal(pickIcon('Sunny'), '☀️')
  assert.equal(pickIcon('sunny'), '☀️')
})

test('weather pickIcon — unknown condition uses fallback', () => {
  assert.equal(pickIcon('Volcanic eruption'), '🌤️')
  assert.equal(pickIcon(''), '🌤️')
})

test('weather pickIcon — handles non-string gracefully', () => {
  assert.equal(pickIcon(undefined), '🌤️')
  assert.equal(pickIcon(null), '🌤️')
  assert.equal(pickIcon(42), '🌤️')
})

test('weather pickIcon — first-match wins (rain before drizzle in iteration order)', () => {
  // The implementation iterates CONDITION_ICON in declaration order, and
  // 'rain' is declared before 'drizzle'. A string containing both
  // matches rain first.
  assert.equal(pickIcon('Light drizzle with rain'), '🌧️')
})
