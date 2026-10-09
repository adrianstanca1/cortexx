/** Native task actions mirror server-side tenant membership and persona rules.
 * The API still enforces access; these helpers only control which actions the
 * mobile interface offers and which fields may be sent by an operative. */
import type { AuthUser } from './api';

export type TaskForm = {
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  projectId: string;
  assigneeId: string;
};

export type TaskEditable = { id: string; title?: string | null; description?: string | null; status?: string | null; priority?: string | null; dueDate?: string | null; projectId?: string | null; assigneeId?: string | null }; 

export function taskPermissions(user: AuthUser) {
  const membership = String(user.organizationRole || user.organizations?.find(o => o.id === user.organization?.id)?.role || '').toLowerCase();
  const persona = String(user.role || '').toLowerCase();
  const canWrite = ['owner', 'admin', 'member'].includes(membership);
  const manager = ['owner', 'admin'].includes(membership);
  return {
    canCreate: canWrite,
    canChangeStatus: canWrite,
    canEdit: canWrite && persona !== 'operative',
    canDelete: canWrite && (manager || persona === 'project_manager'),
    canMoveProject: canWrite && (manager || persona === 'project_manager'),
    requiresProjectAssignee: !manager,
    statusOnly: canWrite && !manager && persona === 'operative',
  };
}

export function emptyTaskForm(defaultProjectId = ''): TaskForm {
  return { title: '', description: '', status: 'todo', priority: 'medium', dueDate: '', projectId: defaultProjectId, assigneeId: '' };
}

export function formFromTask(task: TaskEditable): TaskForm {
  return {
    title: task.title || '',
    description: task.description || '',
    status: task.status || 'todo',
    priority: task.priority || 'medium',
    dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : '',
    projectId: task.projectId || '',
    assigneeId: task.assigneeId || '',
  };
}

export function taskPayload(form: TaskForm, statusOnly = false) {
  if (statusOnly) return { status: form.status };
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    status: form.status,
    priority: form.priority,
    dueDate: form.dueDate || null,
    projectId: form.projectId || null,
    assigneeId: form.assigneeId || null,
  };
}

export function taskFormError(form: TaskForm, statusOnly = false): string | null {
  if (!['todo', 'in_progress', 'blocked', 'done'].includes(form.status)) return 'Choose a supported status.';
  if (statusOnly) return null;
  if (!form.title.trim()) return 'Task title is required.';
  if (!['low', 'medium', 'high', 'critical'].includes(form.priority)) return 'Choose a supported priority.';
  if (form.dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate)) return 'Use a due date in YYYY-MM-DD format.';
    const d = new Date(`${form.dueDate}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== form.dueDate) return 'Enter a valid calendar date.';
  }
  return null;
}

export function eligibleAssignees<T extends { id: string; assignments?: Array<{ projectId?: string; project?: { id?: string } }> }>(
  members: T[], projectId: string, user: AuthUser,
): T[] {
  if (!taskPermissions(user).requiresProjectAssignee) return members;
  if (!projectId) return [];
  return members.filter(member => member.assignments?.some(a => a.projectId === projectId || a.project?.id === projectId));
}
