import React, { useState, useMemo } from 'react';
import {
  Wrench, Plus, Search, X, Calendar, CheckCircle2, Clock, AlertTriangle,
  Trash2, Edit2, Tag, Filter, ArrowUpDown, CheckSquare, Square, BarChart3
} from 'lucide-react';
import { useMaintenanceSchedules } from '../../hooks/useData';
import { equipmentApi } from '../../services/api';
import { toast } from 'sonner';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { EmptyState } from '../ui/EmptyState';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type AnyRow = Record<string, unknown>;

const PRIORITY_ORDER: Record<string, number> = { low: 1, normal: 2, high: 3, critical: 4 };
const STATUS_ORDER: Record<string, number> = { overdue: 1, in_progress: 2, scheduled: 3, completed: 4, cancelled: 5, deferred: 6 };

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-900/30 text-blue-300 border border-blue-700',
  overdue: 'bg-red-900/30 text-red-300 border border-red-700',
  in_progress: 'bg-amber-900/30 text-amber-300 border border-amber-700',
  completed: 'bg-green-900/30 text-green-300 border border-green-700',
  cancelled: 'bg-gray-700/40 text-gray-400 border border-gray-600',
  deferred: 'bg-purple-900/30 text-purple-300 border border-purple-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-green-400 bg-green-500/10',
  normal: 'text-blue-400 bg-blue-500/10',
  high: 'text-amber-400 bg-amber-500/10',
  critical: 'text-red-400 bg-red-500/10',
};

const MAINTENANCE_TYPES = [
  'routine_service', 'repair', 'inspection', 'loler_examination', 'pssr',
  'overhaul', 'calibration', 'winter_service', 'breakdown', 'pre_hire_check'
].map(v => ({ value: v, label: v.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }));

const emptyForm = {
  equipmentId: '',
  title: '',
  maintenanceType: 'routine_service',
  priority: 'normal',
  description: '',
  scheduledDate: '',
  dueDate: '',
  estimatedHours: '',
  technician: '',
  checklist: [] as { item: string; completed: boolean; notes?: string }[],
  partsUsed: [] as { name: string; quantity: number; cost: number }[],
  costEstimate: '',
  notes: '',
};

