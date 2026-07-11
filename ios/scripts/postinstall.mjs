#!/usr/bin/env node
/**
 * Cortexx iOS — postinstall.mjs
 *
 * Runs after `npm install` inside ios/.
 * Checks that the Mac build environment is ready and prints a clear
 * action list if anything is missing.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const ok  = (msg) => console.log(`  ✅  ${msg}`);
const warn = (msg) => console.log(`  ⚠️   ${msg}`);
const err  = (msg) => console.log(`  ❌  ${msg}`);

function run(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe' }).toString().trim();
  } catch {
    return null;
  }
}

console.log('\n🔧  Cortexx iOS — environment check\n');

// 1. macOS
const platform = process.platform;
if (platform !== 'darwin') {
  warn('Not running on macOS — Xcode build will not be possible on this machine.');
  warn('You can still edit web code and push to GitHub; build on a Mac.');
  console.log('');
  process.exit(0);
}
ok('macOS detected');

// 2. Xcode
const xcodeVersion = run('xcodebuild -version');
if (xcodeVersion) {
  ok(`Xcode: ${xcodeVersion.split('\n')[0]}`);
} else {
  err('Xcode not found — install from the Mac App Store, then run: xcode-select --install');
}

// 3. CocoaPods
const podVersion = run('pod --version');
if (podVersion) {
  ok(`CocoaPods: ${podVersion}`);
} else {
  err('CocoaPods not found — run: brew install cocoapods');
}

// 4. Capacitor CLI
const capVersion = run('npx cap --version');
if (capVersion) {
  ok(`Capacitor CLI: ${capVersion}`);
} else {
  warn('Capacitor CLI not found in PATH — it will be used via npx');
}

// 5. Web assets
const wwwDir = path.join(__dirname, '..', 'www');
if (existsSync(wwwDir)) {
  ok('www/ directory exists (web assets built)');
} else {
  warn('www/ not found — run: npm run build:web');
}

// 6. Xcode project (Capacitor: ios.path '.' → App/App.xcodeproj)
const xcodeProj = path.join(__dirname, '..', 'App', 'App.xcodeproj');
if (existsSync(xcodeProj)) {
  ok('App.xcodeproj exists');
} else {
  warn('App.xcodeproj not found — run: npx cap add ios  (first time only)');
}

// 7. Root web assets
const cortexxHtml = path.join(ROOT, 'Cortexx.html');
if (existsSync(cortexxHtml)) {
  ok('Cortexx.html found at project root');
} else {
  err('Cortexx.html missing at project root — check your working directory');
}

console.log('\n📋  Next steps:\n');
console.log('   npm run build:web      # copy web assets into ios/www/');
console.log('   npx cap add ios        # first time only — creates App/App.xcodeproj');
console.log('   npm run build:ios      # build web + cap sync (Podfile at App/Podfile)');
console.log('   npm run ios            # build + sync + open Xcode');
console.log('');
