/**
 * Unit tests for the audit + cron + email helper pure logic.
 * No DB / framework calls — these mirror lib/audit.ts, lib/cron.ts,
 * lib/email.ts so they stay covered if those files are refactored.
 */
const test = require('node:test')
const assert = require('node:assert/strict')

// ─── audit.requestMeta — IP extraction precedence ────────────────────

function requestMeta(req) {
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    null
  const userAgent = req.headers.get('user-agent')?.slice(0, 280) || null
  return { ipAddress, userAgent }
}
function makeReq(headers) {
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
  return { headers: { get: (k) => map.get(k.toLowerCase()) || null } }
}

test('requestMeta: x-forwarded-for wins over x-real-ip', () => {
  const meta = requestMeta(makeReq({
    'x-forwarded-for': '203.0.113.1',
    'x-real-ip': '203.0.113.99',
  }))
  assert.equal(meta.ipAddress, '203.0.113.1')
})

test('requestMeta: takes first IP from comma-separated x-forwarded-for', () => {
  const meta = requestMeta(makeReq({
    'x-forwarded-for': '203.0.113.1, 10.0.0.2, 10.0.0.3',
  }))
  assert.equal(meta.ipAddress, '203.0.113.1')
})

test('requestMeta: falls back to x-real-ip when forwarded-for missing', () => {
  const meta = requestMeta(makeReq({ 'x-real-ip': '198.51.100.5' }))
  assert.equal(meta.ipAddress, '198.51.100.5')
})

test('requestMeta: null when no IP headers present', () => {
  const meta = requestMeta(makeReq({}))
  assert.equal(meta.ipAddress, null)
})

test('requestMeta: user-agent clamped at 280 chars', () => {
  const longUA = 'A'.repeat(500)
  const meta = requestMeta(makeReq({ 'user-agent': longUA }))
  assert.equal(meta.userAgent.length, 280)
})

// ─── cron secret bearer verification ─────────────────────────────────

function requireCronAuth(req, secret) {
  if (!secret) return { ok: false, status: 503 }
  const header = req.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match || match[1].trim() !== secret) return { ok: false, status: 401 }
  return { ok: true }
}

test('requireCronAuth: 503 when no secret configured', () => {
  const r = requireCronAuth(makeReq({}), '')
  assert.equal(r.status, 503)
})

test('requireCronAuth: 401 when bearer missing', () => {
  const r = requireCronAuth(makeReq({}), 'sec123')
  assert.equal(r.status, 401)
})

test('requireCronAuth: 401 when bearer wrong', () => {
  const r = requireCronAuth(makeReq({ 'authorization': 'Bearer wrong' }), 'sec123')
  assert.equal(r.status, 401)
})

test('requireCronAuth: ok on exact match', () => {
  const r = requireCronAuth(makeReq({ 'authorization': 'Bearer sec123' }), 'sec123')
  assert.equal(r.ok, true)
})

test('requireCronAuth: case-insensitive scheme', () => {
  const r = requireCronAuth(makeReq({ 'authorization': 'bearer sec123' }), 'sec123')
  assert.equal(r.ok, true)
})

test('requireCronAuth: trims whitespace around token', () => {
  const r = requireCronAuth(makeReq({ 'authorization': 'Bearer   sec123   ' }), 'sec123')
  assert.equal(r.ok, true)
})

// ─── plan resolution: matches PLANS table in lib/billing.ts ──────────

const PLANS = {
  starter: { limits: { users: 5, projects: 10 } },
  pro: { limits: { users: 20, projects: 50 } },
  enterprise: { limits: { users: 999, projects: 999 } },
}
function planByKey(key) {
  return key && key in PLANS ? PLANS[key] : PLANS.starter
}

test('planByKey: known plan returns its config', () => {
  assert.equal(planByKey('pro').limits.users, 20)
  assert.equal(planByKey('enterprise').limits.users, 999)
})

test('planByKey: unknown plan defaults to starter', () => {
  assert.equal(planByKey('mythical').limits.users, 5)
  assert.equal(planByKey(null).limits.users, 5)
  assert.equal(planByKey(undefined).limits.users, 5)
  assert.equal(planByKey('').limits.users, 5)
})

// ─── email template subject limits — mirror lib/email.ts clamp ───────

function clampSubject(s) {
  return s.slice(0, 200)
}

test('subject clamp: 200 chars max', () => {
  const long = 'X'.repeat(500)
  assert.equal(clampSubject(long).length, 200)
  assert.equal(clampSubject('short').length, 5)
})
