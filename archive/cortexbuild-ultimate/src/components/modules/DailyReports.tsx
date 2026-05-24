import { useState, useRef } from 'react';
import {
  ClipboardList, Plus, CloudRain, Sun, Cloud, Wind, CloudSnow, CloudFog, CloudLightning, Users, Edit2,
  Trash2, X, ChevronDown, ChevronUp, AlertTriangle, Download, FileText,
  Camera, Brain, CheckCircle2, CheckSquare, Square, Loader2
} from 'lucide-react';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { EmptyState } from '../ui/EmptyState';
import { useProjects, useDailyReports } from '../../hooks/useData';
import { aiSummarizeApi } from '../../services/api';
import { toast } from 'sonner';
import { API_BASE } from '@/lib/auth-storage';
import { SummaryStatsCards } from './daily-reports/SummaryStatsCards';
import { DiaryFilters } from './daily-reports/DiaryFilters';
import { WeatherWidget } from './daily-reports/WeatherWidget';

type AnyRow = Record<string, unknown>;

const WEATHER_OPTIONS = ['Sunny', 'Partly Cloudy', 'Overcast', 'Light Rain', 'Heavy Rain', 'Fog', 'High Wind', 'Snow', 'Frost'];
const STATUS_OPTIONS = ['Draft', 'Submitted', 'Approved'];

const statusColour: Record<string, string> = {
  'Draft': 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  'Submitted': 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  'Approved': 'bg-green-500/20 text-green-300 border border-green-500/30',
};

const weatherIcon = (w: string) => {
  const l = w.toLowerCase();
  if (l.includes('rain') || l.includes('drizzle') || l.includes('shower')) return <CloudRain size={16} className="text-blue-400" />;
  if (l.includes('sun') || l.includes('clear')) return <Sun size={16} className="text-yellow-400" />;
  if (l.includes('wind') || l.includes('gale')) return <Wind size={16} className="text-gray-400" />;
  if (l.includes('snow') || l.includes('frost') || l.includes('ice')) return <CloudSnow size={16} className="text-blue-200" />;
  if (l.includes('fog') || l.includes('mist')) return <CloudFog size={16} className="text-gray-300" />;
  if (l.includes('thunder') || l.includes('storm')) return <CloudLightning size={16} className="text-purple-400" />;
  return <Cloud size={16} className="text-gray-400" />;
};

const emptyForm = {
  report_date: '',
  project_id: '',
  weather: 'Sunny',
  temperature: '',
  workers_on_site: '',
  plant_equipment: '',
  visitors: '',
  work_carried_out: '',
  work_planned_tomorrow: '',
  issues_delays: '',
  safety_notes: '',
  materials_delivered: '',
  subcontractors: '',
  status: 'Draft',
  submitted_by: '',
};

