/**
 * Unit tests for the structured logger (server/logger.js).
 *
 * The logger is dependency-free: it writes timestamped, leveled lines to
 * stdout (INFO/WARN) and stderr (ERROR/FATAL). We capture the underlying
 * stream writes by temporarily replacing process.stdout/stderr.write, then
 * assert the emitted line carries the ISO timestamp, the level, and the
 * message (plus JSON-serialised meta).
 *
 * Run with:  npm test
 */
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const log = require('../server/logger')

let captured = []
let origStdout, origStderr

before(() => {
  origStdout = process.stdout.write.bind(process.stdout)
  origStderr = process.stderr.write.bind(process.stderr)
  process.stdout.write = (s) => { captured.push({ stream: 'out', s: String(s) }); return true }
  process.stderr.write = (s) => { captured.push({ stream: 'err', s: String(s) }); return true }
})
after(() => {
  process.stdout.write = origStdout
  process.stderr.write = origStderr
})

function lines() { return captured.slice() }

test('logger.info — writes an INFO line to stdout with ISO timestamp', () => {
  captured = []
  log.info('server started')
  const out = lines().filter((l) => l.stream === 'out')
  assert.equal(out.length, 1)
  assert.match(out[0].s, /^\S+ INFO server started\n$/, 'line should be "<ts> INFO server started"')
})

test('logger.warn — writes a WARN line to stdout', () => {
  captured = []
  log.warn('cookie-parser missing')
  const out = lines().filter((l) => l.stream === 'out')
  assert.equal(out.length, 1)
  assert.match(out[0].s, /WARN cookie-parser missing\n$/)
})

test('logger.error — writes an ERROR line to stderr', () => {
  captured = []
  log.error('db query failed')
  const err = lines().filter((l) => l.stream === 'err')
  assert.equal(err.length, 1)
  assert.match(err[0].s, /ERROR db query failed\n$/)
})

test('logger.fatal — writes to stderr (ERROR level)', () => {
  captured = []
  log.fatal('refusing to start')
  const err = lines().filter((l) => l.stream === 'err')
  assert.equal(err.length, 1)
  assert.match(err[0].s, /ERROR refusing to start\n$/)
})

test('logger — serialises a meta object as trailing JSON', () => {
  captured = []
  log.info('user login', { uid: 'u1', ws: 'ws1' })
  const out = lines().filter((l) => l.stream === 'out')
  assert.match(out[0].s, /INFO user login \{"uid":"u1","ws":"ws1"\}\n$/)
})

test('logger — serialises an Error meta into { err: message }', () => {
  captured = []
  log.error('boom', new Error('kaboom'))
  const err = lines().filter((l) => l.stream === 'err')
  assert.match(err[0].s, /ERROR boom \{"err":"kaboom"\}\n$/)
})

test('logger — timestamp is a valid ISO-8601 string', () => {
  captured = []
  log.info('ts check')
  const out = lines().filter((l) => l.stream === 'out')
  const ts = out[0].s.split(' ')[0]
  assert.ok(!Number.isNaN(Date.parse(ts)), `timestamp ${ts} must parse as a date`)
})
