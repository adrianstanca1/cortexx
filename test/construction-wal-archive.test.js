const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { spawnSync, spawn } = require('node:child_process')

const script = path.resolve(__dirname, '../ops/construction-wal-archive.sh')
const wal = '000000010000000000000001'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wal-archive-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const archive = path.join(root, 'archive')
  const source = path.join(root, 'source')
  fs.writeFileSync(source, 'realistic-wal-fixture')
  const env = { ...process.env, WAL_ARCHIVE_DIR: archive }
  const args = name => [script, source, name]
  const run = (name = wal) => {
    const result = spawnSync('/bin/bash', args(name), { env, encoding: 'utf8' })
    if (result.error) throw result.error
    return result
  }
  return { root, source, archive, env, args, run }
}

test('WAL publication is private, exact, durable and retry-safe', t => {
  const f = fixture(t)
  assert.equal(f.run().status, 0)
  const target = path.join(f.archive, wal)
  assert.equal(fs.readFileSync(target, 'utf8'), fs.readFileSync(f.source, 'utf8'))
  assert.equal(fs.statSync(target).mode & 0o777, 0o600)
  assert.equal(fs.statSync(f.archive).mode & 0o777, 0o700)
  assert.equal(f.run().status, 0)
  assert.deepEqual(fs.readdirSync(f.archive), [wal])
})

test('changed contents and symlink destinations cannot replace archived WAL', t => {
  const f = fixture(t)
  assert.equal(f.run().status, 0)
  fs.writeFileSync(f.source, 'changed')
  assert.equal(f.run().status, 1)
  assert.equal(fs.readFileSync(path.join(f.archive, wal), 'utf8'), 'realistic-wal-fixture')
  const second = '000000010000000000000002'
  fs.symlinkSync(f.source, path.join(f.archive, second))
  assert.equal(f.run(second).status, 1)
})

test('missing, empty and invalid inputs do not publish a completed archive', t => {
  const f = fixture(t)
  for (const invalid of ['../escape', '00000001/escape', '', 'bad', wal + '\n']) assert.equal(f.run(invalid).status, 1)
  assert.equal(fs.existsSync(f.archive), false)
  fs.writeFileSync(f.source, '')
  assert.equal(f.run().status, 1)
  fs.unlinkSync(f.source)
  assert.equal(f.run().status, 1)
})

test('timeline and base backup history files are archived', t => {
  const f = fixture(t)
  for (const name of ['00000002.history', wal + '.00000020.backup', wal + '.partial']) assert.equal(f.run(name).status, 0)
})

test('concurrent identical publication remains retry-safe', async t => {
  const f = fixture(t)
  const launch = () => new Promise((resolve, reject) => {
    const child = spawn('/bin/bash', f.args(wal), { env: f.env, stdio: 'ignore' })
    child.on('error', reject)
    child.on('exit', resolve)
  })
  assert.deepEqual(await Promise.all([launch(), launch()]), [0, 0])
  assert.deepEqual(fs.readdirSync(f.archive), [wal])
})

test('unsafe archive directories and symlink sources fail before publication', t => {
  const f = fixture(t)
  fs.mkdirSync(f.archive, { mode: 0o755 })
  assert.equal(f.run().status, 1)
  fs.chmodSync(f.archive, 0o700)
  const link = path.join(f.root, 'link')
  fs.symlinkSync(f.archive, link)
  for (const directory of [link, link + '/nested', 'relative', f.archive + '/../other', '/']) {
    const result = spawnSync('/bin/bash', f.args(wal), { env: { ...f.env, WAL_ARCHIVE_DIR: directory }, encoding: 'utf8' })
    assert.equal(result.status, 1)
  }
  assert.deepEqual(fs.readdirSync(f.archive), [])
  assert.equal(fs.existsSync(path.join(f.root, 'other')), false)
  const sourceLink = path.join(f.root, 'source-link')
  fs.symlinkSync(f.source, sourceLink)
  assert.equal(spawnSync('/bin/bash', [script, sourceLink, wal], { env: f.env }).status, 1)
})

test('directories and nonprivate preexisting WAL are rejected', t => {
  const f = fixture(t)
  fs.mkdirSync(f.archive, { mode: 0o700 })
  const target = path.join(f.archive, wal)
  fs.mkdirSync(target)
  assert.equal(f.run().status, 1)
  fs.rmdirSync(target)
  fs.copyFileSync(f.source, target)
  fs.chmodSync(target, 0o644)
  assert.equal(f.run().status, 1)
})

test('concurrent differing publication preserves the winner and fails the loser', async t => {
  const f = fixture(t)
  const otherSource = path.join(f.root, 'source-two')
  fs.writeFileSync(otherSource, 'different-wal')
  const launch = source => new Promise((resolve, reject) => {
    const child = spawn('/bin/bash', [script, source, wal], { env: f.env, stdio: 'ignore' })
    child.on('error', reject)
    child.on('exit', resolve)
  })
  const results = await Promise.all([launch(f.source), launch(otherSource)])
  assert.deepEqual(results.sort(), [0, 1])
  assert.ok(['realistic-wal-fixture', 'different-wal'].includes(fs.readFileSync(path.join(f.archive, wal), 'utf8')))
  assert.deepEqual(fs.readdirSync(f.archive), [wal])
})

test('failed durability synchronization returns failure and remains retryable', t => {
  const f = fixture(t)
  const bin = path.join(f.root, 'bin')
  fs.mkdirSync(bin)
  fs.writeFileSync(path.join(bin, 'sync'), '#!/bin/sh\nexit 1\n', { mode: 0o700 })
  const result = spawnSync('/bin/bash', f.args(wal), { env: { ...f.env, PATH: bin + ':' + process.env.PATH }, encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.equal(f.run().status, 0)
  assert.deepEqual(fs.readdirSync(f.archive), [wal])
})
