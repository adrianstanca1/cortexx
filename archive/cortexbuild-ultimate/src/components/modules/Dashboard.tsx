// Module: Dashboard — CortexBuild Ultimate
// Command Centre — live construction intelligence dashboard
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSyncedPreference } from '../../hooks/useSyncedPreference';
import {
  TrendingUp, TrendingDown, Activity, DollarSign,
  Users, AlertTriangle, Download, FileText, RefreshCw, ShieldCheck, Briefcase,
  CircleDot,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { dashboardApi, projectsApi, notificationsApi } from '../../services/api';
import { eventBus } from '../../lib/eventBus';
import { SiteStatusBanner } from '../layout/SiteStatusBanner';
import { SafetyStatsPanel, type SafetyStatsData } from '../ui/SafetyStatsPanel';
import { QuickStats } from '../dashboard/QuickStats';
import { TaskList } from '../dashboard/TaskList';
import { RFITimeline } from '../dashboard/RFITimeline';
import { SafetyStats } from '../dashboard/SafetyStats';
import { AIAvatar } from '../dashboard/AIAvatar';
import { ProjectCard } from '../dashboard/ProjectCard';
import { WebSocketStatus } from '../dashboard/WebSocketStatus';
import { useSafety } from '../../hooks/useData';
import { useRFIs as useRFIData } from '../../hooks/useData';
import { useProjectTasks } from '../../hooks/useData';
import { useProjects as useProjectsData } from '../../hooks/useData';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { ActivityFeed } from '../ui/ActivityFeed';
import { AISiteBriefPanel } from '../dashboard/AISiteBriefPanel';

type AnyRow = Record<string, unknown>;
type SafetyRow = AnyRow & { status?: string; severity?: string };

interface Project {
  id: number;
  name: string;
  client: string;
  value: number;
  progress: number;
  budgetRAG: 'red' | 'amber' | 'green';
  programmeRAG: 'red' | 'amber' | 'green';
  qualityRAG: 'red' | 'amber' | 'green';
  daysToCompletion: number;
  pmInitials: string;
}

const fmtCurrency = (n: number) => {
  if (!n || isNaN(n)) return '£0';
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}K`;
  return `£${n.toLocaleString()}`;
};

const RAG_COLORS = { green: '#10b981', amber: '#f59e0b', red: '#ef4444' };

// ─── Animated Counter ─────────────────────────────────────────────────────
const AnimatedCounter = React.memo(({ value, prefix = '', suffix = '', duration = 1800 }: {
  value: number; prefix?: string; suffix?: string; duration?: number;
}) => {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const targetRef = useRef(value);

  useEffect(() => {
    targetRef.current = value;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(Math.round(value));
      return;
    }
    startRef.current = null;
    const step = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * targetRef.current));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <span>{prefix}{display.toLocaleString()}{suffix}</span>;
});

// ─── Animated RAG Donut ─────────────────────────────────────────────────────
const RAGDonut = React.memo(({ data }: { data: { name: string; value: number; fill: string }[] }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(true), 200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div style={{ position: 'relative', width: '140px', height: '140px' }}>
      <svg viewBox="0 0 44 44" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        {data.map((d, i) => {
          const pct = mounted ? d.value / total : 0;
          const offset = data.slice(0, i).reduce((s, x) => s + x.value / total, 0);
          const r = 17;
          const circ = 2 * Math.PI * r;
          const dash = circ * pct;
          return (
            <circle
              key={d.name} cx="22" cy="22" r={r} fill="none" stroke={d.fill} strokeWidth="3"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-circ * offset}
              style={{
                transition: `stroke-dasharray 0.8s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.12}s`,
                filter: `drop-shadow(0 0 3px ${d.fill}60)`,
              }}
            />
          );
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '22px', fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>{total}</span>
        <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '8px', color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Projects</span>
      </div>
    </div>
  );
});

// ─── Progress Bar ─────────────────────────────────────────────────────────
const ProgBar = React.memo(({ value, color, animated = true }: { value: number; color: string; animated?: boolean }) => {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!animated) { setW(value); return; }
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setW(value);
      return;
    }
    const t = setTimeout(() => setW(value), 150);
    return () => clearTimeout(t);
  }, [value, animated]);
  return (
    <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${w}%`, background: color,
        borderRadius: '2px',
        transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow: `0 0 6px ${color}80`,
      }} />
    </div>
  );
});

