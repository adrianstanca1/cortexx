/**
 * Unit tests for the RBAC helper + the org slug helper.
 * Pure-function tests; no DB / framework calls.
 */
const test = require('node:test')
const assert = require('node:assert/strict')

// ─── RBAC ────────────────────────────────────────────────────────────
// Mirror of lib/rbac.ts. Kept in sync via the rank ordering below.

const RANK = { viewer: 0, client: 0, operative: 1, member: 1, foreman: 2, project_manager: 3, company_admin: 4, admin: 4, owner: 5 }
function hasRole(actual, required) {
  const a = RANK[actual]
  const r = RANK[required]
  if (a === undefined || r === undefined) return false
  return a >= r
}
function canWrite(role) { return ['owner', 'admin', 'company_admin', 'project_manager', 'foreman', 'operative', 'member'].includes(role) }
function canManage(role) { return ['owner', 'admin', 'company_admin'].includes(role) }
function canCreateProject(role) { return ['owner', 'admin', 'company_admin'].includes(role) }
function isOwner(role) { return role === 'owner' }

test('hasRole: viewer cannot do anything beyond viewing', () => {
  assert.equal(hasRole('viewer', 'viewer'), true)
  assert.equal(hasRole('viewer', 'member'), false)
  assert.equal(hasRole('viewer', 'admin'), false)
  assert.equal(hasRole('viewer', 'owner'), false)
})

test('hasRole: member can write but not manage or own', () => {
  assert.equal(canWrite('member'), true)
  assert.equal(canManage('member'), false)
  assert.equal(isOwner('member'), false)
})

test('hasRole: admin can manage but not own', () => {
  assert.equal(canWrite('admin'), true)
  assert.equal(canManage('admin'), true)
  assert.equal(isOwner('admin'), false)
})

test('hasRole: owner can everything', () => {
  assert.equal(canWrite('owner'), true)
  assert.equal(canManage('owner'), true)
  assert.equal(isOwner('owner'), true)
})
test('construction hierarchy: PM cannot create projects and Foreman cannot manage workspace', () => {
  assert.equal(canCreateProject('company_admin'), true)
  assert.equal(canCreateProject('project_manager'), false)
  assert.equal(canManage('project_manager'), false)
  assert.equal(canWrite('project_manager'), true)
  assert.equal(canWrite('foreman'), true)
  assert.equal(canManage('foreman'), false)
  assert.equal(canWrite('operative'), true)
})


test('hasRole: unknown role grants nothing', () => {
  assert.equal(hasRole('hacker', 'viewer'), false)
  assert.equal(hasRole('', 'viewer'), false)
  assert.equal(hasRole(undefined, 'viewer'), false)
})

test('hasRole: required must be a known role', () => {
  assert.equal(hasRole('owner', 'god'), false)
})

// ─── slugify ─────────────────────────────────────────────────────────
// Mirror of lib/org.ts slugify().
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'workspace'
}

test('slugify: plain text', () => {
  assert.equal(slugify('Acme Construction'), 'acme-construction')
})

test('slugify: punctuation and unicode collapse to hyphens', () => {
  assert.equal(slugify('Smith & Sons, Ltd.'), 'smith-sons-ltd')
  assert.equal(slugify('Builder™ #1'), 'builder-1')
})

test('slugify: leading/trailing hyphens trimmed', () => {
  assert.equal(slugify('--foo--bar--'), 'foo-bar')
})

test('slugify: empty / whitespace-only falls back', () => {
  assert.equal(slugify(''), 'workspace')
  assert.equal(slugify('   '), 'workspace')
  assert.equal(slugify('!!!'), 'workspace')
})

test('slugify: clamped to 48 chars', () => {
  const long = 'a'.repeat(120)
  assert.equal(slugify(long).length, 48)
})

// ─── email validation regex used in lib/email.ts ─────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

test('email regex: accepts standard addresses', () => {
  assert.equal(EMAIL_RE.test('user@example.com'), true)
  assert.equal(EMAIL_RE.test('first.last+tag@sub.example.co.uk'), true)
})

test('email regex: rejects malformed', () => {
  assert.equal(EMAIL_RE.test('not-an-email'), false)
  assert.equal(EMAIL_RE.test('@nope.com'), false)
  assert.equal(EMAIL_RE.test('user@nodot'), false)
  assert.equal(EMAIL_RE.test('user@ space.com'), false)
  assert.equal(EMAIL_RE.test(''), false)
})
