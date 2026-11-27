#!/usr/bin/env node
// Cortexx — build script for Capacitor wrap.
//
// What it does:
//   1. Wipes ios/www/ (the directory Capacitor copies into the app bundle).
//   2. Copies every web asset from the project root into ios/www/.
//   3. Renames Cortexx.html → index.html so the iOS WKWebView opens it directly.
//   4. Vendors React + Babel into www/vendor/. The loader in Cortexx.html asks
//      for ./vendor/<file> before any CDN, so the packaged app boots with NO
//      network (a native app must be self-contained).
//   5. Disables the service-worker registration (the WebView serves from bundle).
//   6. Fails the build if the bundle could not boot (no precompiled dist/, no
//      vendored React) instead of handing Xcode an app that black-screens.
//
// Run from the ios/ folder:  npm run build:web

import { promises as fs, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IOS_DIR    = path.resolve(__dirname, '..');
const ROOT       = path.resolve(IOS_DIR, '..');
const OUT        = path.join(IOS_DIR, 'www');

// What we ship inside the app bundle, beyond the module tree. dist/ or lib/ is
// added below: the app executes one of them, never both.
const INCLUDE = [
  'Cortexx.html',
  'cortex-core.js',
  'manifest.json',
  'sw.js',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
];

// Runtime libraries the loader looks for in ./vendor/ before any CDN (see the
// localFirst() calls in Cortexx.html). Production boot needs the two minified
// React files. The others only matter when the bundle ships raw .jsx, which is
// 4.3 MB of Babel and development React that a normal build never executes.
// Each entry lists the same bytes on two CDNs so one outage can't break a build.
const VENDOR = [
  { file: 'react.production.min.js', required: true, urls: [
    'https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js',
    'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  ] },
  { file: 'react-dom.production.min.js', required: true, urls: [
    'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js',
    'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  ] },
  { file: 'babel.min.js', required: true, needsSources: true, urls: [
    'https://cdn.jsdelivr.net/npm/@babel/standalone@7.29.0/babel.min.js',
    'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js',
  ] },
  { file: 'react.development.js', required: false, needsSources: true, urls: [
    'https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.development.js',
    'https://unpkg.com/react@18.3.1/umd/react.development.js',
  ] },
  { file: 'react-dom.development.js', required: false, needsSources: true, urls: [
    'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.development.js',
    'https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js',
  ] },
];

const log = (...a) => console.log('▶', ...a);

// Sizes of the libraries a dist-only build leaves out, so the log reports the
// real saving rather than a hand-waved one.
const VENDOR_SIZES = {
  'babel.min.js': 3137752,
  'react.development.js': 109931,
  'react-dom.development.js': 1080227,
};

async function dirSize(p) {
  if (!existsSync(p)) return 0;
  let total = 0;
  for (const entry of await fs.readdir(p, { withFileTypes: true })) {
    const full = path.join(p, entry.name);
    total += entry.isDirectory() ? await dirSize(full) : (await fs.stat(full)).size;
  }
  return total;
}

// SHA-384 of each pinned release, in SRI form. These are the same digests
// Cortexx.html has always declared in its integrity attributes; enforcing them
// while packaging means a hijacked or broken mirror cannot put substituted
// bytes inside every installation of a release.
const VENDOR_DIGESTS = {
  'react.production.min.js': 'sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z',
  'react-dom.production.min.js': 'sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1',
  'babel.min.js': 'sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y',
  'react.development.js': 'sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L',
  'react-dom.development.js': 'sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm',
};

async function rmrf(p) {
  if (!existsSync(p)) return;
  await fs.rm(p, { recursive: true, force: true });
}

// The in-browser module loader only ever fetches .js / .jsx (see Cortexx.html —
// it tries dist/<name>.js, lib/<name>.js, lib/<name>.jsx, never .ts). Every .ts
// file under lib/ is a Next.js server module (db, redis, requireAuth, rbac,
// email, cron, tokens…) that would only ship internal source into the IPA.
// Skip them (and sourcemaps) so the bundle carries client code only.
function shouldSkip(src) {
  const base = path.basename(src);
  return src.endsWith('.ts') || src.endsWith('.map') || base === 'node_modules' || base === '.DS_Store';
}

async function copyRecursive(src, dest) {
  if (shouldSkip(src)) return;
  const st = statSync(src);
  if (st.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    for (const entry of await fs.readdir(src)) {
      await copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    await fs.copyFile(src, dest);
  }
}

// dist/ is gitignored, so a clean checkout has none. The loader prefers the
// precompiled dist/*.js (no runtime Babel); without them it falls back to the
// raw .jsx in lib/ and the WebView transforms them at boot. Rebuild dist/ from
// lib/ whenever the repo-root Babel toolchain is installed so a stale build can
// never ship. Xcode Cloud only installs the iOS-local graph, so there we use
// whatever dist/ came with the checkout, else lib/ + the vendored Babel.
function ensureDist() {
  const distDir = path.join(ROOT, 'dist');
  const count = () => (existsSync(distDir) ? readdirSync(distDir).filter(f => f.endsWith('.js')).length : 0);
  if (existsSync(path.join(ROOT, 'node_modules', '@babel', 'core'))) {
    log('building dist/ from lib/');
    execFileSync(process.execPath, [path.join(ROOT, 'build-dist.js')], { cwd: ROOT, stdio: 'inherit' });
    return count();
  }
  const existing = count();
  if (existing >= 100) { log('dist/ already built (' + existing + ' modules)'); return existing; }
  log('! dist/ is missing and @babel/core is not installed at the repo root —');
  log('  shipping lib/*.jsx; the WebView transforms them with the vendored');
  log('  Babel. Run `npm run precompile` at the repo root for the faster');
  log('  precompiled boot.');
  return 0;
}

// The modules Cortexx.html asks for at boot, read from its MODULES array. Since
// a dist-only bundle ships no lib/ fallback, the build has to prove every one of
// them is present — a dist/ that is simply "big enough" is not proof.
function loaderModules() {
  let html;
  try { html = readFileSync(path.join(ROOT, 'Cortexx.html'), 'utf8'); }
  catch { return []; }
  const start = html.indexOf('const MODULES = [');
  if (start < 0) return [];
  const end = html.indexOf('];', start);
  if (end < 0) return [];
  return [...html.slice(start, end).matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1]);
}

async function main() {
  const distModules = ensureDist();
  const withDist = distModules > 0;

  // The app executes exactly one module tree. Shipping both copied 2.1 MB of
  // .jsx sources that only the ?dev=1 path (and the no-dist fallback) reads.
  const include = [...INCLUDE, ...(withDist ? ['dist'] : ['lib'])];
  if (withDist) log('shipping dist/ only — lib/ sources are for ?dev=1 and the no-dist fallback');

  log('Wiping', OUT);
  await rmrf(OUT);
  await fs.mkdir(OUT, { recursive: true });

  for (const name of include) {
    const src = path.join(ROOT, name);
    if (!existsSync(src)) { log('skip (missing):', name); continue; }
    const dest = path.join(OUT, name);
    log('copy', name);
    await copyRecursive(src, dest);
  }

  // Capacitor opens www/index.html by default.
  const srcHtml  = path.join(OUT, 'Cortexx.html');
  const destHtml = path.join(OUT, 'index.html');
  if (existsSync(srcHtml)) {
    log('rename Cortexx.html → index.html');
    await fs.rename(srcHtml, destHtml);
  }

  // Vendor the runtime libraries so the native app boots with no network. The
  // loader asks for ./vendor/<file> first; these files are what make that work.
  const vendorDir = path.join(OUT, 'vendor');
  await fs.mkdir(vendorDir, { recursive: true });
  const missing = [];
  let vendored = 0;
  let skippedBytes = 0;
  const vendorList = VENDOR.filter(v => !v.needsSources || !withDist);
  for (const v of VENDOR) {
    if (!vendorList.includes(v)) {
      skippedBytes += VENDOR_SIZES[v.file] || 0;
      log('skip vendor', v.file, '(only needed when shipping lib/)');
      continue;
    }
    let saved = false;
    for (const url of v.urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const type = (res.headers.get('content-type') || '').toLowerCase();
        const code = await res.text();
        if (code.length < 1000) throw new Error('body too small (' + code.length + ' bytes)');
        // A CDN or intercepting proxy can answer with a 200 HTML page. Packing
        // that would ship a runtime the app rejects at boot, so the same guard
        // the loader applies is applied before the bytes are written.
        if (type.includes('text/html') || /^\s*</.test(code)) throw new Error('HTML instead of JavaScript');
        const expected = VENDOR_DIGESTS[v.file];
        if (expected) {
          const actual = 'sha384-' + createHash('sha384').update(code, 'utf8').digest('base64');
          if (actual !== expected) throw new Error('digest mismatch (got ' + actual + ')');
        }
        await fs.writeFile(path.join(vendorDir, v.file), code);
        log('vendor', v.file, '(' + Math.round(code.length / 1024) + ' KB)');
        saved = true;
        vendored++;
        break;
      } catch (e) {
        log('  ! ' + v.file + ' from ' + new URL(url).host + ': ' + e.message);
      }
    }
    if (!saved) {
      if (v.required) missing.push(v.file);
      else log('  ! optional vendor file skipped:', v.file);
    }
  }

  let html = await fs.readFile(destHtml, 'utf8');

  // Inside a Capacitor app the service worker is not needed (the WebView
  // already serves files from the bundle). Patch out the registration.
  html = html.replace(
    /if \('serviceWorker' in navigator\) \{[\s\S]*?navigator\.serviceWorker\.register\('sw\.js'\)\.catch\(\(\) => \{\}\);\s*\}\);[\s\S]*?\}/,
    `if (false && 'serviceWorker' in navigator) { /* SW disabled inside Capacitor wrap */ }`
  );
  await fs.writeFile(destHtml, html);
  log('patched index.html (SW off)');

  // Never hand Xcode a bundle that cannot boot: a missing module tree *or*
  // missing vendored React is exactly what a black screen on launch looks like.
  const problems = missing.map(f => 'vendor/' + f + ' could not be downloaded');
  if (!existsSync(destHtml)) problems.push('index.html was not produced');
  if (withDist) {
    // The loader resolves dist/<name>.js first and lib/ is no longer shipped, so
    // every module it requests has to be there — otherwise the app silently
    // loses that screen with no fallback left.
    const requested = loaderModules();
    if (requested.length === 0) problems.push('could not read the module list from Cortexx.html');
    const absent = requested.filter(name => !existsSync(path.join(OUT, 'dist', name + '.js')));
    if (absent.length) {
      problems.push('dist/ is missing ' + absent.length + ' module(s) the loader requests: '
        + absent.slice(0, 5).join(', ') + (absent.length > 5 ? ', …' : ''));
    }
    if (!existsSync(path.join(OUT, 'dist', 'boot.js'))) problems.push('dist/boot.js missing from the bundle');
  } else {
    const libDir = path.join(OUT, 'lib');
    const sources = existsSync(libDir) ? readdirSync(libDir).filter(f => /\.jsx?$/.test(f)).length : 0;
    if (sources === 0) problems.push('neither dist/ nor lib/ modules reached the bundle');
    if (!existsSync(path.join(OUT, 'lib', 'boot.jsx'))) problems.push('lib/boot.jsx missing from the bundle');
  }
  if (problems.length) {
    throw new Error('web bundle is not bootable:\n  - ' + problems.join('\n  - '));
  }

  const sizeMb = (await dirSize(OUT)) / (1024 * 1024);
  log('verified: ' + (withDist ? distModules + ' precompiled modules' : 'lib/ sources + vendored Babel')
    + ' + ' + vendored + ' vendored libraries');
  log('bundle: ' + sizeMb.toFixed(1) + ' MB'
    + (skippedBytes ? ' (' + (skippedBytes / (1024 * 1024)).toFixed(1) + ' MB of lib/ + Babel left out)' : ''));

  log('Done →', OUT);
}

main().catch(err => { console.error(err); process.exit(1); });
