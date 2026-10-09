import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { taskVisibilityWhere, visibleTaskById } from '../lib/task-visibility.ts'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('project manager sees both assigned project tasks and directly assigned tasks', () => {
  const where = taskVisibilityWhere('member', 'project_manager', 'manager@example.com')
  assert.equal(where.OR.length, 2)
  assert.equal(where.OR[0].project.assignments.some.member.email.equals, 'manager@example.com')
  assert.equal(where.OR[0].project.assignments.some.member.email.mode, 'insensitive')
  assert.equal(where.OR[1].assignee.email.equals, 'manager@example.com')
  assert.deepEqual(visibleTaskById('task-123', 'member', 'project_manager', 'manager@example.com'), { id: 'task-123', ...where })
})

test('foreman can open a personally assigned task, even outside assigned projects', () => {
  const where = visibleTaskById('task-456', 'member', 'foreman', 'FOREMAN@example.com')
  assert.equal(where.id, 'task-456')
  assert.equal(where.OR[1].assignee.email.equals, 'FOREMAN@example.com')
})

test('operative sees only tasks assigned to them, not all site tasks', () => {
  const where = visibleTaskById('task-321', 'member', 'operative', 'operative@example.com')
  assert.equal(where.id, 'task-321')
  assert.equal(where.assignee.email.equals, 'operative@example.com')
  assert.equal(where.OR, undefined)
})

test('users lacking email do not gain access to assigned project tasks', () => {
  for (const role of ['project_manager', 'foreman', 'operative']) {
    assert.deepEqual(taskVisibilityWhere('member', role, ''), { id: '__no_assigned_task__' })
    assert.deepEqual(taskVisibilityWhere('member', role, null), { id: '__no_assigned_task__' })
  }
})

test('company administrators can access company tasks regardless of field persona', () => {
  for (const orgRole of ['owner', 'admin']) {
    assert.deepEqual(taskVisibilityWhere(orgRole, 'operative', 'admin@example.com'), {})
    assert.deepEqual(visibleTaskById('task-789', orgRole, 'operative', null), { id: 'task-789' })
  }
})

test('task list and per-task endpoints use identical predicates and active organization tenancy', () => {
  const listing = read('app/api/tasks/route.ts')
  const details = read('app/api/tasks/[id]/route.ts')
  assert.match(listing, /taskVisibilityWhere\(organizationRole, appRole, email\)/)
  assert.match(listing, /const where: Prisma\.TaskWhereInput = \{ organizationId,/)
  assert.match(listing, /orderBy: \[\{ priority: 'desc' \}, \{ dueDate: 'asc' \}, \{ id: 'asc' \}\]/)
  assert.match(details, /visibleTaskById\(id, auth\.role, appRole\(auth\), email\(auth\)\)/)
  assert.match(details, /runWithOrg\(\{ organizationId: auth\.orgId/)
})

test('field leaders can update status but cannot edit or delete outside their assigned projects', () => {
  const details = read('app/api/tasks/[id]/route.ts')
  assert.match(details, /if \(!hasAssignedProject\) \{/)
  assert.match(details, /keys\.length !== 1 \|\| keys\[0\] !== 'status'/)
  assert.match(details, /Only task status can be changed outside assigned projects/)
  assert.match(details, /Only tasks in assigned projects can be deleted/)
})

test('navigating to global Tasks clears previous project filter and company switches reset navigation', () => {
  const tabs = read('expo/Tabs.tsx')
  assert.match(tabs, /if \(next === 'tasks'\) setTaskProjectId\(null\)/)
  assert.match(tabs, /setTaskProjectId\(null\);\s*setWebPath\('\/apps'\);\s*setTab\('overview'\)/)
  assert.match(tabs, /\}, \[user\.organization\?\.id\]\)/)
  assert.match(tabs, /<MoreScreen user=\{user\} onNavigate=\{onNavigate\}/)
})
