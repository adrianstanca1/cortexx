/**
 * Rule-based construction “site brief” — synthesises live signals into priorities.
 * Designed to stay useful offline; swap the builder for an LLM-backed service later.
 */
import type { Module } from '../types';

export type BriefSeverity = 'info' | 'attention' | 'critical';

export interface BriefSignal {
  id: string;
  title: string;
  detail: string;
  severity: BriefSeverity;
  navigateTo?: Module;
}

export interface SiteBrief {
  headline: string;
  subline: string;
  signals: BriefSignal[];
  /** Short imperative lines for the command centre */
  playbooks: string[];
}

export function buildAISiteBrief(input: {
  openRfis: number;
  overdueRfis: number;
  blockedTasks: number;
  redBudgetProjects: number;
  amberProgrammeProjects: number;
  openSafetyItems: number;
  activeProjects: number;
  /** Mobile / lightweight summary: outstanding tasks from field API */
  mobileOutstandingTasks?: number;
  /** Mobile: open defects count */
  mobileOpenDefects?: number;
}): SiteBrief {
  const signals: BriefSignal[] = [];

  if (
    input.mobileOpenDefects !== undefined &&
    input.mobileOpenDefects !== null &&
    input.mobileOpenDefects > 0
  ) {
    signals.push({
      id: 'mobile-defects',
      title: 'Open defects',
      detail: `${input.mobileOpenDefects} open defect(s) on the summary feed — close the loop on site.`,
      severity: input.mobileOpenDefects >= 5 ? 'critical' : 'attention',
      navigateTo: 'defects',
    });
  }

  if (
    input.mobileOutstandingTasks !== undefined &&
    input.mobileOutstandingTasks !== null &&
    input.mobileOutstandingTasks > 0
  ) {
    signals.push({
      id: 'mobile-tasks',
      title: 'Your task queue',
      detail: `${input.mobileOutstandingTasks} item(s) on today's mobile summary — work the list top-down.`,
      severity: 'info',
      navigateTo: 'daily-reports',
    });
  }

  if (input.redBudgetProjects > 0) {
    signals.push({
      id: 'budget-rag',
      title: 'Budget pressure',
      detail: `${input.redBudgetProjects} project(s) on red budget RAG — review valuations and change orders.`,
      severity: 'critical',
      navigateTo: 'cost-management',
    });
  }

  if (input.overdueRfis > 0) {
    signals.push({
      id: 'rfi-overdue',
      title: 'RFI response risk',
      detail: `${input.overdueRfis} RFI(s) look overdue — programme exposure until answered.`,
      severity: 'critical',
      navigateTo: 'rfis',
    });
  } else if (input.openRfis > 0) {
    signals.push({
      id: 'rfi-open',
      title: 'Open RFIs',
      detail: `${input.openRfis} open RFI(s) — keep the design record tight.`,
      severity: 'attention',
      navigateTo: 'rfis',
    });
  }

  if (input.openSafetyItems > 0) {
    signals.push({
      id: 'safety-open',
      title: 'Safety follow-up',
      detail: `${input.openSafetyItems} open incident / observation record(s).`,
      severity: input.openSafetyItems >= 3 ? 'critical' : 'attention',
      navigateTo: 'safety',
    });
  }

  if (input.blockedTasks > 0) {
    signals.push({
      id: 'tasks-blocked',
      title: 'Blocked work',
      detail: `${input.blockedTasks} blocked task(s) — unblock or re-sequence.`,
      severity: 'attention',
      navigateTo: 'projects',
    });
  }

  if (input.amberProgrammeProjects > 0 && input.redBudgetProjects === 0) {
    signals.push({
      id: 'programme-amber',
      title: 'Programme drift',
      detail: `${input.amberProgrammeProjects} project(s) on amber programme — tighten lookahead.`,
      severity: 'info',
      navigateTo: 'project-calendar',
    });
  }

  if (signals.length === 0) {
    signals.push({
      id: 'nominal',
      title: 'Systems nominal',
      detail:
        input.activeProjects > 0
          ? `${input.activeProjects} active project(s) — no critical triage signals from live data.`
          : 'No active projects yet — seed programmes or connect integrations.',
      severity: 'info',
      navigateTo: 'dashboard',
    });
  }

  /** Cap so mobile extras + desktop signals stay readable */
  const trimmed = signals.slice(0, 5);

  const headline =
    signals[0]?.severity === 'critical'
      ? 'Critical path needs attention today'
      : signals[0]?.severity === 'attention'
        ? 'Operational focus for this shift'
        : 'Site intelligence — all clear';

  const subline =
    'Heuristic brief from live RFIs, tasks, RAG, and safety feeds. CortexBuild Ultimate is free — invest the time in delivery, not billing.';

  const playbooks = [
    'Run a 10-minute “design + commercial” huddle on top overdue RFIs.',
    'Snapshot programme + cost for any red RAG project before end of day.',
    'Log one proactive safety observation per active site visit.',
  ];

  return { headline, subline, signals: trimmed, playbooks };
}
