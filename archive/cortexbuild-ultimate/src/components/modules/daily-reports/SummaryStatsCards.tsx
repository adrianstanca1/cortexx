import { Calendar, ClipboardList, Users, AlertTriangle } from 'lucide-react';

/**
 * Report data from the generic CRUD router.
 * apiFetch camelizes all responses, so runtime keys are camelCase.
 * Using AnyRow matches the parent component's convention.
 */
type AnyRow = Record<string, unknown>;

type SummaryStatsCardsProps = {
  thisWeekCount: number;
  draftCount: number;
  averageWorkersPerDay: number;
  projectsWithoutReport: AnyRow[];
  isLoading?: boolean;
  error?: string | null;
};

export function SummaryStatsCards({
  thisWeekCount,
  draftCount,
  averageWorkersPerDay,
  projectsWithoutReport,
  isLoading,
  error,
}: SummaryStatsCardsProps) {
  if (error) {
    return (
      <div className="bg-gray-800 rounded-xl border border-red-500/30 p-4 text-red-400" role="alert">
        Failed to load summary stats: {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-gray-800 rounded-xl border border-gray-700 p-4 animate-pulse">
            <div className="h-12 bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const safeProjectsWithoutReport = projectsWithoutReport ?? [];
  const safeAvgWorkers = Number.isFinite(averageWorkersPerDay)
    ? Math.round(averageWorkersPerDay * 10) / 10
    : '--';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        {
          label: 'This Week',
          value: thisWeekCount,
          icon: Calendar,
          colour: 'text-blue-400',
          bg: 'bg-blue-500/10 border-blue-500/30',
        },
        {
          label: 'Draft Reports',
          value: draftCount,
          icon: ClipboardList,
          colour: 'text-yellow-400',
          bg: 'bg-yellow-500/10 border-yellow-500/30',
        },
        {
          label: 'Avg Workers/Day',
          value: safeAvgWorkers,
          icon: Users,
          colour: 'text-green-400',
          bg: 'bg-green-500/10 border-green-500/30',
        },
        {
          label: 'No Report Today',
          value: safeProjectsWithoutReport.length,
          icon: AlertTriangle,
          colour: safeProjectsWithoutReport.length > 0 ? 'text-red-400' : 'text-gray-400',
          bg: safeProjectsWithoutReport.length > 0
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-gray-500/10 border-gray-500/30',
        },
      ].map(kpi => (
        <div key={kpi.label} className={`bg-gray-800 rounded-xl border ${kpi.bg} p-4`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-700">
              <kpi.icon size={20} className={kpi.colour} />
            </div>
            <div>
              <p className="text-xs text-gray-400">{kpi.label}</p>
              <p className="text-xl font-bold text-white">{kpi.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}