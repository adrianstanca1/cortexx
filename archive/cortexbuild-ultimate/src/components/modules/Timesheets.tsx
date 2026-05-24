import React, { useState } from 'react';
import { Clock, Plus, Search, DollarSign, Users, CheckCircle2, AlertTriangle, Edit2, Trash2, X, TrendingUp, Download, Briefcase, ChevronLeft, ChevronRight, Filter, CheckSquare, Square } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, CartesianGrid, Tooltip, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useTimesheets } from '../../hooks/useData';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { EmptyState } from '../ui/EmptyState';
import { toast } from 'sonner';

type AnyRow = Record<string, unknown>;

const STATUS_OPTIONS = ['draft','submitted','approved','rejected','paid'];
const CITB_RATE = 13.50;
const _OT_RATE_15X = 1.5;
const _OT_RATE_2X = 2.0;

const statusColour: Record<string,string> = {
  'draft':'bg-gray-800 text-gray-200',
  'submitted':'bg-blue-900 text-blue-100',
  'approved':'bg-green-900 text-green-100',
  'rejected':'bg-red-900 text-red-100',
  'paid':'bg-indigo-900 text-indigo-100',
};

const emptyForm = { worker_name:'',project_id:'',week_ending:'',regularHours:'0',overtimeHours:'0',overtimeRate:'1.5',dayworkHours:'0',dayworkRate:'0',status:'draft',notes:'' };

const _DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;
const _DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

interface _TimesheetRow {
  id: string;
  worker_name: string;
  project_id: string;
  week_ending: string;
  regularHours: number;
  overtimeHours: number;
  overtimeRate: number;
  dayworkHours: number;
  dayworkRate: number;
  totalPay: number;
  cisDeduction: number;
  status: string;
  notes: string;
  approved_by?: string;
  rejection_reason?: string;
}

