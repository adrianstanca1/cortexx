#!/usr/bin/env node
// Cortexx — build script for Capacitor wrap.
//
// What it does:
//   1. Wipes ios/www/ (the directory Capacitor copies into the app bundle).
//   2. Copies every web asset from the project root into ios/www/.
//   3. Renames Cortexx.html → index.html so the iOS WKWebView opens it directly.
//   4. Patches the service-worker registration to point at the local path.
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
];

const log = (...a) => console.log('▶', ...a);

async function rmrf(p) {
  if (!existsSync(p)) return;
  await fs.rm(p, { recursive: true, force: true });
}

async function copyRecursive(src, dest) {
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

  // Inside a Capacitor app the service worker is not needed (the WebView
  // already serves files from the bundle). Keep sw.js on disk but don't
  // register it — patch the index.html.
  const html = await fs.readFile(destHtml, 'utf8');
  const patched = html.replace(
    /if \('serviceWorker' in navigator\) \{[\s\S]*?navigator\.serviceWorker\.register\('sw\.js'\)\.catch\(\(\) => \{\}\);\s*\}\);[\s\S]*?\}/,
    `if (false && 'serviceWorker' in navigator) { /* SW disabled inside Capacitor wrap */ }`
  );
  await fs.writeFile(destHtml, patched);
  log('patched index.html');

  log('Done →', OUT);
}

main().catch(err => { console.error(err); process.exit(1); });
