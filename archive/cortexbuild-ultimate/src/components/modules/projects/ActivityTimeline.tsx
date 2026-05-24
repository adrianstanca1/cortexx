import React from 'react';
import {
  Clock, FileText, MessageSquare, AlertCircle, CheckCircle2,
  Shield, ClipboardList, Image, Wrench, Calendar, Link2,
  ArrowRight, Filter, ChevronDown, ChevronUp,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import { EmptyState } from '../../ui/EmptyState';
import type { AnyRow } from './types';

interface ActivityRecord {
  id: string;
  type: 'drawing' | 'rfi' | 'submittal' | 'punch' | 'inspection' | 'daily-report' | 'meeting' | 'change-order' | 'specification';
  title: string;
  description?: string;
  status: string;
  date: string;
  author?: string;
  linkedIds?: string[];
  icon: typeof FileText;
  color: string;
  bg: string;
  refId: string;
  module: string;
}

const typeConfig: Record<string, { icon: typeof FileText; label: string; color: string; bg: string; module: string }> = {
  drawing:       { icon: Image,          label: 'Drawing',        color: 'text-sky-400',     bg: 'bg-sky-500/10',     module: 'Drawings' },
  specification: { icon: FileText,       label: 'Specification',    color: 'text-indigo-400',    bg: 'bg-indigo-500/10',  module: 'Specifications' },
  rfi:           { icon: MessageSquare,  label: 'RFI',            color: 'text-blue-400',      bg: 'bg-blue-500/10',    module: 'RFIs' },
  submittal:     { icon: FileText,       label: 'Submittal',        color: 'text-emerald-400',   bg: 'bg-emerald-500/10', module: 'Submittals' },
  punch:         { icon: AlertCircle,    label: 'Punch Item',     color: 'text-red-400',       bg: 'bg-red-500/10',     module: 'Punch List' },
  inspection:    { icon: Shield,         label: 'Inspection',     color: 'text-purple-400',    bg: 'bg-purple-500/10',  module: 'Inspections' },
  'daily-report': { icon: ClipboardList, label: 'Daily Report',   color: 'text-amber-400',     bg: 'bg-amber-500/10',   module: 'Daily Reports' },
  meeting:       { icon: Calendar,       label: 'Meeting',        color: 'text-pink-400',      bg: 'bg-pink-500/10',    module: 'Meetings' },
  'change-order': { icon: Wrench,       label: 'Change Order',   color: 'text-orange-400',    bg: 'bg-orange-500/10',   module: 'Change Orders' },
};

function normalizeToActivities(props: {
  drawings?: AnyRow[];
  rfis?: AnyRow[];
  submittals?: AnyRow[];
  punchList?: AnyRow[];
  inspections?: AnyRow[];
  dailyReports?: AnyRow[];
  meetings?: AnyRow[];
  changeOrders?: AnyRow[];
  specifications?: AnyRow[];
}): ActivityRecord[] {
  const acts: ActivityRecord[] = [];

  (props.drawings ?? []).forEach((d: AnyRow) => {
    const cfg = typeConfig.drawing;
    acts.push({
      id: String(d.id ?? ''),
      type: 'drawing',
      title: String(d.title ?? d.name ?? d.drawing_number ?? 'Untitled Drawing'),
      description: String(d.revision ?? ''),
      status: String(d.status ?? 'draft'),
      date: String(d.created_at ?? d.date ?? new Date().toISOString()),
      author: String(d.created_by ?? d.author ?? ''),
      icon: cfg.icon,
      color: cfg.color,
      bg: cfg.bg,
      refId: String(d.drawing_number ?? d.id ?? ''),
      module: cfg.module,
    });
  });

  (props.rfis ?? []).forEach((r: AnyRow) => {
    const cfg = typeConfig.rfi;
    acts.push({
      id: String(r.id ?? ''),
      type: 'rfi',
      title: String(r.title ?? r.subject ?? `RFI #${r.id ?? ''}`),
      description: String(r.description ?? r.question ?? ''),
      status: String(r.status ?? 'open'),
      date: String(r.date_submitted ?? r.created_at ?? r.date ?? new Date().toISOString()),
      author: String(r.submitted_by ?? r.created_by ?? ''),
      linkedIds: r.drawing_id ? [String(r.drawing_id)] : undefined,
      icon: cfg.icon,
      color: cfg.color,
      bg: cfg.bg,
      refId: String(r.rfi_number ?? `RFI-${r.id ?? ''}`),
      module: cfg.module,
    });
  });

  (props.submittals ?? []).forEach((s: AnyRow) => {
    const cfg = typeConfig.submittal;
    const linked: string[] = [];
    if (s.linked_drawing_id) linked.push(String(s.linked_drawing_id));
    if (s.linked_rfi_id) linked.push(String(s.linked_rfi_id));
    if (s.linked_spec_id) linked.push(String(s.linked_spec_id));
    acts.push({
      id: String(s.id ?? ''),
      type: 'submittal',
      title: String(s.title ?? s.subject ?? `Submittal #${s.submittal_number ?? s.id ?? ''}`),
      description: String(s.description ?? ''),
      status: String(s.status ?? 'draft'),
      date: String(s.due_date ?? s.created_at ?? new Date().toISOString()),
      author: String(s.responsible_person ?? s.ball_in_court ?? s.created_by ?? ''),
      linkedIds: linked.length ? linked : undefined,
      icon: cfg.icon,
      color: cfg.color,
      bg: cfg.bg,
      refId: String(s.submittal_number ?? `SUB-${s.id ?? ''}`),
      module: cfg.module,
    });
  });

  (props.punchList ?? []).forEach((p: AnyRow) => {
    const cfg = typeConfig.punch;
    acts.push({
      id: String(p.id ?? ''),
      type: 'punch',
      title: String(p.description ?? p.item ?? `Punch #${p.id ?? ''}`),
      description: String(p.location ?? p.note ?? ''),
      status: String(p.status ?? 'open'),
      date: String(p.date_created ?? p.created_at ?? p.date ?? new Date().toISOString()),
      author: String(p.assigned_to ?? p.created_by ?? ''),
      icon: cfg.icon,
      color: cfg.color,
      bg: cfg.bg,
      refId: String(p.punch_number ?? `PUNCH-${p.id ?? ''}`),
      module: cfg.module,
    });
  });

  (props.inspections ?? []).forEach((i: AnyRow) => {
    const cfg = typeConfig.inspection;
    acts.push({
      id: String(i.id ?? ''),
      type: 'inspection',
      title: String(i.inspection_type ?? i.title ?? `Inspection #${i.id ?? ''}`),
      description: String(i.result ?? i.notes ?? ''),
      status: String(i.status ?? 'scheduled'),
      date: String(i.scheduled_date ?? i.inspection_date ?? i.created_at ?? new Date().toISOString()),
      author: String(i.inspector ?? i.inspected_by ?? ''),
      icon: cfg.icon,
      color: cfg.color,
      bg: cfg.bg,
      refId: String(i.inspection_number ?? `INSP-${i.id ?? ''}`),
      module: cfg.module,
    });
  });

  (props.dailyReports ?? []).forEach((r: AnyRow) => {
    const cfg = typeConfig['daily-report'];
    acts.push({
      id: String(r.id ?? ''),
      type: 'daily-report',
      title: `Daily Report — ${String(r.date ?? format(new Date(), 'yyyy-MM-dd'))}`,
      description: String(r.weather ?? r.notes ?? ''),
      status: 'submitted',
      date: String(r.date ?? r.created_at ?? new Date().toISOString()),
      author: String(r.foreman ?? r.reported_by ?? r.created_by ?? ''),
      icon: cfg.icon,
      color: cfg.color,
      bg: cfg.bg,
      refId: String(r.report_number ?? `DR-${r.id ?? ''}`),
      module: cfg.module,
    });
  });

  return acts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

const statusBadge: Record<string, string> = {
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  submitted: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  reviewed: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  open: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  pending: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  scheduled: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  investigating: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

function fmtDateFallback(iso: string) {
  try { return format(parseISO(iso), 'd MMM yyyy'); }
  catch { return iso.slice(0, 10); }
}

export function ActivityTimeline(props: {
  drawings?: AnyRow[];
  rfis?: AnyRow[];
  submittals?: AnyRow[];
  punchList?: AnyRow[];
  inspections?: AnyRow[];
  dailyReports?: AnyRow[];
  meetings?: AnyRow[];
  changeOrders?: AnyRow[];
  specifications?: AnyRow[];
}) {
  const [filter, setFilter] = React.useState<string>('all');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const all = React.useMemo(() => normalizeToActivities(props), [props]);

  const filtered = React.useMemo(() => {
    if (filter === 'all') return all;
    if (filter === 'linked') return all.filter(a => (a.linkedIds?.length ?? 0) > 0);
    return all.filter(a => a.type === filter);
  }, [all, filter]);

  const filters = [
    { id: 'all',    label: 'All',    count: all.length },
    { id: 'linked', label: 'Linked', count: all.filter(a => (a.linkedIds?.length ?? 0) > 0).length },
    { id: 'drawing', label: 'Drawings', count: all.filter(a => a.type === 'drawing').length },
    { id: 'rfi', label: 'RFIs', count: all.filter(a => a.type === 'rfi').length },
    { id: 'submittal', label: 'Submittals', count: all.filter(a => a.type === 'submittal').length },
    { id: 'punch', label: 'Punch', count: all.filter(a => a.type === 'punch').length },
    { id: 'daily-report', label: 'Daily Reports', count: all.filter(a => a.type === 'daily-report').length },
    { id: 'inspection', label: 'Inspections', count: all.filter(a => a.type === 'inspection').length },
  ];

  if (all.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="No Activity Yet"
        description="As work progresses, related drawings, RFIs, submittals, and inspections will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-500" />
        {filters.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={clsx(
              'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
              filter === f.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:bg-gray-800'
            )}
          >
            {f.label} <span className="opacity-60 ml-0.5">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative border-l-2 border-gray-800 ml-3 space-y-0">
        {filtered.map((act, idx) => {
          const Icon = act.icon;
          const isExpanded = expandedId === act.id;
          const linked = act.linkedIds
            ? all.filter(x => act.linkedIds!.includes(x.id))
            : [];

          return (
            <div key={`${act.type}-${act.id}`} className="relative pl-6 py-2 group">
              {/* Dot */}
              <div className={clsx('absolute -left-[9px] top-4 w-4 h-4 rounded-full border-2 border-gray-900 flex items-center justify-center', act.bg)}>
                <Icon className={clsx('w-2.5 h-2.5', act.color)} />
              </div>

              <div
                className={clsx(
                  'bg-gray-900/40 border border-gray-800 rounded-xl p-3 transition-all',
                  isExpanded ? 'ring-1 ring-blue-500/30' : 'hover:bg-gray-900/60'
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={clsx('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', act.bg, act.color)}>
                        {act.module}
                      </span>
                      <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded border', statusBadge[act.status] ?? statusBadge.draft)}>
                        {act.status}
                      </span>
                      {linked.length > 0 && (
                        <span className="text-[10px] text-blue-400 flex items-center gap-0.5">
                          <Link2 className="w-3 h-3" /> {linked.length} link{linked.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-white truncate">{act.title}</h4>
                    {act.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{act.description}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">{fmtDateFallback(act.date)}</p>
                    {act.author && <p className="text-[10px] text-gray-600 mt-0.5">{act.author}</p>}
                  </div>
                </div>

                {/* Linked records row */}
                {linked.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <ArrowRight className="w-3 h-3 text-blue-400" />
                    {linked.map(l => {
                      const LIcon = l.icon;
                      return (
                        <span key={l.id} className={clsx('inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border', l.bg, l.color)}>
                          <LIcon className="w-2.5 h-2.5" />
                          {l.refId}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Expand for details */}
                {linked.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : act.id)}
                    className="mt-1.5 text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isExpanded ? 'Hide' : 'Show'} details
                  </button>
                )}

                {isExpanded && linked.length > 0 && (
                  <div className="mt-2 space-y-1.5 border-t border-gray-800 pt-2">
                    {linked.map(l => (
                      <div key={l.id} className="flex items-center gap-2 text-xs text-gray-400">
                        <l.icon className={clsx('w-3.5 h-3.5', l.color)} />
                        <span className="font-medium text-gray-300">{l.refId}</span>
                        <span>— {l.title}</span>
                        <span className={clsx('ml-auto text-[10px] px-1.5 py-0.5 rounded border', statusBadge[l.status] ?? statusBadge.draft)}>
                          {l.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
