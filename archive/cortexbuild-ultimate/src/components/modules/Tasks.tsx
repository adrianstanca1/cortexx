import React, { useState, useMemo, useCallback } from 'react';
import {
  CheckSquare, Plus, Search, X, Filter, CalendarDays, LayoutTemplate,
  List, Clock, AlertTriangle, Tag, User, BarChart3, RefreshCw,
  ArrowRight, Trash2, Edit3, MoreHorizontal, ChevronDown, Copy,
  CheckCircle2, Circle, Timer, ClipboardList, ArrowUpDown,
} from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { useTasks } from '../../hooks/useData';
import { tasksApi } from '../../services/api';
import { toast } from 'sonner';

type AnyRow = Record<string, unknown>;

type TaskRow = {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  due_date?: string;
  estimated_hours?: string | number;
  tags?: string;
  category?: string;
  checklist?: unknown;
  assigned_to?: string;
  project_id?: string;
  parent_task_id?: string | null;
};


type ViewMode = 'list' | 'kanban' | 'calendar';

const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done', 'blocked'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const CATEGORIES = ['general', 'design', 'mep', 'structural', 'finishes', 'safety', 'qa', 'admin'];

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  blocked: 'Blocked',
};

const STATUS_COLOURS: Record<string, string> = {
  todo: 'bg-slate-800/60 border-slate-600 text-slate-200',
  in_progress: 'bg-blue-900/30 border-blue-600 text-blue-200',
  review: 'bg-amber-900/30 border-amber-600 text-amber-200',
  done: 'bg-green-900/30 border-green-600 text-green-200',
  blocked: 'bg-red-900/30 border-red-600 text-red-200',
};

const PRIORITY_COLOURS: Record<string, string> = {
  low: 'text-slate-400',
  medium: 'text-blue-400',
  high: 'text-amber-400',
  critical: 'text-red-400',
};

const emptyForm = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  assigned_to: '',
  due_date: '',
  category: 'general',
  estimated_hours: '',
  tags: '',
  project_id: '',
  checklist: [] as { item: string; completed: boolean }[],
};

function safeChecklist(val: unknown): { item: string; completed: boolean }[] {
  if (!val) return [];
  if (Array.isArray(val)) return val as { item: string; completed: boolean }[];
  try { return JSON.parse(String(val)); } catch { return []; }
}

