import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { taskActionPermissions } from '../lib/task-visibility.ts'
import { effectiveTaskPermissions } from '../expo/task-management.ts'

const user = (role, organizationRole = 'member') => ({
  id: 'user-1', email: 'worker@example.com', role, organizationRole,
  organization: { id: 'org-active', slug: 'active', name: 'Active' },
})

const allFalse = { canChangeStatus: false, canEdit: false, canDelete: false, canMoveProject: false, statusOnly: false }

test('project manager with directly assigned task outside any assigned project can change status only', () => {
  const server = taskActionPermissions('member', 'project_manager', false)
  const client = effectiveTaskPermissions(user('project_manager'), server)
  assert.deepEqual(client, { canChangeStatus: true, canEdit: false, canDelete: false, canMoveProject: false, statusOnly: true })
})

test('project manager in assigned source project can edit and delete and relocate with server enforcement', () => {
  const server = taskActionPermissions('member', 'project_manager', true)
  assert.deepEqual(effectiveTaskPermissions(user('project_manager'), server), {
    canChangeStatus: true, canEdit: true, canDelete: true, canMoveProject: true, statusOnly: false,
  })
})

test('foreman can edit within assigned project but cannot delete or relocate', () => {
  const server = taskActionPermissions('member', 'foreman', true)
  assert.deepEqual(effectiveTaskPermissions(user('foreman'), server), {
    canChangeStatus: true, canEdit: true, canDelete: false, canMoveProject: false, statusOnly: false,
  })
})

test('operative may change only task status, regardless of project assignment', () => {
  for (const assigned of [true, false]) {
    const server = taskActionPermissions('member', 'operative', assigned)
    assert.deepEqual(effectiveTaskPermissions(user('operative'), server), {
      canChangeStatus: true, canEdit: false, canDelete: false, canMoveProject: false, statusOnly: true,
    })
  }
})

test('company owner and admin can edit, move, and delete regardless of field persona', () => {
  for (const role of ['owner', 'admin']) {
    const server = taskActionPermissions(role, 'operative', false)
    assert.deepEqual(effectiveTaskPermissions(user('operative', role), server), {
      canChangeStatus: true, canEdit: true, canDelete: true, canMoveProject: true, statusOnly: false,
    })
  }
})

test('viewer cannot mutate even with server flags erroneously allowing everything', () => {
  const server = taskActionPermissions('owner', 'company_admin', true)
  assert.deepEqual(effectiveTaskPermissions(user('company_admin', 'viewer'), server), allFalse)
})

test('missing/legacy server capabilities fail closed: no editable actions offered', () => {
  const u = user('project_manager')
  assert.deepEqual(effectiveTaskPermissions(u, undefined), allFalse)
  assert.deepEqual(effectiveTaskPermissions(u, null), allFalse)
  assert.deepEqual(effectiveTaskPermissions(u, {}), allFalse)
})

test('server/task UI contract: API sends per-task capabilities derived from source membership', () => {
  const server = readFileSync(new URL('../app/api/tasks/[id]/route.ts', import.meta.url), 'utf8')
  const screen = readFileSync(new URL('../expo/TasksScreen.tsx', import.meta.url), 'utf8')
  assert.match(server, /const sourceProjectAssigned = !!task\.projectId && await assignedProject\(task\.projectId, auth\)/)
  assert.match(server, /taskActionPermissions\(auth\.role, appRole\(auth\), sourceProjectAssigned\)/)
  assert.match(server, /NextResponse\.json\(\{ \.\.\.task, permissions \}\)/)
  assert.match(screen, /effectiveTaskPermissions\(user, editingTask\?\.permissions\)/)
  assert.match(screen, /const statusOnly = !!editingTask && detailPermissions\.statusOnly/)
  assert.match(screen, /detailPermissions\.canMoveProject/)
  assert.match(screen, /detailPermissions\.canDelete/)
  assert.match(screen, /detailPermissions\.canEdit/)
})
