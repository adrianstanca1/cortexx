#!/usr/bin/env node
/**
 * ban-smell-words.mjs
 *
 * CI guard that fails the build if any "smell word" tech-debt marker is
 * committed to first-party source. Smell words are informal, un-tracked
 * markers that tend to accumulate as silent debt:
 *
 *     HACK  WORKAROUND  XXX  KLUDGE   (case-insensitive)
 *
 * Matching uses WORD BOUNDARIES so that legitimate substrings are not
 * flagged (e.g. the London borough "Hackney" used in demo data, or a
 * numeric placeholder like "XXXXX" in a prompt template do NOT match).
 *
 * Vendored / generated trees are excluded by default (node_modules, dist,
 * .next, build, coverage) so third-party code never fails the build.
 *
 * Usage:
 *   node scripts/ban-smell-words.mjs                 # default: lib app server
 *   node scripts/ban-smell-words.mjs lib app server  # explicit roots
 *
 * Exit codes:
 *   0  no smell words found
 *   1  one or more smell words found (prints file:line list)
 *   2  usage / filesystem error
 */

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, resolve, relative, extname } from 'node:path';

// Markers must sit on word boundaries so place names / placeholders survive.
const SMELL_RE = /\b(HACK|WORKAROUND|XXX|KLUDGE)\b/i;

const DEFAULT_ROOTS = ['lib', 'app', 'server'];
const EXCLUDE_DIRS = new Set([
  'node_modules',
  'dist',
  '.next',
  'build',
  'coverage',
  '.git',
]);
// Only scan source we author / ship; ignore lockfiles, maps, minified output.
const SCAN_EXTS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
]);

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // unreadable dir (e.g. symlink) — skip silently
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (entry.isFile()) {
      if (SCAN_EXTS.has(extname(entry.name).toLowerCase())) {
        out.push(full);
      }
    }
  }
}

function main() {
  const roots = process.argv.slice(2);
  const scanRoots = roots.length > 0 ? roots : DEFAULT_ROOTS;

  const files = [];
  for (const root of scanRoots) {
    const abs = resolve(root);
    let st;
    try {
      st = statSync(abs);
    } catch {
      console.error(`[ban-smell-words] skip missing root: ${root}`);
      continue;
    }
    if (st.isDirectory()) walk(abs, files);
    else if (st.isFile()) files.push(abs);
  }

  const hits = [];
  for (const file of files) {
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (SMELL_RE.test(lines[i])) {
        hits.push({ file, line: i + 1, text: lines[i].trim() });
      }
    }
  }

  if (hits.length === 0) {
    const scanned = files.length;
    console.log(
      `[ban-smell-words] OK — scanned ${scanned} file(s) under [${scanRoots.join(
        ', '
      )}], 0 smell words (HACK/WORKAROUND/XXX/KLUDGE) found.`
    );
    process.exit(0);
  }

  console.error(
    `[ban-smell-words] FAIL — ${hits.length} smell word(s) found. ` +
      `Replace with a tracked '// TECHDEBT: <why> — tracked in <issue>' or '// TODO(<date>): <why>' marker.`
  );
  for (const h of hits) {
    console.error(`  ${relative(process.cwd(), h.file)}:${h.line}: ${h.text}`);
  }
  process.exit(1);
}

main();
