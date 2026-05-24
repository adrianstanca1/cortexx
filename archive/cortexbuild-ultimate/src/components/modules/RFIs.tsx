import React, { useState } from 'react';
import {
  MessageSquare, Plus, Search, Clock, CheckCircle, AlertTriangle, Edit2, Trash2, X,
  ChevronDown, ChevronUp, Send, Zap, User, Flame, TrendingUp,
  Loader2, CheckSquare, Square, Brain
} from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { useRFIs } from '../../hooks/useData';
import { aiSummarizeApi } from '../../services/api';
import { toast } from 'sonner';
import { z } from 'zod';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';

type AnyRow = Record<string, unknown>;

const rfiSchema = z.object({
  rfi_number: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  question: z.string().min(1, 'Question is required'),
  answer: z.string().optional(),
  discipline: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
  status: z.enum(['Open', 'In Review', 'Answered', 'Closed']).optional(),
  assigned_to: z.string().optional(),
  project_id: z.string().optional(),
  due_date: z.string().optional(),
  notes: z.string().optional(),
  cost_impact: z.boolean().optional(),
  schedule_impact: z.boolean().optional(),
  submitted_by: z.string().optional(),
  submitted_date: z.string().optional(),
  ball_in_court: z.string().optional(),
});

const STATUS_OPTIONS = ['Open', 'In Review', 'Answered', 'Closed'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];
const DISCIPLINE_OPTIONS = ['Architectural', 'Structural', 'MEP', 'Civil', 'Landscape', 'Other'];
const BALL_OPTIONS = ['Awaiting Client', 'With Us', 'Closed'];

const ballColour: Record<string, string> = {
  'Awaiting Client': 'bg-blue-900/30 text-blue-300',
  'With Us': 'bg-amber-900/30 text-amber-300',
  'Closed': 'bg-gray-700/50 text-gray-400',
};
const priorityColour: Record<string, string> = {
  'Low': 'bg-green-900/30 text-green-300',
  'Medium': 'bg-yellow-900/30 text-yellow-300',
  'High': 'bg-orange-900/30 text-orange-300',
  'Urgent': 'bg-red-900/30 text-red-300',
};
const statusColour: Record<string, string> = {
  'Open': 'bg-blue-900/30 text-blue-300',
  'In Review': 'bg-yellow-900/30 text-yellow-300',
  'Answered': 'bg-green-900/30 text-green-300',
  'Closed': 'bg-gray-700/50 text-gray-400',
};

const emptyForm = {
  rfi_number:'',
  title:'',
  question:'',
  answer:'',
  discipline:'',
  priority:'Medium',
  status:'Open',
  assigned_to:'',
  project_id:'',
  due_date:'',
  notes:'',
  cost_impact:false,
  schedule_impact:false,
  submitted_by:'',
  submitted_date:'',
  ball_in_court:'Awaiting Client',
};

// AI suggestion mappings
function getAISuggestion(title: string, question: string): string {
  const content = `${title} ${question}`.toLowerCase();

  if (content.includes('door') && content.includes('size')) {
    return 'Standard door sizes per architectural standards are 800mm or 900mm wide. We recommend 900mm for main circulation areas. Please confirm preferred material (timber/aluminum) and hardware specification.';
  }
  if (content.includes('window') && (content.includes('size') || content.includes('location'))) {
    return 'Window placement should follow building code requirements for daylighting (minimum 8% of room area). Recommend triple-glazed units for thermal performance. Structural opening coordination with MEP required.';
  }
  if (content.includes('mep') && content.includes('routing')) {
    return 'MEP routing should follow building services coordination plan. Recommend clash detection review. Clearances: 600mm from structural elements for M&E distribution. Submit floor plans with service routing overlay.';
  }
  if (content.includes('finish') && content.includes('specification')) {
    return 'Finishes must comply with building performance standards. Recommend submitting material samples with COO documentation and fire ratings. Lead time typically 6-8 weeks for bespoke specifications.';
  }
  if (content.includes('schedule') || content.includes('timeline')) {
    return 'Schedule impact assessment required. Please provide baseline vs. proposed comparison and any acceleration measures. Coordinate with supply chain constraints and labor availability.';
  }
  if (content.includes('cost') || content.includes('budget')) {
    return 'Cost impact requires detailed breakdown: material, labor, and contingency. Request QS assessment against contract terms. Evaluation against approved change order process required.';
  }

  return 'Please provide additional context for review. Suggest attaching reference documentation and any relevant site photos. We will assess and respond within 48 hours.';
}