/* ─── Tasks Module ─────────────────────────────────────────────────────────── */
export function Tasks() {
  const { useList, useCreate, useUpdate, useDelete } = useTasks;
  const { data: raw = [], isLoading, refetch } = useList();
  const tasks = (raw as unknown as TaskRow[]).filter((t) => !t.parent_task_id);
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [view, setView] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [detailTask, setDetailTask] = useState<AnyRow | null>(null);

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  /* Filtered list */
  const filtered: TaskRow[] = useMemo(() => {
    return (tasks as unknown as TaskRow[]).filter((t: TaskRow) => {
      const s = search.toLowerCase();
      const matchSearch =
        String(t.title ?? '').toLowerCase().includes(s) ||
        String(t.description ?? '').toLowerCase().includes(s) ||
        String(t.tags ?? '').toLowerCase().includes(s);
      const matchStatus = statusFilter === 'All' || t.status === statusFilter;
      const matchPriority = priorityFilter === 'All' || t.priority === priorityFilter;
      const matchCat = categoryFilter === 'All' || t.category === categoryFilter;
      return matchSearch && matchStatus && matchPriority && matchCat;
    });
  }, [tasks, search, statusFilter, priorityFilter, categoryFilter]);

  const grouped = useMemo(() => {
    const g: Record<string, TaskRow[]> = {};
    TASK_STATUSES.forEach((st) => (g[st] = []));
    filtered.forEach((t) => {
      const st = String(t.status ?? 'todo');
      if (!g[st]) g[st] = [];
      g[st].push(t);
    });
    return g;
  }, [filtered]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (task: AnyRow) => {
    setEditing(task);
    setForm({
      title: String(task.title ?? ''),
      description: String(task.description ?? ''),
      status: String(task.status ?? 'todo'),
      priority: String(task.priority ?? 'medium'),
      assigned_to: String(task.assigned_to ?? ''),
      due_date: String(task.due_date ?? '').split('T')[0],
      category: String(task.category ?? 'general'),
      estimated_hours: String(task.estimated_hours ?? ''),
      tags: String(task.tags ?? ''),
      project_id: String(task.project_id ?? ''),
      checklist: safeChecklist(task.checklist),
    });
    setShowModal(true);
  };

  const handleSave = useCallback(async () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description,
      status: form.status,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
      category: form.category,
      estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
      tags: form.tags,
      project_id: form.project_id || null,
      checklist: JSON.stringify(form.checklist),
    };
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: String(editing.id), data: payload });
        toast.success('Task updated');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Task created');
      }
      setShowModal(false);
      refetch();
    } catch (e) {
      toast.error((e as Error).message || 'Save failed');
    }
  }, [form, editing, createMutation, updateMutation, refetch]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Task deleted');
      refetch();
    } catch (e) {
      toast.error((e as Error).message || 'Delete failed');
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} tasks?`)) return;
    try {
      await Promise.all(ids.map((id) => deleteMutation.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} tasks`);
      clearSelection();
      refetch();
    } catch {
      toast.error('Bulk delete failed');
    }
  };

  const handleBulkStatus = async (status: string) => {
    if (selectedIds.size === 0) return;
    try {
      await tasksApi.bulkUpdateStatus(Array.from(selectedIds), status);
      toast.success(`Updated ${selectedIds.size} tasks`);
      clearSelection();
      refetch();
    } catch {
      toast.error('Bulk update failed');
    }
  };

  const addChecklistItem = () => {
    setForm((f) => ({
      ...f,
      checklist: [...f.checklist, { item: '', completed: false }],
    }));
  };

  const updateChecklistItem = (idx: number, item: string) => {
    setForm((f) => {
      const c = [...f.checklist];
      c[idx] = { ...c[idx], item };
      return { ...f, checklist: c };
    });
  };

  const toggleChecklist = (idx: number) => {
    setForm((f) => {
      const c = [...f.checklist];
      c[idx] = { ...c[idx], completed: !c[idx].completed };
      return { ...f, checklist: c };
    });
  };

  const removeChecklistItem = (idx: number) => {
    setForm((f) => ({ ...f, checklist: f.checklist.filter((_, i) => i !== idx) }));
  };

  const toggleDetailCheck = async (task: AnyRow, idx: number) => {
    const list = safeChecklist(task.checklist);
    list[idx] = { ...list[idx], completed: !list[idx].completed };
    try {
      await tasksApi.updateChecklist(String(task.id), list);
      toast.success('Checklist updated');
      refetch();
    } catch {
      toast.error('Update failed');
    }
  };

  /* ─── Overdue count ──────────────────────────────────────────────────────── */
  const overdueCount = useMemo(
    () =>
      filtered.filter(
        (t) =>
          t.due_date &&
          new Date(String(t.due_date)) < new Date() &&
          t.status !== 'done'
      ).length,
    [filtered]
  );

  /* ─── Calendar grid (simple month view) ────────────────────────────────── */
  const today = new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());

  const monthName = useMemo(() => {
    return new Date(calYear, calMonth).toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [calMonth, calYear]);

  const calendarTasks = useMemo(() => {
    const map: Record<string, TaskRow[]> = {};
    filtered.forEach((t) => {
      const dd = String(t.due_date ?? '').split('T')[0];
      if (dd) {
        map[dd] = map[dd] || [];
        map[dd].push(t);
      }
    });
    return map;
  }, [filtered]);

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();

  /* ─── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      <ModuleBreadcrumbs currentModule="tasks" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-amber-500" />
            Tasks
          </h1>
          <p className="text-gray-400 text-sm">Manage global tasks across all projects</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={openCreate} className="btn btn-sm btn-primary gap-1">
            <Plus className="w-4 h-4" />
            New Task
          </button>
          <button onClick={() => refetch()} className="btn btn-sm btn-ghost gap-1" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold text-white">{filtered.length}</p>
        </div>
        <div className="card bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">In Progress</p>
          <p className="text-2xl font-bold text-blue-400">
            {filtered.filter((t) => t.status === 'in_progress').length}
          </p>
        </div>
        <div className="card bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Done</p>
          <p className="text-2xl font-bold text-green-400">
            {filtered.filter((t) => t.status === 'done').length}
          </p>
        </div>
        <div className="card bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Overdue</p>
          <p className="text-2xl font-bold text-red-400">{overdueCount}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 flex-wrap items-start md:items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-2 text-gray-500 w-4 h-4" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks, tags..."
            className="w-full input input-sm pl-9 bg-slate-800 border-slate-600 text-gray-100"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select select-sm bg-slate-800 border-slate-600 text-gray-100"
          >
            <option value="All">All Statuses</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="select select-sm bg-slate-800 border-slate-600 text-gray-100"
          >
            <option value="All">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="select select-sm bg-slate-800 border-slate-600 text-gray-100"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center bg-slate-800 rounded-lg border border-slate-600 p-0.5">
          {([
            { key: 'list', icon: List, label: 'List' },
            { key: 'kanban', icon: LayoutTemplate, label: 'Kanban' },
            { key: 'calendar', icon: CalendarDays, label: 'Calendar' },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md ${
                view === key ? 'bg-amber-600 text-white' : 'text-gray-300 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <BulkActionsBar
          selectedIds={Array.from(selectedIds)}
          onClearSelection={clearSelection}
          actions={[
            { id: 'bulk-delete', label: 'Delete', icon: Trash2, variant: 'danger', onClick: () => handleBulkDelete(Array.from(selectedIds)) },
            ...TASK_STATUSES.map((s) => ({
              id: `bulk-status-${s}`,
              label: `Set ${STATUS_LABELS[s]}`,
              icon: ArrowRight,
              variant: 'default' as const,
              onClick: () => handleBulkStatus(s),
            })),
          ]}
        />
      )}

      {/* Content */}
      {isLoading ? (
        <div className="text-gray-400 text-sm flex items-center gap-2 py-8">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading tasks...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks found"
          description={
            search || statusFilter !== 'All' || priorityFilter !== 'All'
              ? 'Try adjusting your filters'
              : 'Create your first task to get started'
          }
          action={{ label: 'New Task', onClick: openCreate }}
        />
      ) : view === 'list' ? (
        <div className="space-y-2">
          {(filtered as TaskRow[]).map((task) => (
            <div
              key={String(task.id)}
              className="group flex items-center gap-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 hover:border-amber-500/40 transition"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(String(task.id))}
                onChange={() => toggle(String(task.id))}
                className="accent-amber-600"
              />
              <button
                onClick={() => setDetailTask(task)}
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  PRIORITY_COLOURS[String(task.priority ?? 'medium')].replace('text-', 'bg-')
                }`}
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white truncate">{String(task.title ?? '')}</h4>
                <p className="text-xs text-gray-400 truncate">{String(task.description ?? '')}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_COLOURS[String(task.status ?? 'todo')]}`}>
                    {STATUS_LABELS[String(task.status ?? 'todo')]}
                  </span>
                  {task.due_date && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {String(task.due_date).split('T')[0]}
                    </span>
                  )}
                  {task.estimated_hours && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                      <Timer className="w-3 h-3" />
                      {task.estimated_hours}h
                    </span>
                  )}
                  {safeChecklist(task.checklist).length > 0 && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                      <ClipboardList className="w-3 h-3" />
                      {safeChecklist(task.checklist).filter((c) => c.completed).length}/{safeChecklist(task.checklist).length}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => openEdit(task)} className="p-1.5 rounded hover:bg-slate-700 text-gray-300">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(String(task.id))} className="p-1.5 rounded hover:bg-red-900/40 text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : view === 'kanban' ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {TASK_STATUSES.map((status) => (
            <div key={status} className="min-w-[260px] w-1/5 flex-shrink-0">
              <div className={`rounded-t-lg px-3 py-2 text-xs font-semibold border-b-2 flex items-center justify-between ${STATUS_COLOURS[status]}`}>
                <span>{STATUS_LABELS[status]}</span>
                <span className="opacity-70">{grouped[status]?.length ?? 0}</span>
              </div>
              <div className="bg-slate-900/50 rounded-b-lg p-2 space-y-2 min-h-[120px]">
                {(grouped[status] ?? []).map((task) => (
                  <div
                    key={String(task.id)}
                    onClick={() => setDetailTask(task)}
                    className="p-3 rounded-md bg-slate-800 border border-slate-700 hover:border-amber-500/40 cursor-pointer transition"
                  >
                    <h5 className="text-sm font-medium text-white truncate">{String(task.title ?? '')}</h5>
                    {task.due_date && (
                      <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {String(task.due_date).split('T')[0]}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-[10px] ${PRIORITY_COLOURS[String(task.priority ?? 'medium')]}`}>
                        {String(task.priority ?? 'medium').toUpperCase()}
                      </span>
                      {safeChecklist(task.checklist).length > 0 && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <ClipboardList className="w-3 h-3" />
                          {safeChecklist(task.checklist).filter((c) => c.completed).length}/{safeChecklist(task.checklist).length}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {grouped[status]?.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-4">No tasks</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Calendar view */
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">{monthName}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
                  else setCalMonth((m) => m - 1);
                }}
                className="p-1 rounded hover:bg-slate-700 text-gray-300"
              >
                <ChevronDown className="w-4 h-4 rotate-90" />
              </button>
              <button
                onClick={() => {
                  if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
                  else setCalMonth((m) => m + 1);
                }}
                className="p-1 rounded hover:bg-slate-700 text-gray-300"
              >
                <ChevronDown className="w-4 h-4 -rotate-90" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-400 mb-1">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`pad-${i}`} className="h-20" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayTasks = calendarTasks[dateStr] ?? [];
              return (
                <div
                  key={day}
                  className={`h-20 rounded-md p-1 border ${
                    dateStr === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
                      ? 'bg-amber-900/20 border-amber-600/40'
                      : 'bg-slate-800/40 border-slate-700/40'
                  }`}
                >
                  <span className="text-[10px] text-gray-300 font-medium">{day}</span>
                  <div className="mt-0.5 space-y-0.5 overflow-hidden">
                    {dayTasks.slice(0, 3).map((t) => (
                      <div
                        key={String(t.id)}
                        onClick={() => setDetailTask(t)}
                        className="text-[9px] truncate px-1 py-0.5 rounded bg-slate-700/60 text-gray-200 cursor-pointer"
                      >
                        {String(t.title ?? '')}
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <p className="text-[9px] text-gray-500 px-1">+{dayTasks.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{String(detailTask.title ?? '')}</h2>
              <button onClick={() => setDetailTask(null)} className="p-1 rounded hover:bg-slate-700 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-300">{String(detailTask.description ?? '')}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className={`px-2 py-1 rounded border ${STATUS_COLOURS[String(detailTask.status ?? 'todo')]}`}>
                {STATUS_LABELS[String(detailTask.status ?? 'todo')]}
              </span>
              <span className={`px-2 py-1 rounded border ${PRIORITY_COLOURS[String(detailTask.priority ?? 'medium')].replace('text-', 'bg-') + '/20 text-gray-200'}`}>
                {String(detailTask.priority ?? 'medium').toUpperCase()}
              </span>
              {Boolean(detailTask.due_date) && (
                <span className="px-2 py-1 rounded bg-slate-700 text-gray-200 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {String(detailTask.due_date).split('T')[0]}
                </span>
              )}
            </div>

            {/* Checklist in detail */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-amber-500" />
                Checklist
              </h3>
              {safeChecklist(detailTask.checklist).length === 0 ? (
                <p className="text-xs text-gray-500 italic">No checklist items</p>
              ) : (
                <div className="space-y-1">
                  {safeChecklist(detailTask.checklist).map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <button onClick={() => toggleDetailCheck(detailTask, idx)}>
                        {c.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      <span className={`${c.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                        {c.item}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button onClick={() => { setDetailTask(null); openEdit(detailTask); }} className="btn btn-sm btn-primary flex-1">
                Edit
              </button>
              <button onClick={() => { handleDelete(String(detailTask.id)); setDetailTask(null); }} className="btn btn-sm btn-error flex-1">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{editing ? 'Edit Task' : 'New Task'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-slate-700 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Task title"
              className="input input-sm w-full bg-slate-800 border-slate-600 text-gray-100"
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description"
              rows={3}
              className="textarea textarea-sm w-full bg-slate-800 border-slate-600 text-gray-100"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="select select-sm bg-slate-800 border-slate-600 text-gray-100"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="select select-sm bg-slate-800 border-slate-600 text-gray-100"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="input input-sm bg-slate-800 border-slate-600 text-gray-100"
              />
              <input
                type="number"
                value={form.estimated_hours}
                onChange={(e) => setForm((f) => ({ ...f, estimated_hours: e.target.value }))}
                placeholder="Est. hours"
                className="input input-sm bg-slate-800 border-slate-600 text-gray-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={form.assigned_to}
                onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                placeholder="Assigned to (user ID)"
                className="input input-sm bg-slate-800 border-slate-600 text-gray-100"
              />
              <input
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="Tags (comma separated)"
                className="input input-sm bg-slate-800 border-slate-600 text-gray-100"
              />
            </div>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="select select-sm bg-slate-800 border-slate-600 text-gray-100 w-full"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>

            {/* Inline checklist builder */}
            <div>
              <h4 className="text-xs font-semibold text-gray-300 mb-1 flex items-center gap-1">
                <ClipboardList className="w-3.5 h-3.5 text-amber-500" />
                Checklist
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {form.checklist.map((c, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <button onClick={() => toggleChecklist(idx)}>
                      {c.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    <input
                      value={c.item}
                      onChange={(e) => updateChecklistItem(idx, e.target.value)}
                      placeholder="Checklist item"
                      className="flex-1 input input-xs bg-slate-800 border-slate-600 text-gray-100"
                    />
                    <button onClick={() => removeChecklistItem(idx)} className="text-red-400 hover:text-red-300">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addChecklistItem}
                className="text-xs text-amber-400 hover:text-amber-300 mt-1 font-medium"
              >
                + Add checklist item
              </button>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button onClick={handleSave} className="btn btn-sm btn-primary flex-1">
                {editing ? 'Update' : 'Create'}
              </button>
              <button onClick={() => setShowModal(false)} className="btn btn-sm btn-ghost flex-1">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Tasks;