// ─── Live Activity Item ───────────────────────────────────────────────────
const ActivityItem = React.memo(({ user, action, module, time, accent, delay = 0 }: {
  user: string; action: string; module: string; time: string; accent: string; delay?: number;
}) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '12px',
      padding: '12px 14px',
      background: visible ? 'rgba(255,255,255,0.02)' : 'transparent',
      borderLeft: `2px solid ${accent}`,
      borderRadius: '0 8px 8px 0',
      marginBottom: '6px',
      transition: 'all 0.3s ease',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateX(0)' : 'translateX(-8px)',
    }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '8px',
        background: `${accent}15`, border: `1px solid ${accent}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', fontWeight: 700, color: accent }}>
          {user.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div>
            <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: '12px', fontWeight: 600, color: '#f1f5f9' }}>{user}</span>
            <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>{action}</span>
          </div>
          <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', color: '#475569', whiteSpace: 'nowrap' }}>{time}</span>
        </div>
        <span style={{
          display: 'inline-block', marginTop: '4px',
          fontFamily: "'Fira Code', monospace", fontSize: '9px', fontWeight: 600,
          color: accent, background: `${accent}10`, border: `1px solid ${accent}25`,
          borderRadius: '4px', padding: '1px 6px', letterSpacing: '0.05em',
        }}>
          {module}
        </span>
      </div>
    </div>
  );
});

// ─── Main Dashboard ───────────────────────────────────────────────────────
function DashboardComponent() {
  const [activeTab, setActiveTab] = useSyncedPreference<'overview' | 'projects' | 'finance' | 'safety' | 'activity'>(
    'dashboard.activeTab',
    'overview',
  );
  const [dashboardKpi, setDashboardKpi] = useState<{
    activeProjects?: number; totalRevenue?: number; outstanding?: number;
    openRfis?: number; hsScore?: number; workforce?: number;
  } | null>(null);
  const [revenueFromApi, setRevenueFromApi] = useState<{month: string; revenue: number}[]>([]);
  const [projectStatusData, setProjectStatusData] = useState<{name: string; value: number; fill: string}[]>([]);
  const [_safetyChartData, _setSafetyChartData] = useState<{month: string; incidents: number; score: number}[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activityFeed, setActivityFeed] = useState<{id: string; user: string; action: string; module: string; time: string}[]>([]);
  const [alerts, setAlerts] = useState<{id: string; level: 'amber'|'red'; title: string; description: string}[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const [showAIChat, setShowAIChat] = useState(false);

  // Live data hooks — real API data
  const { data: safetyRaw = [] } = useSafety.useList();
  const safetyIncidents = safetyRaw as AnyRow[];
  const safetyList = safetyIncidents as SafetyRow[];
  const { data: rfisRaw = [] } = useRFIData.useList();
  const rfis = rfisRaw as AnyRow[];
  const { data: tasksRaw = [] } = useProjectTasks.useList();
  const tasks = tasksRaw as AnyRow[];
  const { data: liveProjectsRaw = [] } = useProjectsData.useList();
  const liveProjects = liveProjectsRaw as AnyRow[];

  const aiBriefStats = useMemo(() => {
    const openRfis = rfis.filter((r) => {
      const s = String(r.status ?? '').toUpperCase();
      return s === 'OPEN' || s === 'OVERDUE';
    }).length;
    const overdueRfis = rfis.filter((r) => {
      const s = String(r.status ?? '').toUpperCase();
      if (s === 'OVERDUE') return true;
      if (s === 'CLOSED' || s === 'ANSWERED') return false;
      const due = r.dueDate ?? r.due_date;
      if (!due) return false;
      try {
        return new Date(String(due)).getTime() < Date.now();
      } catch {
        return false;
      }
    }).length;
    const blockedTasks = tasks.filter(
      (t) => String(t.status ?? '').toUpperCase() === 'BLOCKED',
    ).length;
    const projRows =
      liveProjects.length > 0 ? liveProjects : (projects as unknown as AnyRow[]);
    let redBudgetProjects = 0;
    let amberProgrammeProjects = 0;
    for (const row of projRows) {
      const b = String(row.budgetRAG ?? row.budget_rag ?? '').toLowerCase();
      const pr = String(row.programmeRAG ?? row.programme_rag ?? '').toLowerCase();
      if (b === 'red') redBudgetProjects++;
      if (pr === 'amber') amberProgrammeProjects++;
    }
    const openSafetyItems = safetyList.filter((s) => {
      const st = String(s.status ?? '').toLowerCase();
      return st !== 'closed' && st !== 'resolved' && st !== 'complete';
    }).length;
    const activeProjects =
      liveProjects.length > 0 ? liveProjects.length : projects.length;
    return {
      openRfis,
      overdueRfis,
      blockedTasks,
      redBudgetProjects,
      amberProgrammeProjects,
      openSafetyItems,
      activeProjects,
    };
  }, [rfis, tasks, liveProjects, projects, safetyList]);

  // Debounce ref for WS refresh
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refetch dashboard data when WS sends a dashboard_update event
  useEffect(() => {
    const unsub = eventBus.on('ws:message', ({ type }) => {
      if (type === 'dashboard_update') {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
          // Refresh KPI overview
          dashboardApi.getOverview().then(d => setDashboardKpi(d.kpi)).catch((err) => {
            console.error('Dashboard: Failed to refresh KPI overview:', err);
          });
          // Refresh revenue data
          dashboardApi.getRevenueData().then(d => setRevenueFromApi(d as {month: string; revenue: number; cost?: number}[])).catch((err) => {
            console.error('Dashboard: Failed to refresh revenue data:', err);
          });
          // Refresh projects
          projectsApi.getAll().then((data: unknown) => {
            const rows = data as AnyRow[];
            setProjects(rows.slice(0, 8).map((row, idx) => ({
              id: row.id !== null && row.id !== undefined ? Number(row.id) : idx + 1,
              name: String(row.name || `Project ${idx + 1}`),
              client: String(row.client || row.company || 'Unknown Client'),
              value: row.value !== null && row.value !== undefined ? Number(row.value) : 0,
              progress: row.progress !== null && row.progress !== undefined ? Number(row.progress) : 0,
              budgetRAG: (row.budgetRAG as 'red'|'amber'|'green') || 'green',
              programmeRAG: (row.programmeRAG as 'red'|'amber'|'green') || 'green',
              qualityRAG: (row.qualityRAG as 'red'|'amber'|'green') || 'green',
              daysToCompletion: row.daysToCompletion !== null && row.daysToCompletion !== undefined ? Number(row.daysToCompletion) : row.daysRemaining !== null && row.daysRemaining !== undefined ? Number(row.daysRemaining) : 0,
              pmInitials: String(row.pmInitials || row.projectManagerInitials || 'PM'),
            })));
          }).catch((err) => {
            console.error('Dashboard: Failed to refresh projects:', err);
          });
          // Refresh notifications / activity feed
          notificationsApi.getAll().then((data: unknown) => {
            const rows = (data as { notifications: AnyRow[] }).notifications || [];
            setActivityFeed(rows.slice(0, 12).map((row, i) => ({
              id: String(row.id || i),
              user: String(row.userName || row.createdBy || row.actor || 'System'),
              action: String(row.title || row.subject || row.message || 'Activity'),
              module: String(row.module || row.category || row.type || 'General'),
              time: String(row.createdAt ? (() => {
                try { const d = new Date(String(row.createdAt)); const m = Math.floor((Date.now()-d.getTime())/60000); return m<1?'Just now':m<60?`${m}m ago`:`${Math.floor(m/60)}h ago`; } catch { return 'Recently'; }
              })() : 'Recently'),
            })));
            const alertRows = rows.filter((r: AnyRow) => r.level==='amber'||r.level==='red'||r.type==='alert').slice(0,4).map((row: AnyRow) => ({
              id: String(row.id), level: (row.level as 'amber'|'red')||'amber',
              title: String(row.title||row.subject||'Notification'),
              description: String(row.message||row.description||''),
            }));
            setAlerts(alertRows.length ? alertRows : [{ id:'1', level:'amber' as const, title:'No active alerts', description:'All systems nominal' }]);
          }).catch((err) => {
            console.error('Dashboard: Failed to refresh notifications:', err);
          });
        }, 2000);
      }
    });
    return () => {
      unsub();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  useEffect(() => {
    dashboardApi.getOverview().then(d => setDashboardKpi(d.kpi)).catch((err) => {
      console.error('Dashboard: Failed to fetch KPI overview:', err);
    });
    dashboardApi.getRevenueData().then(d => setRevenueFromApi(d as {month: string; revenue: number}[])).catch((err) => {
      console.error('Dashboard: Failed to fetch revenue data:', err);
    });
    dashboardApi.getProjectStatus().then(d => setProjectStatusData(d.statuses)).catch((err) => {
      console.error('Dashboard: Failed to fetch project status:', err);
    });
    dashboardApi.getSafetyChart().then(d => _setSafetyChartData(d)).catch((err) => {
      console.error('Dashboard: Failed to fetch safety chart:', err);
    });
    projectsApi.getAll().then((data: unknown) => {
      const rows = data as AnyRow[];
      setProjects(rows.slice(0, 8).map((row, idx) => ({
        id: row.id !== null && row.id !== undefined ? Number(row.id) : idx + 1,
        name: String(row.name || `Project ${idx + 1}`),
        client: String(row.client || row.company || 'Unknown Client'),
        value: row.value !== null && row.value !== undefined ? Number(row.value) : 0,
        progress: row.progress !== null && row.progress !== undefined ? Number(row.progress) : 0,
        budgetRAG: (row.budgetRAG as 'red'|'amber'|'green') || 'green',
        programmeRAG: (row.programmeRAG as 'red'|'amber'|'green') || 'green',
        qualityRAG: (row.qualityRAG as 'red'|'amber'|'green') || 'green',
        daysToCompletion: row.daysToCompletion !== null && row.daysToCompletion !== undefined ? Number(row.daysToCompletion) : row.daysRemaining !== null && row.daysRemaining !== undefined ? Number(row.daysRemaining) : 0,
        pmInitials: String(row.pmInitials || row.projectManagerInitials || 'PM'),
      })));
    }).catch((err) => {
      console.error('Dashboard: Failed to fetch projects:', err);
    });
    notificationsApi.getAll().then((data: unknown) => {
      const rows = (data as { notifications: AnyRow[] }).notifications || [];
      const notifs = rows.slice(0, 12).map((row, i) => ({
        id: String(row.id || i),
        user: String(row.userName || row.createdBy || row.actor || 'System'),
        action: String(row.title || row.subject || row.message || 'Activity'),
        module: String(row.module || row.category || row.type || 'General'),
        time: String(row.createdAt ? (() => {
          try { const d = new Date(String(row.createdAt)); const m = Math.floor((Date.now()-d.getTime())/60000); return m<1?'Just now':m<60?`${m}m ago`:`${Math.floor(m/60)}h ago`; } catch { return 'Recently'; }
        })() : 'Recently'),
      }));
      setActivityFeed(notifs);
      const alertRows = rows.filter((r: AnyRow) => r.level==='amber'||r.level==='red'||r.type==='alert').slice(0,4).map((row: AnyRow) => ({
        id: String(row.id), level: (row.level as 'amber'|'red')||'amber',
        title: String(row.title||row.subject||'Notification'),
        description: String(row.message||row.description||''),
      }));
      setAlerts(alertRows.length ? alertRows : [{ id:'1', level:'amber' as const, title:'No active alerts', description:'All systems nominal' }]);
    }).catch((err) => {
      console.error('Dashboard: Failed to fetch notifications, using fallback data:', err);
      setActivityFeed([
        { id:'1', user:'Sarah Chen', action:'logged a safety near-miss', module:'Safety', time:'14m ago' },
        { id:'2', user:'James Miller', action:'raised CO-0285', module:'Commercial', time:'32m ago' },
        { id:'3', user:'Patricia Watson', action:'approved invoice INV-5847', module:'Finance', time:'1h ago' },
        { id:'4', user:'Michael Brown', action:'created RFI-1203', module:'Technical', time:'2h ago' },
        { id:'5', user:'Emma Wilson', action:'submitted daily report', module:'Site Ops', time:'3h ago' },
      ]);
      setAlerts([
        { id:'1', level:'amber' as const, title:'Schedule Variance', description:'Tech Hub Phase 2 — 12 days behind baseline' },
        { id:'2', level:'amber' as const, title:'Materials Watch', description:'Retail Centre — costs tracking 8% over budget' },
      ]);
    });
  }, []);

  const revenueData = revenueFromApi.length > 0 ? revenueFromApi : [
    { month:'Jan', revenue:0 }, { month:'Feb', revenue:0 },
    { month:'Mar', revenue:0 }, { month:'Apr', revenue:0 },
    { month:'May', revenue:0 }, { month:'Jun', revenue:0 },
  ];

  const kpis = useMemo(() => [
    { label:'Active\nProjects',  value: dashboardKpi?.activeProjects ?? 12,  icon: Briefcase,    accent:'#10b981', bg:'rgba(16,185,129,0.08)', border:'rgba(16,185,129,0.2)',  trend:'+2' },
    { label:'Total\nRevenue',     value: dashboardKpi?.totalRevenue ?? 1890000, icon: DollarSign,  accent:'#3b82f6', bg:'rgba(59,130,246,0.08)', border:'rgba(59,130,246,0.2)',  trend:'+23%' },
    { label:'Outstanding\nDebt',  value: dashboardKpi?.outstanding ?? 342000,   icon: AlertTriangle,accent:'#f59e0b', bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.2)', trend:'-8%' },
    { label:'Open\nRFIs',         value: dashboardKpi?.openRfis ?? 24,          icon: FileText,     accent:'#8b5cf6', bg:'rgba(139,92,246,0.08)', border:'rgba(139,92,246,0.2)', trend:'-5' },
    { label:'H&S\nScore',         value: dashboardKpi?.hsScore ?? 98,             icon: ShieldCheck,  accent:'#10b981', bg:'rgba(16,185,129,0.08)', border:'rgba(16,185,129,0.2)', trend:'+1.2%', suffix:'%' },
    { label:'Workforce\nToday',   value: dashboardKpi?.workforce ?? 143,           icon: Users,        accent:'#3b82f6', bg:'rgba(59,130,246,0.08)', border:'rgba(59,130,246,0.2)', trend:'+18' },
  ], [dashboardKpi]);

  const ragData = projectStatusData.length > 0 ? projectStatusData : [
    { name:'No Data', value:0, fill:'#334155' },
  ];

  const tabs = [
    { id:'overview',  label:'Overview' },
    { id:'projects',  label:'Projects' },
    { id:'finance',  label:'Finance' },
    { id:'safety',   label:'Safety' },
    { id:'activity', label:'Activity' },
  ];

  return (
    <div className="w-full min-w-0 space-y-6 pb-2">
      {/* ── Breadcrumbs ────────────────────────────────────────────── */}
      <ModuleBreadcrumbs currentModule="dashboard" />

      {/* ── Site Status Banner ─────────────────────────────────────── */}
      <SiteStatusBanner />

      <AISiteBriefPanel
        openRfis={aiBriefStats.openRfis}
        overdueRfis={aiBriefStats.overdueRfis}
        blockedTasks={aiBriefStats.blockedTasks}
        redBudgetProjects={aiBriefStats.redBudgetProjects}
        amberProgrammeProjects={aiBriefStats.amberProgrammeProjects}
        openSafetyItems={aiBriefStats.openSafetyItems}
        activeProjects={aiBriefStats.activeProjects}
      />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        className="dashboard-title-row flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-[rgba(13,17,23,0.55)] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-md md:flex-row md:items-start md:justify-between md:gap-6"
        style={{
          animation: mounted ? 'fadeSlideDown 0.5s ease forwards' : 'none',
          opacity: mounted ? 1 : 0,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#10b981', boxShadow: '0 0 8px #10b981',
              animation: 'livePulse 2s ease-in-out infinite',
            }} />
            <span style={{
              fontFamily: "'Fira Code', monospace", fontSize: '9px',
              color: '#10b981', letterSpacing: '0.15em', textTransform: 'uppercase',
            }}>
              Live Command Center
            </span>
          </div>
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', fontWeight: 800,
            color: '#f1f5f9', letterSpacing: '-0.04em', lineHeight: 1.1,
          }}>
            Site Overview
          </h1>
          <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            Real-time intelligence across all active projects
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
          <button className="btn btn-secondary flex items-center gap-2" style={{ fontSize: '12px', padding: '8px 14px' }}>
            <Download style={{ width: '13px', height: '13px' }} />
            Export
          </button>
          <button className="btn btn-secondary flex items-center gap-2" style={{ fontSize: '12px', padding: '8px 14px' }}>
            <RefreshCw style={{ width: '13px', height: '13px' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Bar ───────────────────────────────────────────────── */}
      <div
        className="kpi-grid grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        style={{
          animation: mounted ? 'fadeSlideDown 0.5s ease 0.1s forwards' : 'none',
          opacity: mounted ? 1 : 0,
        }}
      >
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              style={{
                position: 'relative',
                background: `linear-gradient(135deg, ${kpi.bg}, rgba(0,0,0,0.3))`,
                border: `1px solid ${kpi.border}`,
                borderRadius: '14px',
                padding: '14px 16px',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                animation: `fadeSlideUp 0.5s ease ${0.15 + idx * 0.06}s forwards`,
                opacity: 0,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${kpi.accent}15, 0 0 0 1px ${kpi.border}`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              }}
            >
              {/* Top glow line */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                background: `linear-gradient(90deg, transparent, ${kpi.accent}60, transparent)`,
              }} />

              {/* Corner accent */}
              <div style={{
                position: 'absolute', top: '8px', right: '8px',
                width: '20px', height: '20px', borderRadius: '6px',
                background: `${kpi.accent}10`, border: `1px solid ${kpi.accent}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon style={{ width: '10px', height: '10px', color: kpi.accent }} />
              </div>

              <div style={{ marginBottom: '10px', paddingTop: '2px' }}>
                <span style={{
                  fontFamily: "'Fira Code', monospace", fontSize: '9px',
                  color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase',
                  lineHeight: 1.4, display: 'block',
                }}>
                  {kpi.label}
                </span>
              </div>

              <div style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: '22px', fontWeight: 800,
                color: '#f1f5f9', lineHeight: 1, letterSpacing: '-0.03em',
              }}>
                {kpi.value >= 1000
                  ? fmtCurrency(kpi.value)
                  : <AnimatedCounter value={kpi.value} suffix={kpi.suffix || ''} />
                }
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                <TrendingUp style={{ width: '10px', height: '10px', color: '#10b981' }} />
                <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', color: '#10b981', fontWeight: 600 }}>
                  {kpi.trend}
                </span>
                <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', color: '#334155' }}>
                  vs last month
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Sub-tabs ───────────────────────────────────────────────── */}
      <div
        className="dashboard-tabs flex flex-wrap gap-1 rounded-xl border border-white/[0.06] bg-[rgba(13,17,23,0.45)] p-1"
        role="tablist"
        aria-label="Dashboard sections"
      >
        {tabs.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className="rounded-lg px-4 py-2 text-[13px] transition-all duration-200"
              style={{
                fontFamily: "'Instrument Sans', sans-serif",
                fontWeight: active ? 600 : 500,
                color: active ? '#0f172a' : '#64748b',
                background: active
                  ? 'linear-gradient(135deg, rgba(245,158,11,0.95), rgba(251,191,36,0.88))'
                  : 'transparent',
                border: active ? '1px solid rgba(245,158,11,0.35)' : '1px solid transparent',
                cursor: 'pointer',
                boxShadow: active ? '0 4px 14px rgba(245,158,11,0.2)' : 'none',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Row 1: Revenue Chart + RAG Donut + Alerts */}
          <div className="dashboard-overview-row grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_260px_300px]">

            {/* Revenue Area Chart */}
            <div style={{
              background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px', padding: '20px',
              backdropFilter: 'blur(12px)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
                    Revenue vs Cost
                  </h3>
                  <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', color: '#475569', letterSpacing: '0.1em' }}>
                    LAST 6 MONTHS
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {[['#10b981','Revenue'],['#ef4444','Cost']].map(([c, l]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: c }} />
                      <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', color: '#64748b' }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ height: '180px', minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minHeight={180}>
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" verticalPoints={[60,120,180]} />
                    <XAxis dataKey="month" tick={{ fontFamily:'JetBrains Mono', fontSize:9, fill:'#475569' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontFamily:'JetBrains Mono', fontSize:9, fill:'#475569' }} axisLine={false} tickLine={false} tickFormatter={v => `£${(v/1000).toFixed(0)}K`} width={48} />
                    <Tooltip
                      contentStyle={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:8, fontFamily:'JetBrains Mono', fontSize:11 }}
                      formatter={(v) => [`£${(v as number).toLocaleString()}`, '']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#gRev)" dot={false} activeDot={{ r:4, fill:'#10b981' }} />
                    <Area type="monotone" dataKey="cost" stroke="#ef4444" strokeWidth={2} fill="url(#gCost)" dot={false} activeDot={{ r:4, fill:'#ef4444' }} strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Project Status RAG */}
            <div style={{
              background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px', padding: '20px',
              backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              <div style={{ marginBottom: '12px', textAlign: 'center' }}>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
                  Project Status
                </h3>
                <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', color: '#475569', letterSpacing: '0.1em' }}>
                  LIVE RAG ANALYSIS
                </span>
              </div>
              <RAGDonut data={ragData} />
              <div style={{ marginTop: '14px', width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ragData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.fill, boxShadow: `0 0 4px ${d.fill}` }} />
                      <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: '11px', color: '#94a3b8' }}>{d.name}</span>
                    </div>
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Alerts */}
            <div style={{
              background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px', padding: '20px',
              backdropFilter: 'blur(12px)',
            }}>
              <div style={{ marginBottom: '14px' }}>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
                  Active Alerts
                </h3>
                <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', color: '#475569', letterSpacing: '0.1em' }}>
                  REQUIRE ATTENTION
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {alerts.map(a => (
                  <div key={a.id} style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: a.level === 'red' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                    border: `1px solid ${a.level === 'red' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
                    borderLeft: `3px solid ${a.level === 'red' ? '#ef4444' : '#f59e0b'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <AlertTriangle style={{ width: '10px', height: '10px', color: a.level === 'red' ? '#ef4444' : '#f59e0b' }} />
                      <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: '11px', fontWeight: 600, color: a.level === 'red' ? '#ef4444' : '#f59e0b' }}>
                        {a.title}
                      </span>
                    </div>
                    <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: '11px', color: '#64748b', margin: 0 }}>
                      {a.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Project Pipeline */}
          <div style={{
            background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px', padding: '20px',
            backdropFilter: 'blur(12px)',
          }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
                Project Pipeline
              </h3>
              <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', color: '#475569', letterSpacing: '0.1em' }}>
                LIVE PROJECT REGISTER
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {projects.slice(0, 6).map((proj, i) => (
                <div
                  key={proj.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '180px 1fr 80px 60px',
                    gap: '14px',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.04)',
                    animation: `fadeIn 0.4s ease ${i * 0.05}s forwards`,
                    opacity: 0,
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(245,158,11,0.04)';
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(245,158,11,0.15)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)';
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.04)';
                  }}
                >
                  <div>
                    <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: '12px', fontWeight: 600, color: '#f1f5f9', marginBottom: '2px' }}>{proj.name}</p>
                    <p style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', color: '#475569' }}>{proj.client}</p>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', color: '#475569' }}>Progress</span>
                      <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', fontWeight: 600, color: '#94a3b8' }}>{proj.progress}%</span>
                    </div>
                    <ProgBar value={proj.progress} color={proj.budgetRAG === 'green' ? '#10b981' : proj.budgetRAG === 'amber' ? '#f59e0b' : '#ef4444'} />
                  </div>
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                    {[['B', proj.budgetRAG],['P', proj.programmeRAG],['Q', proj.qualityRAG]].map(([l, rag]) => (
                      <div key={String(l)} style={{
                        width: '18px', height: '18px', borderRadius: '4px',
                        background: `${RAG_COLORS[rag as keyof typeof RAG_COLORS]}15`,
                        border: `1px solid ${RAG_COLORS[rag as keyof typeof RAG_COLORS]}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: "'Fira Code', monospace", fontSize: '8px', fontWeight: 700,
                        color: RAG_COLORS[rag as keyof typeof RAG_COLORS],
                      }} title={`${l}: ${rag}`}>
                        {l}
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '12px', fontWeight: 700, color: '#10b981' }}>
                      {proj.daysToCompletion > 0 ? `${proj.daysToCompletion}d` : '—'}
                    </span>
                    <p style={{ fontFamily: "'Fira Code', monospace", fontSize: '8px', color: '#334155' }}>remaining</p>
                  </div>
                </div>
              ))}
              {projects.length === 0 && (
                <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: '13px', color: '#475569', textAlign: 'center', padding: '20px' }}>
                  No projects available
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE INTEL ROW (always visible below tabs) ─────────────── */}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
        <QuickStats />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <RFITimeline
            rfis={rfis.slice(0, 5).map((r) => {
              const row = r as AnyRow;
              const statusRaw = String(row.status ?? 'OPEN');
              const status = statusRaw === 'OVERDUE' ? 'OPEN' : statusRaw;
              const dueRaw = row.dueDate;
              const dueDate =
                dueRaw !== undefined && dueRaw !== null && (typeof dueRaw === 'string' || typeof dueRaw === 'number')
                  ? String(dueRaw)
                  : undefined;
              return {
                id: String(row.id ?? ''),
                number: String(row.number ?? row.rfiNumber ?? ''),
                title: String(row.title ?? row.subject ?? ''),
                status: status as 'OPEN' | 'ANSWERED' | 'CLOSED',
                dueDate,
                createdAt: String(row.createdAt ?? ''),
              };
            })}
          />
          {/* Activity Feed */}
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body p-4">
              <h3 className="card-title text-sm">Recent Activity</h3>
              <ActivityFeed limit={5} />
            </div>
          </div>
        </div>
        <TaskList
          tasks={tasks.slice(0, 6).map((t) => {
            const row = t as AnyRow;
            const assigneeRaw = row.assignee;
            const assigneeObj =
              assigneeRaw && typeof assigneeRaw === 'object' && assigneeRaw !== null
                ? (assigneeRaw as Record<string, unknown>)
                : undefined;
            const assigneeName =
              assigneeObj && typeof assigneeObj.name === 'string' ? assigneeObj.name : undefined;
            const taskDueRaw = row.dueDate;
            const dueDate =
              taskDueRaw !== undefined &&
              taskDueRaw !== null &&
              (typeof taskDueRaw === 'string' || typeof taskDueRaw === 'number')
                ? String(taskDueRaw)
                : undefined;
            return {
              id: String(row.id ?? ''),
              title: String(row.title ?? ''),
              status: row.status as 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETE' | 'BLOCKED',
              priority: row.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
              dueDate,
              assignee: assigneeName ? { name: assigneeName } : undefined,
            };
          })}
          onViewAll={() => {}}
        />
      </div>

      {/* AI Chat toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
        <WebSocketStatus />
        <button
          onClick={() => setShowAIChat(p => !p)}
          style={{
            background: showAIChat ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.08)',
            border: '1px solid rgba(249,115,22,0.3)',
            borderRadius: '8px', padding: '8px 14px', fontSize: '12px',
            color: '#f97316', cursor: 'pointer', fontFamily: "'Instrument Sans', sans-serif",
          }}
        >
          {showAIChat ? 'Hide AI Assistant' : '🤖 AI Assistant'}
        </button>
      </div>
      {showAIChat && (
        <AIAvatar projectId={liveProjects.length > 0 ? String(liveProjects[0].id) : undefined} />
      )}

      {/* ── PROJECTS TAB ────────────────────────────────────────────── */}
      {activeTab === 'projects' && (
        <div className="space-y-5">
          {/* Live project cards from API */}
          {liveProjects.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
              {liveProjects.slice(0, 6).map((proj: AnyRow) => (
                <ProjectCard
                  key={String(proj.id)}
                  project={{
                    id: String(proj.id),
                    name: String(proj.name),
                    status: (proj.status as 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED') || 'PLANNING',
                    location: proj.location ? String(proj.location) : undefined,
                    budget: proj.budget ? Number(proj.budget) : undefined,
                    startDate: proj.startDate ? String(proj.startDate) : undefined,
                    endDate: proj.endDate ? String(proj.endDate) : undefined,
                    progress: Number.isFinite(Number(proj.progress))
                      ? Number(proj.progress)
                      : 0,
                    teamSize: proj.teamSize ? Number(proj.teamSize) : undefined,
                  }}
                />
              ))}
            </div>
          )}
          <div style={{
            background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px', padding: '24px',
            backdropFilter: 'blur(12px)',
          }}>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '16px', fontWeight: 700, color: '#f1f5f9', marginBottom: '16px' }}>
              Project Health Overview
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {projects.map((proj, i) => (
                <div
                  key={proj.id}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '14px', padding: '16px',
                    animation: `fadeIn 0.4s ease ${i * 0.06}s forwards`,
                    opacity: 0,
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(245,158,11,0.3)';
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(245,158,11,0.03)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)';
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '13px', fontWeight: 700, color: '#f1f5f9', marginBottom: '2px' }}>{proj.name}</p>
                      <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: '11px', color: '#64748b' }}>{proj.client}</p>
                    </div>
                    <div style={{
                      padding: '3px 8px', borderRadius: '6px',
                      background: `${RAG_COLORS[proj.budgetRAG]}15`, border: `1px solid ${RAG_COLORS[proj.budgetRAG]}30`,
                    }}>
                      <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', fontWeight: 700, color: RAG_COLORS[proj.budgetRAG] }}>
                        {proj.budgetRAG.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', color: '#475569' }}>Progress</span>
                      <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', fontWeight: 600, color: '#94a3b8' }}>{proj.progress}%</span>
                    </div>
                    <ProgBar value={proj.progress} color="#3b82f6" />
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                    {[['Budget', proj.budgetRAG],['Programme', proj.programmeRAG],['Quality', proj.qualityRAG]].map(([l, rag]) => (
                      <div key={String(l)} style={{
                        flex: 1, padding: '5px 4px', borderRadius: '7px', textAlign: 'center',
                        background: `${RAG_COLORS[rag as keyof typeof RAG_COLORS]}12`,
                        border: `1px solid ${RAG_COLORS[rag as keyof typeof RAG_COLORS]}30`,
                      }}>
                        <p style={{ fontFamily: "'Fira Code', monospace", fontSize: '7px', color: '#475569', letterSpacing: '0.05em', marginBottom: '2px' }}>{String(l).toUpperCase()}</p>
                        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', fontWeight: 700, color: RAG_COLORS[rag as keyof typeof RAG_COLORS] }}>
                          {rag === 'green' ? '✓' : rag === 'amber' ? '~' : '!'}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '14px', fontWeight: 700, color: '#10b981' }}>{fmtCurrency(proj.value)}</span>
                    <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', color: '#475569' }}>
                      {proj.daysToCompletion > 0 ? `${proj.daysToCompletion}d left · ` : ''}<span style={{ color: '#f59e0b' }}>{proj.pmInitials}</span>
                    </span>
                  </div>
                </div>
              ))}
              {projects.length === 0 && (
                <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: '13px', color: '#475569', textAlign: 'center', padding: '40px' }}>
                  No projects available
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── FINANCE TAB ────────────────────────────────────────────── */}
      {activeTab === 'finance' && (
        <div className="space-y-5">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label:'Total Revenue',   value:'£1,890,000', accent:'#10b981', icon:DollarSign },
              { label:'Total Costs',     value:'£1,142,000', accent:'#ef4444', icon:TrendingDown },
              { label:'Gross Profit',    value:'£748,000',   accent:'#3b82f6', icon:TrendingUp },
              { label:'Net Margin',      value:'39.6%',      accent:'#10b981', icon:Activity },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={item.label} style={{
                  background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '14px', padding: '16px',
                  animation: `fadeIn 0.4s ease ${i * 0.07}s forwards`, opacity: 0,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', color: '#475569', letterSpacing: '0.1em' }}>{item.label.toUpperCase()}</span>
                    <Icon style={{ width: '14px', height: '14px', color: item.accent }} />
                  </div>
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>{item.value}</p>
                </div>
              );
            })}
          </div>

          <div style={{
            background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px', padding: '24px',
            backdropFilter: 'blur(12px)',
          }}>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '16px' }}>
              Monthly Cash Flow
            </h3>
            <div style={{ height: '220px', minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" tick={{ fontFamily:'JetBrains Mono', fontSize:9, fill:'#475569' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontFamily:'JetBrains Mono', fontSize:9, fill:'#475569' }} axisLine={false} tickLine={false} tickFormatter={v => `£${(v/1000).toFixed(0)}K`} width={52} />
                  <Tooltip contentStyle={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:8, fontFamily:'JetBrains Mono', fontSize:11 }} formatter={(v) => [`£${(v as number).toLocaleString()}`, '']} />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="cost" fill="#ef4444" radius={[4,4,0,0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Aged Debt */}
          <div style={{
            background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px', padding: '24px',
            backdropFilter: 'blur(12px)',
          }}>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '16px' }}>
              Aged Debt Analysis
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { label:'0–30 days',   value:145000, color:'#10b981' },
                { label:'31–60 days', value:89000,  color:'#f59e0b' },
                { label:'61–90 days', value:56000,  color:'#f97316' },
                { label:'90+ days',   value:95000,  color:'#ef4444' },
              ].map(item => (
                <div key={item.label} style={{
                  padding: '16px', borderRadius: '12px', textAlign: 'center',
                  background: `${item.color}08`, border: `1px solid ${item.color}25`,
                }}>
                  <p style={{ fontFamily: "'Fira Code', monospace", fontSize: '8px', color: '#475569', letterSpacing: '0.1em', marginBottom: '6px' }}>{item.label}</p>
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', fontWeight: 800, color: item.color }}>{fmtCurrency(item.value)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SAFETY TAB ────────────────────────────────────────────── */}
      {activeTab === 'safety' && (
        <div className="space-y-5">
          {/* Live safety stats from API */}
          <SafetyStats stats={{
            totalIncidents: safetyList.length,
            openIncidents: safetyList.filter((i) => i.status === 'REPORTED' || i.status === 'INVESTIGATING').length,
            resolvedIncidents: safetyList.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').length,
            daysSinceLastIncident: 187,
            safetyScore: 98,
            toolboxTalksCompleted: 34,
            toolboxTalksTotal: 36,
            toolChecksPassed: 142,
            toolChecksTotal: 150,
            activeWorkers: 143,
            incidentsBySeverity: {
              LOW: safetyList.filter((i) => i.severity === 'LOW').length,
              MEDIUM: safetyList.filter((i) => i.severity === 'MEDIUM').length,
              HIGH: safetyList.filter((i) => i.severity === 'HIGH').length,
              CRITICAL: safetyList.filter((i) => i.severity === 'CRITICAL').length,
            },
          }} />
          {/* Existing detailed panel */}
          <SafetyStatsPanel
            data={{
              daysSinceIncident: safetyList.filter((i) => i.status === 'REPORTED').length === 0 ? 187 : 0,
              activeRAMS: 34, openObservations: 12, nearMissReports: 8,
              ppeCompliance: 97, inspectionsPassed: 94, siteStatus: 'GREEN',
              lastCheck: new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }) + ' GMT',
              incidentTrend: [
                { day: 'Mon', incidents: 1, observations: 3 },
                { day: 'Tue', incidents: 0, observations: 2 },
                { day: 'Wed', incidents: 2, observations: 5 },
                { day: 'Thu', incidents: 0, observations: 1 },
                { day: 'Fri', incidents: 1, observations: 4 },
                { day: 'Sat', incidents: 0, observations: 2 },
                { day: 'Sun', incidents: 0, observations: 1 },
              ],
              daysSinceSpark: [165, 170, 175, 178, 182, 185, 187],
              ramsSpark: [28, 30, 29, 31, 32, 33, 34],
              observationsSpark: [18, 16, 15, 14, 13, 13, 12],
              nearMissSpark: [12, 11, 10, 10, 9, 9, 8],
              ppeSpark: [94, 95, 95, 96, 96, 96, 97],
              inspectionsSpark: [90, 91, 91, 92, 93, 93, 94],
            } as SafetyStatsData}
          />
        </div>
      )}

      {/* ── ACTIVITY TAB ───────────────────────────────────────────── */}
      {activeTab === 'activity' && (
        <div style={{
          background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '24px',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>
                Live Activity Feed
              </h3>
              <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', color: '#475569', letterSpacing: '0.1em' }}>
                REAL-TIME SITE EVENTS
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CircleDot style={{ width: '8px', height: '8px', color: '#10b981', animation:'livePulse 2s ease-in-out infinite' }} />
              <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '9px', color: '#10b981', letterSpacing: '0.1em' }}>LIVE</span>
            </div>
          </div>
          <div>
            {activityFeed.map((item, i) => (
              <ActivityItem key={item.id} {...item} accent="#f59e0b" delay={i * 60} />
            ))}
            {activityFeed.length === 0 && (
              <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: '13px', color: '#475569', textAlign: 'center', padding: '40px' }}>
                No activity available
              </p>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
export const Dashboard = React.memo(DashboardComponent);
export default Dashboard;
