/**
 * Auth-boundary tests for the Express API — tests the gate logic WITHOUT
 * starting the real server (server/index.js) or a database.
 *
 * Targets:
 *   • The `auth` middleware contract (enforced on /api/triage): rejects
 *     missing/invalid Bearer tokens with 401 before any work runs.
 *   • The `secretGate` closure inside server/routes/agents.js — the shared-
 *     secret gate on the inbound WhatsApp webhook handshake route, including
 *     the constant-time comparison and the X-Webhook-Secret header path.
 *
 * server/index.js does not export `auth`/`integrationAuth`, and `secretGate`
 * is a closure inside the agents router factory — so we mount the real
 * agents router factory on a minimal express app with a fake `auth` and an
 * empty pool, listen on an ephemeral port, and drive it over HTTP with
 * Node's built-in http module. No real network calls are made: we never send
 * a valid token to /triage (which would trigger a live Anthropic request).
 *
 * Express is not declared in package.json. The repo's own server requires it,
 * so we resolve it from the repo's node_modules; if it is absent we install
 * it into an isolated temp dir and hook module resolution. The repository is
 * never mutated.
 *
 * Run with:  npm test
 */
const { test, before, after, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const Module = require('node:module')
const { execFileSync } = require('node:child_process')

const REPO = path.resolve(__dirname, '..')

// ── Ensure express is resolvable without mutating the repository ──────────
let expressTmpDir = null
function ensureExpress() {
  try { require.resolve('express'); return } catch { /* not installed locally */ }
  expressTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortexx-express-'))
  execFileSync('npm', ['install', '--no-package-lock', '--prefix', expressTmpDir, 'express@4'], {
    stdio: 'pipe',
    encoding: 'utf8',
  })
  const extraRoot = path.join(expressTmpDir, 'node_modules')
  const origResolve = Module._resolveFilename
  Module._resolveFilename = function (request, parent, isMain, options, conditions) {
    try {
      return origResolve.call(this, request, parent, isMain, options, conditions)
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        try { return require.resolve(request, { paths: [extraRoot] }) }
        catch { /* fall through to original error */ }
      }
      throw err
    }
  }
}
ensureExpress()

const express = require('express')
const makeAgents = require(path.join(REPO, 'server/routes/agents.js'))

// ── Minimal app: fake auth that accepts only "good" and 401s otherwise ──
// This mirrors the real `auth` contract: Bearer-token verified, sets req.user.
const fakeAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (token === 'good') { req.user = { uid: 'u1', ws: 'ws1' }; return next() }
  return res.status(401).json({ error: 'unauthorized' })
}

let server, port

before(() => {
  const app = express()
  app.use(express.json())
  app.use('/api', makeAgents({}, fakeAuth, { emit() {} }))
  server = app.listen(0)
  port = server.address().port
})

after(() => {
  if (server) server.close()
  if (expressTmpDir) { try { fs.rmSync(expressTmpDir, { recursive: true, force: true }) } catch { /* best effort */ } }
})

function request(method, pathname, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const r = http.request({ port, path: pathname, method, headers }, (res) => {
      let d = ''
      res.on('data', c => { d += c })
      res.on('end', () => resolve({ status: res.statusCode, body: d }))
    })
    r.on('error', reject)
    if (body != null) r.write(body)
    r.end()
  })
}

