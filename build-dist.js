#!/usr/bin/env node
/**
 * CortexBuild Pro — Lib → Dist sync
 *
 * Walks lib/ and compiles every .jsx through Babel into dist/.js,
 * and copies every .js straight across. Idempotent — only rewrites
 * files whose source changed.
 *
 * Usage:
 *   node build-dist.js        # full sync
 *   node build-dist.js --check  # report which files are out of sync, exit 1 if any
 *
 * Prereq:
 *   npm install @babel/core @babel/preset-react
 *   # or, if you only have npx:
 *   npx -p @babel/core -p @babel/preset-react -c 'node build-dist.js'
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST);

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const cacheFile = path.join(DIST, '.sync-cache.json');
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};

const entries = fs.readdirSync(LIB).filter(f => /\.(jsx?|js)$/.test(f));
let compiled = 0, copied = 0, skipped = 0, drift = [];

for (const f of entries) {
  const src = fs.readFileSync(path.join(LIB, f), 'utf8');
  const out = f.endsWith('.jsx') ? f.replace(/\.jsx$/, '.js') : f;
  const distPath = path.join(DIST, out);
  const srcHash = sha(src);
  if (cache[f] === srcHash && fs.existsSync(distPath)) { skipped++; continue; }

  if (CHECK_ONLY) {
    drift.push(f);
    continue;
  }

  if (f.endsWith('.jsx')) {
    const result = babel.transformSync(src, {
      presets: [['@babel/preset-react', { runtime: 'classic' }]],
      compact: false,
      comments: false,
      babelrc: false,
      configFile: false,
    });
    fs.writeFileSync(distPath, result.code);
    compiled++;
  } else {
    fs.writeFileSync(distPath, src);
    copied++;
  }
  cache[f] = srcHash;
}

if (!CHECK_ONLY) fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));

if (CHECK_ONLY) {
  if (drift.length === 0) {
    console.log('✓ dist/ is in sync with lib/ (' + entries.length + ' files checked)');
    process.exit(0);
  }
  console.log('✗ ' + drift.length + ' file(s) out of sync:');
  drift.forEach(f => console.log('  - ' + f));
  process.exit(1);
}

console.log('✓ ' + compiled + ' compiled, ' + copied + ' copied, ' + skipped + ' up-to-date (of ' + entries.length + ')');
