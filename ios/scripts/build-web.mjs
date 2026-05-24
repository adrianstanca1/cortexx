#!/usr/bin/env node
// Cortexx — build script for the Capacitor iOS wrap.
//
// What it does:
//   1. Wipes ios/www/ (the directory Capacitor copies into the app bundle).
//   2. Copies the legacy single-file PWA out of public/legacy/ into ios/www/.
//   3. Renames index.html (it's already the right name in /legacy) and
//      copies the dist/ + lib/ bundles + icons + manifest.
//   4. Patches the service-worker registration to a no-op so the WKWebView
//      doesn't try to register a SW (it serves from the bundle directly).
//
// Why public/legacy/ and not the Next.js build?
//   The Next.js app at this repo's root is server-rendered + uses
//   /api/* routes. Capacitor needs a static webDir. Two ways to ship:
//   (a) THIS SCRIPT — bundle the legacy static PWA at public/legacy/
//       inside the app. Works fully offline. No /api/* — uses
//       localStorage / IndexedDB inside the WebView.
//   (b) Alternative — uncomment the `server.url` block in
//       capacitor.config.ts pointing at https://cortexbuildpro.com.
//       The shell loads the live Next.js app on each launch. Online
//       only, but always up to date and uses the real DB.
//
// Run from the ios/ folder:  npm run build:web

import { promises as fs, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IOS_DIR    = path.resolve(__dirname, '..');
const ROOT       = path.resolve(IOS_DIR, '..');
const LEGACY_SRC = path.join(ROOT, 'public', 'legacy');
const OUT        = path.join(IOS_DIR, 'www');

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
  if (!existsSync(LEGACY_SRC)) {
    console.error('✗ public/legacy/ does not exist. The legacy PWA bundle must be present at the repo root.');
    console.error('  Expected:', LEGACY_SRC);
    console.error('  See ios/README.md for the alternative `server.url` config that skips this script entirely.');
    process.exit(1);
  }

  log('Wiping', OUT);
  await rmrf(OUT);
  await fs.mkdir(OUT, { recursive: true });

  // Copy the whole legacy PWA bundle — index.html, dist/, lib/, icons,
  // manifest, sw.js. The legacy bundle already uses index.html as the
  // entry point, so no rename needed.
  log('Copying public/legacy/ → ios/www/');
  for (const entry of await fs.readdir(LEGACY_SRC)) {
    // Skip the README — it's developer-facing, not shipped to iOS.
    if (entry === 'README.md') continue;
    await copyRecursive(path.join(LEGACY_SRC, entry), path.join(OUT, entry));
  }

  // The Capacitor WebView serves files from the bundle directly; the SW
  // would try to cache against an http(s):// origin that doesn't exist
  // inside the bundle. Disable it so it doesn't throw at load.
  const indexPath = path.join(OUT, 'index.html');
  if (existsSync(indexPath)) {
    const html = await fs.readFile(indexPath, 'utf8');
    const patched = html
      // Match the legacy bundle's SW-register block — guard with `false`
      .replace(
        /if \('serviceWorker' in navigator\) \{[\s\S]*?navigator\.serviceWorker\.register\(['"]sw\.js['"]\)\.catch\(\(\) => \{\}\);\s*\}\);?\s*\}/,
        `if (false && 'serviceWorker' in navigator) { /* SW disabled inside Capacitor wrap */ }`,
      );
    if (patched !== html) {
      await fs.writeFile(indexPath, patched);
      log('patched index.html — service worker registration disabled');
    } else {
      log('index.html — no SW block matched (probably already patched or absent)');
    }
  } else {
    log('warn: index.html not found at', indexPath, '— Capacitor will boot to a blank screen');
  }

  log('Done →', OUT);
}

main().catch(err => { console.error(err); process.exit(1); });
