import React, { useState } from 'react';
import { ShieldCheck, Plus, Search, Clock, AlertTriangle, CheckCircle2, Edit2, Trash2, X, Calendar, FileText, RefreshCw, Bell, Filter } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { useSitePermits } from '../../hooks/useData';
import { sitePermitsApi } from '../../services/api';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';

const PERMIT_TYPES = ['Planning','Building Control','Party Wall','Road Closure','Licence to Deposit','Demolition','Scaffolding','Crane','Over-sail','Excavation','Permit to Work','Environmental','Traffic Management','Other'];
const PERMIT_STATUSES = ['applied','approved','active','expired','renewed','revoked'];
const PRIORITIES = ['low','medium','high','critical'];

const STATUS_COLORS: Record<string, string> = {
  applied: 'bg-blue-900/30 text-blue-300',
  approved: 'bg-yellow-900/30 text-yellow-300',
  active: 'bg-green-900/30 text-green-300',
  expired: 'bg-red-900/30 text-red-300',
  renewed: 'bg-purple-900/30 text-purple-300',
  revoked: 'bg-gray-700/30 text-gray-300',
};

const STATUS_LABELS: Record<string, string> = {
  applied: 'Applied', approved: 'Approved', active: 'Active', expired: 'Expired', renewed: 'Renewed', revoked: 'Revoked',
};

function formatDate(d?: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString();
}

