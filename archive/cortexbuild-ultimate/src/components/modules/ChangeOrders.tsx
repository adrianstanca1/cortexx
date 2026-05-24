import { useState } from 'react';
import {
  GitBranch, Plus, Search, CheckCircle2, Clock, Edit2, Trash2, X, TrendingUp, AlertTriangle,
  BarChart3, Activity, CheckSquare, Square, FileEdit, DollarSign, Calendar, PenLine
} from 'lucide-react';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { EmptyState } from '../ui/EmptyState';
import { useChangeOrders } from '../../hooks/useData';
import { signaturesApi } from '../../services/api';
import { SignatureCapture, SignatureDisplay } from '../ui/SignatureCapture';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import type { Signature } from '../../services/api';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

type AnyRow = Record<string, unknown>;

const changeOrderSchema = z.object({
  co_number: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['Addition', 'Omission', 'Substitution', 'Variation', 'Provisional Sum']).optional(),
  reason: z.string().optional(),
  value: z.union([z.string(), z.number()]).optional(),
  days_extension: z.union([z.string(), z.number()]).optional(),
  status: z.enum(['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Withdrawn']).optional(),
  project_id: z.string().optional(),
  submitted_date: z.string().optional(),
  approved_date: z.string().optional(),
  description: z.string().optional(),
  rejection_reason: z.string().optional(),
});

const STATUS_OPTIONS = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Withdrawn'];
const TYPES = ['Addition', 'Omission', 'Substitution', 'Variation', 'Provisional Sum'];
const REASONS = ['Client Variation', 'Unforeseen Conditions', 'Design Change', 'Scope Creep', 'Regulatory', 'Error & Omission'];

const statusColour: Record<string, string> = {
  'Draft': 'bg-gray-700/50 text-gray-400',
  'Submitted': 'bg-yellow-900/30 text-yellow-300',
  'Under Review': 'bg-yellow-900/30 text-yellow-300',
  'Approved': 'bg-green-900/30 text-green-300',
  'Rejected': 'bg-red-900/30 text-red-300',
  'Withdrawn': 'bg-gray-700/30 text-gray-400',
};

const _chartColours = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const emptyForm = {
  co_number: '',
  title: '',
  type: 'Addition',
  reason: '',
  value: '',
  days_extension: '0',
  status: 'Draft',
  project_id: '',
  submitted_date: '',
  approved_date: '',
  description: '',
  rejection_reason: ''
};

// Mock audit logs
function generateAuditLog(co: AnyRow): Array<{action: string; user: string; date: string}> {
  const logs: Array<{action: string; user: string; date: string}> = [];
  logs.push({ action: 'Created', user: 'System', date: '2026-01-15' });
  if (co.submitted_date) logs.push({ action: 'Submitted for approval', user: 'Project Manager', date: String(co.submitted_date) });
  if (co.status === 'Under Review') logs.push({ action: 'Under review', user: 'Approver', date: '2026-02-20' });
  if (co.status === 'Approved' && co.approved_date) logs.push({ action: 'Approved by Client', user: 'Client', date: String(co.approved_date) });
  if (co.status === 'Rejected') logs.push({ action: 'Rejected', user: 'Approver', date: '2026-02-25' });
  return logs;
}

// Generate chart data from orders
function generateChartData(orders: AnyRow[]) {
  const byMonth: Record<string, number> = {};
  orders.forEach(o => {
    if (o.status === 'Approved' && o.submitted_date) {
      const date = new Date(String(o.submitted_date));
      const key = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      byMonth[key] = (byMonth[key] || 0) + Number(o.value ?? 0);
    }
  });
  const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  return months.map(m => ({ month: m, value: byMonth[m] || 0 }));
}

function generateCumulativeData(orders: AnyRow[]) {
  const byMonth: Record<string, number> = {};
  let cumulative = 0;
  orders
    .filter(o => o.status === 'Approved')
    .sort((a, b) => String(a.submitted_date ?? '').localeCompare(String(b.submitted_date ?? '')))
    .forEach(o => {
      const date = new Date(String(o.submitted_date));
      const key = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      cumulative += Number(o.value ?? 0);
      byMonth[key] = cumulative;
    });
  const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  return months.map(m => ({ month: m, value: byMonth[m] || 0 }));
}

