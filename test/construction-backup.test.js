const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, utimesSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, dirname } = require('node:path');
const { spawnSync } = require('node:child_process');

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'construction-recovery-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const backups = join(root, 'backups');
  const scripts = join(root, 'scripts');
  mkdirSync(backups); mkdirSync(scripts);
  const verify = join(scripts, 'construction-verify-latest.sh');
  copyFileSync(resolve('ops/construction-verify-latest.sh'), verify);
  writeFileSync(join(scripts, 'construction-restore-drill.sh'), '#!/bin/bash\nprintf "RESTORE:%s\\n" "$1"\n');
  const run = () => spawnSync('bash', [verify], { env: { ...process.env, BACKUP_DIR: backups }, encoding: 'utf8' });
  const backup = join(backups, 'construction-test');
  const create = () => {
    mkdirSync(backup);
    writeFileSync(join(backup, 'database.dump'), 'test');
    writeFileSync(join(backups, '.last-local-success'), backup + '\n');
  };
  return { backups, backup, create, run };
}

test('missing success marker fails before restore', t => {
  const f = fixture(t); const r = f.run();
  assert.notEqual(r.status, 0); assert.match(r.stderr, /No successful/);
});
test('fresh backup is passed to isolated restore', t => {
  const f = fixture(t); f.create(); const r = f.run();
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /RESTORE:/);
});
test('stale backup fails before restore', t => {
  const f = fixture(t); f.create(); const old = new Date(Date.now() - 37 * 3600 * 1000);
  utimesSync(join(f.backup, 'database.dump'), old, old);
  const r = f.run(); assert.notEqual(r.status, 0); assert.match(r.stderr, /stale/); assert.doesNotMatch(r.stdout, /RESTORE:/);
});
test('future timestamp fails before restore', t => {
  const f = fixture(t); f.create(); const future = new Date(Date.now() + 3600 * 1000);
  utimesSync(join(f.backup, 'database.dump'), future, future);
  const r = f.run(); assert.notEqual(r.status, 0); assert.match(r.stderr, /invalid timestamp/);
});
test('marker outside managed backups fails before restore', t => {
  const f = fixture(t); f.create();
  const outside = join(dirname(f.backups), 'construction-outside');
  mkdirSync(outside); writeFileSync(join(outside, 'database.dump'), 'test');
  writeFileSync(join(f.backups, '.last-local-success'), outside + '\n');
  const r = f.run(); assert.notEqual(r.status, 0); assert.match(r.stderr, /outside the managed/); assert.doesNotMatch(r.stdout, /RESTORE:/);
});