export function Timesheets() {
  const { useList, useCreate, useUpdate, useDelete } = useTimesheets;
  const { data: raw = [], isLoading } = useList();
  const timesheets = raw as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [subTab, setSubTab] = useState<'weekly'|'labour'|'payroll'|'overtime'>('weekly');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [workerFilter, setWorkerFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [currentWeek, setCurrentWeek] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [detailRow, setDetailRow] = useState<AnyRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} timesheet(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} timesheet(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  const getWeekDate = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + (offset * 7) - d.getDay() + 1);
    return d;
  };
  const weekStart = getWeekDate(currentWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString('en-GB',{day:'numeric' as const,month:'short' as const})} - ${weekEnd.toLocaleDateString('en-GB',{day:'numeric' as const,month:'short' as const})}`;

  const filtered = timesheets.filter(t => {
    const name = String(t.worker_name??'').toLowerCase();
    const matchSearch = name.includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchWorker = workerFilter === 'all' || String(t.worker_name??'') === workerFilter;
    const matchProject = projectFilter === 'all' || String(t.project_id??'') === projectFilter;
    return matchSearch && matchStatus && matchWorker && matchProject;
  });

  function _getTimelineData() {
    const workers = Array.from(new Set(timesheets.map(t=>String(t.worker_name??''))));
    return workers.slice(0, 5).map(w => {
      const data = timesheets.filter(t=>String(t.worker_name??'')===w).slice(-4);
      return { name: w, weeks: data.length > 0 ? data.map((d,_i)=>Number(d.overtimeHours??0)) : [0,0,0,0] };
    });
  }

  function calculateCIS(gross: number, verified: boolean = true): number {
    return verified ? gross * 0.20 : gross * 0.30;
  }

  function calculateTotalPay(t: AnyRow): number {
    const regular = Number(t.regularHours??0) * CITB_RATE;
    const otRate = Number(t.overtimeRate??1.5);
    const ot = Number(t.overtimeHours??0) * CITB_RATE * otRate;
    const daywork = Number(t.dayworkHours??0) * Number(t.dayworkRate??0);
    return regular + ot + daywork;
  }

  const workers = Array.from(new Set(timesheets.map(t=>String(t.worker_name??''))));
  const projects = Array.from(new Set(timesheets.map(t=>String(t.project_id??''))));

  const thisWeekSheets = timesheets.length;
  const totalHoursThisWeek = timesheets.reduce((s,t)=>s+(Number(t.regularHours??0)+Number(t.overtimeHours??0)),0);
  const awaitingApproval = timesheets.filter(t=>t.status==='submitted').length;
  const totalLabourCost = timesheets.reduce((s,t)=>s+calculateTotalPay(t),0);
  const totalCIS = timesheets.reduce((s,t)=>s+calculateCIS(calculateTotalPay(t)),0);

  const projectMap = new Map<string, { regularHrs: number; otHrs: number; dayworkHrs: number; totalHrs: number; totalCost: number; cis: number }>();
  timesheets.filter(t=>t.status==='approved').forEach(t => {
    const project = String(t.project_id??'Unassigned');
    const rh = Number(t.regularHours??0);
    const oh = Number(t.overtimeHours??0);
    const dh = Number(t.dayworkHours??0);
    const pay = calculateTotalPay(t);
    const cis = calculateCIS(pay);
    const existing = projectMap.get(project) ?? { regularHrs:0, otHrs:0, dayworkHrs:0, totalHrs:0, totalCost:0, cis:0 };
    projectMap.set(project, {
      regularHrs: existing.regularHrs+rh,
      otHrs: existing.otHrs+oh,
      dayworkHrs: existing.dayworkHrs+dh,
      totalHrs: existing.totalHrs+rh+oh+dh,
      totalCost: existing.totalCost+pay,
      cis: existing.cis+cis
    });
  });
  const labourSummary = Array.from(projectMap.entries())
    .map(([project, v]) => ({ project, ...v }))
    .sort((a,b) => b.totalCost - a.totalCost);

  const workerMap = new Map<string, { otHours: number; dayworkHours: number; otCost: number; dayworkCost: number }>();
  timesheets.filter(t=>!!Number(t.overtimeHours??0) || !!Number(t.dayworkHours??0)).forEach(t => {
    const worker = String(t.worker_name??'Unknown');
    const otH = Number(t.overtimeHours??0);
    const dwH = Number(t.dayworkHours??0);
    const otRate = Number(t.overtimeRate??1.5);
    const otC = otH * CITB_RATE * otRate;
    const dwC = dwH * Number(t.dayworkRate??0);
    const existing = workerMap.get(worker) ?? { otHours:0, dayworkHours:0, otCost:0, dayworkCost:0 };
    workerMap.set(worker, {
      otHours: existing.otHours+otH,
      dayworkHours: existing.dayworkHours+dwH,
      otCost: existing.otCost+otC,
      dayworkCost: existing.dayworkCost+dwC
    });
  });
  const overtimeSummary = Array.from(workerMap.entries())
    .map(([name, v]) => ({ name, ...v, totalExtra: v.otCost + v.dayworkCost }))
    .sort((a,b) => b.totalExtra - a.totalExtra);

  const payrollWorkers = Array.from(new Set(timesheets.filter(t=>t.status==='approved').map(t=>String(t.worker_name??''))));
  const payrollData = payrollWorkers.map(w => {
    const sheets = timesheets.filter(t=>String(t.worker_name??'')===w && t.status==='approved');
    const totalGross = sheets.reduce((s,t)=>s+calculateTotalPay(t),0);
    const totalCIS = calculateCIS(totalGross);
    return { name: w, sheets: sheets.length, gross: totalGross, cis: totalCIS, net: totalGross - totalCIS };
  }).sort((a,b) => b.gross - a.gross);

  function openCreate() { setEditing(null); setForm({ ...emptyForm }); setShowModal(true); }
  function openEdit(t: AnyRow) {
    setEditing(t);
    setForm({
      worker_name:String(t.worker_name??''),
      project_id:String(t.project_id??''),
      week_ending:String(t.week_ending??''),
      regularHours:String(t.regularHours??'0'),
      overtimeHours:String(t.overtimeHours??'0'),
      overtimeRate:String(t.overtimeRate??'1.5'),
      dayworkHours:String(t.dayworkHours??'0'),
      dayworkRate:String(t.dayworkRate??'0'),
      status:String(t.status??'draft'),
      notes:String(t.notes??'')
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const regularHours = form.regularHours !== '' ? Number(form.regularHours) : 0;
    const overtimeHours = form.overtimeHours !== '' ? Number(form.overtimeHours) : 0;
    const overtimeRate = form.overtimeRate !== '' ? Number(form.overtimeRate) : 1.5;
    const dayworkHours = form.dayworkHours !== '' ? Number(form.dayworkHours) : 0;
    const dayworkRate = form.dayworkRate !== '' ? Number(form.dayworkRate) : 0;
    const totalPay = (regularHours * CITB_RATE) + (overtimeHours * CITB_RATE * overtimeRate) + (dayworkHours * dayworkRate);
    const cisDeduction = calculateCIS(totalPay);
    const payload = { ...form, regularHours, overtimeHours, overtimeRate, dayworkHours, dayworkRate, totalPay, cisDeduction };
    if (editing) { await updateMutation.mutateAsync({ id:String(editing.id), data:payload }); toast.success('Timesheet updated'); }
    else { await createMutation.mutateAsync(payload); toast.success('Timesheet submitted'); }
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this timesheet?')) return;
    await deleteMutation.mutateAsync(id); toast.success('Timesheet deleted');
  }

  async function approve(t: AnyRow) {
    await updateMutation.mutateAsync({ id:String(t.id), data:{ status:'approved', approved_by: 'Current User' } });
    toast.success('Timesheet approved');
  }

  async function reject(id: string) {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    await updateMutation.mutateAsync({ id, data:{ status:'rejected', rejection_reason: rejectionReason } });
    toast.success('Timesheet rejected');
    setShowRejectModal(false);
    setRejectingId(null);
    setRejectionReason('');
  }

  async function approveAllSubmitted() {
    const submitted = timesheets.filter(t=>t.status==='submitted');
    for (const t of submitted) {
      await updateMutation.mutateAsync({ id:String(t.id), data:{ status:'approved', approved_by: 'Current User' } });
    }
    toast.success(`${submitted.length} timesheets approved`);
  }

  async function runPayroll() {
    const approved = timesheets.filter(t=>t.status==='approved');
    for (const t of approved) {
      await updateMutation.mutateAsync({ id:String(t.id), data:{ status:'paid' } });
    }
    toast.success(`Payroll run complete: ${approved.length} payments processed`);
  }

  const formRegular = form.regularHours !== '' ? Number(form.regularHours) : 0;
  const formOT = form.overtimeHours !== '' ? Number(form.overtimeHours) : 0;
  const formDaywork = form.dayworkHours !== '' ? Number(form.dayworkHours) : 0;
  const formOTRate = form.overtimeRate !== '' ? Number(form.overtimeRate) : 1.5;
  const formDayworkRate = form.dayworkRate !== '' ? Number(form.dayworkRate) : 0;
  const formTotalPay = (formRegular * CITB_RATE) + (formOT * CITB_RATE * formOTRate) + (formDaywork * formDayworkRate);

  return (
    <>
      <ModuleBreadcrumbs currentModule="timesheets" />
      <div className="p-6 space-y-6 bg-gray-950 min-h-screen text-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display text-white">Timesheets & Payroll</h1>
          <p className="text-sm text-gray-400 mt-1">Construction timesheet tracking, labour costing & payroll management</p>
        </div>
        <button type="button" onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus size={16}/><span>Add Timesheet</span>
        </button>
      </div>

      {/* KPI Stats - 5 Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label:'Timesheets This Week', value:String(thisWeekSheets), icon:Clock, colour:'text-blue-400', bg:'bg-blue-900/30' },
          { label:'Total Hours This Week', value:`${totalHoursThisWeek.toFixed(0)}h`, icon:TrendingUp, colour:'text-green-400', bg:'bg-green-900/30' },
          { label:'Awaiting Approval', value:String(awaitingApproval), icon:AlertTriangle, colour:awaitingApproval>0?'text-amber-400':'text-gray-500', bg:awaitingApproval>0?'bg-amber-900/30':'bg-gray-800/50' },
          { label:'Total Labour Cost (£)', value:`£${Math.round(totalLabourCost).toLocaleString()}`, icon:DollarSign, colour:'text-green-400', bg:'bg-green-900/30' },
          { label:'CIS Deductions (£)', value:`£${Math.round(totalCIS).toLocaleString()}`, icon:Users, colour:'text-orange-400', bg:'bg-orange-900/30' },
        ].map(kpi=>(
          <div key={kpi.label} className={`rounded-lg border border-gray-700 p-3 ${kpi.bg}`}>
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded bg-gray-800 flex-shrink-0"><kpi.icon size={18} className={kpi.colour}/></div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 truncate">{kpi.label}</p>
                <p className="text-lg font-display text-white truncate">{kpi.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs - 4 Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-700 cb-table-scroll touch-pan-x">
        {([
          { key:'weekly' as const, label:'Weekly Timesheets', count:filtered.length },
          { key:'labour' as const, label:'Labour Summary', count:labourSummary.length },
          { key:'payroll' as const, label:'Payroll Run', count:payrollData.length },
          { key:'overtime' as const, label:'Overtime & Daywork', count:overtimeSummary.length },
        ]).map(t=>(
          <button type="button"  key={t.key} onClick={()=>setSubTab(t.key)}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${subTab===t.key?'border-blue-500 text-blue-400':'border-transparent text-gray-400 hover:text-gray-300'}`}>
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${subTab===t.key?'bg-blue-900 text-blue-200':'bg-gray-800 text-gray-400'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Weekly Timesheets Tab */}
      {subTab === 'weekly' && (
        <div className="space-y-4">
          {/* Week Selector & Filters */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button type="button" onClick={()=>setCurrentWeek(w=>w-1)} className="p-2 hover:bg-gray-800 rounded"><ChevronLeft size={18}/></button>
                <span className="text-sm font-medium text-white min-w-48 text-center">{weekLabel}</span>
                <button type="button" onClick={()=>setCurrentWeek(w=>w+1)} className="p-2 hover:bg-gray-800 rounded"><ChevronRight size={18}/></button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="flex gap-2 items-center">
                <Filter size={16} className="text-gray-400"/>
                <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white">
                  <option value="all">All Status</option>
                  {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
              </div>
              <select value={workerFilter} onChange={e=>setWorkerFilter(e.target.value)} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white">
                <option value="all">All Workers</option>
                {workers.map(w=><option key={w} value={w}>{w}</option>)}
              </select>
              <select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)} className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white">
                <option value="all">All Projects</option>
                {projects.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search worker…" className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            </div>
            {awaitingApproval > 0 && (
              <button type="button" onClick={approveAllSubmitted} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 text-sm font-medium border border-green-700">
                <CheckCircle2 size={16}/><span>Approve All Submitted ({awaitingApproval})</span>
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"/></div>
          ) : (
            <div className="bg-gray-900 rounded-lg border border-gray-700 cb-table-scroll touch-pan-x">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-display text-gray-300 uppercase tracking-widest">Worker</th>
                    <th className="px-4 py-3 text-left text-xs font-display text-gray-300 uppercase tracking-widest">Project</th>
                    <th className="px-4 py-3 text-center text-xs font-display text-gray-300 uppercase tracking-widest">Week</th>
                    <th className="px-3 py-3 text-center text-xs font-display text-gray-300 uppercase tracking-widest">Reg Hrs</th>
                    <th className="px-3 py-3 text-center text-xs font-display text-gray-300 uppercase tracking-widest">OT Hrs</th>
                    <th className="px-3 py-3 text-center text-xs font-display text-gray-300 uppercase tracking-widest">Daywork</th>
                    <th className="px-3 py-3 text-right text-xs font-display text-gray-300 uppercase tracking-widest">Total Pay (£)</th>
                    <th className="px-3 py-3 text-right text-xs font-display text-gray-300 uppercase tracking-widest">CIS (£)</th>
                    <th className="px-3 py-3 text-center text-xs font-display text-gray-300 uppercase tracking-widest">Status</th>
                    <th className="px-3 py-3 text-xs font-display text-gray-300 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filtered.map(t=>{
                    const id = String(t.id);
                    const isSelected = selectedIds.has(id);
                    const regHrs = Number(t.regularHours??0);
                    const otHrs = Number(t.overtimeHours??0);
                    const dwHrs = Number(t.dayworkHours??0);
                    const pay = calculateTotalPay(t);
                    const cis = calculateCIS(pay);
                    return (
                      <tr key={String(t.id)} className="hover:bg-gray-800 border-b border-gray-700 cursor-pointer" onClick={()=>{setDetailRow(t); setShowDetailModal(true);}}>
                        <td className="px-4 py-3">
                          <button type="button" onClick={e => { e.stopPropagation(); toggle(id); }}>{isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}</button>
                          <span className="ml-2 font-medium text-white">{String(t.worker_name??'—')}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-300 font-mono">{String(t.project_id??'—')}</td>
                        <td className="px-4 py-3 text-center text-gray-300 text-xs font-mono">{String(t.week_ending??'—').substring(0,10)}</td>
                        <td className="px-3 py-3 text-center text-white font-mono">{regHrs}h</td>
                        <td className="px-3 py-3 text-center text-amber-400 font-medium">{otHrs}h</td>
                        <td className="px-3 py-3 text-center text-purple-400 font-mono">{dwHrs}h</td>
                        <td className="px-3 py-3 text-right font-mono text-green-400">£{Math.round(pay).toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-gray-400 font-mono">£{Math.round(cis).toLocaleString()}</td>
                        <td className="px-3 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColour[String(t.status??'')] ?? 'bg-gray-800 text-gray-300'}`}>
                            {String(t.status??'').charAt(0).toUpperCase()+String(t.status??'').slice(1)}
                          </span>
                        </td>
                        <td className="px-3 py-3" onClick={e=>e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            {t.status==='submitted' && (
                              <>
                                <button type="button" onClick={()=>approve(t)} className="p-1.5 text-green-400 hover:bg-green-900/30 rounded" title="Approve"><CheckCircle2 size={14}/></button>
                                <button type="button" onClick={()=>{setRejectingId(String(t.id)); setShowRejectModal(true);}} className="p-1.5 text-red-400 hover:bg-red-900/30 rounded" title="Reject"><X size={14}/></button>
                              </>
                            )}
                            <button type="button" onClick={()=>openEdit(t)} className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-900/30 rounded"><Edit2 size={14}/></button>
                            <button type="button" onClick={()=>handleDelete(String(t.id))} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded"><Trash2 size={14}/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <EmptyState
                  icon={Clock}
                  title="No timesheets found"
                  description="Log timesheets to track workforce hours and labour costs."
                />
              )}
              {selectedIds.size > 0 && (
                <BulkActionsBar
                  selectedIds={Array.from(selectedIds)}
                  actions={[
                    { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger' as const, onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
                  ]}
                  onClearSelection={clearSelection}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Labour Summary Tab */}
      {subTab === 'labour' && (
        <div className="space-y-4">
          {labourSummary.length === 0 ? (
            <div className="text-center py-16 text-gray-500 bg-gray-900 rounded-lg border border-gray-700"><Briefcase size={40} className="mx-auto mb-3 opacity-30"/><p>No labour data</p></div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
                  <h3 className="text-sm font-semibold text-white mb-4">Hours by Project</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={labourSummary}>
                      <CartesianGrid stroke="#374151"/>
                      <XAxis dataKey="project" tick={{fill:'#9ca3af',fontSize:12}}/>
                      <YAxis tick={{fill:'#9ca3af',fontSize:12}}/>
                      <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'1px solid #374151'}}/>
                      <Bar dataKey="totalHrs" fill="#3b82f6" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
                  <h3 className="text-sm font-semibold text-white mb-4">Cost Distribution</h3>
                  <div className="space-y-2">
                    {labourSummary.map(p => {
                      const total = labourSummary.reduce((s,x)=>s+x.totalCost,0);
                      const pct = total > 0 ? (p.totalCost / total * 100).toFixed(1) : '0';
                      return (
                        <div key={p.project} className="space-y-1">
                          <div className="flex justify-between text-sm"><span className="text-gray-300">{p.project}</span><span className="text-white font-medium">£{Math.round(p.totalCost).toLocaleString()}</span></div>
                          <div className="w-full bg-gray-700 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{width:`${pct}%`}}/></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="bg-gray-900 rounded-lg border border-gray-700 cb-table-scroll touch-pan-x">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800 border-b border-gray-700">
                    <tr>{['Project','Regular Hrs','OT Hrs','Daywork Hrs','Total Hours','Total Cost (£)','CIS (£)'].map(h=><th key={h} className={`text-left px-4 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wide ${['Total Hours','Total Cost (£)','CIS (£)'].includes(h)?'text-right':''}`}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {labourSummary.map(p=>(
                      <tr key={p.project} className="hover:bg-gray-800">
                        <td className="px-4 py-3 font-medium text-white">{p.project}</td>
                        <td className="px-4 py-3 text-gray-300">{p.regularHrs}h</td>
                        <td className="px-4 py-3 text-amber-400">{p.otHrs}h</td>
                        <td className="px-4 py-3 text-purple-400">{p.dayworkHrs}h</td>
                        <td className="px-4 py-3 text-white font-medium">{p.totalHrs}h</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-400">£{Math.round(p.totalCost).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-gray-400">£{Math.round(p.cis).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Payroll Run Tab */}
      {subTab === 'payroll' && (
        <div className="space-y-4">
          {payrollData.length === 0 ? (
            <div className="text-center py-16 text-gray-500 bg-gray-900 rounded-lg border border-gray-700"><DollarSign size={40} className="mx-auto mb-3 opacity-30"/><p>No approved timesheets for payroll</p></div>
          ) : (
            <>
              <div className="flex gap-3">
                <button type="button" onClick={runPayroll} className="flex items-center gap-2 px-4 py-2 bg-green-900 text-green-100 rounded-lg hover:bg-green-800 text-sm font-medium border border-green-700">
                  <TrendingUp size={16}/><span>Run Payroll for Week</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-sm font-medium border border-gray-700">
                  <Download size={16}/><span>Export to CSV</span>
                </button>
              </div>
              <div className="bg-gray-900 rounded-lg border border-gray-700 cb-table-scroll touch-pan-x">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800 border-b border-gray-700">
                    <tr>{['Name','Sheets','CIS Status','Gross Pay (£)','CIS Deduction (£)','Net Pay (£)'].map(h=><th key={h} className={`text-left px-4 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wide ${['Gross Pay (£)','CIS Deduction (£)','Net Pay (£)'].includes(h)?'text-right':''}`}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {payrollData.map(w=>(
                      <tr key={w.name} className="hover:bg-gray-800">
                        <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">{w.name.split(' ').map((n:string)=>n[0]).slice(0,2).join('')}</div><span className="font-medium text-white">{w.name}</span></div></td>
                        <td className="px-4 py-3 text-gray-300">{w.sheets}</td>
                        <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full bg-green-900 text-green-100 font-medium">Verified</span></td>
                        <td className="px-4 py-3 text-right font-semibold text-green-400">£{Math.round(w.gross).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-gray-400">£{Math.round(w.cis).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-semibold text-white">£{Math.round(w.net).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-800 border-t border-gray-700">
                    <tr>
                      <td className="px-4 py-3 font-semibold text-white">Total</td>
                      <td className="px-4 py-3 font-semibold text-white">{payrollData.reduce((s,w)=>s+w.sheets,0)}</td>
                      <td/>
                      <td className="px-4 py-3 text-right font-semibold text-green-400">£{Math.round(payrollData.reduce((s,w)=>s+w.gross,0)).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-400">£{Math.round(payrollData.reduce((s,w)=>s+w.cis,0)).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold text-white">£{Math.round(payrollData.reduce((s,w)=>s+w.net,0)).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Overtime & Daywork Tab */}
      {subTab === 'overtime' && (
        <div className="space-y-4">
          {overtimeSummary.length === 0 ? (
            <div className="text-center py-16 text-gray-500 bg-gray-900 rounded-lg border border-gray-700"><AlertTriangle size={40} className="mx-auto mb-3 opacity-30"/><p>No overtime or daywork hours</p></div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
                  <h3 className="text-sm font-semibold text-white mb-4">OT Hours by Worker</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={overtimeSummary}>
                      <CartesianGrid stroke="#374151"/>
                      <XAxis dataKey="name" tick={{fill:'#9ca3af',fontSize:12}}/>
                      <YAxis tick={{fill:'#9ca3af',fontSize:12}}/>
                      <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'1px solid #374151'}}/>
                      <Bar dataKey="otHours" fill="#f59e0b" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
                  <h3 className="text-sm font-semibold text-white mb-4">OT Cost Trend (4 weeks)</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={[{week:'W1',cost:2400},{week:'W2',cost:2210},{week:'W3',cost:2290},{week:'W4',cost:2000}]}>
                      <CartesianGrid stroke="#374151"/>
                      <XAxis dataKey="week" tick={{fill:'#9ca3af',fontSize:12}}/>
                      <YAxis tick={{fill:'#9ca3af',fontSize:12}}/>
                      <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'1px solid #374151'}}/>
                      <Line type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={2}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-gray-900 rounded-lg border border-gray-700 cb-table-scroll touch-pan-x">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800 border-b border-gray-700">
                    <tr>{['Worker','OT Hours','OT Rate','OT Cost (£)','Daywork Hours','Daywork Cost (£)','Total Extra (£)'].map(h=><th key={h} className={`text-left px-4 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wide ${['OT Hours','OT Cost (£)','Daywork Hours','Daywork Cost (£)','Total Extra (£)'].includes(h)?'text-right':''}`}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {overtimeSummary.map(w=>{
                      const weekOT = w.otHours;
                      const otFlag = weekOT > 20 ? '⚠️' : '';
                      return (
                        <tr key={w.name} className="hover:bg-gray-800">
                          <td className="px-4 py-3 font-medium text-white">{w.name}</td>
                          <td className="px-4 py-3 text-right text-amber-400 font-medium">{w.otHours}h {otFlag}</td>
                          <td className="px-4 py-3 text-right text-gray-300">1.5x</td>
                          <td className="px-4 py-3 text-right font-semibold text-amber-400">£{Math.round(w.otCost).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-purple-400">{w.dayworkHours}h</td>
                          <td className="px-4 py-3 text-right text-purple-400">£{Math.round(w.dayworkCost).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-semibold text-white">£{Math.round(w.totalExtra).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}


      {/* Add/Edit Timesheet Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-900 z-10">
              <h2 className="text-lg font-semibold text-white">{editing?'Edit Timesheet':'Add Timesheet'}</h2>
              <button type="button" onClick={()=>setShowModal(false)} className="p-2 hover:bg-gray-800 rounded"><X size={18} className="text-gray-400"/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formTotalPay > 0 && (
                <div className="grid grid-cols-3 gap-3 bg-green-900/30 border border-green-700 rounded-lg p-4 text-sm">
                  <div className="text-center"><p className="text-xs text-gray-400">Regular Pay</p><p className="font-bold text-white">£{Math.round(formRegular * CITB_RATE).toLocaleString()}</p></div>
                  <div className="text-center"><p className="text-xs text-gray-400">OT Pay</p><p className="font-bold text-amber-400">£{Math.round(formOT * CITB_RATE * (form.overtimeRate !== null && form.overtimeRate !== undefined ? Number(form.overtimeRate) : 1.5)).toLocaleString()}</p></div>
                  <div className="text-center"><p className="text-xs text-gray-400">Total Pay</p><p className="font-bold text-green-400">£{Math.round(formTotalPay).toLocaleString()}</p></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Worker *</label>
                  <input required value={form.worker_name} onChange={e=>setForm(f=>({...f,worker_name:e.target.value}))} placeholder="e.g. John Smith" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Project *</label>
                  <input required value={form.project_id} onChange={e=>setForm(f=>({...f,project_id:e.target.value}))} placeholder="e.g. M25 Widening" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Week Ending</label>
                  <input type="date" value={form.week_ending} onChange={e=>setForm(f=>({...f,week_ending:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Hours & Rates</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Regular Hours (0-40)</label>
                    <input type="number" min="0" max="40" step="0.5" value={form.regularHours} onChange={e=>setForm(f=>({...f,regularHours:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Overtime Hours</label>
                    <input type="number" min="0" step="0.5" value={form.overtimeHours} onChange={e=>setForm(f=>({...f,overtimeHours:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">OT Rate Multiplier</label>
                    <select value={form.overtimeRate} onChange={e=>setForm(f=>({...f,overtimeRate:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="1.5">1.5x</option>
                      <option value="2">2x</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Daywork Hours</label>
                    <input type="number" min="0" step="0.5" value={form.dayworkHours} onChange={e=>setForm(f=>({...f,dayworkHours:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Daywork Rate (£/hour)</label>
                    <input type="number" min="0" step="0.01" value={form.dayworkRate} onChange={e=>setForm(f=>({...f,dayworkRate:e.target.value}))} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  </div>
                </div>
              </div>
              {form.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={()=>setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-700 rounded text-sm text-gray-300 hover:bg-gray-800">Cancel</button>
                <button type="submit" disabled={!!createMutation.isPending||!!updateMutation.isPending} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {editing?'Update':'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && detailRow && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">{String(detailRow.worker_name??'')}'s Timesheet</h2>
              <button type="button" onClick={()=>setShowDetailModal(false)} className="p-2 hover:bg-gray-800 rounded"><X size={18} className="text-gray-400"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-gray-400">Project</p><p className="font-medium text-white">{String(detailRow.project_id??'—')}</p></div>
                <div><p className="text-xs text-gray-400">Week Ending</p><p className="font-medium text-white">{String(detailRow.week_ending??'—').substring(0,10)}</p></div>
              </div>
              <div className="grid grid-cols-3 gap-3 bg-gray-800 rounded-lg p-3">
                <div className="text-center"><p className="text-xs text-gray-400">Regular Hours</p><p className="font-bold text-white">{Number(detailRow.regularHours??0)}h</p></div>
                <div className="text-center"><p className="text-xs text-gray-400">Overtime Hours</p><p className="font-bold text-amber-400">{Number(detailRow.overtimeHours??0)}h</p></div>
                <div className="text-center"><p className="text-xs text-gray-400">Daywork Hours</p><p className="font-bold text-purple-400">{Number(detailRow.dayworkHours??0)}h</p></div>
              </div>
              <div className="border-t border-gray-700 pt-4 space-y-2">
                <div className="flex justify-between"><span className="text-gray-400">Regular ({CITB_RATE}/h)</span><span className="text-white font-medium">£{Math.round(Number(detailRow.regularHours??0)*CITB_RATE).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">OT ({Number(detailRow.overtimeRate??1.5)}x)</span><span className="text-amber-400 font-medium">£{Math.round(Number(detailRow.overtimeHours??0)*CITB_RATE*(Number(detailRow.overtimeRate??1.5))).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Daywork</span><span className="text-purple-400 font-medium">£{Math.round(Number(detailRow.dayworkHours??0)*Number(detailRow.dayworkRate??0)).toLocaleString()}</span></div>
                <div className="border-t border-gray-700 pt-2 flex justify-between"><span className="text-white font-semibold">Total Pay</span><span className="text-green-400 font-bold">£{Math.round(calculateTotalPay(detailRow)).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">CIS (20%)</span><span className="text-orange-400">£{Math.round(calculateCIS(calculateTotalPay(detailRow))).toLocaleString()}</span></div>
              </div>
              <div className="bg-gray-800 rounded-lg px-3 py-2"><p className="text-xs text-gray-400 mb-1">Status</p><span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColour[String(detailRow.status??'')] ?? 'bg-gray-700 text-gray-300'}`}>{String(detailRow.status??'').charAt(0).toUpperCase()+String(detailRow.status??'').slice(1)}</span></div>
              {String(detailRow.notes??'') && <div><p className="text-xs text-gray-400 mb-1">Notes</p><p className="text-sm text-gray-300">{String(detailRow.notes??'')}</p></div>}
              <div className="flex gap-2 pt-4">
                {detailRow.status==='submitted' && (
                  <>
                    <button type="button" onClick={()=>{approve(detailRow); setShowDetailModal(false);}} className="flex-1 px-4 py-2 bg-green-900 text-green-100 rounded text-sm font-medium hover:bg-green-800">Approve</button>
                    <button type="button" onClick={()=>{setRejectingId(String(detailRow.id)); setShowDetailModal(false); setShowRejectModal(true);}} className="flex-1 px-4 py-2 bg-red-900 text-red-100 rounded text-sm font-medium hover:bg-red-800">Reject</button>
                  </>
                )}
                <button type="button" onClick={()=>setShowDetailModal(false)} className="flex-1 px-4 py-2 border border-gray-700 rounded text-sm text-gray-300 hover:bg-gray-800">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-md border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Reject Timesheet</h2>
              <button type="button" onClick={()=>{setShowRejectModal(false); setRejectingId(null); setRejectionReason('');}} className="p-2 hover:bg-gray-800 rounded"><X size={18} className="text-gray-400"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Rejection Reason *</label>
                <textarea value={rejectionReason} onChange={e=>setRejectionReason(e.target.value)} placeholder="Explain why this timesheet is being rejected..." rows={4} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"/>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={()=>{setShowRejectModal(false); setRejectingId(null); setRejectionReason('');}} className="flex-1 px-4 py-2 border border-gray-700 rounded text-sm text-gray-300 hover:bg-gray-800">Cancel</button>
                <button type="button" onClick={()=>reject(rejectingId!)} disabled={!!updateMutation.isPending} className="flex-1 px-4 py-2 bg-red-900 text-red-100 rounded text-sm font-medium hover:bg-red-800 disabled:opacity-50 border border-red-700">
                  Reject
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
export default React.memo(Timesheets);
