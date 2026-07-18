/**
 * Server-hardening verification tests (items 7 + 10 of the self-improvement loop).
 *
 * Item 7 — Security headers: server/index.js already mounts `helmet()` and a
 *   fail-closed CORS policy. These tests assert the headers are actually emitted.
 *
 * Item 10 — Auth rate-limiting: /api/auth/login, /register and /magic/request are
 *   mounted with `authLimiter`. These tests assert the rate-limit response headers
 *   (standardHeaders: true -> RateLimit-Limit / RateLimit-Remaining) are present
 *   on auth routes, proving the limiter is attached (without hammering the endpoint).
 *
 * The Express/helmet/rate-limit/jwt deps are NOT part of the repo's dependency
 * tree, so (like test/health.test.js) we install them into an isolated temp dir.
 * If that install is unavailable (network-sandboxed CI), the tests SKIP cleanly
 * rather than failing — the behavior is still verified locally and the headers
 * are observable on the live /api/health response in deployment.
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
    return true
  } catch { /* not installed locally */ }
  try {
    const srvTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortexx-hardening-'))
    execFileSync('npm', ['install', '--no-package-lock', '--prefix', srvTmpDir,
      'express@4', 'helmet@7', 'express-rate-limit@7', 'jsonwebtoken@9', 'cookie-parser@1'], {
      stdio: 'pipe', encoding: 'utf8', timeout: 60000,
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
    return true
  } catch {
    return false
  }
}

const depsOk = ensureServerDeps()
const maybe = depsOk ? test : test.skip
const app = depsOk ? require(path.join(REPO, 'server', 'index.js')).app : null

let server, port
before(() => {
  if (!depsOk) return
  process.env.NODE_ENV = 'development'
  process.env.CORS_ORIGINS = 'http://localhost:8080'
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-used'
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://placeholder:***@localhost:5432/placeholder'
  server = app.listen(0)
  port = server.address().port
})
after(() => {
  if (server) server.close()
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
maybe('helmet emits X-Content-Type-Options: nosniff', async () => {
  const res = await req('GET', '/api/health')
  assert.equal(res.headers['x-content-type-options'], 'nosniff', 'helmet must set nosniff')
})

maybe('helmet emits X-Frame-Options (clickjacking protection)', async () => {
  const res = await req('GET', '/api/health')
  assert.ok(res.headers['x-frame-options'], 'helmet must set X-Frame-Options')
})

maybe('helmet emits a Content-Security-Policy header', async () => {
  const res = await req('GET', '/api/health')
  assert.ok(res.headers['content-security-policy'], 'helmet must set a CSP')
})

maybe('CORS rejects a disallowed origin with 403 (fail-closed)', async () => {
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
maybe('POST /api/auth/login carries rate-limit headers (authLimiter attached)', async () => {
  const res = await req('POST', '/api/auth/login')
  assert.ok(res.headers['ratelimit-limit'], 'RateLimit-Limit header must be present on login')
  assert.ok(res.headers['ratelimit-remaining'] !== undefined, 'RateLimit-Remaining header must be present on login')
})

maybe('POST /api/auth/register carries rate-limit headers (authLimiter attached)', async () => {
  const res = await req('POST', '/api/auth/register')
  assert.ok(res.headers['ratelimit-limit'], 'RateLimit-Limit header must be present on register')
})

maybe('POST /api/auth/magic/request carries rate-limit headers (authLimiter attached)', async () => {
  const res = await req('POST', '/api/auth/magic/request')
  assert.ok(res.headers['ratelimit-limit'], 'RateLimit-Limit header must be present on magic/request')
})