export function DailyReports() {
  const { useList: useProjectsList } = useProjects;
  const { useList, useCreate, useUpdate, useDelete } = useDailyReports;

  const { data: rawProjects = [] } = useProjectsList();
  const { data: raw = [], isLoading, error: listError } = useList();

  const projects = rawProjects as AnyRow[];
  const reports = raw as AnyRow[];

  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [mainTab, setMainTab] = useState<'diary' | 'weather' | 'photos' | 'summary'>('diary');
  const [diarySubTab, setDiarySubTab] = useState<'today' | 'week' | 'all' | 'drafts'>('today');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [weatherProjectFilter, setWeatherProjectFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailView, setDetailView] = useState<AnyRow | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryStats, setAiSummaryStats] = useState<{count: number; avgWorkers: number; weatherSummary: string} | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} item(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} item(s)`);
      clearSelection();
    } catch (err) {
      console.error('[DailyReports] Bulk delete failed:', err);
      toast.error('Bulk delete failed');
    }
  }

  async function handleSummarizeReports() {
    setAiLoading(true);
    setAiError(null);
    setSummaryExpanded(true);
    try {
      const res = await aiSummarizeApi.summarizeDailyReports();
      setAiSummary(res.summary);
      setAiSummaryStats({ count: res.count, avgWorkers: res.avgWorkers, weatherSummary: res.weatherSummary });
      toast.success('Daily reports summary generated');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate AI summary';
      setAiError(msg);
      toast.error(msg);
    } finally {
      setAiLoading(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  const filtered = reports.filter(r => {
    const date = String(r.report_date ?? '');
    const projectId = String(r.project_id ?? '');
    const work = String(r.work_carried_out ?? '').toLowerCase();

    const matchSearch = date.includes(search) || work.includes(search.toLowerCase());
    const matchProject = projectFilter === 'all' || projectId === projectFilter;
    const matchStatus = diarySubTab === 'drafts' ? r.status === 'Draft' : true;
    const matchDateFrom = !dateFrom || date >= dateFrom;
    const matchDateTo = !dateTo || date <= dateTo;

    if (!matchSearch || !matchProject || !matchStatus || !matchDateFrom || !matchDateTo) return false;

    if (diarySubTab === 'today') return date === today;
    if (diarySubTab === 'week') {
      const diff = (Date.now() - new Date(date).getTime()) / 86400000;
      return diff >= 0 && diff <= 7;
    }
    return true; // 'all'
  });

  const thisWeekCount = reports.filter(r => {
    const d = new Date(String(r.report_date ?? ''));
    const diff = (Date.now() - d.getTime()) / 86400000;
    return diff >= 0 && diff <= 7;
  }).length;

  const draftCount = reports.filter(r => r.status === 'Draft').length;
  const totalWorkerDays = reports.reduce((s, r) => s + Number(r.workers_on_site ?? 0), 0);
  const projectsWithoutReport = projects.filter(p => {
    const hasReport = reports.some(r => String(r.project_id ?? '') === String(p.id) && String(r.report_date ?? '') === today);
    return !hasReport && !['Completed', 'Cancelled'].includes(String(p.status ?? ''));
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, report_date: today });
    setShowModal(true);
  }

  function openEdit(r: AnyRow) {
    setEditing(r);
    setForm({
      report_date: String(r.report_date ?? ''),
      project_id: String(r.project_id ?? ''),
      weather: String(r.weather ?? 'Sunny'),
      temperature: String(r.temperature ?? ''),
      workers_on_site: String(r.workers_on_site ?? ''),
      plant_equipment: String(r.plant_equipment ?? ''),
      visitors: String(r.visitors ?? ''),
      work_carried_out: String(r.work_carried_out ?? ''),
      work_planned_tomorrow: String(r.work_planned_tomorrow ?? ''),
      issues_delays: String(r.issues_delays ?? ''),
      safety_notes: String(r.safety_notes ?? ''),
      materials_delivered: String(r.materials_delivered ?? ''),
      subcontractors: String(r.subcontractors ?? ''),
      status: String(r.status ?? 'Draft'),
      submitted_by: String(r.submitted_by ?? ''),
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      workers_on_site: form.workers_on_site !== '' ? Number(form.workers_on_site) : 0,
      temperature: form.temperature !== '' ? Number(form.temperature) : null,
    };

    if (editing) {
      await updateMutation.mutateAsync({ id: String(editing.id), data: payload });
      toast.success('Report updated');
    } else {
      await createMutation.mutateAsync(payload);
      toast.success('Report submitted');
    }
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this daily report?')) return;
    await deleteMutation.mutateAsync(id);
    toast.success('Report deleted');
  }

  async function submitReport(r: AnyRow) {
    await updateMutation.mutateAsync({ id: String(r.id), data: { status: 'Submitted' } });
    toast.success('Report submitted for approval');
  }

  const getProjectName = (projectId: string) => {
    const proj = projects.find(p => String(p.id) === projectId);
    return String(proj?.name ?? proj?.title ?? 'Unknown Project');
  };

  const averageWorkersPerDay = reports.length > 0 ? Math.round(totalWorkerDays / reports.length) : 0;

  return (
    <>
      <ModuleBreadcrumbs currentModule="daily-reports" />
      <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display text-white">Daily Site Reports</h1>
          <p className="text-sm text-gray-400 mt-1">Daily progress, weather & site records</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          <span>New Report</span>
        </button>
      </div>

      {/* Summary Stats */}
      <SummaryStatsCards
        thisWeekCount={thisWeekCount}
        draftCount={draftCount}
        averageWorkersPerDay={averageWorkersPerDay}
        projectsWithoutReport={projectsWithoutReport}
        isLoading={isLoading}
        error={listError?.message}
      />

      {/* Main Tabs */}
      <div className="border-b border-gray-700 flex gap-1 cb-table-scroll touch-pan-x">
        {[
          { key: 'diary' as const, label: 'Site Diary', icon: ClipboardList },
          { key: 'weather' as const, label: 'Weather Log', icon: Cloud },
          { key: 'photos' as const, label: 'Progress Photos', icon: Camera },
          { key: 'summary' as const, label: 'AI Summary', icon: Brain },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setMainTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                mainTab === t.key ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Conditional Content */}
      {mainTab === 'diary' && (
        <>
          {/* Diary Sub Tabs */}
          <div className="border-b border-gray-700 flex gap-1 cb-table-scroll touch-pan-x">
            {[
              { key: 'today' as const, label: 'Today', count: reports.filter(r => String(r.report_date ?? '') === today).length },
              { key: 'week' as const, label: 'This Week', count: thisWeekCount },
              { key: 'drafts' as const, label: 'Drafts', count: draftCount },
              { key: 'all' as const, label: 'All Reports', count: reports.length },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setDiarySubTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  diarySubTab === t.key ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                {t.label}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    t.key === 'drafts'
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Filters */}
          <DiaryFilters
            search={search}
            onSearchChange={setSearch}
            projectFilter={projectFilter}
            onProjectFilterChange={setProjectFilter}
            dateFrom={dateFrom}
            onDateFromChange={setDateFrom}
            dateTo={dateTo}
            onDateToChange={setDateTo}
            filteredLength={filtered.length}
            aiLoading={aiLoading}
            aiError={aiError}
            onSummarize={handleSummarizeReports}
            projects={projects}
          />
        </>
      )}

      {/* AI Summary Panel */}
      {summaryExpanded && (
        <div className="bg-purple-900/10 border border-purple-500/30 rounded-xl overflow-hidden">
          <button
            onClick={() => setSummaryExpanded(false)}
            className="w-full flex items-center justify-between p-4 hover:bg-purple-900/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-purple-400" />
              <span className="text-sm font-medium text-purple-300">AI Daily Reports Summary</span>
              {aiSummaryStats && (
                <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                  {aiSummaryStats.count} reports · avg {aiSummaryStats.avgWorkers} workers · {aiSummaryStats.weatherSummary}
                </span>
              )}
            </div>
            <ChevronUp size={14} className="text-purple-400" />
          </button>
          {aiSummary && (
            <div className="px-4 pb-4">
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{aiSummary}</p>
            </div>
          )}
        </div>
      )}

      {mainTab === 'weather' && (
        <div className="flex items-center gap-3 bg-gray-800 rounded-xl border border-gray-700 p-4">
          <span className="text-sm font-medium text-gray-400">Project:</span>
          <select
            value={weatherProjectFilter}
            onChange={e => setWeatherProjectFilter(e.target.value)}
            className="text-sm border border-gray-700 bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={String(p.id)} value={String(p.id)}>
                {String(p.name ?? p.title ?? 'Unnamed')}
              </option>
            ))}
          </select>
        </div>
      )}

      {mainTab === 'photos' && (
        <div className="flex items-center justify-between bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-400">Project:</span>
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="text-sm border border-gray-700 bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Projects</option>
              {projects.map(p => (
                <option key={String(p.id)} value={String(p.id)}>
                  {String(p.name ?? p.title ?? 'Unnamed')}
                </option>
              ))}
            </select>
          </div>
          <input
            id="photo-upload"
            type="file"
            accept="image/*"
            multiple
            ref={photoInputRef}
            className="hidden"
            onChange={e => {
              const files = Array.from(e.target.files || []);
              if (!files.length) return;
              setPhotoUploading(true);
              const pid = projectFilter === 'all'
                ? (projects[0]?.id as string)
                : projectFilter;
              if (!pid) { toast.error('Select a project first'); setPhotoUploading(false); return; }
              handleDailyReportPhotoUpload(files, pid)
                .catch(() => toast.error('Photo upload failed'))
                .finally(() => setPhotoUploading(false));
              e.target.value = '';
            }}
          />
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={photoUploading}
            className="flex items-center gap-2 px-4 py-2 btn btn-primary rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {photoUploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {photoUploading ? 'Uploading...' : 'Upload Photo'}
          </button>
        </div>
      )}

      {/* SITE DIARY TAB */}
      {mainTab === 'diary' && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
            </div>
          ) : (
            <>
            <div className="bg-gray-800 rounded-xl border border-gray-700 divide-y divide-gray-700">
              {filtered.length === 0 && (
                <EmptyState
                  icon={ClipboardList}
                  title="No daily reports found"
                  description="Create a daily report to log site activity, workforce, and progress."
                />
              )}
              {filtered.map(r => {
                const id = String(r.id ?? '');
                const isSelected = selectedIds.has(id);
                const isExp = expanded === id;
                const reportDate = String(r.report_date ?? '');
                const isToday = reportDate === today;

                return (
                  <div key={id}>
                    <div
                      className="flex items-center gap-4 p-4 hover:bg-gray-700/30 cursor-pointer transition-colors"
                      onClick={() => setExpanded(isExp ? null : id)}
                    >
                      <button type="button" onClick={e => { e.stopPropagation(); toggle(id); }}>
                        {isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
                      </button>
                      <div className="w-24 flex-shrink-0 text-center">
                        <p className={`text-sm font-mono ${isToday ? 'text-orange-400' : 'text-white'}`}>{reportDate}</p>
                        {isToday && <p className="text-xs text-orange-400 mt-0.5">Today</p>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {weatherIcon(String(r.weather ?? ''))}
                        <span className="text-xs text-gray-400">{String(r.weather ?? '—')}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-300 font-medium mb-0.5">{getProjectName(String(r.project_id ?? ''))}</p>
                        <p className="text-sm text-gray-400 truncate">{String(r.work_carried_out ?? 'No description')}</p>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {!!r.workers_on_site && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Users size={11} />
                              {String(r.workers_on_site)} workers
                            </span>
                          )}
                          {!!r.issues_delays && (
                            <span className="text-xs text-red-400 flex items-center gap-1">
                              <AlertTriangle size={11} />
                              Issues noted
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColour[String(r.status ?? '')] ?? 'bg-gray-600 text-gray-300'}`}>
                          {String(r.status ?? '')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {r.status === 'Draft' && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              submitReport(r);
                            }}
                            className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                            title="Submit"
                          >
                            <ClipboardList size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setDetailView(r);
                          }}
                          className="p-1.5 text-gray-500 hover:text-orange-400 hover:bg-gray-700/50 rounded transition-colors"
                          title="View Full Report"
                        >
                          <FileText size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            openEdit(r);
                          }}
                          className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-gray-700/50 rounded transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleDelete(id);
                          }}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700/50 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                        {isExp ? (
                          <ChevronUp size={16} className="text-gray-500" />
                        ) : (
                          <ChevronDown size={16} className="text-gray-500" />
                        )}
                      </div>
                    </div>
                    {isExp && (
                      <div className="px-6 pb-4 bg-gray-700/20 space-y-3 text-sm border-t border-gray-700">
                        {!!r.work_carried_out && (
                          <div>
                            <p className="text-xs font-display text-orange-400 uppercase tracking-widest mb-1">Work Carried Out</p>
                            <p className="text-gray-300 whitespace-pre-wrap">{String(r.work_carried_out)}</p>
                          </div>
                        )}
                        {!!r.work_planned_tomorrow && (
                          <div>
                            <p className="text-xs font-display text-blue-400 uppercase tracking-widest mb-1">Work Planned Tomorrow</p>
                            <p className="text-gray-300 whitespace-pre-wrap">{String(r.work_planned_tomorrow)}</p>
                          </div>
                        )}
                        {!!r.issues_delays && (
                          <div>
                            <p className="text-xs font-display text-red-400 uppercase tracking-widest mb-1">Issues / Delays</p>
                            <p className="text-gray-300">{String(r.issues_delays)}</p>
                          </div>
                        )}
                        {!!r.safety_notes && (
                          <div>
                            <p className="text-xs font-display text-green-400 uppercase tracking-widest mb-1">Safety Notes</p>
                            <p className="text-gray-300">{String(r.safety_notes)}</p>
                          </div>
                        )}
                        {!!r.materials_delivered && (
                          <div>
                            <p className="text-xs font-display text-purple-400 uppercase tracking-widest mb-1">Materials Delivered</p>
                            <p className="text-gray-300">{String(r.materials_delivered)}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
        </>
      )}

      {/* WEATHER LOG TAB */}
      {mainTab === 'weather' && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
            </div>
          ) : (
            <WeatherWidget reports={reports} projectFilter={weatherProjectFilter} isLoading={isLoading} error={listError?.message} />
          )}
        </div>
      )}

      {/* PROGRESS PHOTOS TAB */}
      {mainTab === 'photos' && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-display text-white">
                  {reports.reduce((sum, r) => sum + Number(r.photos ?? 0), 0)} Photos
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {reports
                  .filter(r => projectFilter === 'all' || String(r.project_id) === projectFilter)
                  .flatMap((r: AnyRow) =>
                    Array.from({ length: Number(r.photos ?? 0) }, (_, i) => ({
                      ...r,
                      photoIndex: i,
                      colors: ['bg-blue-500/20', 'bg-purple-500/20', 'bg-pink-500/20', 'bg-green-500/20'],
                    }))
                  )
                  .slice(0, 20)
                  .map((r: AnyRow & { photoIndex: number; colors: string[] }, idx) => {
                    const colorIdx = (idx + Number(r.photoIndex)) % 4;
                    return (
                      <div key={`${r.id}-${idx}`} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-orange-500/50 transition-colors group">
                        <div className={`h-40 ${r.colors[colorIdx]} flex items-center justify-center border-b border-gray-700`}>
                          <Camera size={32} className="text-gray-500 group-hover:text-orange-400 transition-colors" />
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-medium text-white truncate">{getProjectName(String(r.project_id ?? ''))}</p>
                          <p className="text-xs text-gray-400">{String(r.report_date ?? '—')}</p>
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">{String(r.work_carried_out ?? 'Photo from site').slice(0, 50)}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
              {reports.filter(r => projectFilter === 'all' || String(r.project_id) === projectFilter).length === 0 && (
                <EmptyState
                  icon={Camera}
                  title="No photos found"
                  description="Attach photos to your daily reports to document site progress."
                />
              )}
            </div>
          )}
        </>
      )}

      {/* AI SUMMARY TAB */}
      {mainTab === 'summary' && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-display text-white">Weekly Summaries</h3>
                <button
                  onClick={async () => {
                    const weekStart = new Date();
                    weekStart.setDate(weekStart.getDate() - 0 * 7);
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 6);
                    const currentWeek = reports.filter(r => {
                      const d = new Date(String(r.report_date ?? ''));
                      return d >= weekStart && d <= weekEnd;
                    });
                    if (!currentWeek.length) { toast.error('No reports this week'); return; }
                    toast.success('Generating AI summary…');
                    try {
                      const res = await fetch(`${API_BASE}/reports/summary`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reports: currentWeek, projectName: projectFilter === 'all' ? 'All Projects' : String(projects.find(p => String(p.id) === projectFilter)?.name ?? 'Project') }),
                      });
                      if (!res.ok) throw new Error();
                      const data = await res.json() as { summary?: string };
                      toast.success(data.summary || 'Summary generated successfully');
                    } catch {
                      // Fallback: show a basic text summary (AI unavailable)
                      const totalWorkers = currentWeek.reduce((s: number, r: AnyRow) => s + Number(r.workers_on_site ?? 0), 0);
                      const issues = currentWeek.filter((r: AnyRow) => r.issues_delays).length;
                      toast.warning('AI summary unavailable — showing basic stats');
                      toast.info(`Week Summary: ${currentWeek.length} reports, ${totalWorkers} total workers, ${issues} issues`);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Brain size={16} />
                  Generate Summary
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 4 }, (_, weekIdx) => {
                  const weekStart = new Date();
                  weekStart.setDate(weekStart.getDate() - weekIdx * 7);
                  const weekEnd = new Date(weekStart);
                  weekEnd.setDate(weekEnd.getDate() + 6);
                  const weekReports = reports.filter(r => {
                    const d = new Date(String(r.report_date ?? ''));
                    return d >= weekStart && d <= weekEnd;
                  });
                  const totalWorkers = weekReports.reduce((sum, r) => sum + Number(r.workers_on_site ?? 0), 0);
                  const issuesCount = weekReports.filter(r => !!r.issues_delays).length;

                  return (
                    <div key={weekIdx} className="bg-gray-800 rounded-lg border border-gray-700 p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide">Week {4 - weekIdx}</p>
                          <p className="text-sm text-gray-300 mt-0.5">
                            {weekStart.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} - {weekEnd.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <Brain size={20} className="text-purple-400" />
                      </div>
                      <div className="space-y-3 border-t border-gray-700 pt-3">
                        <div>
                          <p className="text-xs font-medium text-gray-400 mb-1">Reports Submitted</p>
                          <p className="text-lg font-display text-white">{weekReports.length}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-400 mb-1">Total Worker Days</p>
                          <p className="text-lg font-display text-green-400">{totalWorkers}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-400 mb-1">Issues Reported</p>
                          <p className="text-lg font-display text-red-400">{issuesCount}</p>
                        </div>
                        <div className="pt-2">
                          <p className="text-xs font-medium text-gray-400 mb-2">Highlights</p>
                          <div className="flex flex-wrap gap-1">
                            {weekReports.length > 0 && (
                              <>
                                <span className="text-xs px-2 py-1 bg-green-500/20 text-green-300 border border-green-500/30 rounded-full flex items-center gap-1">
                                  <CheckCircle2 size={10} />
                                  On Track
                                </span>
                                {issuesCount > 0 && (
                                  <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-full flex items-center gap-1">
                                    <AlertTriangle size={10} />
                                    {issuesCount} Issues
                                  </span>
                                )}
                              </>
                            )}
                            {weekReports.length === 0 && (
                              <span className="text-xs px-2 py-1 bg-gray-700 text-gray-400 rounded-full">No reports</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                <button
                  onClick={() => exportWeeklyReportsPDF(
                    reports.filter(r => projectFilter === 'all' || String(r.project_id) === projectFilter),
                    projectFilter === 'all' ? 'All Projects' : String(projects.find(p => String(p.id) === projectFilter)?.name ?? 'Project')
                  )}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download size={16} />
                  Export Weekly Reports
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
              <h2 className="text-lg font-semibold text-white">{editing ? 'Edit Daily Report' : 'New Daily Report'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Project Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Project *</label>
                  <select
                    required
                    value={form.project_id}
                    onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                    className="w-full border border-gray-700 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select Project</option>
                    {projects.map(p => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {String(p.name ?? p.title ?? 'Unnamed')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Report Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Report Date *</label>
                  <input
                    required
                    type="date"
                    value={form.report_date}
                    onChange={e => setForm(f => ({ ...f, report_date: e.target.value }))}
                    className="w-full border border-gray-700 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Weather */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Weather</label>
                  <select
                    value={form.weather}
                    onChange={e => setForm(f => ({ ...f, weather: e.target.value }))}
                    className="w-full border border-gray-700 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {WEATHER_OPTIONS.map(w => (
                      <option key={w}>{w}</option>
                    ))}
                  </select>
                </div>

                {/* Temperature */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Temperature (°C)</label>
                  <input
                    type="number"
                    value={form.temperature}
                    onChange={e => setForm(f => ({ ...f, temperature: e.target.value }))}
                    className="w-full border border-gray-700 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Workers on Site */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Workers on Site</label>
                  <input
                    type="number"
                    value={form.workers_on_site}
                    onChange={e => setForm(f => ({ ...f, workers_on_site: e.target.value }))}
                    className="w-full border border-gray-700 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border border-gray-700 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Plant/Equipment */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Plant/Equipment Used</label>
                <textarea
                  rows={2}
                  value={form.plant_equipment}
                  onChange={e => setForm(f => ({ ...f, plant_equipment: e.target.value }))}
                  placeholder="e.g. JCB 3CX, Forklift, Scaffold Tower"
                  className="w-full border border-gray-700 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none placeholder-gray-500"
                />
              </div>

              {/* Visitors */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Visitors to Site</label>
                <textarea
                  rows={2}
                  value={form.visitors}
                  onChange={e => setForm(f => ({ ...f, visitors: e.target.value }))}
                  placeholder="Names and companies of visitors"
                  className="w-full border border-gray-700 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none placeholder-gray-500"
                />
              </div>

              {/* Work Carried Out */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Work Completed Today *</label>
                <textarea
                  required
                  rows={3}
                  value={form.work_carried_out}
                  onChange={e => setForm(f => ({ ...f, work_carried_out: e.target.value }))}
                  placeholder="Describe all work activities on site today…"
                  className="w-full border border-gray-700 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none placeholder-gray-500"
                />
              </div>

              {/* Work Planned Tomorrow */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Work Planned Tomorrow</label>
                <textarea
                  rows={3}
                  value={form.work_planned_tomorrow}
                  onChange={e => setForm(f => ({ ...f, work_planned_tomorrow: e.target.value }))}
                  placeholder="Describe planned work for next day…"
                  className="w-full border border-gray-700 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none placeholder-gray-500"
                />
              </div>

              {/* Issues/Delays */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Issues / Delays</label>
                <textarea
                  rows={2}
                  value={form.issues_delays}
                  onChange={e => setForm(f => ({ ...f, issues_delays: e.target.value }))}
                  placeholder="Any delays, stoppages or issues…"
                  className="w-full border border-gray-700 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none placeholder-gray-500"
                />
              </div>

              {/* Safety Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Safety Notes</label>
                <textarea
                  rows={2}
                  value={form.safety_notes}
                  onChange={e => setForm(f => ({ ...f, safety_notes: e.target.value }))}
                  placeholder="Safety observations and hazard notes…"
                  className="w-full border border-gray-700 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none placeholder-gray-500"
                />
              </div>

              {/* Materials Delivered */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Materials Delivered</label>
                <textarea
                  rows={2}
                  value={form.materials_delivered}
                  onChange={e => setForm(f => ({ ...f, materials_delivered: e.target.value }))}
                  placeholder="Materials delivered to site…"
                  className="w-full border border-gray-700 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none placeholder-gray-500"
                />
              </div>

              {/* Subcontractors */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Subcontractors on Site</label>
                <textarea
                  rows={2}
                  value={form.subcontractors}
                  onChange={e => setForm(f => ({ ...f, subcontractors: e.target.value }))}
                  placeholder="Subcontractor names and companies…"
                  className="w-full border border-gray-700 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none placeholder-gray-500"
                />
              </div>

              {/* Submitted By */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Submitted By</label>
                <input
                  value={form.submitted_by}
                  onChange={e => setForm(f => ({ ...f, submitted_by: e.target.value }))}
                  className="w-full border border-gray-700 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-700 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {editing ? 'Update Report' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {detailView && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
              <h2 className="text-lg font-semibold text-white">Daily Site Report</h2>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400">
                  <Download size={18} />
                </button>
                <button
                  onClick={() => setDetailView(null)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-8 space-y-6">
              {/* Header Section */}
              <div className="border-b border-gray-700 pb-6">
                <h3 className="text-2xl font-display text-white mb-2">{getProjectName(String(detailView.project_id ?? ''))}</h3>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>Date: {String(detailView.report_date ?? '—')}</span>
                  <span>Reported by: {String(detailView.submitted_by ?? '—')}</span>
                </div>
              </div>

              {/* Site Conditions */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-700">
                  <p className="text-xs font-display text-gray-400 uppercase tracking-widest mb-1">Weather</p>
                  <div className="flex items-center gap-2">
                    {weatherIcon(String(detailView.weather ?? ''))}
                    <p className="text-lg font-medium text-white">{String(detailView.weather ?? '—')}</p>
                  </div>
                  {Boolean(detailView.temperature) && <p className="text-sm text-gray-400 mt-1">{String(detailView.temperature)}°C</p>}
                </div>
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-700">
                  <p className="text-xs font-display text-gray-400 uppercase tracking-widest mb-1">Workers</p>
                  <p className="text-lg font-medium text-white">{String(detailView.workers_on_site ?? '0')}</p>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-700">
                  <p className="text-xs font-display text-gray-400 uppercase tracking-widest mb-1">Status</p>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium inline-block ${statusColour[String(detailView.status ?? '')] ?? 'bg-gray-600 text-gray-300'}`}
                  >
                    {String(detailView.status ?? '')}
                  </span>
                </div>
              </div>

              {/* Work Sections */}
              {Boolean(detailView.work_carried_out) && (
                <div>
                  <h4 className="text-sm font-display text-orange-400 uppercase tracking-widest mb-2">Work Completed Today</h4>
                  <p className="text-gray-300 whitespace-pre-wrap">{String(detailView.work_carried_out)}</p>
                </div>
              )}

              {Boolean(detailView.work_planned_tomorrow) && (
                <div>
                  <h4 className="text-sm font-display text-blue-400 uppercase tracking-widest mb-2">Work Planned Tomorrow</h4>
                  <p className="text-gray-300 whitespace-pre-wrap">{String(detailView.work_planned_tomorrow)}</p>
                </div>
              )}

              {Boolean(detailView.plant_equipment) && (
                <div>
                  <h4 className="text-sm font-display text-purple-400 uppercase tracking-widest mb-2">Plant & Equipment</h4>
                  <p className="text-gray-300 whitespace-pre-wrap">{String(detailView.plant_equipment)}</p>
                </div>
              )}

              {Boolean(detailView.issues_delays) && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <h4 className="text-sm font-display text-red-400 uppercase tracking-widest mb-2">Issues & Delays</h4>
                  <p className="text-gray-300 whitespace-pre-wrap">{String(detailView.issues_delays)}</p>
                </div>
              )}

              {Boolean(detailView.safety_notes) && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <h4 className="text-sm font-display text-green-400 uppercase tracking-widest mb-2">Safety Notes</h4>
                  <p className="text-gray-300 whitespace-pre-wrap">{String(detailView.safety_notes)}</p>
                </div>
              )}

              {Boolean(detailView.materials_delivered) && (
                <div>
                  <h4 className="text-sm font-display text-yellow-400 uppercase tracking-widest mb-2">Materials Delivered</h4>
                  <p className="text-gray-300 whitespace-pre-wrap">{String(detailView.materials_delivered)}</p>
                </div>
              )}

              {Boolean(detailView.subcontractors) && (
                <div>
                  <h4 className="text-sm font-display text-cyan-400 uppercase tracking-widest mb-2">Subcontractors</h4>
                  <p className="text-gray-300 whitespace-pre-wrap">{String(detailView.subcontractors)}</p>
                </div>
              )}

              {Boolean(detailView.visitors) && (
                <div>
                  <h4 className="text-sm font-display text-indigo-400 uppercase tracking-widest mb-2">Visitors</h4>
                  <p className="text-gray-300 whitespace-pre-wrap">{String(detailView.visitors)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Photo upload handler ─────────────────────────────── */}
      {projectFilter === 'all' && (
        <div className="hidden" />
      )}

      {/* ── PDF Export ─────────────────────────────────────── */}
      <div className="hidden print:block" />
    </div>
    </>
  );
}

// ── Photo upload ─────────────────────────────────────────────
async function handleDailyReportPhotoUpload(files: File[], projectId: string) {
  if (!files.length) return;
  const formData = new FormData();
  formData.append('name', `Daily Report Photo - ${new Date().toLocaleDateString()}`);
  formData.append('project_id', projectId);
  formData.append('category', 'daily-report');
  files.forEach(f => formData.append('files', f));
  try {
    const res = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }) as Response;
    if (!res.ok) throw new Error('Upload failed');
    toast.success(`${files.length} photo(s) uploaded`);
  } catch (err) {
    console.error('[DailyReports] Photo upload failed:', err);
    toast.error('Photo upload failed');
  }
}

// ── PDF export ───────────────────────────────────────────────
async function exportWeeklyReportsPDF(reports: AnyRow[], projectName: string) {
  if (!reports.length) { toast.error('No reports to export'); return; }
  try {
    // Raw fetch — bypasses apiFetch camelization; response is a Blob (no key normalization needed)
    const res = await fetch(`${API_BASE}/reports/weekly-pdf`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reports, projectName }),
    }) as { ok: boolean; blob: () => Promise<Blob> };
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('PDF exported');
  } catch {
    // Fallback: open print dialog with printable summary
    const printContent = reports.map(r => `
${r.report_date ? new Date(String(r.report_date)).toLocaleDateString() : ''} | ${r.weather || ''} | ${r.workers_on_site || 0} workers
${r.activities ? JSON.parse(String(r.activities)).map((a: AnyRow) => `- ${a.description || a.title || ''}`).join('\n') : r.work_carried_out || ''}
`).join('\n\n');
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`<pre>${printContent}</pre>`);
      win.document.close();
      win.print();
    }
    toast.warning('PDF export failed — opening print view instead');
  }
}

export default DailyReports;
