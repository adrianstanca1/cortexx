// Shared components for the Projects module

import React from 'react';
import { FileText, FileSpreadsheet, File, Image as ImageIcon } from 'lucide-react';
import { fmtM, getBudgetHealth, daysDiff, STATUS_CFG, PRIORITY_CFG, TASK_STATUS_COLORS, TASK_STATUSES, TASK_STATUS_LABELS } from './types';
import type { AnyRow } from './types';

// ─── Document icon helper ──────────────────────────────────────────────────
export function getDocIcon(type: string): React.ReactNode {
  switch (type?.toUpperCase()) {
    case 'PDF': return <FileText className="w-4 h-4 text-red-400" />;
    case 'DOC': case 'DOCX': return <FileText className="w-4 h-4 text-blue-400" />;
    case 'XLS': case 'XLSX': return <FileSpreadsheet className="w-4 h-4 text-green-400" />;
    case 'DWG': case 'DXF': return <File className="w-4 h-4 text-orange-400" />;
    case 'PNG': case 'JPG': case 'JPEG': case 'GIF': case 'WEBP': return <ImageIcon className="w-4 h-4 text-purple-400" />;
    default: return <File className="w-4 h-4 text-gray-400" />;
  }
}

// ─── Status badge ──────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.planning;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
  );
}

