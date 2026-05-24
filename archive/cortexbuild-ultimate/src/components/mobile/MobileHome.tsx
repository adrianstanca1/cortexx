import { FileText, AlertTriangle, Camera, Clock, Package, Users, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { type Module } from '../../types';
import { getToken } from '../../lib/auth-storage';
import { buildAISiteBrief } from '../../lib/aiSiteBrief';

interface QuickAction {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  module: Module;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Daily Report', icon: FileText,      module: 'daily-reports', color: 'bg-emerald-600' },
  { label: 'Safety',       icon: AlertTriangle, module: 'safety',        color: 'bg-red-600' },
  { label: 'Timesheet',    icon: Clock,         module: 'timesheets',    color: 'bg-indigo-600' },
  { label: 'Materials',    icon: Package,       module: 'procurement',   color: 'bg-amber-600' },
  { label: 'Team',         icon: Users,         module: 'teams',         color: 'bg-cyan-600' },
  { label: 'Photos',       icon: Camera,        module: 'documents',     color: 'bg-purple-600' },
];

interface MobileHomeProps {
  onNavigate: (module: Module) => void;
}

interface MobileSummary {
  tasks: number;
  permits: number;
  hours: number;
  defects: number;
}

export function MobileHome({ onNavigate }: MobileHomeProps) {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  const { data: summary, isLoading } = useQuery<MobileSummary>({
    queryKey: ['mobile-summary'],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch('/api/mobile/summary', {
        credentials: 'include',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error('Failed to load mobile summary');
      return res.json() as Promise<MobileSummary>;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const stats = [
    { label: 'Tasks',   value: isLoading ? '…' : String(summary?.tasks   ?? '—'), color: 'text-blue-400' },
    { label: 'Permits', value: isLoading ? '…' : String(summary?.permits ?? '—'), color: 'text-amber-400' },
    { label: 'Logged',  value: isLoading ? '…' : `${summary?.hours ?? 0}h`,       color: 'text-emerald-400' },
    { label: 'Defects', value: isLoading ? '…' : String(summary?.defects ?? '—'), color: 'text-red-400' },
  ];

  const mobileBrief =
    !isLoading && summary
      ? buildAISiteBrief({
          openRfis: 0,
          overdueRfis: 0,
          blockedTasks: 0,
          redBudgetProjects: 0,
          amberProgrammeProjects: 0,
          openSafetyItems: 0,
          activeProjects: 1,
          mobileOutstandingTasks: summary.tasks,
          mobileOpenDefects: summary.defects,
        })
      : null;

  return (
    <div className="p-4 space-y-4">
      {mobileBrief && (
        <button
          type="button"
          onClick={() => onNavigate(mobileBrief.signals[0]?.navigateTo ?? 'ai-assistant')}
          className="w-full text-left bg-gradient-to-br from-violet-950/80 to-slate-900 border border-violet-500/25 rounded-2xl p-4 active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-2 text-violet-300 text-[10px] uppercase tracking-widest mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            AI shift brief
          </div>
          <div className="text-white font-semibold text-sm leading-snug">{mobileBrief.headline}</div>
          <div className="text-slate-400 text-xs mt-1 line-clamp-2">{mobileBrief.signals[0]?.detail ?? mobileBrief.subline}</div>
        </button>
      )}

      <div className="bg-slate-800 rounded-2xl p-4">
        <div className="text-slate-400 text-[10px] uppercase tracking-widest mb-3">Today · {today}</div>
        <div className="grid grid-cols-2 gap-2">
          {stats.map(({ label, value, color }) => (
            <div key={label} className="bg-slate-900 rounded-xl p-3 text-center">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-slate-400 text-xs mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-slate-400 text-[10px] uppercase tracking-widest mb-2">Quick actions</div>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_ACTIONS.map(({ label, icon: Icon, module, color }) => (
            <button
              type="button"
              key={module}
              onClick={() => onNavigate(module)}
              className="bg-slate-800 rounded-xl p-3 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
            >
              <div className={`w-9 h-9 ${color} rounded-lg flex items-center justify-center`}>
                <Icon size={18} className="text-white" />
              </div>
              <span className="text-slate-300 text-[10px] text-center leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
