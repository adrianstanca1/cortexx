#!/usr/bin/env node
/**
 * Build the shared @cortexbuild/core client into a browser-global IIFE so the
 * no-bundler SPA (Cortexx.html) can load it via a plain <script> tag.
 *
 * Output: cortex-core.js  →  attaches window.CortexCore = { createApiClient, api, API_URL }
 *
 * This is the SPA side of the monorepo consolidation: packages/core is the
 * single source of truth for the REST client + auth; the SPA's cloud-sync.js
 * delegates its generic GET/POST/PUT/DELETE calls to CortexCore.apiGet/apiPost.
 *
 * Run: node scripts/build-core.mjs   (also invoked by `npm run build:core`)
 */
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'packages/core/src/index.ts');
const outfile = path.join(root, 'cortex-core.js');

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: 'iife',
  // Attach the module exports to window.CortexCore (no import/export in IIFE).
  globalName: 'CortexCore',
  platform: 'browser',
  target: ['es2019'],
  // Drop the TS types and the ESM-only `export` keywords.
  loader: { '.ts': 'ts' },
  logLevel: 'info',
});

console.log('✓ cortex-core.js built (window.CortexCore)');
