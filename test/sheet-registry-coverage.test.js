/**
 * Sheet-registry coverage test (item 11 of the self-improvement loop).
 *
 * Every navigation key that can be dispatched — via `cortexxNav('KEY')` or
 * `setSheet('KEY')` — MUST exist as a key in lib/sheet-registry.jsx's
 * SHEET_REGISTRY. Otherwise the dispatcher renders nothing (a silent dead
 * navigation). This test statically parses lib/ to enforce that invariant,
 * strengthening the guard added in the earlier nav-registry stream.
 *
 * Static parsing (regex over source text) is used instead of executing the
 * .jsx modules, which contain JSX and can't be required directly in Node.
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const REPO = path.resolve(__dirname, '..')
const LIB = path.join(REPO, 'lib')

function read(p) { return fs.readFileSync(p, 'utf8') }

// Extract SHEET_REGISTRY keys from sheet-registry.jsx (depth-aware so nested
// objects inside entries aren't mistaken for top-level keys).
function registryKeys() {
  const src = read(path.join(LIB, 'sheet-registry.jsx'))
  const start = src.indexOf('SHEET_REGISTRY')
  const open = src.indexOf('{', start)
  const keys = new Set()
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const ch = src[i]
    if (ch === '{') { depth++; continue }
    if (ch === '}') { depth--; if (depth === 0) break; continue }
    // At depth 1, a key is 'name': followed by {
    if (depth === 1 && ch === "'") {
      const end = src.indexOf("'", i + 1)
      if (end === -1) break
      const key = src.slice(i + 1, end)
      // confirm it's followed by ':' and '{'
      const rest = src.slice(end + 1, end + 6)
      if (/^\s*:\s*\{/.test(rest)) keys.add(key)
      i = end
    }
  }
  return keys
}

// Dispatched nav keys that are legacy aliases (remapped in app-main.jsx with a
// warn guard) — intentionally absent from the registry. Mirrors the drift
// guard's KNOWN_GAPS allowlist.
const LEGACY_NAV_ALIASES = new Set(['invoices', 'scheduletalk'])

// Extract every cortexxNav('X') and setSheet('X') key referenced across lib/.
function dispatchedKeys() {
  const keys = new Set()
  const files = fs.readdirSync(LIB).filter(f => /\.(jsx|js)$/.test(f))
  const re = /(?:cortexxNav|setSheet)\(\s*'([a-zA-Z0-9_-]+)'\s*\)/g
  for (const f of files) {
    const src = read(path.join(LIB, f))
    let m
    while ((m = re.exec(src)) !== null) keys.add(m[1])
  }
  return keys
}

test('every dispatched nav key exists in SHEET_REGISTRY', () => {
  const registry = registryKeys()
  const dispatched = dispatchedKeys()
  assert.ok(registry.size > 0, 'SHEET_REGISTRY must contain entries')
  assert.ok(dispatched.size > 0, 'lib/ must dispatch at least one nav key')
  const missing = [...dispatched]
    .filter(k => !registry.has(k))
    .filter(k => !LEGACY_NAV_ALIASES.has(k))
    .sort()
  assert.deepEqual(missing, [],
    `dispatched nav key(s) missing from SHEET_REGISTRY: ${missing.join(', ')}`)
})

test('SHEET_REGISTRY is comprehensive (covers the screen surface)', () => {
  const registry = registryKeys()
  // The app has 118 SPA screen modules; the registry should cover the large
  // majority of dispatchable screens. A healthy registry is well over 100 keys.
  assert.ok(registry.size >= 100, `expected >=100 registry entries, got ${registry.size}`)
  // The registry must at least contain its own self-reference surface — verify a
  // few keys that are guaranteed present by construction (project, settings, profile).
  for (const k of ['project', 'settings', 'profile']) {
    assert.ok(registry.has(k), `expected registry to contain '${k}'`)
  }
})
