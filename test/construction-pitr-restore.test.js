const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { spawnSync } = require('node:child_process')

const script = path.resolve(__dirname, '../ops/construction-pitr-restore-drill.sh')
const walName = '000000010000000000000004'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pitr-restore-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const backup = path.join(root, 'backup')
  const wal = path.join(root, 'wal')
  const bin = path.join(root, 'bin')
  for (const directory of [backup, wal, bin]) fs.mkdirSync(directory, { mode: 0o700 })
  const log = path.join(root, 'docker.log')
  fs.writeFileSync(path.join(wal, walName), 'synthetic WAL')
  fs.writeFileSync(path.join(backup, 'contents.txt'), 'fixture\n')
  fs.writeFileSync(path.join(backup, 'manifest.txt'), 'postgres_major=16\n')
  // Metadata is evidence, never a command or executable-image selection.
  fs.writeFileSync(path.join(backup, 'postgres-image.txt'), 'malicious-image:latest\n')
  const checksum = () => {
    const result = spawnSync('sha256sum', ['base.tar.gz', 'contents.txt', 'postgres-image.txt', 'manifest.txt'], { cwd: backup })
    assert.equal(result.status, 0, result.stderr?.toString())
    fs.writeFileSync(path.join(backup, 'SHA256SUMS'), result.stdout)
  }
  const archive = (extra = [], version = '16\n') => {
    const result = spawnSync('python3', ['-c', `
import io, json, sys, tarfile
with tarfile.open(sys.argv[1], 'w:gz') as archive:
    for name, data, kind in [('PG_VERSION', sys.argv[3], 'file'), ('backup_label', 'fixture', 'file'), ('backup_manifest', 'fixture', 'file')] + json.loads(sys.argv[2]):
        member = tarfile.TarInfo(name)
        if kind == 'symlink':
            member.type = tarfile.SYMTYPE
            member.linkname = data
            archive.addfile(member)
        else:
            payload = data.encode()
            member.size = len(payload)
            archive.addfile(member, io.BytesIO(payload))
`, path.join(backup, 'base.tar.gz'), JSON.stringify(extra), version])
    assert.equal(result.status, 0, result.stderr?.toString())
    checksum()
  }
  archive()
  fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env node
