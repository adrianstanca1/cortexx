import { useState } from 'react';
import {
  Plus, Search, TrendingUp, Clock, XCircle, Edit2, Trash2, X, Calendar, DollarSign, Target, Award, BarChart3, Brain, Zap, CheckSquare, Square
} from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { useTenders } from '../../hooks/useData';
import { toast } from 'sonner';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';

import { API_BASE } from '../../lib/auth-storage';


type AnyRow = Record<string, unknown>;

interface _TenderRequest {
  id: string;
  title: string;
  client: string;
  value: number;
  deadline: string;
  status: 'drafting' | 'submitted' | 'shortlisted' | 'won' | 'lost';
  probability: number;
  type: string;
  location: string;
  aiScore: number;
  notes: string;
}

const PIPELINE_STAGES = ['Drafting', 'Submitted', 'Shortlisted', 'Won', 'Lost'];
const TENDER_TYPES = ['Design & Build', 'Traditional', 'Two Stage', 'Framework', 'Negotiated', 'Minor Works'];

const statusColours: Record<string, string> = {
  'drafting': 'bg-gray-700 text-gray-200',
  'submitted': 'bg-blue-900 text-blue-200',
  'shortlisted': 'bg-purple-900 text-purple-200',
  'won': 'bg-green-900 text-green-200',
  'lost': 'bg-red-900 text-red-200',
};

const emptyForm = {
  title: '',
  client: '',
  type: '',
  value: 0,
  deadline: '',
  status: 'drafting' as const,
  probability: 50,
  location: '',
  aiScore: 0,
  notes: '',
};

