#!/usr/bin/env node
/**
 * Cortexx — single source-of-truth build:  lib/ → dist/
 *
 * This is the ONLY dist builder. `npm run precompile` calls it (and precompile
 * is what `postinstall` and `npm run build` run), so every path produces the
 * same deterministic output and `--check` can never disagree with a real build.
 *
 * Rules:
 *   • lib/*.jsx  → Babel (classic React runtime, comments stripped) → dist/*.js
 *   • lib/*.js   → copied verbatim → dist/*.js   (already browser-ready)
 *   • lib/*.ts and everything else → NOT emitted. Those are server-only modules;
 *     shipping them into dist/ would publish server source on the live site.
 *   • dist/ is pruned: any *.js/*.ts/*.jsx (or legacy _manifest.json) with no
 *     corresponding lib source is deleted.
 *
 * Usage:
 *   node build-dist.js          # build dist/ (write changed files, prune orphans)
 *   node build-dist.js --check  # verify dist/ matches lib/ byte-for-byte; exit 1 on drift
 *
 * Prereq: npm install --save-dev @babel/core @babel/preset-react
 */

const fs = require('fs');
const path = require('path');

let babel;
try { babel = require('@babel/core'); }
catch (e) {
  console.error('Missing @babel/core. Install with:');
  console.error('  npm install --save-dev @babel/core @babel/preset-react');
  process.exit(2);
}

const LIB = path.join(__dirname, 'lib');
const DIST = path.join(__dirname, 'dist');
const CHECK_ONLY = process.argv.includes('--check');

// Fixed options — the single transform every build path shares.
const BABEL_OPTS = {
  presets: [['@babel/preset-react', { runtime: 'classic' }]],
  compact: false,
  comments: false,
  babelrc: false,
  configFile: false,
};

// The exact bytes dist/<out> must contain for a given lib source file.
function render(file, src) {
  if (file.endsWith('.jsx')) return babel.transformSync(src, BABEL_OPTS).code;
  return src; // plain .js — verbatim
}

// Build the map of expected dist outputs from lib/ (only .js and .jsx ship).
const expected = new Map(); // distFileName -> bytes
for (const f of fs.readdirSync(LIB)) {
  if (!/\.(js|jsx)$/.test(f)) continue; // .ts etc. are server-only — never ship
  const out = f.endsWith('.jsx') ? f.replace(/\.jsx$/, '.js') : f;
  expected.set(out, render(f, fs.readFileSync(path.join(LIB, f), 'utf8')));
}

// A dist entry is prunable if it looks like source but no lib file produces it.
const isPrunableOrphan = (name) =>
  !name.startsWith('.') &&
  (name === '_manifest.json' || (/\.(js|jsx|ts)$/.test(name) && !expected.has(name)));

if (CHECK_ONLY) {
  const problems = [];
  for (const [out, bytes] of expected) {
    const p = path.join(DIST, out);
    if (!fs.existsSync(p)) problems.push('missing: ' + out);
    else if (fs.readFileSync(p, 'utf8') !== bytes) problems.push('stale:   ' + out);
  }
  if (fs.existsSync(DIST)) {
    for (const d of fs.readdirSync(DIST)) {
      if (isPrunableOrphan(d)) problems.push('orphan:  ' + d);
    }
  }
  if (problems.length === 0) {
    console.log('✓ dist/ is in sync with lib/ (' + expected.size + ' modules)');
    process.exit(0);
  }
  console.log('✗ ' + problems.length + ' issue(s) — run `node build-dist.js` to fix:');
  problems.forEach(p => console.log('  - ' + p));
  process.exit(1);
}

// ── Build ────────────────────────────────────────────────────────────
if (!fs.existsSync(DIST)) fs.mkdirSync(DIST);

let written = 0;
for (const [out, bytes] of expected) {
  const p = path.join(DIST, out);
  const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  if (cur !== bytes) { fs.writeFileSync(p, bytes); written++; }
}

let pruned = 0;
for (const d of fs.readdirSync(DIST)) {
  // Drop the legacy hash cache from the old builder, and any orphaned source.
  if (d === '.sync-cache.json' || isPrunableOrphan(d)) {
    fs.rmSync(path.join(DIST, d));
    pruned++;
  }
}

console.log('✓ dist/: ' + expected.size + ' modules, ' + written + ' written, ' + pruned + ' pruned');