function generateReasonBreakdown(orders: AnyRow[]) {
  const breakdown: Record<string, { count: number; value: number }> = {};
  orders.forEach(o => {
    const reason = String(o.reason ?? 'Other');
    if (!breakdown[reason]) breakdown[reason] = { count: 0, value: 0 };
    breakdown[reason].count += 1;
    breakdown[reason].value += Number(o.value ?? 0);
  });
  return Object.entries(breakdown).map(([reason, data]) => ({
    reason,
    count: data.count,
    value: data.value,
    percentage: 0
  })).sort((a, b) => b.value - a.value);
}

function ApprovalTimeline({ status }: { status: string }) {
  const steps = [
    { label: 'Draft', icon: '📝' },
    { label: 'Submitted', icon: '📤' },
    { label: 'Under Review', icon: '👁️' },
    { label: 'Approved', icon: '✅' },
  ];

  const stepIndex = steps.findIndex(s => s.label === status);
  const isRejected = status === 'Rejected';

  return (
    <>
      <ModuleBreadcrumbs currentModule="change-orders" />
      <div className="flex items-center justify-between mb-6 p-4 bg-gray-700/50 rounded-lg">
      {steps.map((step, idx) => (
        <div key={step.label} className="flex flex-col items-center flex-1">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
            idx <= stepIndex && !isRejected ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-400'
          }`}>
            {step.icon}
          </div>
          <p className={`text-xs mt-2 font-medium ${idx <= stepIndex && !isRejected ? 'text-green-400' : 'text-gray-400'}`}>
            {step.label}
          </p>
          {idx < steps.length - 1 && (
            <div className={`h-1 w-8 mt-4 ${idx < stepIndex && !isRejected ? 'bg-green-600' : 'bg-gray-600'}`} />
          )}
        </div>
      ))}
    </div>
    </>
  );
}

function calculateDaysPending(submittedDate: unknown): number {
  const submitted = new Date(String(submittedDate ?? ''));
  const now = new Date();
  return Math.floor((now.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24));
}

function getUrgencyClass(daysPending: number): string {
  if (daysPending > 14) return 'border-l-4 border-l-red-500 bg-red-900/10';
  if (daysPending > 7) return 'border-l-4 border-l-yellow-500 bg-yellow-900/10';
  return 'border-l-4 border-l-gray-600 bg-gray-700/20';
}

function getUrgencyBadge(daysPending: number): { label: string; colour: string } {
  if (daysPending > 14) return { label: 'Critical', colour: 'bg-red-900/30 text-red-300' };
  if (daysPending > 7) return { label: 'Urgent', colour: 'bg-yellow-900/30 text-yellow-300' };
  return { label: 'On Time', colour: 'bg-gray-700/30 text-gray-300' };
}

export function ChangeOrders() {
  const { useList, useCreate, useUpdate, useDelete } = useChangeOrders;
  const { data: raw = [], isLoading } = useList();
  const orders = raw as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [mainTab, setMainTab] = useState('register');
  const [subTab, setSubTab] = useState('all');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [expandedCoId, setExpandedCoId] = useState<string | null>(null);
  const [selectedForApproval, setSelectedForApproval] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [showSignModal, setShowSignModal] = useState(false);
  const [signingCo, setSigningCo] = useState<AnyRow | null>(null);
  const [existingSignatures, setExistingSignatures] = useState<Signature[]>([]);

  const { user } = useAuth();

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} change order(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} order(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  async function handleBulkApprove(ids: string[]) {
    try {
      await Promise.all(ids.map(id => updateMutation.mutateAsync({ id, data: { status: 'Approved' } })));
      toast.success(`Approved ${ids.length} order(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk approve failed');
    }
  }

  const PENDING_STATUSES = ['Draft', 'Submitted', 'Under Review'];
  const REJECTED_STATUSES = ['Rejected', 'Withdrawn'];

  const filtered = orders.filter(o => {
    const title = String(o.title ?? '').toLowerCase();
    const num = String(o.co_number ?? '').toLowerCase();
    const proj = String(o.project ?? o.projectId ?? '').toLowerCase();
    const matchSearch = title.includes(search.toLowerCase()) || num.includes(search.toLowerCase());
    const matchProject = !projectFilter || proj.includes(projectFilter.toLowerCase());
    let matchStatus = statusFilter === 'All' || o.status === statusFilter;
    if (subTab === 'pending') matchStatus = PENDING_STATUSES.includes(String(o.status ?? ''));
    if (subTab === 'rejected') matchStatus = REJECTED_STATUSES.includes(String(o.status ?? ''));
    return matchSearch && matchStatus && matchProject;
  });

  const approvedOrders = orders.filter(o => o.status === 'Approved');
  const pendingOrders = orders.filter(o => ['Submitted', 'Under Review'].includes(String(o.status ?? '')));
  const draftOrders = orders.filter(o => o.status === 'Draft');

  const totalCOs = orders.length;
  const approvedCount = approvedOrders.length;
  const pendingCount = pendingOrders.length;
  const approvedValue = approvedOrders.reduce((s, o) => s + Number(o.value ?? 0), 0);
  const pendingValue = pendingOrders.reduce((s, o) => s + Number(o.value ?? 0), 0);
  const draftValue = draftOrders.reduce((s, o) => s + Number(o.value ?? 0), 0);
  const totalValue = approvedValue + pendingValue + draftValue;
  const totalDays = approvedOrders.reduce((s, o) => s + Number(o.days_extension ?? 0), 0);
  const avgProcessingTime = approvedCount > 0 ? Math.round(totalDays / approvedCount) : 0;
  const _underReviewCount = orders.filter(o => o.status === 'Under Review').length;
  const projects = Array.from(new Set(orders.map(o => String(o.project ?? o.projectId ?? '')).filter(Boolean)));

  function nextCONumber() {
    const nums = orders.map(o => parseInt(String(o.co_number ?? '0').replace(/\D/g, ''))).filter(n => !isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `CO-${String(next).padStart(3, '0')}`;
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, co_number: nextCONumber() });
    setShowModal(true);
  }

  function openEdit(o: AnyRow) {
    setEditing(o);
    setForm({
      co_number: String(o.co_number ?? ''),
      title: String(o.title ?? ''),
      type: String(o.type ?? 'Addition'),
      reason: String(o.reason ?? ''),
      value: String(o.value ?? ''),
      days_extension: String(o.days_extension ?? '0'),
      status: String(o.status ?? 'Draft'),
      project_id: String(o.project_id ?? ''),
      submitted_date: String(o.submitted_date ?? ''),
      approved_date: String(o.approved_date ?? ''),
      description: String(o.description ?? ''),
      rejection_reason: String(o.rejection_reason ?? '')
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = changeOrderSchema.safeParse(form);
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }
    const payload = { ...form, value: form.value !== null && form.value !== undefined ? Number(form.value) : 0, days_extension: form.days_extension !== null && form.days_extension !== undefined ? Number(form.days_extension) : 0 };
    if (editing) {
      await updateMutation.mutateAsync({ id: String(editing.id), data: payload });
      toast.success('Change order updated');
    } else {
      await createMutation.mutateAsync(payload);
      toast.success('Change order created');
    }
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this change order?')) return;
    await deleteMutation.mutateAsync(id);
    toast.success('Change order deleted');
  }

  async function openSignModal(o: AnyRow) {
    setSigningCo(o);
    setShowSignModal(true);
    try {
      const res = await signaturesApi.getByDocument('change_order', String(o.id));
      setExistingSignatures(Array.isArray(res.data) ? res.data : []);
    } catch {
      setExistingSignatures([]);
    }
  }

  async function handleSignature(signatureData: string) {
    if (!signingCo || !user) return;
    try {
      await signaturesApi.create({
        document_type: 'change_order',
        document_id: String(signingCo.id),
        signer_name: user.name || user.email || 'Unknown',
        signer_role: user.role || 'Approver',
        signer_email: user.email,
        signature_data: signatureData,
      });
      toast.success('Change order signed successfully');
      setShowSignModal(false);
      setSigningCo(null);
    } catch {
      toast.error('Failed to save signature');
    }
  }

  async function approve(o: AnyRow) {
    await updateMutation.mutateAsync({
      id: String(o.id),
      data: { status: 'Approved', approved_date: new Date().toISOString().slice(0, 10) }
    });
    toast.success('Change order approved');
  }

  async function approveSelected() {
    for (const id of selectedForApproval) {
      const order = orders.find(o => String(o.id) === id);
      if (order) {
        await updateMutation.mutateAsync({
          id,
          data: { status: 'Approved', approved_date: new Date().toISOString().slice(0, 10) }
        });
      }
    }
    toast.success(`${selectedForApproval.size} change orders approved`);
    setSelectedForApproval(new Set());
  }

  function toggleApprovalSelection(id: string) {
    const newSet = new Set(selectedForApproval);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedForApproval(newSet);
  }

  const _chartData = generateChartData(orders);
  const cumulativeData = generateCumulativeData(orders);
  const reasonBreakdown = generateReasonBreakdown(orders);
  const byProjectData = Array.from(new Set(orders.map(o => String(o.project ?? o.projectId ?? ''))))
    .map(proj => ({
      project: proj || 'Unassigned',
      value: orders.filter(o => String(o.project ?? o.projectId ?? '') === proj && o.status === 'Approved')
        .reduce((s, o) => s + Number(o.value ?? 0), 0)
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const pendingWorkflow = orders.filter(o => PENDING_STATUSES.includes(String(o.status ?? ''))).sort(
    (a, b) => String(a.submitted_date ?? '').localeCompare(String(b.submitted_date ?? ''))
  );

  return (
    <div className="p-6 space-y-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Change Orders</h1>
          <p className="text-sm text-gray-400 mt-1">UK construction variation management & financial impact</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
        >
          <Plus size={16} /> <span>New Change Order</span>
        </button>
      </div>

      {/* Stats Cards (5) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'Total COs', value: totalCOs, icon: FileEdit, colour: 'text-blue-400', bg: 'bg-blue-900/30', border: 'border-blue-700' },
          { label: 'Approved', value: approvedCount, icon: CheckCircle2, colour: 'text-green-400', bg: 'bg-green-900/30', border: 'border-green-700' },
          { label: 'Pending', value: pendingCount, icon: Clock, colour: 'text-yellow-400', bg: 'bg-yellow-900/30', border: 'border-yellow-700' },
          { label: 'Total Value (£)', value: `£${totalValue.toLocaleString()}`, icon: DollarSign, colour: 'text-purple-400', bg: 'bg-purple-900/30', border: 'border-purple-700' },
          { label: 'Avg Processing (days)', value: avgProcessingTime, icon: Calendar, colour: 'text-orange-400', bg: 'bg-orange-900/30', border: 'border-orange-700' },
        ].map(kpi => (
          <div key={kpi.label} className={`bg-gray-800 border-gray-700 rounded-xl border ${kpi.border} p-4`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-gray-400 font-medium">{kpi.label}</p>
                <p className="text-2xl font-bold text-white mt-2">{kpi.value}</p>
              </div>
              <div className={`p-2.5 rounded-lg ${kpi.bg}`}>
                <kpi.icon size={20} className={kpi.colour} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 border-b border-gray-700">
        {[
          { key: 'register', label: 'Change Orders', icon: FileEdit },
          { key: 'financial', label: 'Financial Impact', icon: BarChart3 },
          { key: 'workflow', label: 'Approval Workflow', icon: CheckCircle2 },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setMainTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              mainTab === tab.key
                ? 'border-orange-600 text-orange-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* CHANGE ORDERS TAB */}
      {mainTab === 'register' && (
        <div className="space-y-4">
          {/* Sub-tabs for Change Orders */}
          <div className="flex gap-1 border-b border-gray-700">
            {[
              { key: 'all', label: 'All', filter: 'All', count: orders.length },
              { key: 'draft', label: 'Draft', filter: 'Draft', count: draftOrders.length },
              { key: 'pending', label: 'Pending', filter: 'All', count: pendingCount },
              { key: 'approved', label: 'Approved', filter: 'Approved', count: approvedCount },
              { key: 'rejected', label: 'Rejected', filter: 'Rejected', count: orders.filter(o => REJECTED_STATUSES.includes(String(o.status ?? ''))).length },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => {
                  setSubTab(t.key);
                  setStatusFilter(t.filter);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  subTab === t.key ? 'border-orange-600 text-orange-400' : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    t.key === 'approved'
                      ? 'bg-green-900/30 text-green-300'
                      : t.key === 'rejected'
                        ? 'bg-red-900/30 text-red-300'
                        : 'bg-gray-700/30 text-gray-300'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search & Filter */}
          <div className="flex flex-wrap gap-3 items-center bg-gray-800 border-gray-700 rounded-xl border p-4">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search CO number or title…"
                className="w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="text-sm bg-gray-700 border-gray-600 text-white border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Projects</option>
              {projects.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
            </div>
          ) : (
            <div className="bg-gray-800 border-gray-700 rounded-xl border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700 border-gray-600 border-b">
                  <tr>
                    {['CO #', 'Project', 'Title', 'Amount (£)', 'Schedule Impact', 'Reason', 'Submitted', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-gray-400 font-medium uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filtered.map(o => {
                    const id = String(o.id);
                    const isSelected = selectedIds.has(id);
                    return (
                    <>
                      <tr
                        key={id}
                        className="hover:bg-gray-700/50 cursor-pointer"
                        onClick={() => setExpandedCoId(expandedCoId === id ? null : id)}
                      >
                        <td className="px-4 py-3">
                          <button type="button" onClick={e => { e.stopPropagation(); toggle(id); }}>{isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}</button>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-orange-600">{String(o.co_number ?? '—')}</td>
                        <td className="px-4 py-3 text-gray-300 text-sm">{String(o.project ?? o.projectId ?? '—')}</td>
                        <td className="px-4 py-3 font-medium text-white max-w-xs truncate">{String(o.title ?? '—')}</td>
                        <td className="px-4 py-3 font-semibold text-white">
                          {Number(o.value ?? 0) >= 0 ? '+' : ''}£{Number(o.value ?? 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm">
                          {Number(o.days_extension ?? 0) > 0 ? `+${String(o.days_extension)}d` : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm">{String(o.reason ?? '—')}</td>
                        <td className="px-4 py-3 text-gray-400 text-sm">{String(o.submitted_date ?? '—')}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColour[String(o.status ?? '')] ?? 'bg-gray-700/30 text-gray-300'}`}>
                            {String(o.status ?? '')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {String(o.status ?? '') === 'Under Review' && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  approve(o);
                                }}
                                className="p-1.5 text-green-400 hover:bg-green-900/30 rounded"
                                title="Approve"
                              >
                                <CheckCircle2 size={14} />
                              </button>
                            )}
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                openSignModal(o);
                              }}
                              className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-900/30 rounded"
                              title="Sign change order"
                            >
                              <PenLine size={14} />
                            </button>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                openEdit(o);
                              }}
                              className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-900/30 rounded"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleDelete(String(o.id));
                              }}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded Row */}
                      {expandedCoId === String(o.id) && (
                        <tr className="bg-gray-700/50">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="space-y-4">
                              <ApprovalTimeline status={String(o.status ?? 'Draft')} />
                              {!!o.rejection_reason && (
                                <div className="p-4 bg-red-900/30 border-red-700 border text-red-300 rounded-lg flex items-start gap-3">
                                  <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
                                  <div>
                                    <p className="font-semibold">Rejection Reason</p>
                                    <p className="text-sm mt-1">{String(o.rejection_reason)}</p>
                                  </div>
                                </div>
                              )}
                              <div className="grid grid-cols-3 gap-3 p-4 bg-gray-600/50 rounded-lg">
                                <div>
                                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Contract Impact</p>
                                  <p className="text-lg font-bold text-white mt-1">£{Number(o.value ?? 0).toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Programme Extension</p>
                                  <p className="text-lg font-bold text-white mt-1">+{Number(o.days_extension ?? 0)}d</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Cumulative Approved</p>
                                  <p className="text-lg font-bold text-white mt-1">£{approvedValue.toLocaleString()}</p>
                                </div>
                              </div>
                              <div className="bg-gray-600/50 rounded-lg p-4">
                                <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                  <Activity size={16} />
                                  Activity Log
                                </p>
                                <div className="space-y-2">
                                  {generateAuditLog(o).map((log, idx) => (
                                    <div key={idx} className="text-xs text-gray-300 flex items-start gap-2">
                                      <span className="text-gray-400">{log.date}</span>
                                      <span>•</span>
                                      <span>
                                        <span className="font-semibold">{log.action}</span> by {log.user}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {!!o.description && (
                                <div className="bg-gray-600/50 rounded-lg p-4">
                                  <p className="text-sm font-semibold text-white mb-2">Description</p>
                                  <p className="text-sm text-gray-300">{String(o.description)}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <EmptyState
                  icon={GitBranch}
                  title="No change orders found"
                  description="Create a change order to track scope adjustments and cost variations."
                />
              )}
              <BulkActionsBar
                selectedIds={Array.from(selectedIds)}
                actions={[
                  { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
                  { id: 'approve', label: 'Approve Selected', icon: CheckCircle2, variant: 'primary', onClick: handleBulkApprove },
                ]}
                onClearSelection={clearSelection}
              />
            </div>
          )}
        </div>
      )}

      {/* FINANCIAL IMPACT TAB */}
      {mainTab === 'financial' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Original Contract Value', value: '£2,500,000', colour: 'text-blue-400', bg: 'bg-blue-900/30' },
              { label: 'Approved COs Value', value: `£${approvedValue.toLocaleString()}`, colour: 'text-green-400', bg: 'bg-green-900/30' },
              { label: 'Pending COs Value', value: `£${pendingValue.toLocaleString()}`, colour: 'text-yellow-400', bg: 'bg-yellow-900/30' },
              { label: 'Revised Contract Value', value: `£${(2500000 + approvedValue).toLocaleString()}`, colour: 'text-purple-400', bg: 'bg-purple-900/30' },
            ].map(card => (
              <div key={card.label} className={`bg-gray-800 border-gray-700 rounded-xl border p-4`}>
                <p className="text-xs text-gray-400 font-medium">{card.label}</p>
                <p className={`text-2xl font-bold mt-2 ${card.colour}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart - CO Values by Project */}
            <div className="bg-gray-800 border-gray-700 rounded-xl border p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 size={20} />
                CO Values by Project
              </h3>
              {byProjectData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={byProjectData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="project" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={FileEdit} title="No approved COs by project" description="Change orders will appear here once created." variant="documents" />
              )}
            </div>

            {/* Line Chart - Cumulative CO Value Over Time */}
            <div className="bg-gray-800 border-gray-700 rounded-xl border p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={20} />
                Cumulative CO Value Over Time
              </h3>
              {cumulativeData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={cumulativeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
                    <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={TrendingUp} title="No cumulative data available" description="Cumulative chart data will appear here." variant="default" />
              )}
            </div>
          </div>

          {/* Reason Breakdown Table */}
          <div className="bg-gray-800 border-gray-700 rounded-xl border p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Reason Breakdown</h3>
            <table className="w-full text-sm">
              <thead className="bg-gray-700 border-gray-600 border-b">
                <tr>
                  {['Reason', 'Count', 'Total Value (£)', '%'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-gray-400 font-medium uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {reasonBreakdown.length > 0 ? (
                  reasonBreakdown.map(row => {
                    const totalBreakdownValue = reasonBreakdown.reduce((s, r) => s + r.value, 0);
                    const pct = totalBreakdownValue > 0 ? ((row.value / totalBreakdownValue) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={row.reason} className="hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-gray-300">{String(row.reason)}</td>
                        <td className="px-4 py-3 text-white font-semibold">{String(row.count)}</td>
                        <td className="px-4 py-3 text-white font-semibold">£{Number(row.value).toLocaleString()}</td>
                        <td className="px-4 py-3 text-white font-semibold">{String(pct)}%</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={4}><EmptyState icon={BarChart3} title="No data available" description="Chart data will appear here." variant="default" /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* APPROVAL WORKFLOW TAB */}
      {mainTab === 'workflow' && (
        <div className="space-y-4">
          {/* Bulk Actions */}
          {selectedForApproval.size > 0 && (
            <div className="flex items-center justify-between p-4 bg-orange-900/30 border border-orange-700 text-orange-300 rounded-lg">
              <span className="font-medium">{selectedForApproval.size} items selected</span>
              <button
                onClick={approveSelected}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium"
              >
                <CheckCircle2 size={16} />
                Approve Selected
              </button>
            </div>
          )}

          {/* Pending COs Cards */}
          {pendingWorkflow.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {pendingWorkflow.map(co => {
                const daysPending = calculateDaysPending(co.submitted_date);
                const urgency = getUrgencyBadge(daysPending);
                const selected = !!selectedForApproval.has(String(co.id));
                return (
                  <div key={String(co.id)} className={`bg-gray-800 border-gray-700 rounded-xl border p-5 ${getUrgencyClass(daysPending)}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleApprovalSelection(String(co.id))}
                          className="mt-1 w-5 h-5 bg-gray-700 border-gray-600 rounded cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-mono text-sm font-bold text-orange-400">{String(co.co_number ?? '—')}</p>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${urgency.colour}`}>
                              {urgency.label} ({daysPending}d)
                            </span>
                          </div>
                          <p className="text-white font-semibold">{String(co.title ?? '—')}</p>
                          <p className="text-sm text-gray-400 mt-1">
                            Project: <span className="text-gray-300">{String(co.project ?? co.projectId ?? '—')}</span>
                          </p>
                          <p className="text-sm text-gray-400">
                            Amount: <span className="text-white font-semibold">£{Number(co.value ?? 0).toLocaleString()}</span>
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            Submitted: {String(co.submitted_date ?? '—')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => approve(co)}
                          className="flex items-center gap-2 px-3 py-2 bg-green-900/30 text-green-300 hover:bg-green-900/50 rounded-lg text-sm font-medium"
                        >
                          <CheckCircle2 size={16} />
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setEditing(co);
                            setForm({
                              co_number: String(co.co_number ?? ''),
                              title: String(co.title ?? ''),
                              type: String(co.type ?? 'Addition'),
                              reason: String(co.reason ?? ''),
                              value: String(co.value ?? ''),
                              days_extension: String(co.days_extension ?? '0'),
                              status: String(co.status ?? 'Draft'),
                              project_id: String(co.project_id ?? ''),
                              submitted_date: String(co.submitted_date ?? ''),
                              approved_date: String(co.approved_date ?? ''),
                              description: String(co.description ?? ''),
                              rejection_reason: String(co.rejection_reason ?? '')
                            });
                            setShowModal(true);
                          }}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-900/30 text-blue-300 hover:bg-blue-900/50 rounded-lg text-sm font-medium"
                        >
                          <Edit2 size={16} />
                          Info
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-500">
              <CheckCircle2 size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-lg">All change orders processed</p>
              <p className="text-sm mt-1">No pending approvals at this time</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border">
            <div className="flex items-center justify-between p-6 border-gray-700 bg-gray-800 border-b sticky top-0 z-10">
              <h2 className="text-lg font-semibold text-white">{editing?'Edit Change Order':'New Change Order'}</h2>
              <button type="button" onClick={()=>setShowModal(false)} className="p-2 hover:bg-gray-700 rounded-lg"><X size={18}/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">CO Number</label>
                  <input value={form.co_number} onChange={e=>setForm(f=>({...f,co_number:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                  <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Title *</label>
                  <input required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Value (£)</label>
                  <input type="number" value={form.value} onChange={e=>setForm(f=>({...f,value:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Extension Days</label>
                  <input type="number" value={form.days_extension} onChange={e=>setForm(f=>({...f,days_extension:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Reason</label>
                  <select value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option value="">Select…</option>{REASONS.map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Submitted Date</label>
                  <input type="date" value={form.submitted_date} onChange={e=>setForm(f=>({...f,submitted_date:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                {form.status === 'Rejected' && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Rejection Reason</label>
                    <input value={form.rejection_reason} onChange={e=>setForm(f=>({...f,rejection_reason:e.target.value}))} placeholder="Explain why this change order was rejected…" className="w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                  <textarea rows={3} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"/>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className="flex-1 px-4 py-2 border-gray-600 text-gray-300 hover:bg-gray-700 border rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={createMutation.isPending||updateMutation.isPending} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                  {editing?'Update CO':'Create CO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSignModal && signingCo && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div>
                <h2 className="text-lg font-semibold text-white">Sign Change Order</h2>
                <p className="text-sm text-gray-400 mt-0.5">{String(signingCo.title ?? '')}</p>
              </div>
              <button type="button" onClick={() => { setShowSignModal(false); setSigningCo(null); }} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <SignatureCapture
                onSign={handleSignature}
                onCancel={() => { setShowSignModal(false); setSigningCo(null); }}
                signerName={user?.name || user?.email}
              />
              {existingSignatures.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-400">Existing signatures</p>
                  {existingSignatures.map(sig => <SignatureDisplay key={sig.id} signature={sig} compact />)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default ChangeOrders;