export default function MaintenanceSchedules() {
  const { useList, useCreate, useUpdate, useDelete } = useMaintenanceSchedules;
  const { data: raw = [], isLoading } = useList();
  const schedules = (raw || []) as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | string>('All');
  const [sortBy, setSortBy] = useState<'scheduled_date' | 'priority' | 'status'>('scheduled_date');

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: AnyRow = {
      equipment_id: form.equipmentId || null,
      title: form.title,
      maintenance_type: form.maintenanceType,
      priority: form.priority,
      status: editingId ? undefined : 'scheduled',
      description: form.description || null,
      scheduled_date: form.scheduledDate || null,
      due_date: form.dueDate || null,
      estimated_hours: form.estimatedHours ? Number(form.estimatedHours) : null,
      technician: form.technician || null,
      checklist: JSON.stringify(form.checklist),
      parts_used: JSON.stringify(form.partsUsed),
      cost_estimate: form.costEstimate ? Number(form.costEstimate) : null,
      notes: form.notes || null,
    };
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: payload });
        toast.success('Maintenance schedule updated');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Maintenance schedule created');
      }
      setShowModal(false);
      setEditingId(null);
      setForm({ ...emptyForm });
    } catch {
      toast.error('Failed to save schedule');
    }
  }

  function openEdit(row: AnyRow) {
    setEditingId(String(row.id));
    setForm({
      equipmentId: String(row.equipment_id ?? ''),
      title: String(row.title ?? ''),
      maintenanceType: String(row.maintenance_type ?? 'routine_service'),
      priority: String(row.priority ?? 'normal'),
      description: String(row.description ?? ''),
      scheduledDate: row.scheduled_date ? String(row.scheduled_date).slice(0,10) : '',
      dueDate: row.due_date ? String(row.due_date).slice(0,10) : '',
      estimatedHours: row.estimated_hours ? String(row.estimated_hours) : '',
      technician: String(row.technician ?? ''),
      checklist: safeJson(row.checklist, []),
      partsUsed: safeJson(row.parts_used, []),
      costEstimate: row.cost_estimate ? String(row.cost_estimate) : '',
      notes: String(row.notes ?? ''),
    });
    setShowModal(true);
  }

  function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} maintenance schedule(s)?`)) return;
    Promise.all(ids.map(id => deleteMutation.mutateAsync(id)))
      .then(() => { toast.success(`Deleted ${ids.length} schedule(s)`); clearSelection(); })
      .catch(() => toast.error('Bulk delete failed'));
  }

  const filtered = useMemo(() => {
    let rows = schedules.filter((r) => {
      const matchSearch = !search || (
        String(r.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
        String(r.technician ?? '').toLowerCase().includes(search.toLowerCase()) ||
        String(r.equipment_id ?? '').toLowerCase().includes(search.toLowerCase())
      );
      const matchStatus = statusFilter === 'All' || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
    rows = [...rows].sort((a, b) => {
      if (sortBy === 'scheduled_date') {
        return new Date(String(a.scheduled_date || 0)).getTime() - new Date(String(b.scheduled_date || 0)).getTime();
      }
      if (sortBy === 'priority') {
        return (PRIORITY_ORDER[String(b.priority)] || 0) - (PRIORITY_ORDER[String(a.priority)] || 0);
      }
      return (STATUS_ORDER[String(a.status)] || 0) - (STATUS_ORDER[String(b.status)] || 0);
    });
    return rows;
  }, [schedules, search, statusFilter, sortBy]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    schedules.forEach((r) => { counts[String(r.status)] = (counts[String(r.status)] || 0) + 1; });
    return counts;
  }, [schedules]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display text-gray-100">Maintenance Schedules</h2>
          <p className="text-xs text-gray-400 mt-1">Total: {schedules.length} | Overdue: {statusCounts['overdue'] || 0} | In Progress: {statusCounts['in_progress'] || 0}</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setEditingId(null); setForm({ ...emptyForm }); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New Schedule
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search schedules…"
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All Statuses</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="scheduled_date">Sort: Scheduled Date</option>
          <option value="priority">Sort: Priority</option>
          <option value="status">Sort: Status</option>
        </select>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} schedules</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Wrench} title="No maintenance schedules" description="Create schedules to track equipment upkeep." />
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50 border-b border-gray-700">
                <tr>
                  <th className="px-2 py-3 w-8"><input type="checkbox" className="accent-blue-600" onChange={() => {}} /></th>
                  {['Equipment', 'Title', 'Type', 'Status', 'Priority', 'Scheduled', 'Due', 'Technician', 'Progress', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-display tracking-widest text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filtered.map((row) => {
                  const id = String(row.id ?? '');
                  const isSelected = selectedIds.has(id);
                  const checklist = safeJson(row.checklist, []);
                  const completed = checklist.filter((c: any) => c.completed).length;
                  const progress = checklist.length ? Math.round((completed / checklist.length) * 100) : (row.status === 'completed' ? 100 : 0);
                  return (
                    <tr key={id} className={`hover:bg-gray-700/50 ${isSelected ? 'bg-gray-700/40' : ''}`}>
                      <td className="px-2 py-3">
                        <button type="button" onClick={() => toggle(id)}>
                          {isSelected ? <CheckSquare size={16} className="text-blue-400" /> : <Square size={16} className="text-gray-500" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-100 font-medium">{String(row.equipment_id ?? '').slice(0,8)}…</td>
                      <td className="px-4 py-3 text-gray-100">{String(row.title ?? '')}</td>
                      <td className="px-4 py-3 text-gray-300 capitalize">{String(row.maintenance_type ?? '').replace(/_/g,' ')}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${STATUS_COLORS[String(row.status)] || STATUS_COLORS['scheduled']}`}>
                          {String(row.status).replace(/_/g,' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${PRIORITY_COLORS[String(row.priority)] || 'text-blue-400 bg-blue-500/10'}`}>
                          {String(row.priority)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-200">{String(row.scheduled_date ?? '').slice(0,10)}</td>
                      <td className="px-4 py-3 text-gray-200">{row.due_date ? String(row.due_date).slice(0,10) : '-'}</td>
                      <td className="px-4 py-3 text-gray-300">{String(row.technician ?? '')}</td>
                      <td className="px-4 py-3">
                        <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-gray-400">{progress}%</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(row)} className="p-1.5 bg-blue-900/30 text-blue-300 rounded hover:bg-blue-900/50"><Edit2 size={14} /></button>
                          <button onClick={() => { if (confirm('Delete schedule?')) deleteMutation.mutate(id); }} className="p-1.5 bg-red-900/30 text-red-300 rounded hover:bg-red-900/50"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BulkActionsBar
        selectedIds={Array.from(selectedIds)}
        actions={[
          { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'Are you sure?' },
        ]}
        onClearSelection={clearSelection}
      />

      {/* KPI Chart */}
      {statusCounts && Object.keys(statusCounts).length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="text-lg font-display text-gray-100 mb-4">Schedule Status Distribution</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={Object.entries(statusCounts).map(([k,v]) => ({ name: k.replace(/_/g,' '), value: v }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[8,8,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-display text-gray-100">{editingId ? 'Edit Schedule' : 'New Maintenance Schedule'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-700"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Equipment ID</label>
                  <input required value={form.equipmentId} onChange={e => setForm(f => ({ ...f, equipmentId: e.target.value }))} className="w-full px-3 py-2 text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Equipment UUID" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Title</label>
                  <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Monthly LOLER Examination" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Type</label>
                  <select value={form.maintenanceType} onChange={e => setForm(f => ({ ...f, maintenanceType: e.target.value }))} className="w-full px-3 py-2 text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {MAINTENANCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full px-3 py-2 text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {['low','normal','high','critical'].map(p => <option key={p} value={p}>{p.replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Scheduled Date</label>
                  <input type="date" required value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} className="w-full px-3 py-2 text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Due Date</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full px-3 py-2 text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Estimated Hours</label>
                  <input type="number" step="0.1" value={form.estimatedHours} onChange={e => setForm(f => ({ ...f, estimatedHours: e.target.value }))} className="w-full px-3 py-2 text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 2.5" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Technician</label>
                  <input value={form.technician} onChange={e => setForm(f => ({ ...f, technician: e.target.value }))} className="w-full px-3 py-2 text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Name" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Cost Estimate (£)</label>
                  <input type="number" step="0.01" value={form.costEstimate} onChange={e => setForm(f => ({ ...f, costEstimate: e.target.value }))} className="w-full px-3 py-2 text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="What work is required?" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Additional notes..." />
              </div>

              {/* Checklist builder inline */}
              <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-700">
                <h4 className="text-xs font-display text-gray-300 uppercase tracking-wide mb-2">Checklist Items</h4>
                <div className="space-y-2">
                  {form.checklist.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input type="checkbox" checked={item.completed} onChange={e => { const c = [...form.checklist]; c[idx].completed = e.target.checked; setForm(f => ({ ...f, checklist: c })); }} className="accent-blue-600" />
                      <input value={item.item} onChange={e => { const c = [...form.checklist]; c[idx].item = e.target.value; setForm(f => ({ ...f, checklist: c })); }} className="flex-1 px-2 py-1 text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded" placeholder="Checklist item" />
                      <button type="button" onClick={() => setForm(f => ({ ...f, checklist: f.checklist.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setForm(f => ({ ...f, checklist: [...f.checklist, { item: '', completed: false, notes: '' }] }))} className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                    + Add Checklist Item
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-300 hover:text-gray-100 transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">{editingId ? 'Update Schedule' : 'Create Schedule'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function safeJson(value: unknown, fallback: unknown[]) {
  try { return typeof value === 'string' ? JSON.parse(value) : (Array.isArray(value) ? value : fallback); } catch { return fallback; }
}
