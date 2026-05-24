import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Layers, Plus, Search, X, Trash2, Edit, Copy, CheckCircle,
  BarChart3, Filter, ArrowUpDown, LayoutTemplate, FileText,
  CheckSquare, Square, Download, Star, Trash,
} from 'lucide-react';
import { BulkActionsBar, useBulkSelection, type BulkAction } from '../ui/BulkActions';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { EmptyState } from '../ui/EmptyState';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { useProjectTemplates } from '../../hooks/useData';
import type { Row } from '../../services/api';

type AnyRow = Record<string, unknown>;

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  on_hold: '#f59e0b',
  planning: '#3b82f6',
  archived: '#ef4444',
  completed: '#10b981',
};

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444'];

const emptyForm = {
  name: '',
  description: '',
  type: 'standard',
  defaultBudget: '',
  defaultDurationDays: '',
  defaultPhaseOrder: [] as string[],
  checklists: [] as { name: string; items: string[] }[],
  isShared: true,
  isDefault: false,
};

export default function ProjectTemplates() {
  const { useList, useCreate, useUpdate, useDelete } = useProjectTemplates;
  const { data: raw = [], isLoading } = useList();
  const templates = (raw || []) as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const delMutation = useDelete();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | string>('All');
  const [sortBy, setSortBy] = useState<'name' | 'created_at'>('created_at');
  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  const filtered = useMemo(() => {
    let rows = templates.filter((r) => {
      const q = search.toLowerCase();
      const match =
        String(r.name ?? '').toLowerCase().includes(q) ||
        String(r.description ?? '').toLowerCase().includes(q) ||
        String(r.type ?? '').toLowerCase().includes(q);
      const matchType = typeFilter === 'All' || r.type === typeFilter;
      return match && matchType;
    });
    rows = [...rows].sort((a: AnyRow, b: AnyRow) => {
      if (sortBy === 'name') return String(a.name).localeCompare(String(b.name));
      return (
        new Date(String(b.createdAt || b.created_at || 0)).getTime() -
        new Date(String(a.createdAt || a.created_at || 0)).getTime()
      );
    });
    return rows;
  }, [templates, search, typeFilter, sortBy]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    templates.forEach((t) => {
      const key = String(t.type || 'standard');
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [templates]);

  const chartData = Object.entries(typeCounts).map(([name, value]) => ({
    name,
    value,
  }));

  function openEdit(row: AnyRow) {
    setEditingId(String(row.id));
    const parsedPhases = safeJson<string[]>(row.defaultPhaseOrder || row.default_phase_order, []);
    const parsedChecklists = safeJson(row.checklists || row.checklists, []);
    setForm({
      name: String(row.name ?? ''),
      description: String(row.description ?? ''),
      type: String(row.type ?? 'standard'),
      defaultBudget: row.defaultBudget || row.default_budget ? String(row.defaultBudget ?? row.default_budget) : '',
      defaultDurationDays: row.defaultDurationDays || row.default_duration_days ? String(row.defaultDurationDays ?? row.default_duration_days) : '',
      defaultPhaseOrder: parsedPhases,
      checklists: parsedChecklists,
      isShared: Boolean(row.isShared ?? row.is_shared ?? true),
      isDefault: Boolean(row.isDefault ?? row.is_default ?? false),
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: AnyRow = {
      name: form.name,
      description: form.description || null,
      type: form.type || 'standard',
      default_budget: form.defaultBudget ? Number(form.defaultBudget) : null,
      default_duration_days: form.defaultDurationDays ? Number(form.defaultDurationDays) : null,
      default_phase_order: JSON.stringify(form.defaultPhaseOrder),
      checklists: JSON.stringify(form.checklists),
      is_shared: form.isShared,
      is_default: form.isDefault,
    };
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: payload });
        toast.success('Template updated');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Template created');
      }
      setShowModal(false);
      setEditingId(null);
      setForm({ ...emptyForm });
    } catch {
      toast.error('Failed to save template');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return;
    try {
      await delMutation.mutateAsync(id);
      toast.success('Deleted');
    } catch {
      toast.error('Delete failed');
    }
  }

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} templates?`)) return;
    await Promise.all(ids.map((id) => delMutation.mutateAsync(id)));
    toast.success(`Deleted ${ids.length} templates`);
    clearSelection();
  }

  const getPhaseStr = (r: AnyRow) => {
    const arr = safeJson<string[]>(r.defaultPhaseOrder || r.default_phase_order, []);
    return arr.length ? arr.join(', ') : 'No phases';
  };

  const addPhase = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      defaultPhaseOrder: [...prev.defaultPhaseOrder, ''],
    }));
  }, []);

  const setPhase = useCallback((index: number, value: string) => {
    setForm((prev) => {
      const next = [...prev.defaultPhaseOrder];
      next[index] = value;
      return { ...prev, defaultPhaseOrder: next };
    });
  }, []);

  const removePhase = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      defaultPhaseOrder: prev.defaultPhaseOrder.filter((_, i) => i !== index),
    }));
  }, []);

  const addChecklist = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      checklists: [...prev.checklists, { name: '', items: [] }],
    }));
  }, []);

  const setChecklistName = useCallback((index: number, name: string) => {
    setForm((prev) => {
      const next = [...prev.checklists];
      next[index] = { ...next[index], name };
      return { ...prev, checklists: next };
    });
  }, []);

  const removeChecklist = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      checklists: prev.checklists.filter((_, i) => i !== index),
    }));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display text-gray-100">Project Templates</h2>
          <p className="text-xs text-gray-400 mt-1">
            Total: {templates.length} | Types: {Object.keys(typeCounts).length}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setForm({ ...emptyForm });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          <Plus size={16} /> New Template
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All Types</option>
          {Object.keys(typeCounts).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'name' | 'created_at')}
          className="text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="created_at">Newest First</option>
          <option value="name">Name (A-Z)</option>
        </select>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h4 className="text-xs font-medium text-gray-400 mb-2">Templates by Type</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="md:col-span-2 bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h4 className="text-xs font-medium text-gray-400 mb-2">Default Budget by Template</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={templates
                  .filter((t) => Number(t.defaultBudget ?? t.default_budget ?? 0) > 0)
                  .slice(0, 10)}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip />
                <Bar dataKey="defaultBudget" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-400 animate-pulse">Loading…</div>
      ) : !filtered.length ? (
        <EmptyState title="No templates found" description="Create a template to kick-start projects." icon={LayoutTemplate} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs text-gray-400 uppercase bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) filtered.forEach((r) => toggle(String(r.id)));
                      else clearSelection();
                    }}
                  />
                </th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Phases</th>
                <th className="px-4 py-3">Budget</th>
                <th className="px-4 py-3">Duration (d)</th>
                <th className="px-4 py-3">Default</th>
                <th className="px-4 py-3">Shared</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={String(row.id)}
                  className="border-b border-gray-700 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(String(row.id))}
                      onChange={() => toggle(String(row.id))}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-100">{String(row.name ?? '-')}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300 border border-gray-600">
                      {String(row.type ?? '-')}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate" title={getPhaseStr(row)}>
                    {getPhaseStr(row)}
                  </td>
                  <td className="px-4 py-3">
                    {row.defaultBudget || row.default_budget
                      ? `£${Number(row.defaultBudget ?? row.default_budget).toLocaleString()}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3">{String(row.defaultDurationDays ?? row.default_duration_days ?? '-')}</td>
                  <td className="px-4 py-3">
                    {(row.isDefault ?? row.is_default) ? (
                      <CheckCircle className="text-amber-400" size={18} />
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {(row.isShared ?? row.is_shared) ? (
                      <span className="text-green-400 text-xs">Yes</span>
                    ) : (
                      <span className="text-gray-500 text-xs">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(row)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors"
                    >
                      <Edit size={12} /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(String(row.id))}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-700/40 text-red-300 rounded hover:bg-red-700/60 transition-colors"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedIds.size > 0 && (
        <BulkActionsBar
          selectedIds={Array.from(selectedIds)}
          actions={[
            {
              id: 'delete',
              label: 'Delete',
              icon: Trash2,
              variant: 'danger',
              confirm: 'Delete selected templates?',
              onClick: (ids) => handleBulkDelete(ids),
            },
          ]}
          onClearSelection={clearSelection}
        />
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-100">
                {editingId ? 'Edit Template' : 'New Project Template'}
              </h3>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-100">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-gray-800 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-gray-800 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="standard">Standard</option>
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="infrastructure">Infrastructure</option>
                    <option value="industrial">Industrial</option>
                    <option value="fitout">Fit-Out</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Default Budget (£)</label>
                  <input
                    type="number"
                    value={form.defaultBudget}
                    onChange={(e) => setForm({ ...form, defaultBudget: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-gray-800 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Default Duration (days)</label>
                  <input
                    type="number"
                    value={form.defaultDurationDays}
                    onChange={(e) => setForm({ ...form, defaultDurationDays: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-gray-800 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-gray-800 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Phase order builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-400">Default Phase Order</label>
                  <button type="button" onClick={addPhase} className="text-xs text-blue-400 hover:text-blue-300">
                    + Add Phase
                  </button>
                </div>
                <div className="space-y-2">
                  {form.defaultPhaseOrder.map((phase, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs">{i + 1}.</span>
                      <input
                        value={phase}
                        onChange={(e) => setPhase(i, e.target.value)}
                        placeholder="Phase name e.g. Mobilisation"
                        className="flex-1 px-3 py-2 text-sm bg-gray-800 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button type="button" onClick={() => removePhase(i)} className="text-gray-500 hover:text-red-400">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  {!form.defaultPhaseOrder.length && (
                    <p className="text-xs text-gray-500">No phases added yet.</p>
                  )}
                </div>
              </div>

              {/* Checklists builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-400">Checklists</label>
                  <button type="button" onClick={addChecklist} className="text-xs text-blue-400 hover:text-blue-300">
                    + Add Checklist
                  </button>
                </div>
                <div className="space-y-3">
                  {form.checklists.map((cl, i) => (
                    <div key={i} className="bg-gray-800 rounded-lg border border-gray-700 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          value={cl.name}
                          onChange={(e) => setChecklistName(i, e.target.value)}
                          placeholder="Checklist name"
                          className="flex-1 px-3 py-1.5 text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button type="button" onClick={() => removeChecklist(i)} className="text-gray-500 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">Items: {cl.items.length}</p>
                    </div>
                  ))}
                  {!form.checklists.length && (
                    <p className="text-xs text-gray-500">No checklists added yet.</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isShared}
                    onChange={(e) => setForm({ ...form, isShared: e.target.checked })}
                  />
                  Shared across organization
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  />
                  Set as default template
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingId(null); }}
                  className="px-4 py-2 text-sm text-gray-300 hover:text-gray-100 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingId ? 'Save Changes' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function safeJson<T>(val: unknown, fallback: T): T {
  if (!val) return fallback;
  if (Array.isArray(val)) return val as unknown as T;
  try {
    return JSON.parse(String(val)) as T;
  } catch {
    return fallback;
  }
}
