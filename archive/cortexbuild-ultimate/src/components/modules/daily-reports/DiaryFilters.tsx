import { Search, Brain, Loader2, AlertTriangle } from 'lucide-react';

/**
 * Report/project data from the generic CRUD router.
 * apiFetch camelizes all responses, so runtime keys are camelCase (e.g., projectId, reportDate).
 * Using AnyRow accommodates the untyped data from the parent component.
 */
type AnyRow = Record<string, unknown>;

type DiaryFiltersProps = {
  search: string;
  onSearchChange: (v: string) => void;
  projectFilter: string;
  onProjectFilterChange: (v: string) => void;
  dateFrom: string;
  onDateFromChange: (v: string) => void;
  dateTo: string;
  onDateToChange: (v: string) => void;
  filteredLength: number;
  aiLoading: boolean;
  aiError?: string | null;
  onSummarize: () => void;
  projects: AnyRow[];
};

export function DiaryFilters({
  search,
  onSearchChange,
  projectFilter,
  onProjectFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  filteredLength,
  aiLoading,
  aiError,
  onSummarize,
  projects,
}: DiaryFiltersProps) {
  const safeProjects = projects ?? [];
  if (projects === null && import.meta.env.DEV) {
    console.warn('[DiaryFilters] projects prop is null/undefined — this should not happen');
  }

  return (
    <div className="flex flex-wrap gap-3 items-center bg-gray-800 rounded-xl border border-gray-700 p-4">
      <div className="relative flex-1 min-w-48">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search date or work description..."
          className="input input-bordered input-sm w-full pl-9 bg-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <select
        value={projectFilter}
        onChange={e => onProjectFilterChange(e.target.value)}
        className="select select-bordered select-sm bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
      >
        <option value="all">All Projects</option>
        {safeProjects.map(p => (
          <option key={String(p.id)} value={String(p.id)}>
            {String(p.name ?? p.title ?? '— data missing —')}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={dateFrom}
          onChange={e => onDateFromChange(e.target.value)}
          className="input input-bordered input-sm bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          title="From date"
        />
        <span className="text-gray-500 text-xs">–</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => onDateToChange(e.target.value)}
          className="input input-bordered input-sm bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          title="To date"
        />
      </div>

      <span className="text-sm text-gray-400 ml-auto">{filteredLength} reports</span>

      <div className="flex flex-col items-end">
        <button
          type="button"
          onClick={onSummarize}
          disabled={aiLoading}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
          AI Summary
        </button>
        {aiError && (
          <p className="text-xs text-red-400 mt-1 flex items-center gap-1" role="alert">
            <AlertTriangle size={12} />
            {aiError}
          </p>
        )}
      </div>
    </div>
  );
}