#!/usr/bin/env node
/**
 * Cortexx iOS — generate-icons.mjs
 *
 * Generates every required iOS app icon size from the 1024×1024 master PNG.
 * Requires: npm install -g sharp-cli   OR   brew install imagemagick
 *
 * Usage:
 *   node scripts/generate-icons.mjs
 *   node scripts/generate-icons.mjs --source ../app-store/icons/icon-1024.png
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const sourceArg = args.find(a => a.startsWith('--source='))?.split('=')[1]
                || args[args.indexOf('--source') + 1];

const SOURCE = sourceArg
  ? path.resolve(sourceArg)
  : path.resolve(__dirname, '../../app-store/icons/icon-1024.png');

const OUT_DIR = path.resolve(
  __dirname,
  '../App/App/Assets.xcassets/AppIcon.appiconset'
);

// All sizes required by Xcode 15 (single-size asset catalog)
const SIZES = [
  // iPhone
  { size: 20,   scale: 2, name: 'Icon-20@2x.png' },
  { size: 20,   scale: 3, name: 'Icon-20@3x.png' },
  { size: 29,   scale: 2, name: 'Icon-29@2x.png' },
  { size: 29,   scale: 3, name: 'Icon-29@3x.png' },
  { size: 40,   scale: 2, name: 'Icon-40@2x.png' },
  { size: 40,   scale: 3, name: 'Icon-40@3x.png' },
  { size: 60,   scale: 2, name: 'Icon-60@2x.png' },
  { size: 60,   scale: 3, name: 'Icon-60@3x.png' },
  // iPad
  { size: 20,   scale: 1, name: 'Icon-iPad-20@1x.png' },
  { size: 20,   scale: 2, name: 'Icon-iPad-20@2x.png' },
  { size: 29,   scale: 1, name: 'Icon-iPad-29@1x.png' },
  { size: 29,   scale: 2, name: 'Icon-iPad-29@2x.png' },
  { size: 40,   scale: 1, name: 'Icon-iPad-40@1x.png' },
  { size: 40,   scale: 2, name: 'Icon-iPad-40@2x.png' },
  { size: 76,   scale: 1, name: 'Icon-iPad-76@1x.png' },
  { size: 76,   scale: 2, name: 'Icon-iPad-76@2x.png' },
  { size: 83.5, scale: 2, name: 'Icon-iPad-83.5@2x.png' },
  // App Store
  { size: 1024, scale: 1, name: 'AppIcon-1024.png' },
];

if (!existsSync(SOURCE)) {
  console.error(`❌  Source icon not found: ${SOURCE}`);
  console.error('    Place a 1024×1024 PNG at app-store/icons/icon-1024.png');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

// Detect tool
const hasConvert = (() => { try { execSync('convert --version', { stdio: 'pipe' }); return true; } catch { return false; } })();
const hasSharp   = (() => { try { execSync('sharp --version',   { stdio: 'pipe' }); return true; } catch { return false; } })();

if (!hasConvert && !hasSharp) {
  console.error('❌  Neither ImageMagick (convert) nor sharp-cli found.');
  console.error('    Install one:');
  console.error('      brew install imagemagick');
  console.error('      npm install -g sharp-cli');
  process.exit(1);
}

console.log(`\n🎨  Generating ${SIZES.length} icon sizes from ${path.basename(SOURCE)}\n`);

for (const { size, scale, name } of SIZES) {
  const px   = Math.round(size * scale);
  const dest = path.join(OUT_DIR, name);

  if (hasConvert) {
    execSync(`convert "${SOURCE}" -resize ${px}x${px} "${dest}"`, { stdio: 'pipe' });
  } else {
    execSync(`sharp --input "${SOURCE}" --output "${dest}" resize ${px} ${px}`, { stdio: 'pipe' });
  }
  console.log(`  ✅  ${name}  (${px}×${px})`);
}

// Write Contents.json for the asset catalog
const contents = {
  images: SIZES.map(({ size, scale, name }) => ({
    filename: name,
    idiom: size >= 76 || name.includes('iPad') ? 'ipad' : (size === 1024 ? 'ios-marketing' : 'iphone'),
    scale: `${scale}x`,
    size: `${size}x${size}`,
  })),
  info: { author: 'xcode', version: 1 },
};

import { writeFileSync } from 'node:fs';
writeFileSync(
  path.join(OUT_DIR, 'Contents.json'),
  JSON.stringify(contents, null, 2)
);

console.log(`\n✅  Contents.json written to ${OUT_DIR}\n`);
