// Shared types, constants, and utility functions for the Projects module

import type { ProjectStatus } from '../../../types';

export type AnyRow = Record<string, unknown>;

// ─── Config ────────────────────────────────────────────────────────────────
export const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  active:    { label: 'Active',    color: 'text-green-400',   bg: 'bg-green-500/15 border border-green-600/50',    dot: 'bg-green-400'  },
  planning:  { label: 'Planning',  color: 'text-blue-400',    bg: 'bg-blue-500/15 border border-blue-600/50',      dot: 'bg-blue-400'   },
  on_hold:   { label: 'On Hold',   color: 'text-yellow-400',  bg: 'bg-yellow-500/15 border border-yellow-600/50',  dot: 'bg-yellow-400' },
  completed: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border border-emerald-600/50', dot: 'bg-emerald-400' },
  archived:  { label: 'Archived',  color: 'text-gray-500',    bg: 'bg-gray-700/50 border border-gray-600',         dot: 'bg-gray-500'   },
};

export const PRIORITY_CFG: Record<string, { label: string; color: string; dot: string }> = {
  critical: { label: 'Critical', color: 'text-red-400',    dot: 'bg-red-500'    },
  high:     { label: 'High',     color: 'text-orange-400',  dot: 'bg-orange-500' },
  medium:   { label: 'Medium',   color: 'text-yellow-400',  dot: 'bg-yellow-400' },
  low:      { label: 'Low',      color: 'text-gray-400',    dot: 'bg-gray-500'   },
};

export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'blocked', 'done'];
export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', review: 'Review', blocked: 'Blocked', done: 'Done',
};
export const TASK_STATUS_COLORS: Record<string, string> = {
  todo: 'bg-gray-600',
  in_progress: 'bg-blue-600',
  review: 'bg-purple-600',
  blocked: 'bg-red-600',
  done: 'bg-green-600',
};

export const DOC_CATEGORIES = ['RAMS', 'Drawings', 'Reports', 'Contracts', 'Specifications', 'Health & Safety', 'Method Statements', 'Pictures', 'General'];
export const IMAGE_CATEGORIES = ['site_progress', 'aerial', 'interior', 'exterior', 'materials', 'team', 'general'];

export const PROJECT_TYPES  = ['Commercial', 'Residential', 'Civil', 'Industrial', 'Healthcare', 'Fit-Out', 'Infrastructure', 'Refurbishment'];
export const PROJECT_PHASES = ['Pre-construction', 'Tender', 'Design', 'Foundation', 'Structural', 'Envelope', 'Internal Fit-Out', 'MEP', 'Finishing', 'Snagging', 'Handover'];

export const defaultForm = { name: '', client: '', location: '', type: 'Commercial', manager: '', budget: '', contract_value: '', workers: '0', start_date: '', end_date: '', status: 'planning', phase: 'Pre-construction', description: '' };
export type FormData = typeof defaultForm;

// ─── Workspace types ───────────────────────────────────────────────────────
export type WorkspaceTab = 'overview' | 'activity' | 'timeline' | 'milestones' | 'tasks' | 'gallery' | 'financials' | 'team' | 'documents' | 'rfis' | 'safety' | 'reports';

export interface WorkspaceProps {
  project: AnyRow;
  onBack: () => void;
  onEdit: () => void;
}

// ─── Project milestone type ────────────────────────────────────────────────
export interface ProjectMilestone {
  id: string;
  title: string;
  dueDate: string;
  status: 'completed' | 'in_progress' | 'upcoming';
}

// ─── Task form defaults ────────────────────────────────────────────────────
export const TASK_FORM_DEFAULTS = { title: '', description: '', priority: 'medium', assigned_to: '', due_date: '', category: 'general', estimated_hours: '' };

// ─── Utility functions ─────────────────────────────────────────────────────
export function fmtM(n: number): string {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}K`;
  return `£${n.toLocaleString()}`;
}

export function daysDiff(d: string): number {
  const diff = (new Date(d).getTime() - Date.now()) / 86400000;
  return Math.round(diff);
}

export function getBudgetHealth(spent: number, budget: number): 'green' | 'amber' | 'red' {
  if (budget === 0) return 'green';
  const pct = (spent / budget) * 100;
  if (pct <= 70) return 'green';
  if (pct <= 85) return 'amber';
  return 'red';
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

// ─── Phase & milestone generation ──────────────────────────────────────────
export function generateProjectPhases(project: AnyRow): { name: string; progress: number; startDate: string; endDate: string }[] {
  const currentPhaseIdx = PROJECT_PHASES.indexOf(String(project.phase ?? project.current_phase ?? 'Pre-construction'));
  const progress = Number(project.progress ?? 0);
  return PROJECT_PHASES.map((phase, idx) => {
    let phProgress = 0;
    if (idx < currentPhaseIdx) phProgress = 100;
    else if (idx === currentPhaseIdx) phProgress = progress;
    return {
      name: phase,
      progress: phProgress,
      startDate: String(project.startDate ?? project.start_date ?? ''),
      endDate: String(project.endDate ?? project.end_date ?? ''),
    };
  });
}

export function generateProjectMilestones(project: AnyRow): ProjectMilestone[] {
  const currentPhaseIdx = PROJECT_PHASES.indexOf(String(project.phase ?? 'Pre-construction'));
  const endDate = new Date(String(project.endDate ?? project.end_date ?? Date.now()));

  return [
    { id: '1', title: 'Site Mobilization', dueDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: currentPhaseIdx > 0 ? 'completed' : 'upcoming' },
    { id: '2', title: 'Structural Frame Complete', dueDate: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: currentPhaseIdx > 2 ? 'completed' : currentPhaseIdx > 1 ? 'in_progress' : 'upcoming' },
    { id: '3', title: 'MEP First Fix', dueDate: new Date(new Date().getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: currentPhaseIdx > 4 ? 'completed' : currentPhaseIdx > 3 ? 'in_progress' : 'upcoming' },
    { id: '4', title: 'Interior Finishing', dueDate: new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: currentPhaseIdx > 6 ? 'completed' : currentPhaseIdx > 5 ? 'in_progress' : 'upcoming' },
    { id: '5', title: 'Snagging & Final Sign-Off', dueDate: endDate.toISOString().split('T')[0], status: currentPhaseIdx >= PROJECT_PHASES.length - 1 ? 'completed' : currentPhaseIdx >= PROJECT_PHASES.length - 2 ? 'in_progress' : 'upcoming' },
  ];
}

export type { ProjectStatus };