function getDaysRemaining(dueDate: string): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const today = new Date();
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getSLAStatus(days: number): 'green' | 'amber' | 'red' {
  if (days > 3) return 'green';
  if (days >= 0) return 'amber';
  return 'red';
}

export function RFIs() {
  const { useList, useCreate, useUpdate, useDelete } = useRFIs;
  const { data: raw = [], isLoading } = useList();
  const rfis = raw as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [subTab, setSubTab] = useState('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  function setTab(key: string, filter: string) { setSubTab(key); setStatusFilter(filter); }
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [panelOpen, setPanelOpen] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryStats, setAiSummaryStats] = useState<{count: number; open: number; overdue: number; critical: number} | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} RFI(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} RFI(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  async function handleBulkClose(ids: string[]) {
    try {
      await Promise.all(ids.map(id => updateMutation.mutateAsync({ id, data: { status: 'Closed' } })));
      toast.success(`Closed ${ids.length} RFI(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk close failed');
    }
  }

  async function handleSummarizeRfi() {
    setAiLoading(true);
    setSummaryExpanded(true);
    try {
      const res = await aiSummarizeApi.summarizeRfiThread();
      setAiSummary(res.summary);
      setAiSummaryStats({ count: res.count, open: res.open, overdue: res.overdue, critical: res.critical });
      toast.success('RFI summary generated');
    } catch {
      toast.error('Failed to generate AI summary');
    } finally {
      setAiLoading(false);
    }
  }

  const filtered = rfis.filter(r => {
    const title = String(r.title??'').toLowerCase();
    const num = String(r.rfi_number??'').toLowerCase();
    const matchSearch = title.includes(search.toLowerCase()) || num.includes(search.toLowerCase());
    let matchStatus = statusFilter === 'All' || r.status === statusFilter;
    if (statusFilter === 'Overdue') {
      const due = r.due_date || r.dueDate;
      matchStatus = !!due && new Date(String(due)) < new Date() && !['Answered','Closed'].includes(String(r.status??''));
    }
    const matchPriority = priorityFilter === 'All' || r.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const openCount = rfis.filter(r=>r.status==='Open').length;
  const overdueCount = rfis.filter(r => {
    const due = r.due_date || r.dueDate;
    if (!due) return false;
    return new Date(String(due)) < new Date() && !['Answered','Closed'].includes(String(r.status??''));
  }).length;
  const answeredCount = rfis.filter(r=>['Answered','Closed'].includes(String(r.status??''))).length;

  function nextRFINumber() {
    const nums = rfis.map(r => parseInt(String(r.rfi_number??'0').replace(/\D/g,''))).filter(n=>!isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `RFI-${String(next).padStart(3,'0')}`;
  }

  function openCreate() {
    setEditing(null);
    const today = new Date().toISOString().split('T')[0];
    setForm({
      ...emptyForm,
      rfi_number: nextRFINumber(),
      submitted_date: today,
      submitted_by: 'Current User',
    });
    setShowModal(true);
  }

  function openEdit(r: AnyRow) {
    setEditing(r);
    setForm({
      rfi_number:String(r.rfi_number??''),
      title:String(r.title??''),
      question:String(r.question??''),
      answer:String(r.answer??''),
      discipline:String(r.discipline??''),
      priority:String(r.priority??'Medium'),
      status:String(r.status??'Open'),
      assigned_to:String(r.assigned_to??''),
      project_id:String(r.project_id??''),
      due_date:String(r.due_date??''),
      notes:String(r.notes??''),
      cost_impact:Boolean(r.cost_impact),
      schedule_impact:Boolean(r.schedule_impact),
      submitted_by:String(r.submitted_by??''),
      submitted_date:String(r.submitted_date??''),
      ball_in_court:String(r.ball_in_court??'Awaiting Client'),
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = rfiSchema.safeParse(form);
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }
    if (editing) {
      await updateMutation.mutateAsync({ id:String(editing.id), data:form });
      toast.success('RFI updated');
    } else {
      await createMutation.mutateAsync(form);
      toast.success('RFI created');
    }
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this RFI?')) return;
    await deleteMutation.mutateAsync(id);
    toast.success('RFI deleted');
  }

  async function markAnswered(r: AnyRow) {
    await updateMutation.mutateAsync({
      id: String(r.id),
      data: { status: 'Answered' }
    });
    toast.success('RFI marked as answered');
  }

  async function sendResponse(r: AnyRow) {
    await updateMutation.mutateAsync({
      id: String(r.id),
      data: { status: 'Answered', ball_in_court: 'Awaiting Client' }
    });
    toast.success('Response sent to client');
  }

  return (
    <>
      <ModuleBreadcrumbs currentModule="rfis" />
      <div className="min-h-screen bg-gray-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-white">RFIs</h1>
          <p className="text-sm text-gray-400 mt-1">Requests for Information — design & technical queries</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors"
        >
          <Plus size={16}/><span>New RFI</span>
        </button>
      </div>

      {/* Overdue Alert */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 bg-red-500/15 border border-red-600/50 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-red-300 flex-shrink-0"/>
          <p className="text-sm text-red-300"><span className="font-semibold">{overdueCount} overdue RFI{overdueCount>1?'s':''}</span> — requiring urgent response.</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Open', value:openCount, icon:MessageSquare, bg:'bg-blue-500/15 border border-blue-600/50', colour:'text-blue-300' },
          { label:'Overdue', value:overdueCount, icon:AlertTriangle, bg:overdueCount>0?'bg-red-500/15 border border-red-600/50':'bg-gray-700/50 border border-gray-600', colour:overdueCount>0?'text-red-300':'text-gray-400' },
          { label:'Answered / Closed', value:answeredCount, icon:CheckCircle, bg:'bg-green-500/15 border border-green-600/50', colour:'text-green-300' },
          { label:'Total Raised', value:rfis.length, icon:Clock, bg:'bg-purple-500/15 border border-purple-600/50', colour:'text-purple-300' },
        ].map(kpi=>(
          <div key={kpi.label} className={`rounded-xl ${kpi.bg} p-4`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-800"><kpi.icon size={20} className={kpi.colour}/></div>
              <div><p className="text-xs text-gray-400">{kpi.label}</p><p className="text-xl font-display text-white">{kpi.value}</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-700">
        {([
          { key:'all',      label:'All RFIs',          filter:'All',              count:rfis.length },
          { key:'open',     label:'Open',               filter:'Open',             count:openCount },
          { key:'pending',  label:'Pending Response',   filter:'Pending Response', count:rfis.filter(r=>r.status==='Pending Response').length },
          { key:'answered', label:'Answered / Closed',  filter:'Answered',         count:answeredCount },
          { key:'overdue',  label:'Overdue',            filter:'Overdue',          count:overdueCount },
        ]).map(t=>(
          <button
            key={t.key}
            onClick={()=>setTab(t.key, t.filter)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              subTab===t.key
                ? 'border-orange-600 text-orange-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              t.key==='overdue'&&t.count>0?'bg-red-500/15 text-red-300':
              t.key==='open'&&t.count>0?'bg-orange-500/15 text-orange-300':
              'bg-gray-700/50 text-gray-500'
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="Search RFI number or title…"
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e=>setStatusFilter(e.target.value)}
          className="text-sm bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          {['All',...STATUS_OPTIONS].map(s=><option key={s}>{s}</option>)}
        </select>
        <select
          value={priorityFilter}
          onChange={e=>setPriorityFilter(e.target.value)}
          className="text-sm bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          {['All',...PRIORITY_OPTIONS].map(p=><option key={p}>{p}</option>)}
        </select>
        <button
          type="button"
          onClick={handleSummarizeRfi}
          disabled={aiLoading}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
          AI Summary
        </button>
        <span className="text-sm text-gray-400 ml-auto">{filtered.length} RFIs</span>
      </div>

      {/* AI Summary Panel */}
      {summaryExpanded && (
        <div className="bg-purple-900/10 border border-purple-500/30 rounded-xl overflow-hidden">
          <button
            onClick={() => setSummaryExpanded(false)}
            className="w-full flex items-center justify-between p-4 hover:bg-purple-900/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-purple-400" />
              <span className="text-sm font-medium text-purple-300">AI RFI Summary</span>
              {aiSummaryStats && (
                <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                  {aiSummaryStats.count} total · {aiSummaryStats.open} open · {aiSummaryStats.overdue} overdue
                </span>
              )}
            </div>
            <ChevronUp size={14} className="text-purple-400" />
          </button>
          {aiSummary && (
            <div className="px-4 pb-4">
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{aiSummary}</p>
            </div>
          )}
        </div>
      )}

      {/* RFI List */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-orange-600"/></div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 divide-y divide-gray-700 overflow-hidden">
          {filtered.length === 0 && (
            <EmptyState title="No RFIs found" icon={MessageSquare} />
          )}
          {filtered.map(r => {
            const id = String(r.id??'');
            const daysRemaining = getDaysRemaining(String(r.due_date??''));
            const slaStatus = getSLAStatus(daysRemaining);
            const isPanel = panelOpen === id;
            const aiSuggestion = getAISuggestion(String(r.title??''), String(r.question??''));
            const costImpact = Boolean(r.cost_impact);
            const scheduleImpact = Boolean(r.schedule_impact);
            const ballInCourt = String(r.ball_in_court ?? 'Awaiting Client');
            const submittedBy = String(r.submitted_by ?? 'Unknown');
            const submittedDate = String(r.submitted_date ?? '');

            return (
              <div key={id} className={`transition-all ${isPanel ? 'bg-gray-700/50' : 'hover:bg-gray-700/30'} ${selectedIds.has(id) ? 'border-l-2 border-blue-500' : ''}`}>
                {/* RFI Row */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer transition-colors"
                  onClick={() => setPanelOpen(isPanel ? null : id)}
                >
                  <button type="button" onClick={e => { e.stopPropagation(); toggle(id); }} className="flex-shrink-0">
                    {selectedIds.has(id) ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
                  </button>
                  <div className="w-16 flex-shrink-0 text-center">
                    <p className="text-xs font-mono tracking-widest text-orange-400">{String(r.rfi_number??'—')}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{String(r.title??'Untitled')}</p>
                    <p className="text-sm text-gray-400">{String(r.discipline??'')} {r.assigned_to?`· Assigned: ${r.assigned_to}`:''}</p>
                  </div>

                  {/* Impact Badges */}
                  <div className="hidden lg:flex items-center gap-2">
                    {costImpact && (
                      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-500/15 border border-amber-600/50 text-amber-300">
                        <TrendingUp size={12}/>Cost Impact
                      </span>
                    )}
                    {scheduleImpact && (
                      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-500/15 border border-red-600/50 text-red-300">
                        <Flame size={12}/>Schedule Impact
                      </span>
                    )}
                  </div>

                  {/* Ball in Court */}
                  <div className="hidden md:block">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${ballColour[ballInCourt] ?? 'bg-gray-700/50 border border-gray-600 text-gray-400'}`}>
                      <User size={12}/>{ballInCourt}
                    </span>
                  </div>

                  {/* SLA Countdown */}
                  {Boolean(r.due_date) && (
                    <div className="hidden md:block">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        slaStatus === 'green' ? 'bg-green-500/15 border border-green-600/50 text-green-300' :
                        slaStatus === 'amber' ? 'bg-yellow-500/15 border border-yellow-600/50 text-yellow-300' :
                        'bg-red-500/15 border border-red-600/50 text-red-300'
                      }`}>
                        {daysRemaining > 0 ? `${daysRemaining}d` : 'Overdue'}
                      </span>
                    </div>
                  )}

                  {/* Status & Priority */}
                  <div className="hidden md:flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${priorityColour[String(r.priority??'')] ?? 'bg-gray-700/50 border border-gray-600 text-gray-400'}`}>{String(r.priority??'')}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColour[String(r.status??'')] ?? 'bg-gray-700/50 border border-gray-600 text-gray-400'}`}>{String(r.status??'')}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {r.status==='Pending Response' && (
                      <button
                        onClick={e=>{e.stopPropagation();markAnswered(r);}}
                        className="p-1.5 text-green-300 hover:bg-green-500/20 rounded transition-colors"
                        title="Mark Answered"
                      >
                        <CheckCircle size={14}/>
                      </button>
                    )}
                    <button
                      onClick={e=>{e.stopPropagation();openEdit(r);}}
                      className="p-1.5 text-gray-400 hover:text-blue-300 hover:bg-blue-500/20 rounded transition-colors"
                    >
                      <Edit2 size={14}/>
                    </button>
                    <button
                      onClick={e=>{e.stopPropagation();handleDelete(id);}}
                      className="p-1.5 text-gray-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                    >
                      <Trash2 size={14}/>
                    </button>
                    {isPanel?<ChevronUp size={16} className="text-gray-500"/>:<ChevronDown size={16} className="text-gray-500"/>}
                  </div>
                </div>

                {/* Detail Panel */}
                {isPanel && (
                  <div className="px-6 pb-6 bg-gray-700/30 space-y-4 text-sm border-t border-gray-700">
                    {/* Question Section */}
                    {!!r.question && (
                      <div>
                        <p className="text-xs font-display text-gray-400 uppercase tracking-widest mb-2">Question</p>
                        <p className="text-gray-300 leading-relaxed bg-gray-800/50 rounded p-3 border border-gray-700">{String(r.question)}</p>
                      </div>
                    )}

                    {/* Response Thread */}
                    <div className="space-y-3">
                      <p className="text-xs font-display text-gray-400 uppercase tracking-widest">Response Thread</p>
                      <div className="space-y-3 bg-gray-800/30 rounded p-3 border border-gray-700">
                        {/* Submitted */}
                        <div className="flex gap-3">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-600/50 flex items-center justify-center">
                              <User size={12} className="text-blue-300"/>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white">Submitted by {submittedBy}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{submittedDate}</p>
                            {Boolean(r.question) && <p className="text-xs text-gray-300 mt-1 leading-relaxed">{String(r.question).substring(0,100)}...</p>}
                          </div>
                        </div>

                        {/* Client Response */}
                        {Boolean(r.answer) && (
                          <div className="flex gap-3 pt-2 border-t border-gray-700">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-600/50 flex items-center justify-center">
                                <CheckCircle size={12} className="text-green-300"/>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white">Client Responded</p>
                              <p className="text-xs text-gray-300 mt-1 leading-relaxed">{String(r.answer)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Suggestion */}
                    <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/10 border border-blue-600/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap size={14} className="text-blue-300"/>
                        <p className="text-xs font-display text-blue-300 uppercase tracking-widest">AI Suggestion</p>
                      </div>
                      <p className="text-sm text-blue-100 leading-relaxed">{aiSuggestion}</p>
                    </div>

                    {/* Notes */}
                    {Boolean(r.notes) && (
                      <div>
                        <p className="text-xs font-display text-gray-400 uppercase tracking-widest mb-2">Notes</p>
                        <p className="text-gray-300 bg-gray-800/50 rounded p-3 border border-gray-700">{String(r.notes)}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      {r.status !== 'Answered' && r.status !== 'Closed' && (
                        <button
                          onClick={e=>{e.stopPropagation();sendResponse(r);}}
                          className="flex items-center gap-2 px-3 py-2 btn btn-success rounded text-xs font-medium transition-colors"
                        >
                          <Send size={12}/>Send Response
                        </button>
                      )}
                      {r.status === 'Pending Response' && (
                        <button
                          onClick={e=>{e.stopPropagation();markAnswered(r);}}
                          className="flex items-center gap-2 px-3 py-2 btn btn-primary rounded text-xs font-medium transition-colors"
                        >
                          <CheckCircle size={12}/>Mark Answered
                        </button>
                      )}
                      <button
                        onClick={e=>{e.stopPropagation();openEdit(r);}}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded text-xs font-medium transition-colors"
                      >
                        <Edit2 size={12}/>Edit Details
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <BulkActionsBar
        selectedIds={Array.from(selectedIds)}
        actions={[
          { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
          { id: 'close', label: 'Close RFIs', icon: CheckCircle, variant: 'primary', onClick: handleBulkClose },
        ]}
        onClearSelection={clearSelection}
      />

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
              <h2 className="text-lg font-semibold text-white">{editing?'Edit RFI':'New RFI'}</h2>
              <button type="button" onClick={()=>setShowModal(false)} className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white"><X size={18}/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* RFI Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">RFI Number</label>
                  <input
                    value={form.rfi_number}
                    onChange={e=>setForm(f=>({...f,rfi_number:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Discipline */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Discipline</label>
                  <select
                    value={form.discipline}
                    onChange={e=>setForm(f=>({...f,discipline:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select…</option>{DISCIPLINE_OPTIONS.map(d=><option key={d}>{d}</option>)}
                  </select>
                </div>

                {/* Title */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Title / Subject *</label>
                  <input
                    required
                    value={form.title}
                    onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Question */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Question</label>
                  <textarea
                    rows={3}
                    value={form.question}
                    onChange={e=>setForm(f=>({...f,question:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  />
                </div>

                {/* Answer */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Answer / Response</label>
                  <textarea
                    rows={3}
                    value={form.answer}
                    onChange={e=>setForm(f=>({...f,answer:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={e=>setForm(f=>({...f,priority:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {PRIORITY_OPTIONS.map(p=><option key={p}>{p}</option>)}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e=>setForm(f=>({...f,status:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>

                {/* Ball in Court */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Ball in Court</label>
                  <select
                    value={form.ball_in_court}
                    onChange={e=>setForm(f=>({...f,ball_in_court:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {BALL_OPTIONS.map(b=><option key={b}>{b}</option>)}
                  </select>
                </div>

                {/* Assigned To */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Assigned To</label>
                  <input
                    value={form.assigned_to}
                    onChange={e=>setForm(f=>({...f,assigned_to:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={e=>setForm(f=>({...f,due_date:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Submitted By */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Submitted By</label>
                  <input
                    value={form.submitted_by}
                    onChange={e=>setForm(f=>({...f,submitted_by:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Submitted Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Submitted Date</label>
                  <input
                    type="date"
                    value={form.submitted_date}
                    onChange={e=>setForm(f=>({...f,submitted_date:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Notes */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  />
                </div>

                {/* Impact Flags */}
                <div className="col-span-2">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.cost_impact}
                        onChange={e=>setForm(f=>({...f,cost_impact:e.target.checked}))}
                        className="w-4 h-4 rounded bg-gray-700 border border-gray-600 text-orange-600 focus:ring-2 focus:ring-orange-500"
                      />
                      <span className="text-sm font-medium text-gray-300">Cost Impact</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.schedule_impact}
                        onChange={e=>setForm(f=>({...f,schedule_impact:e.target.checked}))}
                        className="w-4 h-4 rounded bg-gray-700 border border-gray-600 text-orange-600 focus:ring-2 focus:ring-orange-500"
                      />
                      <span className="text-sm font-medium text-gray-300">Schedule Impact</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={()=>setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg text-sm text-gray-300 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending||updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {editing?'Update RFI':'Submit RFI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
export default React.memo(RFIs);