// ─── Priority badge ────────────────────────────────────────────────────────
export function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CFG[priority] ?? PRIORITY_CFG.low;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cfg.color} bg-opacity-20`}
      style={{ backgroundColor: `${cfg.dot}33` }}>
      {cfg.label}
    </span>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────
export function KPICard({ label, value, sub, color = 'text-white' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card bg-base-100 border border-base-300 p-4">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

// ─── Budget Health indicator ───────────────────────────────────────────────
export function BudgetHealthIndicator({ spent, budget }: { spent: number; budget: number }) {
  const pct = budget > 0 ? (spent / budget) * 100 : 0;
  const health = getBudgetHealth(spent, budget);
  const cfg = {
    green: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Healthy' },
    amber: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'At Risk' },
    red:   { bg: 'bg-red-500/20',    text: 'text-red-400',    label: 'Critical' },
  }[health];

  return (
    <div className={`${cfg.bg} rounded-xl p-3 border border-gray-700`}>
      <p className="text-gray-400 text-xs mb-1">Budget Health</p>
      <p className={`font-bold text-lg ${cfg.text}`}>{cfg.label}</p>
      <p className="text-gray-500 text-xs">{pct.toFixed(1)}% spent</p>
    </div>
  );
}

// ─── Project Card (for the grid list) ──────────────────────────────────────
interface ProjectCardProps {
  project: AnyRow;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onEdit: (project: AnyRow) => void;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, isSelected, onToggle, onSelect, onEdit, onDelete }: ProjectCardProps) {
  const cfg = STATUS_CFG[String(project.status ?? '')] ?? STATUS_CFG.planning;
  const budget = Number(project.budget ?? 0);
  const spent = Number(project.spent ?? 0);
  const pct = budget > 0 ? (spent / budget) * 100 : 0;
  const endDate = String(project.endDate ?? '');
  const days = endDate ? daysDiff(endDate) : null;
  const budgetHealth = getBudgetHealth(spent, budget);

  return (
    <div
      onClick={() => onSelect(String(project.id))}
      className="group bg-gray-900 border border-gray-800 rounded-2xl p-5 cursor-pointer hover:border-blue-700/50 hover:bg-gray-900/80 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button type="button" onClick={e => { e.stopPropagation(); onToggle(String(project.id)); }}>
            {isSelected ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h3 className="font-semibold text-white text-sm">{String(project.name ?? '')}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
            </div>
            <p className="text-gray-400 text-xs truncate">{String(project.client ?? '')} · {String(project.location ?? '')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button type="button" onClick={e => { e.stopPropagation(); onEdit(project); }} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>
          </button>
          <button type="button" onClick={e => { e.stopPropagation(); if (confirm('Delete?')) onDelete(String(project.id)); }} className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
          </button>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{String(project.phase ?? '')}</span>
          <span className="font-bold text-blue-400">{String(project.progress ?? 0)}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400" style={{ width: `${Number(project.progress ?? 0)}%` }} />
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
        <div><p className="text-gray-400">Workers</p><p className="text-white font-semibold">{String(project.workers ?? 0)}</p></div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-800 text-xs">
        <div className="flex items-center gap-1 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.01 3.01 0 0 1 5.13-2.16L9 7.13z"/><path d="M12 10a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/><path d="M12 10V8"/><path d="M12 15v.01"/></svg>
          {days !== null ? (days > 0 ? <span className={days < 30 ? 'text-red-400' : days < 90 ? 'text-yellow-400' : 'text-gray-400'}>{days}d left</span> : <span className="text-red-400">Overdue</span>) : '—'}
        </div>
        <div className="flex items-center gap-1 text-blue-400 group-hover:text-blue-300">
          Open workspace <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>
    </div>
  );
}

// ─── Task Card (for kanban) ────────────────────────────────────────────────
interface TaskCardProps {
  task: AnyRow;
  onEdit: (task: AnyRow) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}

export function TaskCard({ task, onEdit, onDelete, onStatusChange }: TaskCardProps) {
  const daysUntilDue = task.due_date ? daysDiff(String(task.due_date)) : null;
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0 && task.status !== 'done';
  const priorityCfg = PRIORITY_CFG[String(task.priority ?? 'medium')] ?? PRIORITY_CFG.low;

  return (
    <div
      className="bg-gray-800/80 border border-gray-700 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-blue-600/50 transition-all group"
      draggable
      onDragStart={() => {}}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityCfg.color} bg-opacity-20`}
          style={{ backgroundColor: `${priorityCfg.dot}33` }}>
          {priorityCfg.label}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(task)} className="p-1 text-gray-400 hover:text-white rounded">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>
          </button>
          <button onClick={() => onDelete(String(task.id))} className="p-1 text-gray-400 hover:text-red-400 rounded">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
          </button>
        </div>
      </div>
      <p className="text-white text-sm font-medium mb-2 leading-snug">{String(task.title ?? '')}</p>
      {!!task.description && <p className="text-gray-400 text-xs mb-2 line-clamp-2">{String(task.description)}</p>}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          {task.assigned_to ? (
            <span className="flex items-center gap-1 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              {String(task.assigned_to).split(' ')[0]}
            </span>
          ) : (
            <span className="text-gray-600">Unassigned</span>
          )}
        </div>
        {!!task.due_date && (
          <span className={isOverdue ? 'text-red-400 font-semibold' : daysUntilDue !== null && daysUntilDue < 3 ? 'text-yellow-400' : 'text-gray-400'}>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-0.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {isOverdue ? `${Math.abs(daysUntilDue!)}d overdue` : `${daysUntilDue}d left`}
          </span>
        )}
      </div>
      {!!task.estimated_hours && (
        <p className="text-gray-600 text-xs mt-1">⏱ {String(task.estimated_hours)}h estimated</p>
      )}
      <div className="mt-2 pt-2 border-t border-gray-700">
        <select
          value={String(task.status ?? 'todo')}
          onChange={(e) => { e.stopPropagation(); onStatusChange(String(task.id), e.target.value); }}
          onClick={(e) => e.stopPropagation()}
          className="w-full bg-gray-700/50 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          {TASK_STATUSES.map(s => (
            <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── Kanban Column ─────────────────────────────────────────────────────────
interface KanbanColumnProps {
  status: string;
  tasks: AnyRow[];
  onEdit: (task: AnyRow) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}

export function KanbanColumn({ status, tasks, onEdit, onDelete, onStatusChange }: KanbanColumnProps) {
  return (
    <div className="min-w-[220px]">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${TASK_STATUS_COLORS[status]}`} />
          <span className="text-xs font-semibold text-gray-300">{TASK_STATUS_LABELS[status]}</span>
        </div>
        <span className="text-xs text-gray-600">{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.map((task: AnyRow) => (
          <TaskCard key={String(task.id)} task={task} onEdit={onEdit} onDelete={onDelete} onStatusChange={onStatusChange} />
        ))}
        {tasks.length === 0 && (
          <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center">
            <p className="text-xs text-gray-600">No tasks</p>
          </div>
        )}
      </div>
    </div>
  );
}
