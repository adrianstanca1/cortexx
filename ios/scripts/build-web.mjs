#!/usr/bin/env node
// Cortexx — build script for Capacitor wrap.
//
// What it does:
//   1. Wipes ios/www/ (the directory Capacitor copies into the app bundle).
//   2. Copies every web asset from the project root into ios/www/.
//   3. Renames Cortexx.html → index.html so the iOS WKWebView opens it directly.
//   4. Vendors the React + Babel CDN scripts into www/vendor/ and rewrites the
//      loader to use those local copies — so the packaged app boots with NO
//      network (a native app must be self-contained).
//   5. Disables the service-worker registration (the WebView serves from bundle).
//
// Run from the ios/ folder:  npm run build:web

import { promises as fs, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IOS_DIR    = path.resolve(__dirname, '..');
const ROOT       = path.resolve(IOS_DIR, '..');
const OUT        = path.join(IOS_DIR, 'www');

// What we ship inside the app bundle.
const INCLUDE = [
  'Cortexx.html',
  'manifest.json',
  'sw.js',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'lib',
  'dist',
];

// CDN scripts vendored locally so the native app needs no network to boot.
const VENDOR = [
  { url: 'https://unpkg.com/react@18.3.1/umd/react.development.js',        file: 'react.development.js' },
  { url: 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js', file: 'react-dom.development.js' },
  { url: 'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js',        file: 'babel.min.js' },
];

const log = (...a) => console.log('▶', ...a);

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

async function main() {
  log('Wiping', OUT);
  await rmrf(OUT);
  await fs.mkdir(OUT, { recursive: true });

  for (const name of INCLUDE) {
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

  // Vendor the CDN scripts locally so the native app boots with no network.
  const vendorDir = path.join(OUT, 'vendor');
  await fs.mkdir(vendorDir, { recursive: true });
  let html = await fs.readFile(destHtml, 'utf8');
  for (const v of VENDOR) {
    try {
      log('vendor', v.file);
      const res = await fetch(v.url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const code = await res.text();
      await fs.writeFile(path.join(vendorDir, v.file), code);
      // Point the loader at the local copy and strip the integrity hash
      // (the bytes are identical, but a relative path + SRI can mismatch).
      const esc = v.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(esc, 'g'), './vendor/' + v.file);
    } catch (e) {
      log('  ! vendor failed (' + v.file + ') — app will fall back to CDN:', e.message);
    }
  }
  // Drop integrity attrs on the now-local scripts so SRI can't block them.
  html = html.replace(/integrity:\s*'sha384-[^']*',?/g, '');

  // Inside a Capacitor app the service worker is not needed (the WebView
  // already serves files from the bundle). Patch out the registration.
  html = html.replace(
    /if \('serviceWorker' in navigator\) \{[\s\S]*?navigator\.serviceWorker\.register\('sw\.js'\)\.catch\(\(\) => \{\}\);\s*\}\);[\s\S]*?\}/,
    `if (false && 'serviceWorker' in navigator) { /* SW disabled inside Capacitor wrap */ }`
  );
  await fs.writeFile(destHtml, html);
  log('patched index.html (vendored deps + SW off)');

  log('Done →', OUT);
}

main().catch(err => { console.error(err); process.exit(1); });
