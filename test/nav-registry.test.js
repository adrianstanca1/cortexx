/**
 * Navigation coverage CI gate — the SPA's hand-wired `cortexxNav` router.
 *
 * Context: `window.cortexxNav(key)` (lib/app-main.jsx, the `key === 'X'` chain)
 * special-cases ~19 keys, then falls through to `else { setSheet(key) }`. Sheets
 * only render when app-main.jsx has a `{sheet === 'X' && <Component/>}` block.
 * A navigation target is DANGLING when a `cortexxNav('X')` call site exists but
 * neither a render block (`sheet === 'X'`) nor a special-case (`key === 'X'`)
 * is defined — i.e. navigating there sets `sheet` to a key with no UI, so the
 * user sees nothing.
 *
 * This test enumerates every `cortexxNav('X')` literal across lib/ and asserts
 * each target is covered by a render block OR a special-case in app-main.jsx.
 *
 * It is written TDD-RED: before the registry fix, `invoices` and `scheduletalk`
 * are dangling and this test FAILS. After the fix it PASSES. Re-run as a CI gate:
 *
 *   node --test test/nav-registry.test.js
 *   # or: npm run test:nav
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const LIB = path.join(REPO, 'lib');
const APP_MAIN = path.join(LIB, 'app-main.jsx');

// Enumerate every `cortexxNav('X')` literal call site across lib/.
function navTargets() {
  const raw = execSync(
    `grep -rhoE "cortexxNav\\('[a-zA-Z0-9_-]+'"`,
    { cwd: LIB, encoding: 'utf8' }
  );
  const keys = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^cortexxNav\('/, '').replace(/'$/, ''));
  return [...new Set(keys)].sort();
}

// Render-block keys: `sheet === 'X' && <Component/>` in app-main.jsx.
function renderBlockKeys(src) {
  const keys = new Set();
  const re = /sheet\s*===\s*'([a-zA-Z0-9_-]+)'\s*&&/g;
  let m;
  while ((m = re.exec(src)) !== null) keys.add(m[1]);
  return keys;
}

// Special-cased keys inside the `window.cortexxNav` definition: `key === 'X'`.
function specialCaseKeys(src) {
  const keys = new Set();
  const re = /key\s*===\s*'([a-zA-Z0-9_-]+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) keys.add(m[1]);
  return keys;
}

const TARGETS = navTargets();
const APP_SRC = fs.readFileSync(APP_MAIN, 'utf8');
const RENDER = renderBlockKeys(APP_SRC);
const SPECIAL = specialCaseKeys(APP_SRC);

test('nav audit — discovered every cortexxNav call site (75 unique targets)', () => {
  assert.ok(TARGETS.length >= 70, `expected ~75 nav targets, got ${TARGETS.length}`);
  assert.ok(TARGETS.includes('invoices'), "nav audit must include 'invoices' target");
  assert.ok(TARGETS.includes('scheduletalk'), "nav audit must include 'scheduletalk' target");
});

test('nav coverage — every cortexxNav target resolves to a render block or special-case', () => {
  const dangling = TARGETS.filter((t) => !RENDER.has(t) && !SPECIAL.has(t));
  assert.deepEqual(
    dangling,
    [],
    `Dangling nav targets (navigate to a key with no render block and no special-case): ${JSON.stringify(dangling)}`
  );
});

// Pin the two known historical danglers so a regression is impossible to miss.
test('nav coverage — the previously-dangling targets are now wired', () => {
  // `invoices` must route to the subcontractor invoices screen (subinvoices).
  assert.ok(
    SPECIAL.has('invoices') || RENDER.has('invoices'),
    "'invoices' must be covered by a special-case or a render block"
  );
  // `scheduletalk` must route to the toolbox-talk sheet (toolboxtalk).
  assert.ok(
    SPECIAL.has('scheduletalk') || RENDER.has('scheduletalk'),
    "'scheduletalk' must be covered by a special-case or a render block"
  );
});
