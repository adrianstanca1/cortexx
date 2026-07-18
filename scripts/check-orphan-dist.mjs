#!/usr/bin/env node
/**
 * check-orphan-dist.mjs — orphaned dist/ detector
 *
 * Every file in dist/ MUST be produced by the lib/ → dist/ build (build-dist.js):
 *   • lib/*.jsx  → dist/<name>.js   (Babel-compiled)
 *   • lib/*.js   → dist/<name>.js   (copied verbatim)
 *
 * An "orphan" is a dist/*.js (or dist/*.ts / dist/*.jsx) that has no matching
 * lib source. Orphans are dangerous because they are served live at
 * cortexbuildpro.com but are not regenerated from any tracked source — a stale
 * or accidentally-committed module can shadow the real code.
 *
 * This script mirrors build-dist.js's orphan decision so it can run standalone
 * (e.g. in CI or as a pre-commit guard) without invoking the full Babel build.
 *
 * Usage:
 *   node scripts/check-orphan-dist.mjs            # exit 0 = clean, 1 = orphans
 *   node scripts/check-orphan-dist.mjs --json     # emit a JSON report
 *
 * Exit codes:
 *   0  no orphans
 *   1  one or more orphans found (prints them)
 *   2  usage / filesystem error
 */
import { readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO = resolve(process.cwd());
const LIB = join(REPO, 'lib');
const DIST = join(REPO, 'dist');

// Same predicate build-dist.js uses for "is this a source-like dist entry that
// must have a lib twin". Anything matching true with no lib source is an orphan.
const isSourceLikeDistEntry = (name) =>
  !name.startsWith('.') &&
  (name === '_manifest.json' || (/\.(js|jsx|ts)$/.test(name)));

// The dist filename a given lib source file produces.
function distNameFor(libName) {
  return libName.endsWith('.jsx') ? libName.replace(/\.jsx$/, '.js') : libName;
}

function expectedDistNames() {
  const set = new Set();
  if (!existsSync(LIB)) return set;
  for (const f of readdirSync(LIB)) {
    if (/\.(js|jsx)$/.test(f)) set.add(distNameFor(f));
  }
  return set;
}

function main() {
  if (!existsSync(DIST)) {
    console.log('[check-orphan-dist] dist/ does not exist — nothing to check.');
    process.exit(0);
  }
  const expected = expectedDistNames();
  const orphans = [];
  for (const d of readdirSync(DIST)) {
    if (isSourceLikeDistEntry(d) && !expected.has(d)) {
      orphans.push(d);
    }
  }
  if (orphans.length === 0) {
    console.log(`[check-orphan-dist] OK — ${expected.size} expected dist module(s); no orphaned dist/*.js found.`);
    if (process.argv.includes('--json')) {
      process.stdout.write(JSON.stringify({ ok: true, orphaned: [] }) + '\n');
    }
    process.exit(0);
  }
  console.error(`[check-orphan-dist] FAIL — ${orphans.length} orphaned dist file(s) with no lib/ source:`);
  for (const o of orphans) console.error(`  - ${o}`);
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify({ ok: false, orphaned: orphans }) + '\n');
  }
  process.exit(1);
}

main();
