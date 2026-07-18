/**
 * Orphaned-dist detector test.
 *
 * Verifies scripts/check-orphan-dist.mjs:
 *   • exits 0 on a clean repo (every dist/*.js maps to a lib/ source)
 *   • exits 1 when an orphan dist file exists, printing the orphan name to stderr
 *
 * The script writes its FAIL line to STDERR and the JSON report (--json) to
 * STDOUT, so the assertions read from the correct stream.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = new URL('../scripts/check-orphan-dist.mjs', import.meta.url).pathname;

function runIn(cwd, args = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' });
}

test('clean repo: no orphans, exit 0', () => {
  const repo = process.cwd();
  const r = runIn(repo);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
  assert.match(r.stdout, /OK/);
});

test('orphan dist file: exit 1 and name printed to stderr', () => {
  // Build a tiny fake repo: lib/ has one source, dist/ has that + an orphan.
  const dir = mkdtempSync(join(tmpdir(), 'orphan-'));
  try {
    writeFileSync(join(dir, 'fake-root'), 'do not delete — marks repo root\n');
    const lib = join(dir, 'lib');
    const dist = join(dir, 'dist');
    mkdirSync(lib, { recursive: true });
    mkdirSync(dist, { recursive: true });
    writeFileSync(join(lib, 'real.jsx'), '// source\n');
    writeFileSync(join(dist, 'real.js'), '// compiled\n');
    writeFileSync(join(dist, 'ghost.js'), '// ORPHAN — no lib source\n');

    const r = runIn(dir);
    assert.equal(r.status, 1, `expected exit 1, got ${r.status}\nstdout: ${r.stdout}`);
    // FAIL line goes to stderr
    assert.match(r.stderr, /FAIL/);
    assert.match(r.stderr, /ghost\.js/);
    // JSON report (--json) goes to stdout
    const json = runIn(dir, ['--json']);
    assert.equal(json.status, 1);
    const report = JSON.parse(json.stdout);
    assert.equal(report.ok, false);
    assert.deepEqual(report.orphaned, ['ghost.js']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