export function Tenders() {
  const { useList, useCreate, useUpdate, useDelete } = useTenders;
  const { data: raw = [], isLoading } = useList();
  const tenders = raw as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [activeTab, setActiveTab] = useState<'pipeline' | 'register' | 'analytics' | 'ai-scoring'>('pipeline');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [selectedDetail, setSelectedDetail] = useState<AnyRow | null>(null);
  const [aiFilter, setAiFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} tender(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} tender(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  // Filtering logic
  const filtered = tenders.filter(t => {
    const title = String(t.title ?? '').toLowerCase();
    const client = String(t.client ?? '').toLowerCase();
    const matchSearch = title.includes(search.toLowerCase()) || client.includes(search.toLowerCase());
    const matchType = filterType === 'All' || String(t.type ?? '') === filterType;
    const matchStatus = filterStatus === 'All' || String(t.status ?? '') === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  // Stats calculations
  const activeBids = tenders.filter(t => !['won', 'lost'].includes(String(t.status ?? ''))).length;
  const totalPipeline = tenders.reduce((sum, t) => sum + Number(t.value ?? 0), 0);
  const wonCount = tenders.filter(t => t.status === 'won').length;
  const lostCount = tenders.filter(t => t.status === 'lost').length;
  const winRate = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;
  const avgBidSize = tenders.length > 0 ? totalPipeline / tenders.length : 0;
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const bidsThisMonth = tenders.filter(t => {
    const d = new Date(String(t.deadline ?? ''));
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  // Analytics data
  const monthlyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (6 - i));
    const month = d.toLocaleString('default', { month: 'short' });
    const count = tenders.filter(t => {
      const td = new Date(String(t.deadline ?? ''));
      return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
    }).length;
    return { month, count };
  });

  const winRateByType = TENDER_TYPES.map(type => {
    const typeWon = tenders.filter(t => t.type === type && t.status === 'won').length;
    const typeLost = tenders.filter(t => t.type === type && t.status === 'lost').length;
    const total = typeWon + typeLost;
    return {
      type: type.substring(0, 12),
      wins: typeWon,
      losses: typeLost,
      rate: total > 0 ? Math.round((typeWon / total) * 100) : 0,
    };
  });

  const funnelData = [
    { stage: 'Drafting', count: tenders.filter(t => t.status === 'drafting').length },
    { stage: 'Submitted', count: tenders.filter(t => t.status === 'submitted').length },
    { stage: 'Shortlisted', count: tenders.filter(t => t.status === 'shortlisted').length },
    { stage: 'Won', count: wonCount },
  ];

  // Stable hash offset: produces a deterministic integer in [-10, 10] per (id, seed) pair
  function hashOffset(id: unknown, seed: number): number {
    let h = seed * 2654435761;
    const s = String(id ?? '');
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 2246822519);
    }
    return ((Math.abs(h >>> 0) % 21) - 10);
  }

  const aiScoringData = tenders
    .map(t => {
      const base = Number(t.aiScore ?? 50);
      const mapped: AnyRow & {
        overall: number;
        clientRel: number;
        techFit: number;
        priceComp: number;
        progRisk: number;
        resources: number;
      } = {
        ...t,
        overall: Number(t.aiScore ?? 0),
        // Sub-dimensions: stable offsets derived from tender ID — no random on render
        clientRel: Math.min(100, Math.max(5, base + hashOffset(t.id, 1))),
        techFit:   Math.min(100, Math.max(5, base + hashOffset(t.id, 2))),
        priceComp: Math.min(100, Math.max(5, base + hashOffset(t.id, 3))),
        progRisk:  Math.min(100, Math.max(5, base + hashOffset(t.id, 4))),
        resources: Math.min(100, Math.max(5, base + hashOffset(t.id, 5))),
      };
      return mapped;
    })
    .filter(t => {
      if (aiFilter === 'high') return t.overall >= 70;
      if (aiFilter === 'medium') return t.overall >= 50 && t.overall < 70;
      if (aiFilter === 'low') return t.overall < 50;
      return true;
    });

  // Helpers
  function getDaysToDeadline(deadline: unknown): number | null {
    const d = new Date(String(deadline ?? ''));
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    return Math.ceil((d.getTime() - today.getTime()) / (1000 * 3600 * 24));
  }

  function getDeadlineClass(days: number | null): string {
    if (days === null) return 'text-gray-400';
    if (days < 0) return 'text-red-400';
    if (days <= 7) return 'text-red-400';
    if (days <= 14) return 'text-yellow-400';
    return 'text-green-400';
  }

  function getAiScoreBadgeClass(score: number): string {
    if (score >= 75) return 'bg-green-900/30 text-green-300 border border-green-700';
    if (score >= 50) return 'bg-yellow-900/30 text-yellow-300 border border-yellow-700';
    return 'bg-red-900/30 text-red-300 border border-red-700';
  }

  // Modal handlers
  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  }

  function openEdit(t: AnyRow) {
    setEditing(t);
    setForm({
      title: String(t.title ?? ''),
      client: String(t.client ?? ''),
      type: String(t.type ?? ''),
      value: Number(t.value ?? 0),
      deadline: String(t.deadline ?? ''),
      status: (t.status ?? 'drafting') as typeof form.status,
      probability: Number(t.probability ?? 50),
      location: String(t.location ?? ''),
      aiScore: Number(t.aiScore ?? 0),
      notes: String(t.notes ?? ''),
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      value: form.value !== null && form.value !== undefined ? Number(form.value) : 0,
      probability: form.probability !== null && form.probability !== undefined ? Number(form.probability) : 50,
      aiScore: form.aiScore !== null && form.aiScore !== undefined ? Number(form.aiScore) : 0,
    };
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: String(editing.id), data: payload });
        toast.success('Tender updated');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Tender created');
      }
      setShowModal(false);
    } catch {
      toast.error('Failed to save tender');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this tender?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Tender deleted');
    } catch {
      toast.error('Failed to delete tender');
    }
  }

  async function moveStatus(t: AnyRow, newStatus: typeof form.status) {
    try {
      await updateMutation.mutateAsync({ id: String(t.id), data: { status: newStatus } });
      toast.success(`Moved to ${newStatus}`);
    } catch {
      toast.error('Failed to move tender');
    }
  }

  async function triggerAiRescore() {
    if (!tenders.length) return;
    toast.loading('AI re-scoring all tenders...', { id: 'ai-rescore' });
    try {
      const ids = tenders.map(t => String(t.id));
      const res = await fetch(`${API_BASE}/tenders/ai/batch/ai-score`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenderIds: ids }),
      });
      if (!res.ok) throw new Error('Batch scoring failed');
      const { results } = await res.json();
      const scoreMap: Record<string, number> = {};
      (results || []).forEach((r: { id: string; overall?: number; error?: string }) => {
        if (r.overall !== null && r.overall !== undefined) scoreMap[r.id] = r.overall;
      });
      // Persist scores back via the update mutation
      await Promise.all(
        Object.entries(scoreMap).map(([tid, score]) =>
          updateMutation.mutateAsync({ id: tid, data: { ai_score: score } })
        )
      );
      toast.dismiss('ai-rescore');
      toast.success(`Re-scored ${Object.keys(scoreMap).length} tender(s)`);
    } catch {
      toast.dismiss('ai-rescore');
      toast.error('AI re-scoring failed');
    }
  }

  async function rescoreTender(tender: AnyRow) {
    const id = String(tender.id);
    toast.loading('AI scoring...', { id: `ai-score-${id}` });
    try {
      const res = await fetch(`${API_BASE}/tenders/ai/${id}/ai-score`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Scoring failed');
      const scores = await res.json();
      await updateMutation.mutateAsync({ id, data: { ai_score: scores.overall } });
      toast.dismiss(`ai-score-${id}`);
      toast.success('AI scoring complete');
    } catch {
      toast.dismiss(`ai-score-${id}`);
      toast.error('Scoring failed');
    }
  }

  return (
    <>
      <ModuleBreadcrumbs currentModule="tenders" />
      <div className="p-6 space-y-6 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display text-white">Tender Pipeline</h1>
          <p className="text-sm text-gray-400 mt-1">Comprehensive bid management & AI-powered pipeline</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus size={18} /> <span>Add Opportunity</span>
        </button>
      </div>

      {/* Stats Cards (5) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          {
            label: 'Active Bids',
            value: activeBids,
            icon: Target,
            colour: 'text-blue-400',
            bg: 'bg-blue-900/20',
          },
          {
            label: 'Total Pipeline',
            value: `£${(totalPipeline / 1000000).toFixed(1)}M`,
            icon: DollarSign,
            colour: 'text-green-400',
            bg: 'bg-green-900/20',
          },
          {
            label: 'Win Rate',
            value: `${winRate}%`,
            icon: Award,
            colour: 'text-purple-400',
            bg: 'bg-purple-900/20',
          },
          {
            label: 'Avg Bid Size',
            value: `£${(avgBidSize / 1000).toFixed(0)}k`,
            icon: TrendingUp,
            colour: 'text-orange-400',
            bg: 'bg-orange-900/20',
          },
          {
            label: 'This Month',
            value: bidsThisMonth,
            icon: Calendar,
            colour: 'text-pink-400',
            bg: 'bg-pink-900/20',
          },
        ].map(stat => (
          <div
            key={stat.label}
            className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">{stat.label}</p>
                <p className="text-2xl font-display text-white mt-2">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon size={24} className={stat.colour} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-700">
        {[
          { id: 'pipeline', label: 'Bid Pipeline', icon: Target },
          { id: 'register', label: 'Tender Register', icon: BarChart3 },
          { id: 'analytics', label: 'Analytics', icon: TrendingUp },
          { id: 'ai-scoring', label: 'AI Scoring', icon: Brain },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'pipeline' | 'register' | 'analytics' | 'ai-scoring')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : activeTab === 'pipeline' ? (
        // Bid Pipeline Tab
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by title or client..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-700 rounded-lg bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="text-sm border border-gray-700 rounded-lg px-3 py-2 bg-gray-900 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Types</option>
              {TENDER_TYPES.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-700 rounded-lg px-3 py-2 bg-gray-900 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Status</option>
              {PIPELINE_STAGES.map(s => (
                <option key={s} value={s.toLowerCase()}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="cb-table-scroll touch-pan-x pb-4">
            <div className="flex gap-4 min-w-max">
              {PIPELINE_STAGES.map(stage => {
                const stageKey = stage.toLowerCase();
                const stageCards = filtered.filter(t => t.status === stageKey);
                const stageValue = stageCards.reduce((sum, t) => sum + Number(t.value ?? 0), 0);

                return (
                  <div key={stage} className="w-80 flex-shrink-0">
                    <div className="bg-gray-800 rounded-t-lg px-4 py-3 border-b border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">{stage}</span>
                        <span className="text-xs bg-gray-700 text-gray-200 px-2 py-1 rounded-full font-medium">
                          {stageCards.length}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        £{(stageValue / 1000).toFixed(0)}k
                      </p>
                    </div>
                    <div className="bg-gray-900 rounded-b-lg p-2 space-y-2 min-h-96 max-h-96 overflow-y-auto">
                      {stageCards.length === 0 ? (
                        <div className="h-96 flex items-center justify-center text-gray-600 text-sm">
                          No bids
                        </div>
                      ) : (
                        stageCards.map(t => {
                          const days = getDaysToDeadline(t.deadline);
                          return (
                            <div
                              key={String(t.id)}
                              className="bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500/50 p-3 space-y-2 cursor-pointer hover:shadow-lg transition-all group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-medium text-sm text-white truncate flex-1">
                                  {String(t.title ?? 'Untitled')}
                                </h4>
                                {!!Number(t.aiScore ?? 0) && (
                                  <span className={`text-xs font-bold px-2 py-1 rounded flex-shrink-0 ${getAiScoreBadgeClass(
                                    Number(t.aiScore ?? 0)
                                  )}`}>
                                    {Number(t.aiScore ?? 0)}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400">{String(t.client ?? '—')}</p>
                              {!!Number(t.value ?? 0) && (
                                <p className="text-xs font-semibold text-blue-400">
                                  £{Number(t.value ?? 0).toLocaleString()}
                                </p>
                              )}
                              {days !== null && (
                                <div className="flex items-center gap-1">
                                  <Clock size={12} className={getDeadlineClass(days)} />
                                  <span className={`text-xs ${getDeadlineClass(days)}`}>
                                    {days < 0 ? 'Overdue' : days === 0 ? 'Today' : `${days}d left`}
                                  </span>
                                </div>
                              )}
                              <div className="flex gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openEdit(t)}
                                  className="flex-1 text-xs bg-gray-700 hover:bg-blue-600 text-white py-1 rounded transition-colors"
                                >
                                  <Edit2 size={12} className="mx-auto" />
                                </button>
                                {stageKey !== 'won' && stageKey !== 'lost' && (
                                  <select
                                    value={stageKey}
                                    onChange={e => moveStatus(t, e.target.value as typeof form.status)}
                                    className="flex-1 text-xs bg-gray-700 hover:bg-green-600 text-white px-1 rounded transition-colors cursor-pointer"
                                  >
                                    {PIPELINE_STAGES.map(s => (
                                      <option key={s} value={s.toLowerCase()}>
                                        {s}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : activeTab === 'register' ? (
        // Tender Register Tab
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 border-b border-gray-700">
              <tr>
                {['Ref', 'Title', 'Client', 'Type', 'Value', 'Deadline', 'Status', 'AI Score', 'Win Prob', 'Actions'].map(
                  h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filtered.map((t, idx) => {
                const _days = getDaysToDeadline(t.deadline);
                const tId = String(t.id);
                const isSelected = selectedIds.has(tId);
                return (
                  <tr
                    key={tId}
                    className={`hover:bg-gray-700/50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-900/20' : ''}`}
                    onClick={() => setSelectedDetail(t)}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button type="button" onClick={() => toggle(tId)}>
                        {isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                      T{String(idx + 1).padStart(4, '0')}
                    </td>
                    <td className="px-4 py-3 font-medium text-white truncate">{String(t.title ?? '—')}</td>
                    <td className="px-4 py-3 text-gray-300 text-sm">{String(t.client ?? '—')}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{String(t.type ?? '—')}</td>
                    <td className="px-4 py-3 font-semibold text-blue-400">
                      £{Number(t.value ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        {String(t.deadline ?? '—')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          statusColours[String(t.status ?? '')] ?? 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {String(t.status ?? '').charAt(0).toUpperCase() +
                          String(t.status ?? '').slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!!Number(t.aiScore ?? 0) && (
                        <span className={`text-xs font-bold px-2 py-1 rounded ${getAiScoreBadgeClass(
                          Number(t.aiScore ?? 0)
                        )}`}>
                          {Number(t.aiScore ?? 0)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-24 bg-gray-900 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full"
                          style={{ width: `${Number(t.probability ?? 50)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{Number(t.probability ?? 50)}%</p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          openEdit(t);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-900/30 rounded transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState icon={XCircle} title="No tenders match your filters" description="Try adjusting your filter criteria or create a new tender." variant="default" />
          )}
          <BulkActionsBar
            selectedIds={Array.from(selectedIds)}
            actions={[
              { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
            ]}
            onClearSelection={clearSelection}
          />
        </div>
      ) : activeTab === 'analytics' ? (
        // Analytics Tab
        <div className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Submitted', value: tenders.length, colour: 'text-blue-400' },
              { label: 'Won', value: wonCount, colour: 'text-green-400' },
              { label: 'Lost', value: lostCount, colour: 'text-red-400' },
              { label: 'In Progress', value: activeBids, colour: 'text-yellow-400' },
              { label: 'Win Rate', value: `${winRate}%`, colour: 'text-purple-400' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide">{kpi.label}</p>
                <p className={`text-2xl font-bold ${kpi.colour} mt-2`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Win Rate by Type */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h3 className="text-sm font-display text-white mb-4">Win Rate by Project Type</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={winRateByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="type" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#FFF',
                    }}
                  />
                  <Bar dataKey="rate" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Conversion Funnel */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h3 className="text-sm font-display text-white mb-4">Bid Pipeline Funnel</h3>
              <div className="space-y-3">
                {funnelData.map(item => {
                  const maxCount = Math.max(...funnelData.map(d => d.count), 1);
                  const width = (item.count / maxCount) * 100;
                  return (
                    <div key={item.stage}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-300">{item.stage}</span>
                        <span className="text-xs text-gray-400">{item.count}</span>
                      </div>
                      <div className="h-6 bg-gray-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Monthly Trend */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h3 className="text-sm font-display text-white mb-4">Monthly Bid Submissions (7 months)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#FFF',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        // AI Scoring Tab
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <button
              onClick={triggerAiRescore}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Zap size={16} /> Re-score
            </button>
            <div className="flex gap-2 ml-auto">
              {[
                { id: 'high', label: 'High (≥70)' },
                { id: 'medium', label: 'Medium (50-69)' },
                { id: 'low', label: 'Low (<50)' },
                { id: 'all', label: 'All' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setAiFilter(f.id as 'all' | 'high' | 'medium' | 'low')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    aiFilter === f.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 border-b border-gray-700">
                <tr>
                  {[
                    'Title',
                    'Client',
                    'Overall',
                    'Client Rel',
                    'Tech Fit',
                    'Price Comp',
                    'Prog Risk',
                    'Resources',
                    'Actions',
                  ].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {aiScoringData.map(t => (
                  <tr key={String(t.id)} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-white truncate">
                      {String(t.title ?? '—')}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{String(t.client ?? '—')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${getAiScoreBadgeClass(
                        t.overall
                      )}`}>
                        {t.overall}
                      </span>
                    </td>
                    {[t.clientRel, t.techFit, t.priceComp, t.progRisk, t.resources].map(
                      (score, idx) => (
                        <td key={idx} className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 bg-gray-900 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${score}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 w-8">{score}</span>
                          </div>
                        </td>
                      )
                    )}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => rescoreTender(t)}
                        className="text-xs px-2 py-1 bg-purple-700 hover:bg-purple-600 text-purple-200 rounded font-medium transition-colors"
                        title="AI re-score this tender"
                      >
                        <Zap size={12} className="inline mr-1" />
                        Re-score
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {aiScoringData.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Brain size={32} className="mx-auto mb-2 opacity-30" />
                <p>No tenders in this AI score range</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit/Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
              <h2 className="text-lg font-display text-white">
                {editing ? 'Edit Tender' : 'Add Opportunity'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wide mb-2">
                    Tender Title
                  </label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wide mb-2">
                    Client
                  </label>
                  <input
                    type="text"
                    required
                    value={form.client}
                    onChange={e => setForm({ ...form, client: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wide mb-2">
                    Tender Type
                  </label>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select type</option>
                    {TENDER_TYPES.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wide mb-2">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value as typeof form.status })}
                    className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PIPELINE_STAGES.map(s => (
                      <option key={s} value={s.toLowerCase()}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wide mb-2">
                    Value (£)
                  </label>
                  <input
                    type="number"
                    value={form.value}
                    onChange={e => setForm({ ...form, value: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wide mb-2">
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={e => setForm({ ...form, deadline: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wide mb-2">
                    Win Probability (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.probability}
                    onChange={e => setForm({ ...form, probability: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wide mb-2">
                    AI Score (0-100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.aiScore}
                    onChange={e => setForm({ ...form, aiScore: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wide mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wide mb-2">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                {editing && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDelete(String(editing.id));
                      setShowModal(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-red-400 bg-red-900/30 hover:bg-red-900/50 rounded-lg transition-colors border border-red-700"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white btn btn-primary rounded-lg transition-colors"
                >
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedDetail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800">
              <h2 className="text-lg font-display text-white">Tender Details</h2>
              <button
                onClick={() => setSelectedDetail(null)}
                className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Title</p>
                <p className="text-white font-medium">{String(selectedDetail.title ?? '—')}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Client</p>
                  <p className="text-white">{String(selectedDetail.client ?? '—')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Type</p>
                  <p className="text-white">{String(selectedDetail.type ?? '—')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Value</p>
                  <p className="text-blue-400 font-semibold">£{Number(selectedDetail.value ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Status</p>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium inline-block ${
                      statusColours[String(selectedDetail.status ?? '')] ?? 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {String(selectedDetail.status ?? '').charAt(0).toUpperCase() +
                      String(selectedDetail.status ?? '').slice(1)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Deadline</p>
                  <p className="text-white">{String(selectedDetail.deadline ?? '—')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Win Probability</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${Number(selectedDetail.probability ?? 50)}%` }}
                      />
                    </div>
                    <span className="text-white font-medium text-sm">
                      {Number(selectedDetail.probability ?? 50)}%
                    </span>
                  </div>
                </div>
              </div>
              {!!Number(selectedDetail.aiScore ?? 0) && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">AI Score Breakdown</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Overall', val: Number(selectedDetail.aiScore ?? 0) },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-16">{item.label}</span>
                        <div className="flex-1 h-2 bg-gray-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${item.val}%` }}
                          />
                        </div>
                        <span className="text-xs text-white font-medium w-8 text-right">{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!!String(selectedDetail.notes ?? '') && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Notes</p>
                  <p className="text-gray-300 text-sm">{String(selectedDetail.notes ?? '')}</p>
                </div>
              )}
              <div className="flex gap-3 pt-4 border-t border-gray-700">
                <button
                  onClick={() => {
                    openEdit(selectedDetail);
                    setSelectedDetail(null);
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white btn btn-primary rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    moveStatus(selectedDetail, (selectedDetail.status === 'won' ? 'submitted' : 'won') as typeof form.status);
                    setSelectedDetail(null);
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  {selectedDetail.status === 'won' ? 'Revert' : 'Mark Won'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
export default Tenders;
