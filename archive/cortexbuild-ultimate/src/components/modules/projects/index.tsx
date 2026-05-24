// Main Projects component with state management, project list, modals

import React, { useState } from 'react';
import {
  Plus, X, Trash2, Edit2, Search, ChevronRight, MapPin, Users, Calendar,
  PoundSterling, AlertTriangle, CheckCircle2,
  BarChart3, FileText, Shield, ClipboardList, ArrowLeft,
  Loader2, RefreshCw, MessageSquare, CheckSquare, Square, Circle, Clock,
} from 'lucide-react';
import { BulkActionsBar, useBulkSelection } from '../../ui/BulkActions';
import { EmptyState } from '../../ui/EmptyState';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  useProjects, useInvoices, useTeam, useDocuments,
  useRFIs, useChangeOrders, useSafety, useDailyReports,
  useSubmittals, usePunchList, useInspections, useSpecifications,
} from '../../../hooks/useData';
import { GalleryTab } from './GalleryTab';
import { DocumentsTab } from './DocumentsTab';
import { TasksTab } from './TasksTab';
import { ActivityTimeline } from './ActivityTimeline';
import {
  STATUS_CFG, PROJECT_PHASES, PROJECT_TYPES, defaultForm,
  fmtM, daysDiff, getBudgetHealth,
  generateProjectPhases, generateProjectMilestones,
} from './types';
import { BudgetHealthIndicator } from './shared';
import type { AnyRow, FormData, WorkspaceProps, WorkspaceTab } from './types';
import type { ProjectStatus } from '../../../types';
import clsx from 'clsx';
import { toast } from 'sonner';
import { ModuleBreadcrumbs } from '../../ui/Breadcrumbs';

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT WORKSPACE
// ═══════════════════════════════════════════════════════════════════════════
function ProjectWorkspace({ project, onBack, onEdit }: WorkspaceProps) {
  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [_taskAssignee, _setTaskAssignee] = useState<Record<string, string>>({});
  const pName = String(project.name ?? '');
  const pId = String(project.id ?? '');

  const { data: rawInv = [] } = useInvoices.useList();
  const { data: rawTeam = [] } = useTeam.useList();
  const { data: rawDocs = [] } = useDocuments.useList();
  const { data: rawRFIs = [] } = useRFIs.useList();
  const { data: rawCOs = [] } = useChangeOrders.useList();
  const { data: rawSafe = [] } = useSafety.useList();
  const { data: rawReps = [] } = useDailyReports.useList();
  const { data: rawSubmittals = [] } = useSubmittals.useList();
  const { data: rawPunch = [] } = usePunchList.useList();
  const { data: rawSpecs = [] } = useSpecifications.useList();
  const { data: rawInsp = [] } = useInspections.useList();

  const invoices = (rawInv as AnyRow[]).filter(i => String(i.project ?? '').toLowerCase().includes(pName.toLowerCase().split(' ')[0]));
  const teamAll = (rawTeam as AnyRow[]);
  const _docs = (rawDocs as AnyRow[]).filter(d => String(d.project ?? '').toLowerCase().includes(pName.toLowerCase().split(' ')[0]));
  const rfis = (rawRFIs as AnyRow[]).filter(r => String(r.project ?? '').toLowerCase().includes(pName.toLowerCase().split(' ')[0]));
  const cos = (rawCOs as AnyRow[]).filter(c => String(c.project ?? '').toLowerCase().includes(pName.toLowerCase().split(' ')[0]));
  const safety = (rawSafe as AnyRow[]).filter(s => String(s.project ?? '').toLowerCase().includes(pName.toLowerCase().split(' ')[0]));
  const reports = (rawReps as AnyRow[]).filter(r => String(r.project ?? '').toLowerCase().includes(pName.toLowerCase().split(' ')[0]));
  const submittals = (rawSubmittals as AnyRow[]).filter(s => String(s.project_id ?? s.project ?? '') === pId || String(s.project_name ?? '').toLowerCase().includes(pName.toLowerCase().split(' ')[0]));
  const punchList = (rawPunch as AnyRow[]).filter(p => String(p.project_id ?? p.project ?? '') === pId || String(p.project ?? '').toLowerCase().includes(pName.toLowerCase().split(' ')[0]));
  const inspections = (rawInsp as AnyRow[]).filter(i => String(i.project_id ?? i.project ?? '') === pId || String(i.project ?? '').toLowerCase().includes(pName.toLowerCase().split(' ')[0]));
  const drawings = (rawSpecs as AnyRow[]).filter(s => String(s.project_id ?? s.project ?? '') === pId);

  const budget = Number(project.budget ?? 0);
  const spent = Number(project.spent ?? 0);
  const pct = budget > 0 ? (spent / budget) * 100 : 0;
  const progress = Number(project.progress ?? 0);
  const endDate = String(project.endDate ?? '');
  const daysLeft = endDate ? daysDiff(endDate) : null;
  const statusCfg = STATUS_CFG[String(project.status ?? '')] ?? STATUS_CFG.planning;
  const budgetHealth = getBudgetHealth(spent, budget);
  const _budgetHealthCfg = {
    green: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Healthy' },
    amber: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'At Risk' },
    red:   { bg: 'bg-red-500/20',    text: 'text-red-400',    label: 'Critical' },
  }[budgetHealth];

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const openRFIs = rfis.filter(r => r.status === 'open' || r.status === 'pending').length;
  const openSafety = safety.filter(s => s.status === 'open' || s.status === 'investigating').length;
  const pendingCOs = cos.filter(c => c.status === 'pending' || c.status === 'draft').length;
  const approvedCOVal = cos.filter(c => c.status === 'approved').reduce((s, c) => s + Number(c.value ?? c.amount ?? 0), 0);

  const phases = generateProjectPhases(project);
  const milestones = generateProjectMilestones(project);

  const TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'activity', label: 'Activity', icon: Clock },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
    { id: 'milestones', label: 'Milestones', icon: CheckCircle2 },
    { id: 'tasks', label: 'Tasks', icon: ClipboardList },
    { id: 'gallery', label: 'Gallery', icon: FileText },
    { id: 'financials', label: 'Financials', icon: PoundSterling },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'rfis', label: 'RFIs \u0026 COs', icon: MessageSquare },
    { id: 'safety', label: 'Safety', icon: Shield },
    { id: 'reports', label: 'Daily Reports', icon: ClipboardList },
  ] as const;

  return (
    <div className="space-y-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Projects
        </button>
        <ChevronRight className="w-4 h-4 text-gray-600" />
        <span className="text-white font-medium">{pName}</span>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-900/60 border border-gray-800 rounded-2xl p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{pName}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${statusCfg.bg} ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            </div>
            <p className="text-gray-400 text-sm">{String(project.client ?? '')} &nbsp;·&nbsp; <MapPin className="inline w-3.5 h-3.5" /> {String(project.location ?? project.address ?? '')}</p>
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            <button type="button" onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 btn btn-ghost text-sm rounded-lg transition-colors">
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-gray-400">Overall Progress</span>
            <span className="font-bold text-blue-400">{progress}%</span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gray-800/60 rounded-xl p-3">
            <p className="text-gray-400 text-xs mb-1">Contract Value</p>
            <p className="text-white font-bold text-lg">{fmtM(Number(project.contractValue ?? 0))}</p>
          </div>
          <div className="bg-gray-800/60 rounded-xl p-3">
            <p className="text-gray-400 text-xs mb-1">Budget Used</p>
            <p className={`font-bold text-lg ${pct > 90 ? 'text-red-400' : pct > 70 ? 'text-yellow-400' : 'text-green-400'}`}>{pct.toFixed(0)}%</p>
            <p className="text-gray-500 text-xs">{fmtM(spent)} / {fmtM(budget)}</p>
          </div>
          <div className="bg-gray-800/60 rounded-xl p-3">
            <p className="text-gray-400 text-xs mb-1">Days Remaining</p>
            <p className={`font-bold text-lg ${daysLeft !== null && daysLeft < 30 ? 'text-red-400' : daysLeft !== null && daysLeft < 90 ? 'text-yellow-400' : 'text-green-400'}`}>
              {daysLeft !== null ? (daysLeft > 0 ? `${daysLeft}d` : 'Overdue') : '—'}
            </p>
            {!!endDate && <p className="text-gray-500 text-xs">Due {endDate}</p>}
          </div>
          <div className="bg-gray-800/60 rounded-xl p-3">
            <p className="text-gray-400 text-xs mb-1">Workers On Site</p>
            <p className="text-white font-bold text-lg">{String(project.workers ?? 0)}</p>
            <p className="text-gray-500 text-xs">{String(project.phase ?? project.currentPhase ?? '—')}</p>
          </div>
          <BudgetHealthIndicator spent={spent} budget={budget} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 card bg-base-100 border border-base-300 p-1 cb-table-scroll touch-pan-x">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button type="button" key={t.id} onClick={() => setTab(t.id as WorkspaceTab)}
              className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                tab === t.id ? 'bg-blue-600 text-white shadow' : 'btn btn-ghost')}>
              <Icon className="w-3.5 h-3.5" />{t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {(openSafety > 0 || openRFIs > 0 || pct > 85) && (
            <div className="flex gap-3 flex-wrap">
              {openSafety > 0 && <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-2 text-sm text-red-300"><Shield className="w-4 h-4" />{openSafety} open safety issue{openSafety > 1 ? 's' : ''}</div>}
              {openRFIs > 0 && <div className="flex items-center gap-2 bg-orange-900/30 border border-orange-700/50 rounded-xl px-4 py-2 text-sm text-orange-300"><MessageSquare className="w-4 h-4" />{openRFIs} open RFI{openRFIs > 1 ? 's' : ''}</div>}
              {pct > 85 && <div className="flex items-center gap-2 bg-yellow-900/30 border border-yellow-700/50 rounded-xl px-4 py-2 text-sm text-yellow-300"><AlertTriangle className="w-4 h-4" />{pct.toFixed(0)}% of budget used</div>}
              {pendingCOs > 0 && <div className="flex items-center gap-2 bg-blue-900/30 border border-blue-700/50 rounded-xl px-4 py-2 text-sm text-blue-300"><ClipboardList className="w-4 h-4" />{pendingCOs} pending change order{pendingCOs > 1 ? 's' : ''}</div>}
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Invoiced', value: fmtM(totalInvoiced), sub: `${fmtM(totalPaid)} collected`, icon: PoundSterling, col: 'text-blue-400' },
              { label: 'Open RFIs', value: String(rfis.length), sub: `${openRFIs} awaiting response`, icon: MessageSquare, col: 'text-orange-400' },
              { label: 'CO Value Approved', value: fmtM(approvedCOVal), sub: `${cos.length} total change orders`, icon: ClipboardList, col: 'text-purple-400' },
            ].map(({ label, value, sub, icon: Icon, col }) => (
              <div key={label} className="card bg-base-100 border border-base-300 p-4">
                <div className="flex items-center justify-between mb-2"><p className="text-gray-400 text-sm">{label}</p><Icon className={`w-4 h-4 ${col}`} /></div>
                <p className="text-white font-bold text-xl">{value}</p>
                <p className="text-gray-500 text-xs mt-1">{sub}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="card bg-base-100 border border-base-300 p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Project Details</h3>
              <dl className="space-y-3 text-sm">
                {[
                  ['Type', String(project.type ?? '—')],
                  ['Manager', String(project.manager ?? project.projectManager ?? '—')],
                  ['Start Date', String(project.startDate ?? '—')],
                  ['End Date', String(project.endDate ?? '—')],
                  ['Phase', String(project.phase ?? project.currentPhase ?? '—')],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <dt className="text-gray-400">{k}</dt>
                    <dd className="text-white font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="card bg-base-100 border border-base-300 p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Phase Milestones</h3>
              <div className="space-y-2">
                {PROJECT_PHASES.slice(0, 7).map(phase => {
                  const idx = PROJECT_PHASES.indexOf(String(project.phase ?? project.currentPhase ?? ''));
                  const phIdx = PROJECT_PHASES.indexOf(phase);
                  const done = phIdx < idx;
                  const cur = phIdx === idx;
                  return (
                    <div key={phase} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${done ? 'bg-green-500' : cur ? 'bg-blue-500 ring-2 ring-blue-400/50' : 'bg-gray-700'}`} />
                      <div className={`flex-1 h-0.5 ${done ? 'bg-green-500/30' : cur ? 'bg-blue-500/30' : 'bg-gray-700'}`} />
                      <span className={`text-xs ${done ? 'text-green-400' : cur ? 'text-blue-400 font-semibold' : 'text-gray-600'}`}>{phase}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {!!project.description && (
            <div className="card bg-base-100 border border-base-300 p-5">
              <h3 className="text-sm font-semibold text-white mb-2">Description</h3>
              <p className="text-gray-300 text-sm leading-relaxed">{String(project.description)}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="space-y-4">
          <ActivityTimeline
            drawings={drawings}
            rfis={rfis}
            submittals={submittals}
            punchList={punchList}
            inspections={inspections}
            dailyReports={reports}
            changeOrders={cos}
          />
        </div>
      )}

      {tab === 'timeline' && (
        <div className="space-y-4">
          <div className="card bg-base-100 border border-base-300 p-6">
            <h3 className="text-sm font-semibold text-white mb-6">Project Timeline — Gantt Chart</h3>
            <div className="cb-table-scroll touch-pan-x pb-4">
              <div className="min-w-[800px]">
                <div className="flex gap-6 mb-6 text-xs text-gray-400">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded" /><span>Completed</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded" /><span>In Progress</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 bg-gray-600 rounded" /><span>Upcoming</span></div>
                </div>
                <div className="space-y-4">
                  {phases.map((phase, idx) => {
                    let barColor = 'bg-gray-600';
                    if (phase.progress === 100) barColor = 'bg-green-500';
                    else if (phase.progress > 0) barColor = 'bg-blue-500';
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-32 text-xs font-medium text-gray-400 truncate">{phase.name}</div>
                        <div className="flex-1">
                          <div className="h-6 bg-gray-800 rounded-full overflow-hidden relative">
                            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.max(phase.progress, 5)}%` }} />
                            <div className="absolute inset-0 flex items-center px-2">
                              <span className="text-xs font-medium text-gray-800">{phase.progress}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="w-16 text-xs text-right text-gray-400">{phase.progress}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'milestones' && (
        <div className="space-y-4">
          <div className="card bg-base-100 border border-base-300 p-6">
            <h3 className="text-sm font-semibold text-white mb-6">Project Milestones</h3>
            <div className="space-y-0">
              {milestones.map((milestone, idx) => {
                const isLast = idx === milestones.length - 1;
                let statusIcon = null;
                let statusColor = 'text-gray-400';
                if (milestone.status === 'completed') {
                  statusIcon = <CheckSquare className="w-5 h-5 text-green-400" />;
                  statusColor = 'text-green-400';
                } else if (milestone.status === 'in_progress') {
                  statusIcon = <Circle className="w-5 h-5 text-blue-400 fill-blue-400" />;
                  statusColor = 'text-blue-400';
                } else {
                  statusIcon = <Circle className="w-5 h-5 text-gray-500" />;
                  statusColor = 'text-gray-500';
                }
                return (
                  <div key={milestone.id} className="relative">
                    <div className="flex gap-4 pb-6">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-800 border-2 border-gray-700">
                          {statusIcon}
                        </div>
                        {!isLast && <div className="w-0.5 h-12 bg-gray-700 mt-2" />}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className={`font-medium text-sm ${statusColor}`}>{milestone.title}</p>
                        <p className="text-xs text-gray-400 mt-1">Due: {milestone.dueDate}</p>
                        <span className={`inline-block text-xs px-2 py-1 rounded-full mt-2 ${
                          milestone.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          milestone.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-700/50 text-gray-400'
                        }`}>
                          {milestone.status === 'completed' ? '✓ Complete' : milestone.status === 'in_progress' ? '● In Progress' : '○ Upcoming'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'tasks' && <TasksTab projectId={pId} />}

      {tab === 'gallery' && <GalleryTab projectId={pId} projectName={pName} />}

      {tab === 'financials' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Budget', value: fmtM(budget), col: 'text-white' },
              { label: 'Spent', value: fmtM(spent), col: pct > 90 ? 'text-red-400' : 'text-yellow-400' },
              { label: 'Remaining', value: fmtM(budget - spent), col: 'text-green-400' },
              { label: 'Total Invoiced', value: fmtM(totalInvoiced), col: 'text-blue-400' },
            ].map(({ label, value, col }) => (
              <div key={label} className="card bg-base-100 border border-base-300 p-4">
                <p className="text-gray-400 text-xs mb-1">{label}</p>
                <p className={`text-xl font-bold ${col}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="card bg-base-100 border border-base-300 p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Budget vs Spent</h3>
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Budget utilisation</span><span>{pct.toFixed(1)}%</span></div>
              <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[{ name: pName.split(' ').slice(0, 2).join(' '), budget: budget / 1000, spent: spent / 1000, remaining: (budget - spent) / 1000 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" tickFormatter={(v: number) => `£${v}K`} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} formatter={(v) => `£${(v as number).toFixed(0)}K`} />
                <Legend />
                <Bar dataKey="budget" name="Budget" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spent" name="Spent" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="remaining" name="Remaining" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card bg-base-100 border border-base-300 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">Invoices for this Project</h3>
            </div>
            {invoices.length === 0 ? (
              <EmptyState title="No invoices found for this project" variant="documents" />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-800/60"><tr>{['Invoice #', 'Amount', 'Status', 'Due'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-800">
                  {invoices.map(inv => (
                    <tr key={String(inv.id)} className="hover:bg-gray-800/40">
                      <td className="px-4 py-3 font-mono text-xs text-blue-400 font-bold">{String(inv.number ?? inv.invoiceNumber ?? '—')}</td>
                      <td className="px-4 py-3 text-white font-bold">£{Number(inv.amount ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inv.status === 'paid' ? 'bg-green-900/30 text-green-300' : inv.status === 'overdue' ? 'bg-red-900/30 text-red-300' : inv.status === 'sent' ? 'bg-blue-900/30 text-blue-300' : 'bg-gray-700/50 text-gray-600'}`}>{String(inv.status ?? '')}</span></td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{String(inv.dueDate ?? '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'team' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-2">
            {[
              { label: 'Workers on Site', value: String(project.workers ?? 0), col: 'text-white' },
              { label: 'All Personnel', value: String(teamAll.length), col: 'text-blue-400' },
              { label: 'Phase', value: String(project.phase ?? '—'), col: 'text-purple-400' },
            ].map(({ label, value, col }) => (
              <div key={label} className="card bg-base-100 border border-base-300 p-4">
                <p className="text-gray-400 text-xs mb-1">{label}</p>
                <p className={`text-xl font-bold ${col}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {teamAll.map(m => (
              <div key={String(m.id)} className="card bg-base-100 border border-base-300 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                  {String(m.name ?? '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white font-medium text-sm truncate">{String(m.name ?? '—')}</p>
                  <p className="text-gray-400 text-xs truncate">{String(m.role ?? m.tradeType ?? '—')}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${m.status === 'Active' ? 'bg-green-900/40 text-green-400' : 'bg-gray-700 text-gray-400'}`}>{String(m.status ?? '—')}</span>
                </div>
              </div>
            ))}
            {teamAll.length === 0 && <div className="col-span-3"><EmptyState title="No team members found" variant="team" /></div>}
          </div>
        </div>
      )}

      {tab === 'documents' && <DocumentsTab projectId={pId} projectName={pName} />}

      {tab === 'rfis' && (
        <div className="space-y-4">
          <div className="card bg-base-100 border border-base-300 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">RFIs ({rfis.length})</h3>
              <span className="text-xs text-orange-400">{openRFIs} open</span>
            </div>
            {rfis.length === 0 ? <EmptyState icon={FileText} title="No RFIs for this project" description="Create an RFI to track information requests." variant="documents" /> : (
              <table className="w-full text-sm">
                <thead className="bg-gray-800/60"><tr>{['RFI #', 'Subject', 'Priority', 'Status', 'Due'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-800">
                  {rfis.map(r => (
                    <tr key={String(r.id)} className="hover:bg-gray-800/40">
                      <td className="px-4 py-3 font-mono text-xs text-blue-400 font-bold">{String(r.rfiNumber ?? r.number ?? '—')}</td>
                      <td className="px-4 py-3 text-white max-w-[240px] truncate">{String(r.subject ?? r.title ?? '—')}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.priority === 'critical' ? 'bg-red-900/30 text-red-300' : r.priority === 'high' ? 'bg-orange-900/30 text-orange-300' : r.priority === 'medium' ? 'bg-yellow-900/30 text-yellow-300' : 'bg-gray-700/50 text-gray-600'}`}>{String(r.priority ?? '—')}</span></td>
                      <td className="px-4 py-3 text-gray-400 text-xs capitalize">{String(r.status ?? '—')}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{String(r.dueDate ?? '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card bg-base-100 border border-base-300 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Change Orders ({cos.length})</h3>
              <span className="text-xs text-blue-400">+{fmtM(approvedCOVal)} approved</span>
            </div>
            {cos.length === 0 ? <EmptyState icon={FileText} title="No change orders for this project" description="Create a change order to track scope changes." variant="documents" /> : (
              <table className="w-full text-sm">
                <thead className="bg-gray-800/60"><tr>{['CO #', 'Title', 'Value', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-800">
                  {cos.map(co => (
                    <tr key={String(co.id)} className="hover:bg-gray-800/40">
                      <td className="px-4 py-3 font-mono text-xs text-blue-400 font-bold">{String(co.coNumber ?? co.number ?? '—')}</td>
                      <td className="px-4 py-3 text-white max-w-[240px] truncate">{String(co.title ?? '—')}</td>
                      <td className="px-4 py-3 text-white font-bold">£{Number(co.value ?? co.amount ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${co.status === 'approved' ? 'bg-green-900/30 text-green-300' : co.status === 'rejected' ? 'bg-red-900/30 text-red-300' : 'bg-yellow-900/30 text-yellow-300'}`}>{String(co.status ?? '—')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'safety' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Open Incidents', value: String(openSafety), col: openSafety > 0 ? 'text-red-400' : 'text-green-400' },
              { label: 'Total Records', value: String(safety.length), col: 'text-white' },
              { label: 'Near Misses', value: String(safety.filter((s: AnyRow) => s.type === 'near-miss' || s.type === 'near_miss').length), col: 'text-orange-400' },
            ].map(({ label, value, col }) => (
              <div key={label} className="card bg-base-100 border border-base-300 p-4">
                <p className="text-gray-400 text-xs mb-1">{label}</p>
                <p className={`text-xl font-bold ${col}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="card bg-base-100 border border-base-300 overflow-hidden">
            {safety.length === 0 ? <p className="py-10 text-center text-gray-500">No safety records for this project</p> : (
              <table className="w-full text-sm">
                <thead className="bg-gray-800/60"><tr>{['Title', 'Type', 'Severity', 'Status', 'Date'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-800">
                  {safety.map((s: AnyRow) => (
                    <tr key={String(s.id)} className="hover:bg-gray-800/40">
                      <td className="px-4 py-3 text-white font-medium max-w-[220px] truncate">{String(s.title ?? '—')}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs capitalize">{String(s.type ?? '').replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.severity === 'serious' || s.severity === 'critical' ? 'bg-red-900/30 text-red-300' : s.severity === 'moderate' ? 'bg-orange-900/30 text-orange-300' : 'bg-green-900/30 text-green-300'}`}>{String(s.severity ?? '—')}</span></td>
                      <td className="px-4 py-3 text-xs capitalize text-gray-300">{String(s.status ?? '—')}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{String(s.date ?? s.incidentDate ?? '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <div className="space-y-3">
          {reports.length === 0 ? <p className="py-10 text-center text-gray-500">No daily reports for this project</p> :
            reports.slice().sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))).map((rep: AnyRow) => (
              <div key={String(rep.id)} className="card bg-base-100 border border-base-300 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-white font-semibold">{String(rep.date ?? '—')}</p>
                    <p className="text-gray-400 text-xs">Prepared by {String(rep.preparedBy ?? '—')} · {String(rep.weather ?? '—')} {String(rep.temperature ?? '')}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${rep.status === 'approved' ? 'bg-green-900/30 text-green-300' : 'bg-yellow-900/30 text-yellow-300'}`}>{String(rep.status ?? 'draft')}</span>
                </div>
                {!!rep.workers_on_site && <p className="text-sm text-gray-300">Workers on site: <span className="text-white font-semibold">{String(rep.workers_on_site)}</span></p>}
                {!!rep.activities && <p className="text-sm text-gray-400 mt-1 line-clamp-2">{String(rep.activities)}</p>}
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PROJECTS MODULE
// ═══════════════════════════════════════════════════════════════════════════
export function Projects() {
  const { useList, useCreate, useUpdate, useDelete } = useProjects;
  const { data: rawProjects = [], isLoading, refetch } = useList();
  const projects = rawProjects as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [_view, _setView] = useState<'grid' | 'table'>('grid');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<FormData>(defaultForm);

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} project(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} project(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  const selectedProject = projects.find(p => String(p.id) === selectedId);

  const filtered = projects
    .filter(p => filter === 'all' || String(p.status) === filter)
    .filter(p => !search || String(p.name).toLowerCase().includes(search.toLowerCase()) ||
      String(p.client).toLowerCase().includes(search.toLowerCase()));

  const counts: Record<string, number> = {
    all: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    planning: projects.filter(p => p.status === 'planning').length,
    on_hold: projects.filter(p => p.status === 'on_hold').length,
    completed: projects.filter(p => p.status === 'completed').length,
  };

  const totalCV = projects.reduce((s, p) => s + (p.contractValue !== null && p.contractValue !== undefined ? Number(p.contractValue) : 0), 0);
  const totalWorkers = projects.reduce((s, p) => s + (p.workers !== null && p.workers !== undefined ? Number(p.workers) : 0), 0);

  function openCreate() {
    setEditMode(false);
    setForm(defaultForm);
    setShowModal(true);
  }
  function openEdit(p: AnyRow) {
    setEditMode(true);
    setForm({
      name: String(p.name ?? ''), client: String(p.client ?? ''), location: String(p.location ?? ''),
      type: String(p.type ?? 'Commercial'), manager: String(p.projectManager ?? ''),
      budget: String(p.budget ?? ''), contract_value: String(p.contractValue ?? ''),
      workers: String(p.workers ?? '0'), start_date: String(p.startDate ?? ''),
      end_date: String(p.endDate ?? ''), status: String(p.status ?? 'planning'),
      phase: String(p.phase ?? 'Pre-construction'), description: String(p.description ?? ''),
    });
    setSelectedId(String(p.id));
    setShowModal(true);
  }
  function handleSave() {
    if (!form.name || !form.client) { toast.error('Name and client required'); return; }
    const payload = {
      name: form.name, client: form.client, location: form.location, type: form.type,
      manager: form.manager, budget: parseFloat(form.budget) || 0, contract_value: parseFloat(form.contract_value) || 0,
      workers: parseInt(form.workers) || 0, start_date: form.start_date, end_date: form.end_date,
      status: form.status, phase: form.phase, description: form.description, progress: 0, spent: 0
    };
    if (editMode && selectedId) {
      updateMutation.mutate({ id: selectedId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
    setShowModal(false);
  }

  if (selectedProject && !showModal) {
    return (
      <ProjectWorkspace
        project={selectedProject}
        onBack={() => setSelectedId(null)}
        onEdit={() => openEdit(selectedProject)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <ModuleBreadcrumbs currentModule="projects" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Projects</h1>
          <p className="text-gray-400 text-sm mt-0.5">{counts.active} active · £{(totalCV / 1_000_000).toFixed(1)}M pipeline · {totalWorkers} workers</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => refetch()} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"><RefreshCw className="w-4 h-4" /></button>
          <button type="button" onClick={openCreate} className="flex items-center gap-2 px-4 py-2 btn btn-primary rounded-lg text-white font-medium transition-colors">
            <Plus className="w-4 h-4" />New Project
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[{ k: 'all', l: 'All' }, { k: 'active', l: 'Active' }, { k: 'planning', l: 'Planning' }, { k: 'on_hold', l: 'On Hold' }, { k: 'completed', l: 'Completed' }].map(({ k, l }) => (
          <button type="button" key={k} onClick={() => setFilter(k as ProjectStatus | 'all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === k ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
            {l} <span className="ml-1 text-xs opacity-70">{counts[k]}</span>
          </button>
        ))}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…"
              className="w-full pl-9 pr-3 py-1.5 input input-bordered text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(p => {
              const cfg = STATUS_CFG[String(p.status ?? '')] ?? STATUS_CFG.planning;
              const budget = Number(p.budget ?? 0);
              const spent = Number(p.spent ?? 0);
              const pct = budget > 0 ? (spent / budget) * 100 : 0;
              const endDate = String(p.endDate ?? '');
              const days = endDate ? daysDiff(endDate) : null;
              const budgetHealth = getBudgetHealth(spent, budget);
              const isSelected = selectedIds.has(String(p.id));
              return (
                <div key={String(p.id)}
                  onClick={() => setSelectedId(String(p.id))}
                  className="group bg-gray-900 border border-gray-800 rounded-2xl p-5 cursor-pointer hover:border-blue-700/50 hover:bg-gray-900/80 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <button type="button" onClick={e => { e.stopPropagation(); toggle(String(p.id)); }}>
                        {isSelected ? <CheckSquare size={16} className="text-blue-400" /> : <Square size={16} className="text-gray-500" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <h3 className="font-semibold text-white text-sm">{String(p.name ?? '')}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <p className="text-gray-400 text-xs truncate">{String(p.client ?? '')} · {String(p.location ?? '')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button type="button" onClick={e => { e.stopPropagation(); openEdit(p); }} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={e => { e.stopPropagation(); if (confirm('Delete?')) deleteMutation.mutate(String(p.id)); }} className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-700"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>{String(p.phase ?? '')}</span>
                      <span className="font-bold text-blue-400">{String(p.progress ?? 0)}%</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400" style={{ width: `${Number(p.progress ?? 0)}%` }} />
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Budget Health</span>
                      <span className={`font-medium ${budgetHealth === 'green' ? 'text-green-400' : budgetHealth === 'amber' ? 'text-yellow-400' : 'text-red-400'}`}>
                        {budgetHealth === 'green' ? 'Healthy' : budgetHealth === 'amber' ? 'At Risk' : 'Critical'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${budgetHealth === 'green' ? 'bg-green-500' : budgetHealth === 'amber' ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                    <div><p className="text-gray-400">Budget</p><p className="text-white font-semibold">{fmtM(budget)}</p></div>
                    <div><p className="text-gray-400">Spent {pct > 80 && <span className="text-red-400">⚠</span>}</p><p className="text-white font-semibold">{fmtM(spent)}</p></div>
                    <div><p className="text-gray-400">Workers</p><p className="text-white font-semibold">{String(p.workers ?? 0)}</p></div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-800 text-xs">
                    <div className="flex items-center gap-1 text-gray-400"><Calendar className="w-3.5 h-3.5" />
                      {days !== null ? (days > 0 ? <span className={days < 30 ? 'text-red-400' : days < 90 ? 'text-yellow-400' : 'text-gray-400'}>{days}d left</span> : <span className="text-red-400">Overdue</span>) : '—'}
                    </div>
                    <div className="flex items-center gap-1 text-blue-400 group-hover:text-blue-300">
                      Open workspace <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <EmptyState icon={FileText} title="No projects match your filter" description="Try adjusting your search or filter criteria." variant="projects" />}
          </div>

          <BulkActionsBar
            selectedIds={Array.from(selectedIds)}
            actions={[
              { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
            ]}
            onClearSelection={clearSelection}
          />
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
              <h2 className="text-lg font-bold text-white">{editMode ? 'Edit Project' : 'New Project'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1">Project Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Canary Wharf Office Complex" className="w-full input input-bordered px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Client *</label>
                  <input value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} placeholder="Client name" className="w-full input input-bordered px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Location</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="City, Postcode" className="w-full input input-bordered px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full input input-bordered px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                    {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full input input-bordered px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                    {['planning', 'active', 'on_hold', 'completed', 'archived'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Phase</label>
                  <select value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))} className="w-full input input-bordered px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                    {PROJECT_PHASES.map(ph => <option key={ph} value={ph}>{ph}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Budget (£)</label>
                  <input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} placeholder="0" className="w-full input input-bordered px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Contract Value (£)</label>
                  <input type="number" value={form.contract_value} onChange={e => setForm(f => ({ ...f, contract_value: e.target.value }))} placeholder="0" className="w-full input input-bordered px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full input input-bordered px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">End Date</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="w-full input input-bordered px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Project Manager</label>
                  <input value={form.manager} onChange={e => setForm(f => ({ ...f, manager: e.target.value }))} placeholder="Full name" className="w-full input input-bordered px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Workers on Site</label>
                  <input type="number" value={form.workers} onChange={e => setForm(f => ({ ...f, workers: e.target.value }))} placeholder="0" className="w-full input input-bordered px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Project description…" className="w-full input input-bordered px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
              <button type="button" onClick={handleSave} className="flex-1 btn btn-primary rounded-lg py-2 text-sm font-semibold transition-colors">
                {editMode ? 'Save Changes' : 'Create Project'}
              </button>
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 btn btn-ghost rounded-lg py-2 text-sm font-semibold transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default React.memo(Projects);
