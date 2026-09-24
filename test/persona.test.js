const test = require('node:test')
const assert = require('node:assert/strict')

function resolvePersona(personaRole, legacyRole, orgRole) {
  const valid = new Set(['super_admin', 'platform_admin', 'company_admin', 'project_manager', 'foreman', 'operative', 'client'])
  if (valid.has(personaRole)) return personaRole
  if (valid.has(legacyRole)) return legacyRole
  if (legacyRole === 'admin' || orgRole === 'owner' || orgRole === 'admin') return 'company_admin'
  return 'operative'
}

test('tenant persona wins over legacy global user role', () => {
  assert.equal(resolvePersona('foreman', 'project_manager', 'member'), 'foreman')
})

test('legacy persona remains a backward-compatible fallback', () => {
  assert.equal(resolvePersona(undefined, 'project_manager', 'member'), 'project_manager')
})

test('legacy admin/owner memberships safely map to Company Admin', () => {
  assert.equal(resolvePersona(undefined, 'admin', 'member'), 'company_admin')
  assert.equal(resolvePersona(undefined, 'member', 'owner'), 'company_admin')
})

test('ordinary legacy members default to Operative', () => {
  assert.equal(resolvePersona(undefined, 'member', 'member'), 'operative')
})
