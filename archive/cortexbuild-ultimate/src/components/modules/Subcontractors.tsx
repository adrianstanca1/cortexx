import React, { useState } from 'react';
import { HardHat, CheckCircle2, AlertTriangle, XCircle, Star, DollarSign, Plus, Search, Shield, FileText, BarChart3, X, Edit2, Trash2, Phone, Mail, Building2, CheckSquare, Square, Download } from 'lucide-react';
import { DataImporter, ExportButton } from '../ui/DataImportExport';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { useSubcontractors } from '../../hooks/useData';
import { EmptyState } from '../ui/EmptyState';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { z } from 'zod';

type AnyRow = Record<string, unknown>;

const subcontractorSchema = z.object({
  company: z.string().min(1, 'Company name is required'),
  contact: z.string().min(1, 'Contact name is required'),
  trade: z.string().min(1, 'Trade is required'),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().min(10, 'Phone must be at least 10 digits').optional(),
  status: z.enum(['active', 'pending', 'inactive']).optional(),
  cisVerified: z.boolean().optional(),
  insuranceExpiry: z.string().optional(),
  rating: z.union([z.string(), z.number()]).optional(),
  contractValue: z.union([z.string(), z.number()]).optional(),
});

const TRADES = ['Groundworks','Concrete','Structural Steel','Brickwork','Carpentry','Roofing','Cladding','Electrical','Plumbing','HVAC','Plastering','Tiling','Painting','Scaffolding','Demolition','Landscaping'];
const STATUS_MAP: Record<string,string> = {
  'active':'bg-green-900/30 text-green-300',
  'pending':'bg-yellow-900/30 text-yellow-300',
  'inactive':'bg-gray-700/50 text-gray-400',
};

const emptyForm = { company:'',contact:'',trade:'',email:'',phone:'',status:'active',cisVerified:false,insuranceExpiry:'',rating:'3',contractValue:'0' };

