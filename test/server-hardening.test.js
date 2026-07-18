/**
 * Server-hardening verification tests (items 7 + 10 of the self-improvement loop).
 *
 * Item 7 — Security headers: server/index.js already mounts `helmet()` and a
 *   fail-closed CORS policy. These tests assert the headers are actually emitted.
 *
 * Item 10 — Auth rate-limiting: /api/auth/login, /register and /magic/request are
 *   mounted with `authLimiter`. These tests assert the rate-limit response headers
 *   (standardHeaders: true → `RateLimit-Limit` / `RateLimit-Remaining`) are present
 *   on auth routes, proving the limiter is attached (without hammering the endpoint).
 *
 * Mirrors test/health.test.js: server deps are installed into an isolated temp dir
 * so the repo is never mutated; `app` is driven over HTTP on an ephemeral port.
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

function ensureServerDeps() {
  try {
    require.resolve('express')
    require.resolve('helmet')
    require.resolve('express-rate-limit')
    require.resolve('jsonwebtoken')
    return
  } catch { /* not installed locally */ }
  const srvTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortexx-hardening-'))
  execFileSync('npm', ['install', '--no-package-lock', '--prefix', srvTmpDir,
    'express@4', 'helmet@7', 'express-rate-limit@7', 'jsonwebtoken@9', 'cookie-parser@1'], {
    stdio: 'pipe', encoding: 'utf8',
  })
  const extraRoot = path.join(srvTmpDir, 'node_modules')
  const origResolve = Module._resolveFilename
  Module._resolveFilename = function (request, parent, isMain, options, conditions) {
    try { return origResolve.call(this, request, parent, isMain, options, conditions) }
    catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        try { return require.resolve(request, { paths: [extraRoot] }) } catch { /* fall through */ }
      }
      throw err
    }
  }
}

let srvTmpDir = null
ensureServerDeps()
const { app } = require(path.join(REPO, 'server', 'index.js'))

let server, port
before(() => {
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

function req(method, pathname) {
  return new Promise((resolve, reject) => {
    const r = http.request({ port, method, path: pathname, headers: {} }, (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }))
    })
    r.on('error', reject)
    r.end()
  })
}

// ── Item 7: security headers (helmet) ──────────────────────────────────────
test('helmet emits X-Content-Type-Options: nosniff', async () => {
  const res = await req('GET', '/api/health')
  assert.equal(res.headers['x-content-type-options'], 'nosniff', 'helmet must set nosniff')
})

test('helmet emits X-Frame-Options (clickjacking protection)', async () => {
  const res = await req('GET', '/api/health')
  assert.ok(res.headers['x-frame-options'], 'helmet must set X-Frame-Options')
})

test('helmet emits a Content-Security-Policy header', async () => {
  const res = await req('GET', '/api/health')
  assert.ok(res.headers['content-security-policy'], 'helmet must set a CSP')
})

test('CORS rejects a disallowed origin with 403 (fail-closed)', async () => {
  const res = await new Promise((resolve, reject) => {
    const r = http.request({ port, method: 'GET', path: '/api/health', headers: { origin: 'https://evil.example' } }, (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve({ status: res.statusCode }))
    })
    r.on('error', reject)
    r.end()
  })
  assert.equal(res.status, 403, 'disallowed origin must be rejected')
})

// ── Item 10: auth rate-limiting attached ───────────────────────────────────
test('POST /api/auth/login carries rate-limit headers (authLimiter attached)', async () => {
  const res = await req('POST', '/api/auth/login')
  assert.ok(res.headers['ratelimit-limit'], 'RateLimit-Limit header must be present on login')
  assert.ok(res.headers['ratelimit-remaining'] !== undefined, 'RateLimit-Remaining header must be present on login')
})

test('POST /api/auth/register carries rate-limit headers (authLimiter attached)', async () => {
  const res = await req('POST', '/api/auth/register')
  assert.ok(res.headers['ratelimit-limit'], 'RateLimit-Limit header must be present on register')
})

test('POST /api/auth/magic/request carries rate-limit headers (authLimiter attached)', async () => {
  const res = await req('POST', '/api/auth/magic/request')
  assert.ok(res.headers['ratelimit-limit'], 'RateLimit-Limit header must be present on magic/request')
})
