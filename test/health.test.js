/**
 * Health-endpoint test for the Express API.
 *
 * Verifies `GET /api/health` responds 200 with the documented shape:
 *   { status:'ok', version, db:'up'|'down', ts }
 *
 * server/index.js binds + listens only when run directly; when required it
 * exposes `app`/`pool` without opening a socket (so the file is safe to load
 * in-process). We mount `app` on an ephemeral port and drive it over HTTP with
 * Node's built-in http module. The Express/helmet/rate-limit/jwt deps are not
 * in the repo's node_modules, so (like server-auth.test.js) we install them
 * into an isolated temp dir and hook module resolution — the repository is
 * never mutated. No live DB is required: the endpoint degrades to db:'down'.
 *
 * Run with:  npm test
 */
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const Module = require('node:module')
const { execFileSync } = require('node:child_process')

const REPO = path.resolve(__dirname, '..')

// ── Ensure server deps are resolvable without mutating the repository ──────
let srvTmpDir = null
function ensureServerDeps() {
  try {
    require.resolve('express')
    require.resolve('helmet')
    require.resolve('express-rate-limit')
    require.resolve('jsonwebtoken')
    return
  } catch { /* not installed locally */ }
  srvTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortexx-srvtest-'))
  execFileSync('npm', ['install', '--no-package-lock', '--prefix', srvTmpDir,
    'express@4', 'helmet@7', 'express-rate-limit@7', 'jsonwebtoken@9', 'cookie-parser@1'], {
    stdio: 'pipe', encoding: 'utf8',
  })
  const extraRoot = path.join(srvTmpDir, 'node_modules')
  const origResolve = Module._resolveFilename
  Module._resolveFilename = function (request, parent, isMain, options, conditions) {
    try {
      return origResolve.call(this, request, parent, isMain, options, conditions)
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        try { return require.resolve(request, { paths: [extraRoot] }) } catch { /* fall through */ }
      }
      throw err
    }
  }
}
ensureServerDeps()

const { app } = require(path.join(REPO, 'server', 'index.js'))

let server, port
before(() => {
  // Permissive local dev config so the app boots without refusing to start.
  process.env.NODE_ENV = 'development'
  process.env.CORS_ORIGINS = 'http://localhost:8080'
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-used'
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://placeholder:***@localhost:5432/placeholder'
  server = app.listen(0)
  port = server.address().port
})
after(() => {
  if (server) server.close()
  if (srvTmpDir) { try { fs.rmSync(srvTmpDir, { recursive: true, force: true }) } catch { /* best effort */ } }
})

function get(pathname) {
  return new Promise((resolve, reject) => {
    http.get({ port, path: pathname }, (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve({ status: res.statusCode, json: d ? JSON.parse(d) : null }))
    }).on('error', reject)
  })
}

test('GET /api/health — 200 with the documented { status, version, db, ts } shape', async () => {
  const res = await get('/api/health')
  assert.equal(res.status, 200, '/api/health must return 200')
  assert.equal(res.json.status, 'ok', "status must be 'ok'")
  assert.ok(typeof res.json.version === 'string' && res.json.version.length > 0, 'version must be a non-empty string')
  assert.ok(['up', 'down'].includes(res.json.db), `db must be 'up' or 'down', got ${res.json.db}`)
  assert.ok(typeof res.json.ts === 'number', 'ts must be a number (epoch ms)')
  assert.ok('streams' in res.json, 'streams count must be present')
})

test('GET /api/health — version matches package.json', async () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'))
  const res = await get('/api/health')
  assert.equal(res.json.version, pkg.version, 'health.version must equal package.json version')
})