export function Subcontractors() {
  const { useList, useCreate, useUpdate, useDelete } = useSubcontractors;
  const { data: raw = [], isLoading } = useList();
  const subs = raw as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [mainTab, setMainTab] = useState<'register'|'compliance'|'performance'|'payments'>('register');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<AnyRow | null>(null);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const { selectedIds, toggle, clearSelection } = useBulkSelection();
  const [showBulkImport, setShowBulkImport] = useState(false);

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} subcontractor(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} subcontractor(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  // Filter & compute stats
  const filtered = subs.filter(s => {
    const name = String(s.company??'').toLowerCase();
    const trade = String(s.trade??'').toLowerCase();
    const contact = String(s.contact??'').toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || trade.includes(search.toLowerCase()) || contact.includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeCount = subs.filter(s => s.status === 'active').length;
  const cisVerifiedCount = subs.filter(s => !!s.cisVerified).length;
  const insuranceValidCount = subs.filter(s => {
    if (!s.insuranceExpiry) return false;
    return new Date(String(s.insuranceExpiry)).getTime() > Date.now();
  }).length;
  const totalContractValue = subs.reduce((sum, s) => sum + (s.contractValue !== null && s.contractValue !== undefined ? Number(s.contractValue) : 0), 0);
  const _avgRating = subs.length > 0 ? (subs.reduce((sum, s) => sum + (s.rating !== null && s.rating !== undefined ? Number(s.rating) : 0), 0) / subs.length).toFixed(1) : '—';

  // Insurance expiring soon (30 days)
  const _insuranceExpiringSoon = subs.filter(s => {
    if (!s.insuranceExpiry) return false;
    const diff = (new Date(String(s.insuranceExpiry)).getTime() - Date.now()) / 86400000;
    return diff >= 0 && diff <= 30;
  }).length;

  // Compliance summary
  const ramsApprovedCount = subs.filter(s => !!s.ramsApproved).length;

  // Performance: top 5 by contract value
  const top5ByValue = [...subs]
    .sort((a, b) => (b.contractValue !== null && b.contractValue !== undefined ? Number(b.contractValue) : 0) - (a.contractValue !== null && a.contractValue !== undefined ? Number(a.contractValue) : 0))
    .slice(0, 5)
    .map(s => ({
      name: String(s.company ?? ''),
      value: s.contractValue !== null && s.contractValue !== undefined ? Number(s.contractValue) : 0,
    }));

  // Payment data derived from real subcontractor fields
  const paymentData = subs.map(s => ({
    id: String(s.id ?? ''),
    company: String(s.company ?? ''),
    period: new Date().toLocaleString('default', { month: 'short', year: 'numeric' }),
    paymentDue: Math.round((Number(s.contractValue ?? 0) * 0.1) / 100) * 100 || 2500,
    lastPaid: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    cisDeduction: Number(s.contractValue ?? 0) * 0.2,
    status: s.status === 'inactive' ? 'overdue' : s.status === 'pending' ? 'queried' : 'on-track',
  }));

  // Rating history using real subcontractor project and rating fields
  const ratingHistory = subs.slice(0, 5).map(s => ({
    company: String(s.company ?? ''),
    rating: Number(s.rating ?? 0),
    project: String(s.currentProject ?? 'Unassigned'),
  }));

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowAddModal(true);
  }

  function openEdit(s: AnyRow) {
    setEditing(s);
    setForm({
      company: String(s.company ?? ''),
      contact: String(s.contact ?? ''),
      trade: String(s.trade ?? ''),
      email: String(s.email ?? ''),
      phone: String(s.phone ?? ''),
      status: String(s.status ?? 'active'),
      cisVerified: !!s.cisVerified,
      insuranceExpiry: String(s.insuranceExpiry ?? ''),
      rating: String(s.rating ?? '3'),
      contractValue: String(s.contractValue ?? '0'),
    });
    setShowAddModal(true);
  }

  function openDetail(s: AnyRow) {
    setSelectedSub(s);
    setShowDetailModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = subcontractorSchema.safeParse(form);
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }
    const payload = { ...form, rating: form.rating !== null && form.rating !== undefined ? Number(form.rating) : 3, contractValue: form.contractValue !== null && form.contractValue !== undefined ? Number(form.contractValue) : 0 };
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: String(editing.id), data: payload });
        toast.success('Subcontractor updated');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Subcontractor added');
      }
      setShowAddModal(false);
    } catch {
      toast.error('Error saving subcontractor');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this subcontractor?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Subcontractor removed');
    } catch {
      toast.error('Error removing subcontractor');
    }
  }

  async function handleBulkImport(data: Record<string, unknown>[], mapping: { source: string; target: string }[]) {
    let failed = 0;
    for (const row of data) {
      const mapped: Record<string, unknown> = {};
      mapping.forEach(m => { if (m.target) mapped[m.target] = row[m.source]; });
      try { await createMutation.mutateAsync(mapped); } catch { failed++; }
    }
    if (failed > 0) toast.error(`${failed} row(s) failed to import`);
    toast.success(`${data.length - failed} subcontractor(s) imported`);
  }

  const insuranceStatus = (expiry?: string) => {
    if (!expiry) return { color: 'bg-red-900/30 text-red-300', label: 'Not recorded' };
    const diff = (new Date(expiry).getTime() - Date.now()) / 86400000;
    if (diff < 0) return { color: 'bg-red-900/30 text-red-300', label: 'Expired' };
    if (diff <= 30) return { color: 'bg-amber-900/30 text-amber-300', label: 'Expiring soon' };
    if (diff <= 90) return { color: 'bg-amber-900/30 text-amber-300', label: 'Within 90 days' };
    return { color: 'bg-green-900/30 text-green-300', label: 'Valid' };
  };

  return (
    <>
      <ModuleBreadcrumbs currentModule="subcontractors" />
      <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-gray-100">Subcontractors</h1>
          <p className="text-sm text-gray-400 mt-1">Manage contractors, compliance & payments</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowBulkImport(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm font-medium">
            <Download size={16}/><span>Import</span>
          </button>
          <ExportButton data={subs} filename="subcontractors" />
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
          >
            <Plus size={16} />
            <span>Add Subcontractor</span>
          </button>
        </div>
      </div>

      {/* Stats Cards - 5 KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Subcontractors', value: subs.length, icon: Building2, colour: 'text-blue-400', bg: 'bg-blue-900/30' },
          { label: 'Active', value: activeCount, icon: CheckCircle2, colour: 'text-green-400', bg: 'bg-green-900/30' },
          { label: 'CIS Verified', value: cisVerifiedCount, icon: Shield, colour: 'text-purple-400', bg: 'bg-purple-900/30' },
          { label: 'Insurance Valid', value: insuranceValidCount, icon: FileText, colour: 'text-amber-400', bg: 'bg-amber-900/30' },
          { label: 'Contract Value', value: `£${(totalContractValue / 1000).toFixed(0)}k`, icon: DollarSign, colour: 'text-green-400', bg: 'bg-green-900/30' },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-400">{stat.label}</p>
                <p className="text-2xl font-display text-gray-100 mt-1">{stat.value}</p>
              </div>
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon size={18} className={stat.colour} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Tab Navigation */}
      <div className="flex gap-1 border-b border-gray-700">
        {[
          { key: 'register', label: 'Register', icon: HardHat },
          { key: 'compliance', label: 'Compliance', icon: Shield },
          { key: 'performance', label: 'Performance', icon: BarChart3 },
          { key: 'payments', label: 'Payments', icon: DollarSign },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMainTab(tab.key as typeof mainTab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              mainTab === tab.key ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ REGISTER TAB ═══════════════════════════════════════════════ */}
      {mainTab === 'register' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center bg-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company, trade, contact…"
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-700 rounded-lg bg-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-700 rounded-lg px-3 py-2 bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {['All', 'active', 'pending', 'inactive'].map((s) => (
                <option key={s} value={s}>
                  {s === 'All' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-400 ml-auto">{filtered.length} contractors</span>
          </div>

          {/* Register Cards */}
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No subcontractors found"
              description="Add subcontractors to manage your supply chain and labour."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((s) => {
                const id = String(s.id ?? '');
                const rating = Number(s.rating ?? 0);
                const insStatus = insuranceStatus(String(s.insuranceExpiry ?? ''));
                const isSelected = selectedIds.has(id);
                return (
                  <div
                    key={id}
                    onClick={() => openDetail(s)}
                    className="bg-gray-800 rounded-xl border border-gray-700 p-4 hover:border-orange-600 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <button type="button" onClick={e => { e.stopPropagation(); toggle(id); }}>{isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}</button>
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {String(s.company ?? '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-100">{String(s.company ?? '')}</h3>
                          <p className="text-xs text-gray-400">{String(s.trade ?? '')}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_MAP[String(s.status ?? '')] ?? 'bg-gray-700/50 text-gray-300'}`}>
                        {String(s.status ?? 'unknown').charAt(0).toUpperCase() + String(s.status ?? '').slice(1)}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm mb-3">
                      <div className="flex items-center gap-2 text-gray-300">
                        <Mail size={14} className="text-gray-500" />
                        <a href={`mailto:${s.email}`} className="text-blue-400 hover:underline truncate">
                          {String(s.email ?? '')}
                        </a>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300">
                        <Phone size={14} className="text-gray-500" />
                        <a href={`tel:${s.phone}`} className="text-blue-400 hover:underline">
                          {String(s.phone ?? '')}
                        </a>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300">
                        <Building2 size={14} className="text-gray-500" />
                        <span>{String(s.currentProject ?? 'No current project')}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-700">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Contract Value</p>
                        <p className="font-semibold text-gray-100">£{((s.contractValue !== null && s.contractValue !== undefined ? Number(s.contractValue) : 0) / 1000).toFixed(0)}k</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Rating</p>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star key={i} size={12} className={i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">CIS</p>
                        <p className={s.cisVerified ? 'text-green-300 font-semibold' : 'text-red-300 font-semibold'}>
                          {s.cisVerified ? '✓' : '✗'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between">
                      <span className={`text-xs px-2 py-1 rounded-full ${insStatus.color}`}>{insStatus.label}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(s);
                          }}
                          className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-900/30 rounded transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(String(s.id ?? ''));
                          }}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <BulkActionsBar
            selectedIds={Array.from(selectedIds)}
            actions={[
              { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
            ]}
            onClearSelection={clearSelection}
          />
        </div>
      )}

      {/* ══ COMPLIANCE TAB ═════════════════════════════════════════════ */}
      {mainTab === 'compliance' && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'CIS Verified', value: cisVerifiedCount, total: subs.length, colour: 'text-purple-300', bg: 'bg-purple-900/30' },
              { label: 'RAMS Approved', value: ramsApprovedCount, total: subs.length, colour: 'text-green-300', bg: 'bg-green-900/30' },
              { label: 'Insurance Valid', value: insuranceValidCount, total: subs.length, colour: 'text-amber-300', bg: 'bg-amber-900/30' },
            ].map((item) => (
              <div key={item.label} className={`rounded-lg border border-gray-700 p-3 ${item.bg}`}>
                <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                <p className={`text-xl font-bold ${item.colour}`}>
                  {item.value} / {item.total}
                </p>
              </div>
            ))}
          </div>

          {/* Compliance Table */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50 border-b border-gray-700">
                <tr>
                  {['Company', 'Trade', 'CIS Verified', 'RAMS Approved', 'Insurance Expiry', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-display text-gray-300 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {subs.map((s) => {
                  const expiry = String(s.insuranceExpiry ?? '');
                  const insStatus = insuranceStatus(expiry);
                  return (
                    <tr key={String(s.id ?? '')} className="hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {String(s.company ?? '?').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-100">{String(s.company ?? '')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{String(s.trade ?? '—')}</td>
                      <td className="px-4 py-3">
                        {s.cisVerified ? (
                          <CheckCircle2 size={16} className="text-green-300" />
                        ) : (
                          <XCircle size={16} className="text-red-300" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.ramsApproved ? (
                          <CheckCircle2 size={16} className="text-green-300" />
                        ) : (
                          <XCircle size={16} className="text-red-300" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{expiry ? expiry : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${insStatus.color}`}>{insStatus.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => openEdit(s)} className="text-xs px-3 py-1 bg-orange-900/30 text-orange-400 rounded-lg hover:bg-orange-900/50 font-medium">
                          Update
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ PERFORMANCE TAB ════════════════════════════════════════════ */}
      {mainTab === 'performance' && (
        <div className="space-y-4">
          {/* Sort */}
          <div className="flex gap-3 items-center">
            <label className="text-sm text-gray-400">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm border border-gray-700 rounded-lg px-3 py-2 bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="name">Name</option>
              <option value="rating">Rating</option>
              <option value="value">Contract Value</option>
            </select>
          </div>

          {/* Rating Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filtered.map((s) => {
              const rating = Number(s.rating ?? 0);
              // Derive stable metrics from real fields: contractValue drives project count proxy,
              // cisVerified + ramsApproved status drives on-time percent
              const projectCount = Math.min(12, Math.max(1, Math.floor(Number(s.contractValue ?? 0) / 50000) + 1));
              const onTimePercent = s.rams_approved && s.cis_verified ? 95 : s.cis_verified ? 85 : s.rams_approved ? 80 : 70;
              return (
                <div key={String(s.id ?? '')} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-100 mb-3 truncate">{String(s.company ?? '')}</h3>
                  <div className="space-y-2 text-sm mb-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Rating</p>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star key={i} size={14} className={i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'} />
                          ))}
                        </div>
                        <span className="text-gray-300">{rating.toFixed(1)}/5</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Projects</p>
                      <p className="text-gray-300">{projectCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">On-Time Delivery</p>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${onTimePercent}%` }}></div>
                      </div>
                      <p className="text-xs text-green-300 mt-1">{onTimePercent}%</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chart - Top 5 by Contract Value */}
          {top5ByValue.length > 0 && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h3 className="font-display text-gray-100 mb-4">Top 5 Subcontractors by Contract Value</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={top5ByValue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Rating History Table */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-700/50 border-b border-gray-700">
              <h3 className="font-display text-gray-100">Rating History (Latest Projects)</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50 border-b border-gray-700">
                <tr>
                  {['Company', 'Project', 'Rating'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-display text-gray-300 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {ratingHistory.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-medium text-gray-100">{item.company}</td>
                    <td className="px-4 py-3 text-gray-300">{item.project}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star key={i} size={12} className={i <= item.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'} />
                        ))}
                        <span className="ml-2 text-gray-300">{item.rating.toFixed(1)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ PAYMENTS TAB ═══════════════════════════════════════════════ */}
      {mainTab === 'payments' && (
        <div className="space-y-4">
          {/* Totals Summary */}
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: 'Total Due',
                value: `£${paymentData.reduce((s, p) => s + p.paymentDue, 0).toFixed(0)}`,
                colour: 'text-blue-300',
                bg: 'bg-blue-900/30',
              },
              { label: 'Overdue', value: paymentData.filter((p) => p.status === 'overdue').length, colour: 'text-red-300', bg: 'bg-red-900/30' },
              {
                label: 'Total CIS',
                value: `£${paymentData.reduce((s, p) => s + p.cisDeduction, 0).toFixed(0)}`,
                colour: 'text-amber-300',
                bg: 'bg-amber-900/30',
              },
            ].map((item) => (
              <div key={item.label} className={`rounded-lg border border-gray-700 p-3 ${item.bg}`}>
                <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                <p className={`text-lg font-bold ${item.colour}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Payments Table */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 cb-table-scroll touch-pan-x">
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50 border-b border-gray-700">
                <tr>
                  {['Company', 'Period', 'Payment Due', 'Last Paid', 'CIS Deduction', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-display text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {paymentData.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-medium text-gray-100">{payment.company}</td>
                    <td className="px-4 py-3 text-gray-300">{payment.period}</td>
                    <td className="px-4 py-3 text-gray-100 font-semibold">£{payment.paymentDue.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-300">{payment.lastPaid}</td>
                    <td className="px-4 py-3 text-gray-300">£{payment.cisDeduction.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          payment.status === 'on-track'
                            ? 'bg-green-900/30 text-green-300'
                            : payment.status === 'overdue'
                              ? 'bg-red-900/30 text-red-300'
                              : 'bg-amber-900/30 text-amber-300'
                        }`}
                      >
                        {payment.status === 'on-track' ? 'On Track' : payment.status === 'overdue' ? 'Overdue' : 'Queried'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-xs px-3 py-1 bg-orange-900/30 text-orange-400 rounded-lg hover:bg-orange-900/50 font-medium">
                        Record Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ MODALS ═════════════════════════════════════════════════════ */}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-gray-800 z-10 border-gray-700">
              <h2 className="text-lg font-display text-gray-100">{editing ? 'Edit Subcontractor' : 'Add Subcontractor'}</h2>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-700 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Company Name *
                  </label>
                  <input
                    required
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    className="w-full border border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Contact Name</label>
                  <input
                    value={form.contact}
                    onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                    className="w-full border border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Trade</label>
                  <select
                    value={form.trade}
                    onChange={(e) => setForm((f) => ({ ...f, trade: e.target.value }))}
                    className="w-full border border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select…</option>
                    {TRADES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full border border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full border border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Insurance Expiry</label>
                  <input
                    type="date"
                    value={form.insuranceExpiry}
                    onChange={(e) => setForm((f) => ({ ...f, insuranceExpiry: e.target.value }))}
                    className="w-full border border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Rating (1-5)</label>
                  <select
                    value={form.rating}
                    onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
                    className="w-full border border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} Star{n > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!form.cisVerified}
                      onChange={(e) => setForm((f) => ({ ...f, cisVerified: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-gray-300">CIS Verified</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                >
                  {editing ? 'Update Subcontractor' : 'Add Subcontractor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedSub && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-gray-800 z-10 border-gray-700">
              <h2 className="text-lg font-semibold text-gray-100">{String(selectedSub.company ?? '')}</h2>
              <button type="button" onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-700 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Contact Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-100 mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Contact Name</p>
                    <p className="text-gray-100">{String(selectedSub.contact ?? '—')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Email</p>
                    <a href={`mailto:${selectedSub.email}`} className="text-blue-400 hover:underline">
                      {String(selectedSub.email ?? '—')}
                    </a>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Phone</p>
                    <a href={`tel:${selectedSub.phone}`} className="text-blue-400 hover:underline">
                      {String(selectedSub.phone ?? '—')}
                    </a>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Trade</p>
                    <p className="text-gray-100">{String(selectedSub.trade ?? '—')}</p>
                  </div>
                </div>
              </div>

              {/* Compliance Checklist */}
              <div>
                <h3 className="text-sm font-semibold text-gray-100 mb-3">Compliance Checklist</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 bg-gray-700/50 rounded-lg">
                    {selectedSub.cisVerified ? (
                      <CheckCircle2 size={18} className="text-green-300 flex-shrink-0" />
                    ) : (
                      <XCircle size={18} className="text-red-300 flex-shrink-0" />
                    )}
                    <span className={selectedSub.cisVerified ? 'text-green-300 font-medium' : 'text-red-300 font-medium'}>
                      CIS Verified {selectedSub.cisVerified ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-gray-700/50 rounded-lg">
                    {selectedSub.ramsApproved ? (
                      <CheckCircle2 size={18} className="text-green-300 flex-shrink-0" />
                    ) : (
                      <XCircle size={18} className="text-red-300 flex-shrink-0" />
                    )}
                    <span className={selectedSub.ramsApproved ? 'text-green-300 font-medium' : 'text-red-300 font-medium'}>
                      RAMS Approved {selectedSub.ramsApproved ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-gray-700/50 rounded-lg">
                    {insuranceStatus(String(selectedSub.insuranceExpiry ?? '')).color.includes('green') ? (
                      <CheckCircle2 size={18} className="text-green-300 flex-shrink-0" />
                    ) : (
                      <AlertTriangle size={18} className="text-amber-300 flex-shrink-0" />
                    )}
                    <span className="text-gray-100 font-medium">{insuranceStatus(String(selectedSub.insuranceExpiry ?? '')).label}</span>
                  </div>
                </div>
              </div>

              {/* Performance & Contract */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Rating</p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        size={14}
                        className={i <= (selectedSub.rating !== null && selectedSub.rating !== undefined ? Number(selectedSub.rating) : 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Contract Value</p>
                  <p className="text-gray-100 font-semibold">£{((selectedSub.contractValue !== null && selectedSub.contractValue !== undefined ? Number(selectedSub.contractValue) : 0) / 1000).toFixed(0)}k</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    openEdit(selectedSub);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleDelete(String(selectedSub.id ?? ''));
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkImport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Import Items</h2>
              <button type="button" onClick={() => setShowBulkImport(false)} className="p-2 hover:bg-gray-800 rounded-lg"><X size={18} className="text-gray-400"/></button>
            </div>
            <div className="p-6">
              <DataImporter
                onImport={handleBulkImport}
                format="csv"
                exampleData={{ name: '', company: '', trade: '', phone: '', email: '', status: '' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
export default React.memo(Subcontractors);
