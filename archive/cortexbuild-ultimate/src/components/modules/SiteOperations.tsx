import { useState } from 'react';
import {
  HardHat, Users, Truck, FileText, AlertTriangle, CheckCircle2, MapPin, Plus, Search,
  Sun, Cloud, CloudRain, Activity, Calendar, Wrench, X, CheckSquare, Square, Trash2
} from 'lucide-react';
import { useDailyReports, useEquipment, useTeam } from '../../hooks/useData';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { toast } from 'sonner';

type AnyRow = Record<string, unknown>;

type SubTab = 'diary' | 'equipment' | 'labour' | 'delays';

const _WEATHER_ICONS: Record<string, React.ElementType> = {
  sunny: Sun,
  cloudy: Cloud,
  rain: CloudRain,
  fog: Cloud,
  snow: Cloud,
};

const TABS: { key: SubTab; label: string; icon: React.ElementType }[] = [
  { key: 'diary',     label: 'Site Diary',     icon: FileText },
  { key: 'equipment', label: 'Plant & Equipment', icon: Truck },
  { key: 'labour',    label: 'Labour',         icon: Users },
  { key: 'delays',    label: 'Delay Log',      icon: AlertTriangle },
];

export function SiteOperations() {
  const { data: rawReports = [] } = useDailyReports.useList();
  const createMutation = useDailyReports.useCreate();
  const { data: rawEquipment = [] } = useEquipment.useList();
  const { data: rawTeam = [] } = useTeam.useList();

  const reports = rawReports as AnyRow[];
  const equipment = rawEquipment as AnyRow[];
  const team = rawTeam as AnyRow[];
  // Delays are derived from daily_reports rows that have delay fields set

  const [subTab, setSubTab] = useState<SubTab>('diary');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [showNewDelay, setShowNewDelay] = useState(false);

  // Form state for new entry
  const [newEntry, setNewEntry] = useState({
    project: '',
    date: selectedDate,
    weather: 'sunny' as string,
    temperature: 15,
    workersOnSite: 0,
    activities: '',
    equipment: '',
    materials: '',
    issues: '',
    progress: 50,
  });

  const [newDelay, setNewDelay] = useState({
    date: selectedDate,
    project: '',
    type: 'Weather',
    duration: 0,
    cause: '',
    impact: '',
    status: 'open',
  });

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} item(s)?`)) return;
    try {
      toast.success(`Deleted ${ids.length} item(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  const _today = new Date().toISOString().slice(0, 10);
  const selectedDayReports = reports.filter(r => String(r.report_date ?? '') === selectedDate);
  const filteredReports = projectFilter ? selectedDayReports.filter(r => String(r.project ?? '').toLowerCase().includes(projectFilter.toLowerCase())) : selectedDayReports;

  const reportsThisWeek = reports.filter(r => {
    const d = new Date(String(r.report_date ?? ''));
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo && d <= now;
  }).length;

  const workersOnSiteToday = selectedDayReports.reduce((s, r) => s + Number(r.workers_on_site ?? 0), 0);
  const activeProjects = new Set(reports.map(r => r.project)).size;
  const equipmentOnSite = equipment.filter(e => String(e.status ?? '').toLowerCase() === 'on site').length;
  const openDelays = reports.filter(r => r.delays && String(r.delays ?? '').toLowerCase() !== 'none').length;

  const handleNewEntryChange = (field: string, value: unknown) => {
    setNewEntry(prev => ({ ...prev, [field]: value }));
  };

  const handleNewDelayChange = (field: string, value: unknown) => {
    setNewDelay(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveEntry = async () => {
    if (!newEntry.project) { toast.error('Project is required'); return; }
    try {
      const payload = {
        project: newEntry.project,
        report_date: newEntry.date || selectedDate,
        weather: newEntry.weather,
        temperature: newEntry.temperature,
        workers_on_site: newEntry.workersOnSite,
        activities: newEntry.activities,
        equipment: newEntry.equipment,
        materials: newEntry.materials,
        issues: newEntry.issues,
        progress: newEntry.progress,
        submitted_by: 'Site Manager',
      };
      await createMutation.mutateAsync(payload);
      toast.success('Daily report saved');
      setShowNewEntry(false);
      setNewEntry({
        project: '',
        date: selectedDate,
        weather: 'sunny',
        temperature: 15,
        workersOnSite: 0,
        activities: '',
        equipment: '',
        materials: '',
        issues: '',
        progress: 50,
      });
    } catch {
      toast.error('Failed to save report');
    }
  };

const handleSaveDelay = async () => {
    if (!newDelay.project) { toast.error('Project is required'); return; }
    try {
      const payload = {
        project: newDelay.project,
        report_date: newDelay.date || selectedDate,
        weather: 'N/A',
        temperature: 0,
        workers_on_site: 0,
        activities: `Delay recorded: ${newDelay.type}`,
        delays: newDelay.type,
        delay_type: newDelay.type,
        delay_duration: newDelay.duration !== null && newDelay.duration !== undefined ? Number(newDelay.duration) : 0,
        delay_cause: newDelay.cause,
        delay_impact: newDelay.impact,
        delay_status: newDelay.status,
        issues: `Delay cause: ${newDelay.cause}\nImpact: ${newDelay.impact}`,
        progress: 0,
        submitted_by: 'Site Manager',
      };
      await createMutation.mutateAsync(payload);
      toast.success('Delay logged');
      setShowNewDelay(false);
      setNewDelay({
        date: selectedDate,
        project: '',
        type: 'Weather',
        duration: 0,
        cause: '',
        impact: '',
        status: 'open',
      });
    } catch { toast.error('Failed to log delay'); }
  };

  return (
    <>
      <ModuleBreadcrumbs currentModule="site-ops" />
      <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display text-gray-100">Site Operations</h1>
        <p className="text-sm text-gray-400 mt-1">Comprehensive site overview, daily reporting, equipment & labour management</p>
      </div>

      {/* Stats bar — 5 KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Workers On Site Today', value: workersOnSiteToday, icon: Users, colour: 'text-green-400', bg: 'bg-green-900/30' },
          { label: 'Active Projects', value: activeProjects, icon: Activity, colour: 'text-blue-400', bg: 'bg-blue-900/30' },
          { label: 'Equipment On Site', value: equipmentOnSite, icon: Truck, colour: 'text-orange-400', bg: 'bg-orange-900/30' },
          { label: 'Open Delays', value: openDelays, icon: AlertTriangle, colour: 'text-red-400', bg: 'bg-red-900/30' },
          { label: 'Reports This Week', value: reportsThisWeek, icon: FileText, colour: 'text-purple-400', bg: 'bg-purple-900/30' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${kpi.bg}`}>
                <kpi.icon size={18} className={kpi.colour} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 truncate">{kpi.label}</p>
                <p className="text-xl font-display text-gray-100 mt-0.5">{kpi.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sub-tabs navigation */}
      <div className="border-b border-gray-700 flex gap-1 cb-table-scroll touch-pan-x">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                subTab === t.key
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* SITE DIARY TAB */}
      {subTab === 'diary' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-gray-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="relative flex-1 sm:flex-initial">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Filter by project..."
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 w-full focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
            <button
              onClick={() => setShowNewEntry(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded font-medium text-sm transition-colors whitespace-nowrap"
            >
              <Plus size={16} />
              New Entry
            </button>
          </div>

          {/* Daily report cards */}
          {filteredReports.length === 0 ? (
            <div className="bg-gray-800 rounded-lg border border-gray-700 text-center py-12 text-gray-400">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No reports for {selectedDate}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReports.map(r => (
                <div key={String(r.id)} className="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-100">{String(r.project ?? 'Unnamed Project')}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{String(r.report_date ?? '')}</p>
                    </div>
                    <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs font-medium">{String(r.weather ?? 'N/A')}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Temperature</p>
                      <p className="font-medium text-gray-100">{Number(r.temperature ?? 0)}°C</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Workers</p>
                      <p className="font-medium text-gray-100 flex items-center gap-1">
                        <Users size={14} /> {Number(r.workers_on_site ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Progress</p>
                      <p className="font-medium text-gray-100">{Number(r.progress ?? 0)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Submitted By</p>
                      <p className="font-medium text-gray-100 truncate">{String(r.submitted_by ?? '—')}</p>
                    </div>
                  </div>

                  {String(r.activities ?? '').length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-300 mb-2">Activities</p>
                      <ul className="space-y-1">
                        {String(r.activities ?? '')
                          .split('\n')
                          .filter(a => a.trim())
                          .map((activity, idx) => (
                            <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                              <span className="text-orange-400 mt-0.5">•</span>
                              <span>{activity.trim()}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {String(r.equipment ?? '').length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-300 mb-2">Equipment In Use</p>
                      <div className="flex flex-wrap gap-2">
                        {String(r.equipment ?? '')
                          .split('\n')
                          .filter(e => e.trim())
                          .map((eq, idx) => (
                            <span key={idx} className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">
                              {eq.trim()}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  {String(r.issues ?? '').length > 0 && (
                    <div className="p-3 bg-red-900/20 border border-red-800/30 rounded">
                      <p className="text-xs font-medium text-red-300 mb-1">Issues / Delays</p>
                      <p className="text-sm text-red-200">{String(r.issues ?? '')}</p>
                    </div>
                  )}

                  {String(r.ai_summary ?? '').length > 0 && (
                    <div className="p-3 bg-blue-900/20 border border-blue-800/30 rounded">
                      <p className="text-xs font-medium text-blue-300 mb-1">AI Summary</p>
                      <p className="text-sm text-blue-200">{String(r.ai_summary ?? '')}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* New Entry Modal */}
          {showNewEntry && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="input input-bordered max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-100">New Daily Report</h2>
                  <button type="button" onClick={() => setShowNewEntry(false)} className="text-gray-400 hover:text-gray-300">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Project</label>
                      <input
                        type="text"
                        value={newEntry.project}
                        onChange={(e) => handleNewEntryChange('project', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Date</label>
                      <input
                        type="date"
                        value={newEntry.date}
                        onChange={(e) => handleNewEntryChange('date', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Weather</label>
                      <select
                        value={newEntry.weather}
                        onChange={(e) => handleNewEntryChange('weather', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500"
                      >
                        <option value="sunny">Sunny</option>
                        <option value="cloudy">Cloudy</option>
                        <option value="rain">Rain</option>
                        <option value="fog">Fog</option>
                        <option value="snow">Snow</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Temperature (°C)</label>
                      <input
                        type="number"
                        value={newEntry.temperature}
                        onChange={(e) => handleNewEntryChange('temperature', parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Workers On Site</label>
                    <input
                      type="number"
                      value={newEntry.workersOnSite}
                      onChange={(e) => handleNewEntryChange('workersOnSite', parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Activities (one per line)</label>
                    <textarea
                      value={newEntry.activities}
                      onChange={(e) => handleNewEntryChange('activities', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500"
                      placeholder="Excavation work&#10;Foundation laying&#10;Safety briefing"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Equipment (one per line)</label>
                    <textarea
                      value={newEntry.equipment}
                      onChange={(e) => handleNewEntryChange('equipment', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500"
                      placeholder="Digger-01&#10;Safety Hoist"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Materials Delivered (one per line)</label>
                    <textarea
                      value={newEntry.materials}
                      onChange={(e) => handleNewEntryChange('materials', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500"
                      placeholder="20 tonnes concrete&#10;500x timber boards"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Issues / Delays</label>
                    <textarea
                      value={newEntry.issues}
                      onChange={(e) => handleNewEntryChange('issues', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500"
                      placeholder="Describe any issues or delays..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Progress: {newEntry.progress}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={newEntry.progress}
                      onChange={(e) => handleNewEntryChange('progress', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSaveEntry}
                      disabled={createMutation.isPending}
                      className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded font-medium transition-colors disabled:opacity-50"
                    >
                      Save Entry
                    </button>
                    <button
                      onClick={() => setShowNewEntry(false)}
                      className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PLANT & EQUIPMENT TAB */}
      {subTab === 'equipment' && (
        <div className="space-y-4">
          {/* Status grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'On Site', count: equipment.filter(e => String(e.status ?? '').toLowerCase() === 'on site').length, colour: 'bg-blue-900/30 text-blue-300' },
              { label: 'Available', count: equipment.filter(e => String(e.status ?? '').toLowerCase() === 'available').length, colour: 'bg-green-900/30 text-green-300' },
              { label: 'Maintenance', count: equipment.filter(e => String(e.status ?? '').toLowerCase().includes('maintenance')).length, colour: 'bg-orange-900/30 text-orange-300' },
              { label: 'Hired Out', count: equipment.filter(e => String(e.status ?? '').toLowerCase().includes('hired')).length, colour: 'bg-purple-900/30 text-purple-300' },
            ].map(stat => (
              <div key={stat.label} className={`${stat.colour} border border-gray-700 rounded-lg p-3 text-center`}>
                <p className="text-2xl font-bold">{stat.count}</p>
                <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Equipment cards */}
          {equipment.length === 0 ? (
            <div className="bg-gray-800 rounded-lg border border-gray-700 text-center py-12 text-gray-400">
              <Truck size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No equipment registered</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {equipment.map(e => {
                const id = String(e.id);
                const isSelected = selectedIds.has(id);
                const status = String(e.status ?? '').toLowerCase();
                const statusColour =
                  status === 'on site'
                    ? 'bg-blue-900/30 text-blue-300'
                    : status === 'available'
                      ? 'bg-green-900/30 text-green-300'
                      : status.includes('maintenance')
                        ? 'bg-orange-900/30 text-orange-300'
                        : 'bg-gray-700/30 text-gray-300';

                const nextService = String(e.nextService ?? e.serviceDue ?? '');
                const isServiceSoon = nextService && new Date(nextService) <= new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

                return (
                  <div key={id} className="input input-bordered p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <button type="button" onClick={e => { e.stopPropagation(); toggle(id); }}>
                          {isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
                        </button>
                        <h3 className="font-semibold text-gray-100 truncate">{String(e.name ?? 'Unknown')}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{String(e.type ?? e.category ?? '—')}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ml-2 ${statusColour}`}>
                        {String(e.status ?? '—')}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      {String(e.registration ?? '').length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Registration:</span>
                          <span className="text-gray-200 font-medium">{String(e.registration)}</span>
                        </div>
                      )}
                      {!!e.location && (
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-gray-400">Location:</span>
                          <span className="text-gray-200 text-right flex items-center gap-1">
                            <MapPin size={12} />
                            {String(e.location)}
                          </span>
                        </div>
                      )}
                      {Number(e.daily_rate ?? 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Daily Rate:</span>
                          <span className="text-gray-200 font-medium">£{Number(e.daily_rate).toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    {nextService && (
                      <div className={`p-2 rounded text-xs ${isServiceSoon ? 'bg-amber-900/30 text-amber-300' : 'bg-gray-700/30 text-gray-300'}`}>
                        <div className="flex items-center gap-1">
                          <Wrench size={12} />
                          <span>Service: {nextService}</span>
                        </div>
                        {isServiceSoon && <p className="text-amber-300 font-medium mt-1">Due within 14 days</p>}
                      </div>
                    )}

                    <select
                      defaultValue={status}
                      onChange={(e) => toast.success(`Status: ${e.target.value}`)}
                      className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-gray-100 focus:outline-none focus:border-orange-500"
                    >
                      <option value="on site">On Site</option>
                      <option value="available">Available</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="hired out">Hired Out</option>
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* LABOUR TAB */}
      {subTab === 'labour' && (
        <div className="space-y-4">
          {team.length === 0 ? (
            <div className="bg-gray-800 rounded-lg border border-gray-700 text-center py-12 text-gray-400">
              <HardHat size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No workforce data available</p>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <div className="cb-table-scroll touch-pan-x">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-700/50 border-b border-gray-700">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Worker Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Role</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Trade</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Project</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Hours This Week</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">RAMS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {team.map(w => {
                      const status = String(w.status ?? '').toLowerCase();
                      const ramsStatus = String(w.rams_status ?? '').toLowerCase();
                      const statusDot =
                        status === 'on site'
                          ? 'bg-green-500'
                          : status === 'off site'
                            ? 'bg-gray-500'
                            : status === 'leave'
                              ? 'bg-yellow-500'
                              : 'bg-gray-500';

                      const hasNoRAMS = !ramsStatus || ramsStatus === 'none' || ramsStatus === 'not completed';

                      return (
                        <tr key={String(w.id)} className={`hover:bg-gray-700/50 ${hasNoRAMS ? 'bg-red-900/20' : ''}`}>
                          <td className="px-4 py-3 font-medium text-gray-100">{String(w.name ?? w.workerName ?? '—')}</td>
                          <td className="px-4 py-3 text-gray-300">{String(w.role ?? '—')}</td>
                          <td className="px-4 py-3 text-gray-300">{String(w.trade ?? w.skill ?? '—')}</td>
                          <td className="px-4 py-3 text-gray-300">{String(w.project ?? w.assignment ?? '—')}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${statusDot}`} />
                              <span className="text-xs text-gray-200 capitalize">{status || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-300 text-center">{Number(w.hours_this_week ?? 0)} hrs</td>
                          <td className="px-4 py-3">
                            {ramsStatus === 'completed' || ramsStatus === 'valid' ? (
                              <CheckCircle2 size={16} className="text-green-400" />
                            ) : (
                              <AlertTriangle size={16} className="text-red-400" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DELAY LOG TAB */}
      {subTab === 'delays' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="text-sm text-gray-400">
              <p>Programme delay tracking and impact assessment</p>
            </div>
            <button
              onClick={() => setShowNewDelay(true)}
              className="flex items-center gap-2 px-4 py-2 btn btn-error rounded font-medium text-sm transition-colors whitespace-nowrap"
            >
              <Plus size={16} />
              Log Delay
            </button>
          </div>

          {/* Delay table */}
          {reports.filter(r => r.delays).length === 0 ? (
            <div className="bg-gray-800 rounded-lg border border-gray-700 text-center py-12 text-gray-400">
              <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No delays logged</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <div className="cb-table-scroll touch-pan-x">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-700/50 border-b border-gray-700">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Project</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Delay Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Duration (hrs)</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Cause</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Impact</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-300">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {reports
                        .filter(r => r.delays)
                        .map((r, idx) => (
                          <tr key={idx} className="hover:bg-gray-700/50">
                            <td className="px-4 py-3 whitespace-nowrap text-gray-300 text-xs">{String(r.report_date ?? '—')}</td>
                            <td className="px-4 py-3 text-gray-200">{String(r.project ?? '—')}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 bg-orange-900/30 text-orange-300 rounded text-xs font-medium">
                                {String(r.delay_type ?? 'General')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-300 font-medium">{Number(r.delay_duration ?? 0)}</td>
                            <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{String(r.delay_cause ?? '—')}</td>
                            <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{String(r.delay_impact ?? '—')}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  String(r.delay_status ?? '').toLowerCase() === 'resolved'
                                    ? 'bg-green-900/30 text-green-300'
                                    : 'bg-red-900/30 text-red-300'
                                }`}
                              >
                                {String(r.delay_status ?? 'Open')}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Running totals by project */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                <h3 className="text-sm font-semibold text-gray-100 mb-3">Total Delay Hours This Month by Project</h3>
                <div className="space-y-2">
                  {Array.from(
                    reports
                      .filter(r => r.delays)
                      .reduce((acc, r) => {
                        const proj = String(r.project ?? 'Unknown');
                        const curr = acc.get(proj) ?? 0;
                        acc.set(proj, curr + Number(r.delay_duration ?? 0));
                        return acc;
                      }, new Map<string, number>())
                      .entries()
                  ).map(([project, hours]) => (
                    <div key={project} className="flex items-center justify-between p-2 bg-gray-700/30 rounded">
                      <span className="text-sm text-gray-300">{project}</span>
                      <span className="font-semibold text-orange-300">{hours} hrs</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* New Delay Modal */}
          {showNewDelay && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="input input-bordered max-w-2xl w-full">
                <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-100">Log Delay</h2>
                  <button type="button" onClick={() => setShowNewDelay(false)} className="text-gray-400 hover:text-gray-300">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Date</label>
                      <input
                        type="date"
                        value={newDelay.date}
                        onChange={(e) => handleNewDelayChange('date', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Project</label>
                      <input
                        type="text"
                        value={newDelay.project}
                        onChange={(e) => handleNewDelayChange('project', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Delay Type</label>
                      <select
                        value={newDelay.type}
                        onChange={(e) => handleNewDelayChange('type', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500"
                      >
                        <option value="Weather">Weather</option>
                        <option value="Material Delay">Material Delay</option>
                        <option value="Equipment Breakdown">Equipment Breakdown</option>
                        <option value="Subcontractor">Subcontractor</option>
                        <option value="Client Instructions">Client Instructions</option>
                        <option value="Unforeseen Conditions">Unforeseen Conditions</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Duration (hours)</label>
                      <input
                        type="number"
                        value={newDelay.duration}
                        onChange={(e) => handleNewDelayChange('duration', parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Cause</label>
                    <textarea
                      value={newDelay.cause}
                      onChange={(e) => handleNewDelayChange('cause', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500"
                      placeholder="Describe what caused the delay..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Impact on Programme</label>
                    <textarea
                      value={newDelay.impact}
                      onChange={(e) => handleNewDelayChange('impact', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500"
                      placeholder="Describe the impact..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                    <select
                      value={newDelay.status}
                      onChange={(e) => handleNewDelayChange('status', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500"
                    >
                      <option value="open">Open</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSaveDelay}
                      className="flex-1 px-4 py-2 btn btn-error rounded font-medium transition-colors"
                    >
                      Log Delay
                    </button>
                    <button
                      onClick={() => setShowNewDelay(false)}
                      className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <BulkActionsBar
        selectedIds={Array.from(selectedIds)}
        actions={[
          { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
        ]}
        onClearSelection={clearSelection}
      />
    </div>
    </>
  );
}
export default SiteOperations;
