// Tasks Tab - Task board, create/edit, drag-drop, filter

import React, { useState, useCallback } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { useProjectTasks } from '../../../hooks/useData';
import { projectTasksApi } from '../../../services/api';
import { TASK_STATUSES, PRIORITY_CFG, TASK_FORM_DEFAULTS } from './types';
import { KanbanColumn } from './shared';
import type { AnyRow } from './types';
import { toast } from 'sonner';

interface TasksTabProps {
  projectId: string;
}

export function TasksTab({ projectId }: TasksTabProps) {
  const { data: rawTasks = [], isLoading, refetch } = useProjectTasks.useList();
  const allTasks = rawTasks as AnyRow[];
  const tasks = allTasks.filter((t: AnyRow) => String(t.project_id ?? '') === projectId);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(TASK_FORM_DEFAULTS);
  const [editingTask, setEditingTask] = useState<AnyRow | null>(null);
  const [editForm, setEditForm] = useState(TASK_FORM_DEFAULTS);
  const [filterPriority, setFilterPriority] = useState('all');
  const [_filterAssignee, _setFilterAssignee] = useState('all');
  const [_draggingTask, _setDraggingTask] = useState<string | null>(null);

  const filteredTasks = tasks.filter((t: AnyRow) => {
    if (filterPriority !== 'all' && String(t.priority ?? '') !== filterPriority) return false;
    if (_filterAssignee !== 'all' && String(t.assigned_to ?? '') !== _filterAssignee) return false;
    return true;
  });

  const byStatus = TASK_STATUSES.reduce((acc, status) => {
    acc[status] = filteredTasks.filter((t: AnyRow) => t.status === status);
    return acc;
  }, {} as Record<string, AnyRow[]>);

  const handleCreate = useCallback(async () => {
    if (!createForm.title.trim()) { toast.error('Title is required'); return; }
    try {
      await projectTasksApi.create({
        project_id: projectId,
        title: createForm.title,
        description: createForm.description,
        priority: createForm.priority,
        assigned_to: createForm.assigned_to || null,
        due_date: createForm.due_date || null,
        category: createForm.category,
        estimated_hours: createForm.estimated_hours ? parseFloat(createForm.estimated_hours) : null,
        status: 'todo',
      });
      toast.success('Task created');
      setCreateForm(TASK_FORM_DEFAULTS);
      setShowCreate(false);
      refetch();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to create task');
    }
  }, [createForm, projectId, refetch]);

  const handleUpdate = useCallback(async () => {
    if (!editingTask) return;
    try {
      await projectTasksApi.update(String(editingTask.id), {
        title: editForm.title,
        description: editForm.description,
        priority: editForm.priority,
        assigned_to: editForm.assigned_to || null,
        due_date: editForm.due_date || null,
        category: editForm.category,
        estimated_hours: editForm.estimated_hours ? parseFloat(editForm.estimated_hours) : null,
      });
      toast.success('Task updated');
      setEditingTask(null);
      refetch();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to update task');
    }
  }, [editingTask, editForm, refetch]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await projectTasksApi.delete(id);
      toast.success('Task deleted');
      refetch();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to delete task');
    }
  }, [refetch]);

  const handleStatusChange = useCallback(async (id: string, newStatus: string) => {
    try {
      await projectTasksApi.update(id, { status: newStatus });
      refetch();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to update status');
    }
  }, [refetch]);

  function openEdit(task: AnyRow) {
    setEditingTask(task);
    setEditForm({
      title: String(task.title ?? ''),
      description: String(task.description ?? ''),
      priority: String(task.priority ?? 'medium'),
      assigned_to: String(task.assigned_to ?? ''),
      due_date: String(task.due_date ?? ''),
      category: String(task.category ?? 'general'),
      estimated_hours: String(task.estimated_hours ?? ''),
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            className="bg-gray-800 border border-gray-700 btn btn-sm text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="all">All Priorities</option>
            {Object.entries(PRIORITY_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <span className="text-xs text-gray-400">{filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}</span>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-1.5 btn btn-primary text-sm rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" /> Create Task
        </button>
      </div>

      {/* Create task modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-bold text-white">Create Task</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Title *</label>
                <input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title"
                  className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description</label>
                <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} rows={2}
                  placeholder="Task details..."
                  className="w-full input input-bordered w-full resize-none focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Priority</label>
                  <select value={createForm.priority} onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500">
                    {Object.entries(PRIORITY_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Due Date</label>
                  <input type="date" value={createForm.due_date} onChange={e => setCreateForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Assigned To</label>
                  <input value={createForm.assigned_to} onChange={e => setCreateForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder="Name"
                    className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Estimated Hours</label>
                  <input type="number" value={createForm.estimated_hours} onChange={e => setCreateForm(f => ({ ...f, estimated_hours: e.target.value }))} placeholder="0"
                    className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Category</label>
                <input value={createForm.category} onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))} placeholder="general"
                  className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleCreate}
                  className="flex-1 btn btn-primary rounded-lg py-2 text-sm font-semibold transition-colors">
                  Create Task
                </button>
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 btn btn-ghost rounded-lg py-2 text-sm font-semibold transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit task modal */}
      {editingTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-bold text-white">Edit Task</h3>
              <button onClick={() => setEditingTask(null)} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Title *</label>
                <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description</label>
                <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2}
                  className="w-full input input-bordered w-full resize-none focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Priority</label>
                  <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500">
                    {Object.entries(PRIORITY_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Due Date</label>
                  <input type="date" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Assigned To</label>
                  <input value={editForm.assigned_to} onChange={e => setEditForm(f => ({ ...f, assigned_to: e.target.value }))}
                    className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Estimated Hours</label>
                  <input type="number" value={editForm.estimated_hours} onChange={e => setEditForm(f => ({ ...f, estimated_hours: e.target.value }))}
                    className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleUpdate}
                  className="flex-1 btn btn-primary rounded-lg py-2 text-sm font-semibold transition-colors">
                  Save Changes
                </button>
                <button onClick={() => setEditingTask(null)}
                  className="flex-1 btn btn-ghost rounded-lg py-2 text-sm font-semibold transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kanban board */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-5 gap-3 cb-table-scroll touch-pan-x pb-4">
          {TASK_STATUSES.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={byStatus[status] ?? []}
              onEdit={openEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* Summary bar */}
      {!isLoading && filteredTasks.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-gray-400 card bg-base-100 border border-base-300 px-4 py-3">
          <span><strong className="text-white">{filteredTasks.length}</strong> total tasks</span>
          <span>·</span>
          <span><strong className="text-green-400">{(filteredTasks as AnyRow[]).filter((t: AnyRow) => t.status === 'done').length}</strong> done</span>
          <span>·</span>
          <span><strong className="text-blue-400">{(filteredTasks as AnyRow[]).filter((t: AnyRow) => t.status === 'in_progress').length}</strong> in progress</span>
          <span>·</span>
          <span><strong className="text-red-400">{(filteredTasks as AnyRow[]).filter((t: AnyRow) => t.status === 'blocked').length}</strong> blocked</span>
          <span>·</span>
          <span><strong className="text-yellow-400">{(filteredTasks as AnyRow[]).filter((t: AnyRow) => {
            if (!t.due_date) return false;
            const diff = (new Date(String(t.due_date)).getTime() - Date.now()) / 86400000;
            return diff < 0 && t.status !== 'done';
          }).length}</strong> overdue</span>
        </div>
      )}
    </div>
  );
}