function daysUntil(d?: string | null) {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

type AnyRow = Record<string, unknown>;

const emptyForm = {
  permit_number: '', type: '', site: '', issued_by: '', issued_to: '',
  from_date: '', to_date: '', status: 'applied', project_id: '',
  description: '', apply_date: '', reminder_date: '', notes: '', priority: 'medium',
};

export function Permits() {
  const { useList, useCreate, useUpdate, useDelete } = useSitePermits;
  const { data: raw = [], isLoading } = useList();
  const permits = raw as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const { data: stats } = useQuery({ queryKey: ['permits-stats'], queryFn: () => sitePermitsApi.getStats() });
  const { data: expiring } = useQuery({ queryKey: ['permits-expiring'], queryFn: () => sitePermitsApi.getExpiring(30) });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [renewing, setRenewing] = useState<AnyRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [renewForm, setRenewForm] = useState({ new_end_date: '', notes: '' });

  const filtered = permits.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = [String(p.permit_number ?? ''), String(p.type ?? ''), String(p.site ?? ''), String(p.issued_to ?? '')].some(v => v.toLowerCase().includes(q));
    const matchStatus = statusFilter === 'All' || p.status === statusFilter;
    const matchType = typeFilter === 'All' || p.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const activeCount = permits.filter(p => p.status === 'active').length;
  const expiringCount = expiring?.length ?? 0;
  const overdueCount = stats?.overdue ?? 0;

  function openCreate() { setEditing(null); setForm({ ...emptyForm }); setShowModal(true); }
  function openEdit(p: AnyRow) {
    setEditing(p);
    setForm({
      permit_number: String(p.permit_number ?? ''), type: String(p.type ?? ''), site: String(p.site ?? ''),
      issued_by: String(p.issued_by ?? ''), issued_to: String(p.issued_to ?? ''),
      from_date: p.from_date ? String(p.from_date).slice(0, 10) : '',
      to_date: p.to_date ? String(p.to_date).slice(0, 10) : '',
      status: String(p.status ?? 'applied'), project_id: String(p.project_id ?? ''),
      description: String(p.description ?? ''), notes: String(p.notes ?? ''),
      apply_date: p.apply_date ? String(p.apply_date).slice(0, 10) : '',
      reminder_date: p.reminder_date ? String(p.reminder_date).slice(0, 10) : '',
      priority: String(p.priority ?? 'medium'),
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (editing) {
        await updateMutation.mutateAsync({ id: String(editing.id), data: payload });
        toast.success('Permit updated');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Permit created');
      }
      setShowModal(false);
    } catch { toast.error('Save failed'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this permit?')) return;
    await deleteMutation.mutateAsync(id);
    toast.success('Permit deleted');
  }

  async function handleRenew(e: React.FormEvent) {
    e.preventDefault();
    if (!renewing) return;
    try {
      await sitePermitsApi.renew(String(renewing.id), renewForm);
      toast.success('Permit renewed');
      setShowRenewModal(false);
      setRenewing(null);
      setRenewForm({ new_end_date: '', notes: '' });
    } catch { toast.error('Renewal failed'); }
  }

  async function sendReminder(p: AnyRow) {
    try {
      await sitePermitsApi.remind(String(p.id));
      toast.success('Reminder sent');
    } catch { toast.error('Failed to send reminder'); }
  }

  const chartData = PERMIT_STATUSES.map(s => ({
    name: STATUS_LABELS[s],
    count: stats?.byStatus?.[s] || 0,
  }));

  const uniqueTypes = ['All', ...Array.from(new Set(permits.map(p => String(p.type ?? '')).filter(Boolean)))];

  return (
    <>
      <ModuleBreadcrumbs currentModule="permits" />
      <div className="p-6 space-y-6 min-h-screen bg-gray-950">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display text-gray-100">Permits & Licences</h1>
            <p className="text-sm text-gray-400 mt-1">Track status, expiry and renewals for all project permits</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">
            <Plus size={16} /><span>Add Permit</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            <div className="text-xs text-gray-400 mb-1">Total Permits</div>
            <div className="text-2xl font-bold text-gray-100">{permits.length}</div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            <div className="text-xs text-gray-400 mb-1">Active</div>
            <div className="text-2xl font-bold text-green-400">{activeCount}</div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            <div className="text-xs text-gray-400 mb-1">Expiring (30d)</div>
            <div className="text-2xl font-bold text-yellow-400">{expiringCount}</div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            <div className="text-xs text-gray-400 mb-1">Overdue</div>
            <div className="text-2xl font-bold text-red-400">{overdueCount}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search permits..."
              className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500">
            <option value="All">All Statuses</option>
            {PERMIT_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500">
            {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center text-sm text-gray-400 py-12">Loading...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No permits found" description="Add a permit to start tracking" />
        ) : (
          <div className="rounded-xl border border-gray-800 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Site</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Valid From</th>
                  <th className="px-4 py-3">Valid To</th>
                  <th className="px-4 py-3">Days Left</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map(p => {
                  const days = daysUntil(String(p.to_date ?? ''));
                  const isExpiring = days !== null && days <= 30 && days >= 0;
                  const isOverdue = days !== null && days < 0;
                  return (
                    <tr key={String(p.id)} className="hover:bg-gray-900/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-100">{String(p.permit_number || '-')}</td>
                      <td className="px-4 py-3 text-gray-300">{String(p.type || '-')}</td>
                      <td className="px-4 py-3 text-gray-400">{String(p.site || '-')}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLORS[String(p.status)] || 'bg-gray-800 text-gray-300'}`}>{STATUS_LABELS[String(p.status)] || String(p.status)}</span></td>
                      <td className="px-4 py-3 text-gray-400">{formatDate(String(p.from_date ?? ''))}</td>
                      <td className="px-4 py-3 text-gray-400">
                        <div className="flex items-center gap-1">
                          {isOverdue && <AlertTriangle size={12} className="text-red-400" />}
                          {isExpiring && !isOverdue && <Clock size={12} className="text-yellow-400" />}
                          {formatDate(String(p.to_date ?? ''))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {days !== null ? (
                          <span className={`text-xs font-medium ${isOverdue ? 'text-red-400' : isExpiring ? 'text-yellow-400' : 'text-green-400'}`}>
                            {isOverdue ? `${Math.abs(days)} overdue` : `${days}d left`}
                          </span>
                        ) : <span className="text-gray-500">-</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setRenewing(p); setRenewForm({ new_end_date: '', notes: '' }); setShowRenewModal(true); }} title="Renew" className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-gray-800 rounded"><RefreshCw size={14} /></button>
                          <button onClick={() => sendReminder(p)} title="Remind" className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-gray-800 rounded"><Bell size={14} /></button>
                          <button onClick={() => openEdit(p)} title="Edit" className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(String(p.id))} title="Delete" className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Analytics */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
          <h3 className="text-sm font-semibold text-gray-100 mb-4">Permits by Status</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1f2937', borderColor: '#374151', color: '#e5e7eb' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={['#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6','#6b7280'][i % 6]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-100">{editing ? 'Edit Permit' : 'New Permit'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-100 p-1"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Permit Number</label>
                  <input required value={form.permit_number} onChange={e => setForm({ ...form, permit_number: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500" placeholder="e.g. PERM-2026-001" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500">
                    <option value="">Select type…</option>
                    {PERMIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Site</label>
                  <input value={form.site} onChange={e => setForm({ ...form, site: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500" placeholder="Site name" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Issued To</label>
                  <input value={form.issued_to} onChange={e => setForm({ ...form, issued_to: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500" placeholder="Contractor / team" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Issued By</label>
                  <input value={form.issued_by} onChange={e => setForm({ ...form, issued_by: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500" placeholder="Authority / council" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Project ID</label>
                  <input value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500" placeholder="Optional project link" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Valid From</label>
                  <input type="date" value={form.from_date} onChange={e => setForm({ ...form, from_date: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Valid To</label>
                  <input type="date" value={form.to_date} onChange={e => setForm({ ...form, to_date: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Apply Date</label>
                  <input type="date" value={form.apply_date} onChange={e => setForm({ ...form, apply_date: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Reminder Date</label>
                  <input type="date" value={form.reminder_date} onChange={e => setForm({ ...form, reminder_date: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500">
                    {PERMIT_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Priority</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500">
                    {PRIORITIES.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500" placeholder="Scope, conditions, restrictions…" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500" placeholder="Internal notes…" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-300 hover:text-white border border-gray-700 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium">{editing ? 'Save Changes' : 'Create Permit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {showRenewModal && renewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-100">Renew Permit</h3>
              <button onClick={() => setShowRenewModal(false)} className="text-gray-400 hover:text-gray-100 p-1"><X size={18} /></button>
            </div>
            <div className="text-sm text-gray-400 mb-4">
              Permit: <span className="text-gray-200 font-medium">{String(renewing.permit_number || 'Untitled')}</span><br/>
              Current expiry: <span className="text-gray-200">{formatDate(String(renewing.to_date ?? ''))}</span>
            </div>
            <form onSubmit={handleRenew} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">New End Date</label>
                <input type="date" required value={renewForm.new_end_date} onChange={e => setRenewForm({ ...renewForm, new_end_date: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea value={renewForm.notes} onChange={e => setRenewForm({ ...renewForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500" placeholder="Renewal notes…" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowRenewModal(false)} className="px-4 py-2 text-sm text-gray-300 hover:text-white border border-gray-700 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">Renew Permit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Permits;