const fs = require('node:fs')
const args = process.argv.slice(2)
fs.appendFileSync(process.env.TEST_DOCKER_LOG, JSON.stringify(args) + '\\n')
if (args[0] === 'run') {
  fs.writeFileSync(process.env.TEST_DOCKER_NONCE, args.find(arg => arg.startsWith('cortexx.pitr.drill=')).split('=')[1])
  console.log('disposable')
} else if (args[0] === 'inspect') {
  if (args.includes('{{.State.Running}}')) console.log('false')
  else if (fs.existsSync(process.env.TEST_DOCKER_NONCE)) console.log(fs.readFileSync(process.env.TEST_DOCKER_NONCE, 'utf8'))
} else if (args[0] === 'exec') {
  if (args.at(-1).includes('pg_is_in_recovery')) console.log(process.env.TEST_DOCKER_MODE === 'no-target' ? 'f' : 't')
  else console.log('2')
} else if (!['rm', 'logs'].includes(args[0])) process.exit(1)
`, { mode: 0o700 })
  const env = { ...process.env, PATH: bin + ':' + process.env.PATH, TEST_DOCKER_LOG: log, TEST_DOCKER_NONCE: path.join(root, 'nonce'), PITR_DRILL_TIMEOUT_SECONDS: '1' }
  const run = (extra = {}, args = [backup, wal, 'fixture_target']) => spawnSync('/bin/bash', [script, ...args], { env: { ...env, ...extra }, encoding: 'utf8' })
  return { root, backup, wal, log, run, archive, checksum }
}

test('restore uses a fixed image, read-only sources and an isolated disposable container', t => {
  const f = fixture(t)
  const result = f.run({ PITR_DRILL_CHECK_TABLE: 'pitr_probe', PITR_DRILL_EXPECT_ROWS: '2' })
  assert.equal(result.status, 0, result.stderr)
  const calls = fs.readFileSync(f.log, 'utf8').trim().split('\n').map(JSON.parse)
  const run = calls.find(args => args[0] === 'run')
  assert.equal(run[run.indexOf('--network') + 1], 'none')
  assert.ok(run.includes('--read-only'))
  assert.ok(run.includes('postgres:16-alpine'))
  assert.equal(run.some(arg => arg.includes('malicious-image')), false)
  assert.equal(run.filter(arg => arg.startsWith('type=bind,')).every(arg => arg.endsWith(',readonly')), true)
  assert.match(run[run.length - 3], /pg_verifybackup/)
  assert.match(run[run.length - 3], /recovery_target_action=pause/)
  assert.ok(calls.some(args => args[0] === 'rm' && args[1] === '-fv'))
})

test('checksum corruption and external checksum paths fail before Docker', t => {
  const f = fixture(t)
  fs.appendFileSync(path.join(f.backup, 'manifest.txt'), 'changed\n')
  assert.notEqual(f.run().status, 0)
  f.checksum()
  fs.writeFileSync(path.join(f.backup, 'SHA256SUMS'), '0'.repeat(64) + '  /etc/passwd\n')
  assert.notEqual(f.run().status, 0)
  assert.equal(fs.existsSync(f.log), false)
})

test('path traversal, archive links, duplicate members, tablespaces and other PostgreSQL versions fail before Docker', t => {
  const f = fixture(t)
  for (const members of [
    [['../escape', 'bad', 'file']],
    [['/tmp/escape', 'bad', 'file']],
    [['pg_wal', '/tmp', 'symlink']],
    [['backup_label', 'duplicate', 'file']],
    [['tablespace_map', '16384 /outside', 'file']]
  ]) {
    f.archive(members)
    assert.notEqual(f.run().status, 0)
  }
  f.archive([], '17\n')
  assert.notEqual(f.run().status, 0)
  assert.equal(fs.existsSync(f.log), false)
  assert.equal(fs.existsSync(path.join(f.root, 'escape')), false)
})

test('empty, symlink and unrelated WAL inputs fail before Docker', t => {
  const f = fixture(t)
  fs.unlinkSync(path.join(f.wal, walName))
  assert.notEqual(f.run().status, 0)
  fs.symlinkSync(path.join(f.backup, 'manifest.txt'), path.join(f.wal, walName))
  assert.notEqual(f.run().status, 0)
  fs.unlinkSync(path.join(f.wal, walName))
  fs.writeFileSync(path.join(f.wal, 'unrelated'), 'bad')
  assert.notEqual(f.run().status, 0)
  assert.equal(fs.existsSync(f.log), false)
})

test('an unreached recovery target fails and removes only its labelled disposable container', t => {
  const f = fixture(t)
  const result = f.run({ TEST_DOCKER_MODE: 'no-target' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Recovery did not reach/)
  const calls = fs.readFileSync(f.log, 'utf8').trim().split('\n').map(JSON.parse)
  assert.ok(calls.some(args => args[0] === 'rm'))
})

test('unsafe paths, target names, resource limits and partial row assertions fail before Docker', t => {
  const f = fixture(t)
  for (const extra of [
    { PITR_DRILL_TMPFS_SIZE: '1g,exec' },
    { PITR_DRILL_TIMEOUT_SECONDS: '0' },
    { PITR_DB_NAME: 'db;select' },
    { PITR_DRILL_CHECK_TABLE: 'probe' }
  ]) assert.notEqual(f.run(extra).status, 0)
  assert.notEqual(f.run({}, [f.backup, f.wal, "bad';target"]).status, 0)
  const link = path.join(f.root, 'linked-wal')
  fs.symlinkSync(f.wal, link)
  assert.notEqual(f.run({}, [f.backup, link, 'fixture_target']).status, 0)
  assert.equal(fs.existsSync(f.log), false)
})
