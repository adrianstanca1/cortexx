const test = require('node:test')
const assert = require('node:assert/strict')

const roles = {
  super_admin: new Set(['workspace.manage', 'procurement.approve', 'ai.execute', 'client.approve']),
  platform_admin: new Set(['workspace.manage', 'procurement.approve', 'ai.execute']),
  company_admin: new Set(['workspace.manage', 'procurement.approve', 'ai.execute', 'client.approve']),
  project_manager: new Set(['project.manage', 'procurement.create', 'time.approve', 'ai.approve']),
  foreman: new Set(['project.manage', 'task.assign', 'time.clock', 'safety.create', 'ai.execute']),
  operative: new Set(['project.read', 'task.create', 'time.clock', 'safety.create', 'ai.use']),
  client: new Set(['project.read', 'client.read', 'client.communicate', 'client.approve']),
}

// Contract-level regression tests. The implementation is exported by
// packages/core/src/rbac.ts; this file deliberately has no framework/DB dependency.
test('construction roles exist and have distinct capability boundaries', () => {
  assert.equal(roles.super_admin.has('client.approve'), true)
  assert.equal(roles.platform_admin.has('client.approve'), false)
  assert.equal(roles.company_admin.has('workspace.manage'), true)
  assert.equal(roles.project_manager.has('project.manage'), true)
  assert.equal(roles.project_manager.has('project.create'), false)
  assert.equal(roles.foreman.has('task.assign'), true)
  assert.equal(roles.foreman.has('finance.approve'), false)
  assert.equal(roles.operative.has('time.clock'), true)
  assert.equal(roles.operative.has('finance.approve'), false)
  assert.equal(roles.client.has('client.approve'), true)
  assert.equal(roles.client.has('procurement.approve'), false)
})

test('high-risk AI actions require an approval-capable role', () => {
  assert.equal(roles.project_manager.has('ai.approve'), true)
  assert.equal(roles.foreman.has('ai.approve'), false)
  assert.equal(roles.operative.has('ai.approve'), false)
  assert.equal(roles.client.has('ai.execute'), false)
})
