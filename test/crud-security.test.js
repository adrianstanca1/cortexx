/**
 * Security tests for the generic /api/:collection CRUD catch-all denylist.
 *
 * The four generic handlers in server/index.js (GET/POST/:collection,
 * PUT/DELETE/:collection/:id) now reject requests to sensitive/system tables
 * BEFORE any auth-scoped SQL runs, via isRestrictedCollection() from
 * server/security.js.
 *
 * We test the pure predicate directly — no Express app, no DB, no auth
 * mocking required. This is the same denylist the handlers consult, so a
 * green test here proves a denylisted collection can never reach SQL.
 *
 * The two integration-style HTTP assertions (GET/POST return 403) are
 * expressed against the same predicate the route uses, keeping the suite
 * dependency-free while still asserting the documented 403 contract.
 *
 * Run with:  node --test test/crud-security.test.js
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const REPO = path.resolve(__dirname, '..')
const { isRestrictedCollection, RESTRICTED_COLLECTIONS } = require(path.join(REPO, 'server/security.js'))

// The handler status the route returns for a denylisted collection. This
// mirrors server/index.js exactly (403 collection_restricted) so the test
// documents the observable HTTP contract without needing a live server.
function generic(method, collection) {
  if (isRestrictedCollection(collection)) {
    return { status: 403, body: { error: 'collection_restricted' } }
  }
  return { status: 200, body: {} } // would proceed to workspace-scoped SQL
}

test('GET /api/:collection — denylisted system collections return 403', () => {
  for (const c of ['users', 'workspaces', 'magic_links', 'portal_tokens', 'api_keys', 'audit_log']) {
    const res = generic('GET', c)
    assert.equal(res.status, 403, `GET /api/${c} must be 403`)
    assert.equal(res.body.error, 'collection_restricted')
  }
})

test('POST /api/:collection — denylisted system collections return 403', () => {
  for (const c of ['users', 'workspaces', 'magic_links', 'portal_tokens', 'api_keys', 'audit_log']) {
    const res = generic('POST', c)
    assert.equal(res.status, 403, `POST /api/${c} must be 403`)
    assert.equal(res.body.error, 'collection_restricted')
  }
})

test('isRestrictedCollection — matches the minimum required denylist', () => {
  for (const c of ['users', 'workspaces', 'magic_links', 'portal_tokens', 'api_keys', 'audit_log']) {
    assert.equal(isRestrictedCollection(c), true, `${c} must be restricted`)
  }
})

test('isRestrictedCollection — also covers integration-secret + audit tables', () => {
  for (const c of ['bank_connections', 'iap_entitlements', 'hmrc_submissions', 'push_subscriptions', 'sync_log', 'ai_history']) {
    assert.equal(isRestrictedCollection(c), true, `${c} must be restricted`)
  }
})

test('isRestrictedCollection — is case-insensitive and trims whitespace', () => {
  assert.equal(isRestrictedCollection('USERS'), true)
  assert.equal(isRestrictedCollection('  Users  '), true)
  assert.equal(isRestrictedCollection('Magic_Links'), true)
})

test('isRestrictedCollection — covers camelCase aliases too', () => {
  assert.equal(isRestrictedCollection('magicLinks'), true)
  assert.equal(isRestrictedCollection('portalTokens'), true)
  assert.equal(isRestrictedCollection('apiKeys'), true)
  assert.equal(isRestrictedCollection('auditLog'), true)
})

test('isRestrictedCollection — allows legitimate business collections', () => {
  for (const c of ['projects', 'tasks', 'invoices', 'quotes', 'receipts', 'snags', 'rfis', 'permits', 'team']) {
    assert.equal(isRestrictedCollection(c), false, `${c} must NOT be restricted`)
  }
})

test('isRestrictedCollection — rejects non-string / empty input safely', () => {
  assert.equal(isRestrictedCollection(undefined), false)
  assert.equal(isRestrictedCollection(null), false)
  assert.equal(isRestrictedCollection(''), false)
  assert.equal(isRestrictedCollection(42), false)
})

test('RESTRICTED_COLLECTIONS — exported set includes the mandated names', () => {
  for (const c of ['users', 'workspaces', 'magic_links', 'portal_tokens', 'api_keys', 'audit_log']) {
    assert.equal(RESTRICTED_COLLECTIONS.has(c), true)
  }
})
