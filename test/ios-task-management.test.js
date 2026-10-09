import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { eligibleAssignees, emptyTaskForm, formFromTask, taskFormError, taskPayload, taskPermissions } from '../expo/task-management.ts'

const user = (role, organizationRole = 'member') => ({
  id: 'user-a', email: 'tester@example.com', role, organizationRole,
  organization: { id: 'org-a', name: 'Company A', slug: 'company-a' },
})

test('task management matches organization write permissions and field roles', () => {
  const owner = taskPermissions(user('company_admin', 'owner'))
  const manager = taskPermissions(user('project_manager'))
  const foreman = taskPermissions(user('foreman'))
  const operative = taskPermissions(user('operative'))
  const viewer = taskPermissions(user('operative', 'viewer'))
  assert.deepEqual(owner, { canCreate: true, canChangeStatus: true, canEdit: true, canDelete: true, canMoveProject: true, requiresProjectAssignee: false, statusOnly: false })
  assert.equal(manager.canDelete, true)
  assert.equal(manager.canEdit, true)
  assert.equal(foreman.canEdit, true)
  assert.equal(foreman.canDelete, false)
  assert.equal(foreman.canMoveProject, false)
  assert.equal(operative.canEdit, false)
  assert.equal(operative.statusOnly, true)
  assert.equal(operative.canDelete, false)
  assert.equal(operative.canMoveProject, false)
  assert.equal(viewer.canCreate, false)
  assert.equal(viewer.canChangeStatus, false)
  assert.equal(viewer.canDelete, false)
})

test('current company membership wins over membership in another company', () => {
  const u = user('company_admin', undefined)
  delete u.organizationRole
  u.organizations = [
    { id: 'org-b', name: 'Company B', role: 'owner' },
    { id: 'org-a', name: 'Company A', role: 'viewer' },
  ]
  assert.equal(taskPermissions(u).canCreate, false)
  assert.equal(taskPermissions(u).canDelete, false)
})

test('operative task mutation contains ONLY the status field', () => {
  const edited = formFromTask({ id: 't1', title: 'Roof cladding', description: 'east side', projectId: 'p1', assigneeId: 'm2', priority: 'high', status: 'todo' })
  edited.status = 'done'
  assert.deepEqual(taskPayload(edited, true), { status: 'done' })
  assert.equal(taskFormError(edited, true), null)
})

test('full edit payload retains current assignment and normalizes nullable values', () => {
  const task = formFromTask({ id: 't2', title: '  Update drawing  ', status: 'in_progress', dueDate: '2026-11-20T00:00:00.000Z', projectId: 'p1', assigneeId: 'm2' })
  assert.equal(task.dueDate, '2026-11-20')
  assert.deepEqual(taskPayload(task), {
    title: 'Update drawing', description: null, status: 'in_progress', priority: 'medium', dueDate: '2026-11-20', projectId: 'p1', assigneeId: 'm2',
  })
  assert.deepEqual(taskPayload(emptyTaskForm()), {
    title: '', description: null, status: 'todo', priority: 'medium', dueDate: null, projectId: null, assigneeId: null,
  })
})

test('reject malformed dates, impossible calendar days, empty titles and unsupported statuses', () => {
  const valid = { ...emptyTaskForm('p1'), title: 'Install panels', dueDate: '2028-02-29' }
  assert.equal(taskFormError(valid), null)
  assert.match(taskFormError({ ...valid, dueDate: '2027-02-29' }), /valid calendar date/i)
  assert.match(taskFormError({ ...valid, dueDate: '29/02/2028' }), /YYYY-MM-DD/i)
  assert.match(taskFormError({ ...valid, title: '   ' }), /title/i)
  assert.match(taskFormError({ ...valid, status: 'unsupported' }), /status/i)
  assert.equal(taskFormError({ ...valid, dueDate: 'invalid' }, true), null)
})

test('native task editor is connected to exact web REST routes and native project navigation', () => {
  const taskScreen = readFileSync(new URL('../expo/TasksScreen.tsx', import.meta.url), 'utf8')
  const taskApi = readFileSync(new URL('../expo/api.ts', import.meta.url), 'utf8')
  const tabs = readFileSync(new URL('../expo/Tabs.tsx', import.meta.url), 'utf8')
  const detail = readFileSync(new URL('../expo/ProjectDetailScreen.tsx', import.meta.url), 'utf8')
  const server = readFileSync(new URL('../app/api/tasks/[id]/route.ts', import.meta.url), 'utf8')
  assert.match(taskScreen, /apiGet\(`\/api\/tasks\/\$\{encodeURIComponent\(task\.id\)\}`\)/)
  assert.match(taskScreen, /putCollection\('tasks', editingTask\.id, body\)/)
  assert.match(taskScreen, /apiDelete\(`\/api\/tasks\/\$\{encodeURIComponent\(task\.id\)\}`\)/)
  assert.match(taskScreen, /taskPermissions\(user\)/)
  assert.match(taskApi, /method: 'DELETE'/)
  assert.match(taskApi, /await clearToken\(\)/)
  assert.match(server, /if \(!canWrite\(auth\.role \|\| ''\)\)/)
  assert.match(server, /Operatives can only update task status/)
  assert.match(server, /Company Admin or Project Manager permission required to delete tasks/)
  assert.match(tabs, /onOpenTasks=\{openProjectTasks\}/)
  assert.match(tabs, /projectId=\{taskProjectId\}/)
  assert.match(detail, /Open project tasks in the iOS app/)
})

test('project managers may assign only team members already assigned to their project', () => {
  const members = [
    { id: 'a', assignments: [{ projectId: 'project1' }] },
    { id: 'b', assignments: [{ project: { id: 'project2' } }] },
    { id: 'c', assignments: [] },
  ];
  assert.deepEqual(eligibleAssignees(members, 'project1', user('project_manager')).map(x => x.id), ['a']);
  assert.deepEqual(eligibleAssignees(members, 'project1', user('foreman')).map(x => x.id), ['a']);
  assert.deepEqual(eligibleAssignees(members, 'project1', user('company_admin', 'admin')).map(x => x.id), ['a','b','c']);
  assert.deepEqual(eligibleAssignees(members, '', user('project_manager')), []);
})