let envSaved
beforeEach(() => {
  envSaved = {
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
    WA_VERIFY_TOKEN: process.env.WA_VERIFY_TOKEN,
  }
})
afterEach(() => {
  for (const [k, v] of Object.entries(envSaved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

function setEnv(map) {
  for (const [k, v] of Object.entries(map)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}

test('triage — 401 when Authorization header is missing', async () => {
  const res = await request('POST', '/api/triage')
  assert.equal(res.status, 401)
  assert.equal(JSON.parse(res.body).error, 'unauthorized')
})

test('triage — 401 when Bearer token is wrong', async () => {
  const res = await request('POST', '/api/triage', { authorization: 'Bearer wrong' })
  assert.equal(res.status, 401)
  assert.equal(JSON.parse(res.body).error, 'unauthorized')
})

test('webhook — 403 when WEBHOOK_SECRET is unset (gate disabled)', async () => {
  setEnv({ WEBHOOK_SECRET: '', WA_VERIFY_TOKEN: undefined })
  const res = await request('GET', '/api/webhooks/anything/whatsapp?hub.verify_token=x&hub.challenge=abc')
  assert.equal(res.status, 403)
  assert.equal(JSON.parse(res.body).error, 'forbidden')
})

test('webhook — 403 when path secret mismatches WEBHOOK_SECRET', async () => {
  setEnv({ WEBHOOK_SECRET: 's3cret', WA_VERIFY_TOKEN: undefined })
  const res = await request('GET', '/api/webhooks/wrong/whatsapp?hub.verify_token=s3cret&hub.challenge=hello')
  assert.equal(res.status, 403)
  assert.equal(JSON.parse(res.body).error, 'forbidden')
})

test('webhook — 200 and echoes hub.challenge when path secret + verify_token match WEBHOOK_SECRET', async () => {
  setEnv({ WEBHOOK_SECRET: 's3cret', WA_VERIFY_TOKEN: undefined })
  const res = await request('GET', '/api/webhooks/s3cret/whatsapp?hub.verify_token=s3cret&hub.challenge=hello')
  assert.equal(res.status, 200)
  assert.equal(res.body, 'hello')
})

test('webhook — handshake does NOT require a Bearer auth token (independent gate)', async () => {
  setEnv({ WEBHOOK_SECRET: 's3cret', WA_VERIFY_TOKEN: undefined })
  const res = await request('GET', '/api/webhooks/s3cret/whatsapp?hub.verify_token=s3cret&hub.challenge=hi')
  assert.equal(res.status, 200)
  assert.equal(res.body, 'hi')
})

test('webhook — 200 via X-Webhook-Secret header even with arbitrary path secret', async () => {
  setEnv({ WEBHOOK_SECRET: 's3cret', WA_VERIFY_TOKEN: undefined })
  const res = await request(
    'GET',
    '/api/webhooks/anything/whatsapp?hub.verify_token=s3cret&hub.challenge=hello',
    { 'x-webhook-secret': 's3cret' }
  )
  assert.equal(res.status, 200)
  assert.equal(res.body, 'hello')
})

test('webhook — 403 when X-Webhook-Secret header is present but mismatches (header takes precedence over path)', async () => {
  setEnv({ WEBHOOK_SECRET: 's3cret', WA_VERIFY_TOKEN: undefined })
  const res = await request(
    'GET',
    '/api/webhooks/s3cret/whatsapp?hub.verify_token=s3cret&hub.challenge=hello',
    { 'x-webhook-secret': 'nope' }
  )
  assert.equal(res.status, 403)
  assert.equal(JSON.parse(res.body).error, 'forbidden')
})

test('webhook — 403 when path secret matches but hub.verify_token is wrong', async () => {
  setEnv({ WEBHOOK_SECRET: 's3cret', WA_VERIFY_TOKEN: undefined })
  const res = await request('GET', '/api/webhooks/s3cret/whatsapp?hub.verify_token=wrong&hub.challenge=hello')
  assert.equal(res.status, 403)
})

test('webhook — 200 when WA_VERIFY_TOKEN overrides WEBHOOK_SECRET for the handshake', async () => {
  setEnv({ WEBHOOK_SECRET: 's3cret', WA_VERIFY_TOKEN: 'waverify' })
  const res = await request('GET', '/api/webhooks/s3cret/whatsapp?hub.verify_token=waverify&hub.challenge=hello')
  assert.equal(res.status, 200)
  assert.equal(res.body, 'hello')
})
