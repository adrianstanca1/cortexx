/**
 * CarbonEstimating — UK Net Zero carbon footprint estimator for construction projects.
 * Uses carbonApi from services/api.ts.
 *
 * Features: Multi-tab interface with Estimate, History, Benchmarks, and Reports tabs.
 */
import { useState, useEffect } from 'react';
import {
  Leaf, Calculator, Info, Factory, Truck,
  ChevronDown, ChevronUp, Loader2, History, BarChart3, FileText,
  Download, Share2, Target, Eye, Trash2
} from 'lucide-react';
import { carbonApi } from '../../services/api';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { toast } from 'sonner';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

type CarbonEstimate = {
  summary: {
    embodied_kgCO2e: number;
    operational_annual_kgCO2e: number;
    operational_60yr_kgCO2e: number;
    total_lifetime_kgCO2e: number;
    embodied_pct: number;
    operational_pct: number;
    kgCO2e_per_m2: number;
    rating: string;
  };
  material_breakdown: Array<{
    category: string; quantity: number; unit: string;
    factor: number; kgCO2e: number; desc: string;
  }>;
  transport_breakdown: Array<{
    transport_mode: string; distance_km: number;
    weight_tonnes: number; factor: number; kgCO2e: number;
  }>;
};

type HistoryEntry = {
  id: string;
  project_name: string;
  construction_type: string;
  floor_area: number;
  epc_rating: string;
  total_kgCO2e: number;
  rating: string;
  date: string;
};

type TabType = 'estimate' | 'history' | 'benchmarks' | 'reports';

const BENCHMARK_DATA = {
  'RC Frame': { min: 650, max: 850, avg: 750 },
  'Steel Frame': { min: 550, max: 750, avg: 650 },
  'Timber Frame': { min: 350, max: 500, avg: 425 },
  'Masonry': { min: 400, max: 600, avg: 500 },
  'Hybrid': { min: 500, max: 700, avg: 600 },
};

const PROJECT_TYPES = ['Office', 'Residential', 'Retail', 'Industrial', 'Education', 'Healthcare', 'Mixed Use'];
const CONSTRUCTION_TYPES = ['RC Frame', 'Steel Frame', 'Timber Frame', 'Masonry', 'Hybrid'];
const EPC_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const RATING_LABELS: Record<string, { label: string; colour: string; bg: string }> = {
  'A': { label: 'Excellent', colour: 'text-green-400', bg: 'bg-green-500/20' },
  'B': { label: 'Very Good', colour: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  'C': { label: 'Good', colour: 'text-lime-400', bg: 'bg-lime-500/20' },
  'D': { label: 'Average', colour: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  'E': { label: 'Below Average', colour: 'text-amber-400', bg: 'bg-amber-500/20' },
  'F': { label: 'Poor', colour: 'text-orange-400', bg: 'bg-orange-500/20' },
  'G': { label: 'Very Poor', colour: 'text-red-400', bg: 'bg-red-500/20' },
};

export function CarbonEstimating() {
  const [activeTab, setActiveTab] = useState<TabType>('estimate');
  const [projectType, setProjectType] = useState('Residential');
  const [constructionType, setConstructionType] = useState('RC Frame');
  const [floorArea, setFloorArea] = useState('');
  const [programmeMonths, setProgrammeMonths] = useState('');
  const [epcRating, setEpcRating] = useState('B');
  const [occupancyHours, setOccupancyHours] = useState('12');
  const [result, setResult] = useState<CarbonEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [breakdownExpanded, setBreakdownExpanded] = useState(false);
  const [transportExpanded, setTransportExpanded] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const data = await (carbonApi as any).getHistory?.();
      if (data) {
        setHistory(data);
      } else {
        // Mock fallback data
        setHistory([
          {
            id: '1',
            project_name: 'Peckham Mixed-Use',
            construction_type: 'RC Frame',
            floor_area: 5200,
            epc_rating: 'A',
            total_kgCO2e: 3900000,
            rating: 'B',
            date: '2026-04-20'
          },
          {
            id: '2',
            project_name: 'Whitechapel Office Block',
            construction_type: 'Steel Frame',
            floor_area: 8500,
            epc_rating: 'B',
            total_kgCO2e: 5100000,
            rating: 'C',
            date: '2026-04-15'
          },
          {
            id: '3',
            project_name: 'Shoreditch Timber Build',
            construction_type: 'Timber Frame',
            floor_area: 3200,
            epc_rating: 'A',
            total_kgCO2e: 1450000,
            rating: 'A',
            date: '2026-04-10'
          },
          {
            id: '4',
            project_name: 'Canary Wharf Residential',
            construction_type: 'RC Frame',
            floor_area: 12000,
            epc_rating: 'B',
            total_kgCO2e: 8900000,
            rating: 'D',
            date: '2026-03-28'
          },
          {
            id: '5',
            project_name: 'King\'s Cross Masterplan',
            construction_type: 'Hybrid',
            floor_area: 15000,
            epc_rating: 'A',
            total_kgCO2e: 10200000,
            rating: 'D',
            date: '2026-03-15'
          },
          {
            id: '6',
            project_name: 'Greenwich Retail Park',
            construction_type: 'Masonry',
            floor_area: 6800,
            epc_rating: 'C',
            total_kgCO2e: 4100000,
            rating: 'C',
            date: '2026-03-01'
          },
        ]);
      }
    } catch {
      toast.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleEstimate(e: React.FormEvent) {
    e.preventDefault();
    if (!floorArea) {
      toast.error('Floor area is required');
      return;
    }
    setLoading(true);
    try {
      const res = await carbonApi.estimate({
        area_m2: parseFloat(floorArea),
        programme_months: programmeMonths !== null && programmeMonths !== undefined ? parseInt(programmeMonths) : 12,
        epc_rating: epcRating,
        occupancy_hours: occupancyHours !== null && occupancyHours !== undefined ? parseInt(occupancyHours) : 12,
      });
      setResult(res);
      toast.success('Carbon estimate generated');
    } catch {
      toast.error('Failed to generate carbon estimate');
    } finally {
      setLoading(false);
    }
  }

  function loadHistoryIntoForm(entry: HistoryEntry) {
    setFloorArea(String(entry.floor_area));
    setConstructionType(entry.construction_type);
    setEpcRating(entry.epc_rating);
    setActiveTab('estimate');
    toast.success('Loaded estimate from history');
  }

  async function deleteHistoryEntry(id: string) {
    try {
      await (carbonApi as any).deleteEstimate?.(id);
      setHistory(history.filter(h => h.id !== id));
      toast.success('History entry deleted');
    } catch {
      toast.error('Failed to delete history entry');
    }
  }

  function exportCSV() {
    const headers = ['Project', 'Date', 'Floor Area (m²)', 'Construction Type', 'EPC', 'Total kgCO2e', 'Rating'];
    const rows = history.map(h => [
      h.project_name,
      h.date,
      h.floor_area,
      h.construction_type,
      h.epc_rating,
      h.total_kgCO2e,
      h.rating
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carbon-estimates-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('CSV exported');
  }

  function shareReport() {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success('Report link copied to clipboard');
  }

  const reductionRecommendations = [
    { title: 'Switch to Timber Frame', reduction: 25, description: 'Timber-based construction can reduce embodied carbon by up to 25%' },
    { title: 'Improve to EPC A', reduction: 30, description: 'Upgrading from EPC B to A reduces operational carbon by ~30%' },
    { title: 'Renewable Energy Integration', reduction: 40, description: 'Solar/wind integration can offset 40% of operational emissions' },
    { title: 'Material Efficiency & Reuse', reduction: 15, description: 'Optimise material sizing and consider salvaged materials' },
    { title: 'Lifecycle Assessment Optimization', reduction: 20, description: 'Review transport logistics and supply chain efficiency' }
  ];

  function fmtKg(n: number) {
    if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(2)} tCO2e`;
    return `${n.toFixed(2)} kgCO2e`;
  }

  function fmtPerM2(n: number) {
    return `${(n).toFixed(1)} kgCO2e/m²`;
  }

  const r = result?.summary;

  return (
    <>
      <ModuleBreadcrumbs currentModule="carbon-estimating" />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
            <Leaf size={20} className="text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-display text-white">Carbon Estimating</h1>
            <p className="text-sm text-gray-400">UK Net Zero carbon footprint for construction projects (RICS TM65)</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 border-b border-gray-700">
          {[
            { id: 'estimate', label: 'Estimate', icon: Calculator },
            { id: 'history', label: 'History', icon: History },
            { id: 'benchmarks', label: 'Benchmarks', icon: BarChart3 },
            { id: 'reports', label: 'Reports', icon: FileText }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ESTIMATE TAB */}
        {activeTab === 'estimate' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calculator size={18} className="text-green-400" />
              <h2 className="text-lg font-semibold text-white">Project Parameters</h2>
            </div>
            <form onSubmit={handleEstimate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Project Type</label>
                  <select
                    value={projectType}
                    onChange={e => setProjectType(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Construction Type</label>
                  <select
                    value={constructionType}
                    onChange={e => setConstructionType(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {CONSTRUCTION_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Gross Internal Floor Area (m²) *</label>
                <input
                  type="number"
                  value={floorArea}
                  onChange={e => setFloorArea(e.target.value)}
                  placeholder="e.g. 2500"
                  min="10"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Programme (months)</label>
                  <input
                    type="number"
                    value={programmeMonths}
                    onChange={e => setProgrammeMonths(e.target.value)}
                    placeholder="e.g. 18"
                    min="1"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Occupancy Hours/day</label>
                  <input
                    type="number"
                    value={occupancyHours}
                    onChange={e => setOccupancyHours(e.target.value)}
                    placeholder="e.g. 12"
                    min="1" max="24"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Target EPC Rating</label>
                <select
                  value={epcRating}
                  onChange={e => setEpcRating(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {EPC_OPTIONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-2">
                <Info size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-300">
                  Estimates based on RICS TM65 methodology. Embodied carbon calculated from IStructE
                  Embodied Carbon Database factors. Operational carbon from SAP/CalculatedSAP methodology.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
                {loading ? 'Calculating...' : 'Generate Carbon Estimate'}
              </button>
            </form>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {!result ? (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 flex flex-col items-center justify-center text-center">
                <Leaf size={48} className="text-gray-700 mb-3" />
                <p className="text-gray-500">Enter project parameters and click Generate to see carbon estimate</p>
              </div>
            ) : (
              <>
                {/* Rating */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Carbon Rating</p>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-display ${RATING_LABELS[r?.rating ?? 'D']?.colour}`}>
                          {r?.rating ?? '—'}
                        </span>
                        <span className="text-lg text-gray-400">{RATING_LABELS[r?.rating ?? 'D']?.label}</span>
                      </div>
                    </div>
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-display ${RATING_LABELS[r?.rating ?? 'D']?.bg} ${RATING_LABELS[r?.rating ?? 'D']?.colour}`}>
                      {r?.rating ?? '—'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Embodied Carbon</p>
                      <p className="text-lg font-display text-orange-400">{fmtKg(r?.embodied_kgCO2e ?? 0)}</p>
                      <p className="text-xs text-gray-500">{r?.embodied_pct ?? 0}% of total</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Operational (60yr)</p>
                      <p className="text-lg font-display text-blue-400">{fmtKg(r?.operational_60yr_kgCO2e ?? 0)}</p>
                      <p className="text-xs text-gray-500">{r?.operational_pct ?? 0}% of total</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Total Lifetime</p>
                      <p className="text-lg font-display text-white">{fmtKg(r?.total_lifetime_kgCO2e ?? 0)}</p>
                      <p className="text-xs text-gray-500">Over 60 years</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Per m² Intensity</p>
                      <p className="text-lg font-display text-green-400">{fmtPerM2(r?.kgCO2e_per_m2 ?? 0)}</p>
                      <p className="text-xs text-gray-500">RICS benchmark: 1000</p>
                    </div>
                  </div>

                  {/* RICS Breakdown Bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Embodied {r?.embodied_pct ?? 0}%</span>
                      <span>Operational {r?.operational_pct ?? 0}%</span>
                    </div>
                    <div className="flex h-3 rounded-full overflow-hidden bg-gray-700">
                      <div
                        className="bg-orange-500 transition-all"
                        style={{ width: `${r?.embodied_pct ?? 50}%` }}
                      />
                      <div
                        className="bg-blue-500 transition-all"
                        style={{ width: `${r?.operational_pct ?? 50}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-orange-400">Embodied</span>
                      <span className="text-blue-400">Operational</span>
                    </div>
                  </div>
                </div>

                {/* Embodied Carbon Breakdown */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <button
                    onClick={() => setBreakdownExpanded(p => !p)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Factory size={16} className="text-orange-400" />
                      <span className="text-sm font-medium text-white">Embodied Carbon Breakdown</span>
                      <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                        {result.material_breakdown?.length ?? 0} materials
                      </span>
                    </div>
                    {breakdownExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </button>
                  {breakdownExpanded && (
                    <div className="border-t border-gray-800">
                      {(!result.material_breakdown || result.material_breakdown.length === 0) ? (
                        <p className="p-4 text-sm text-gray-500 text-center">No material breakdown available.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="bg-gray-800/50 border-b border-gray-800">
                            <tr>
                              {['Material', 'Quantity', 'Unit', 'Factor', 'kgCO2e'].map(h => (
                                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {result.material_breakdown.map((m, i) => (
                              <tr key={i} className="hover:bg-gray-800/30">
                                <td className="px-4 py-2.5 text-gray-300">{m.category}</td>
                                <td className="px-4 py-2.5 text-white">{m.quantity.toLocaleString()}</td>
                                <td className="px-4 py-2.5 text-gray-400 text-xs">{m.unit}</td>
                                <td className="px-4 py-2.5 text-gray-400">{m.factor}</td>
                                <td className="px-4 py-2.5 text-orange-400 font-medium">{fmtKg(m.kgCO2e)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>

                {/* Transport Breakdown */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <button
                    onClick={() => setTransportExpanded(p => !p)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Truck size={16} className="text-blue-400" />
                      <span className="text-sm font-medium text-white">Transport Carbon</span>
                      <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                        {result.transport_breakdown?.length ?? 0} modes
                      </span>
                    </div>
                    {transportExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </button>
                  {transportExpanded && (
                    <div className="border-t border-gray-800">
                      {(!result.transport_breakdown || result.transport_breakdown.length === 0) ? (
                        <p className="p-4 text-sm text-gray-500 text-center">No transport data available.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="bg-gray-800/50 border-b border-gray-800">
                            <tr>
                              {['Mode', 'Distance (km)', 'Weight (t)', 'Factor', 'kgCO2e'].map(h => (
                                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {result.transport_breakdown.map((t, i) => (
                              <tr key={i} className="hover:bg-gray-800/30">
                                <td className="px-4 py-2.5 text-gray-300">{t.transport_mode}</td>
                                <td className="px-4 py-2.5 text-white">{t.distance_km}</td>
                                <td className="px-4 py-2.5 text-gray-400">{t.weight_tonnes}t</td>
                                <td className="px-4 py-2.5 text-gray-400">{t.factor}</td>
                                <td className="px-4 py-2.5 text-blue-400 font-medium">{fmtKg(t.kgCO2e)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
        <div className="space-y-4">
          {historyLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : history.length === 0 ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
              <History size={48} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">No carbon estimates in history yet</p>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800/50 border-b border-gray-800">
                    <tr>
                      {['Project', 'Date', 'Floor Area', 'Construction Type', 'EPC', 'Total kgCO2e', 'Rating', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {history.map(entry => (
                      <tr key={entry.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-gray-300 font-medium">{entry.project_name}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{entry.date}</td>
                        <td className="px-4 py-3 text-white">{entry.floor_area.toLocaleString()} m²</td>
                        <td className="px-4 py-3 text-gray-400">{entry.construction_type}</td>
                        <td className="px-4 py-3 text-gray-400 font-mono">{entry.epc_rating}</td>
                        <td className="px-4 py-3 text-green-400 font-medium">{(entry.total_kgCO2e / 1000).toFixed(1)} tCO2e</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                            RATING_LABELS[entry.rating]?.bg
                          } ${RATING_LABELS[entry.rating]?.colour}`}>
                            {entry.rating}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => loadHistoryIntoForm(entry)}
                              className="p-1.5 hover:bg-gray-700 rounded transition-colors text-blue-400"
                              title="Load into form"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => deleteHistoryEntry(entry.id)}
                              className="p-1.5 hover:bg-gray-700 rounded transition-colors text-red-400"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        )}

        {/* BENCHMARKS TAB */}
        {activeTab === 'benchmarks' && (
        <div className="space-y-6">
          {/* Benchmarks Table */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target size={18} className="text-amber-400" />
              <h2 className="text-lg font-semibold text-white">UK Industry Benchmarks</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Construction Type</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Min kgCO2e/m²</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Avg kgCO2e/m²</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Max kgCO2e/m²</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {Object.entries(BENCHMARK_DATA).map(([type, data]) => (
                    <tr key={type} className="hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-white font-medium">{type}</td>
                      <td className="text-right px-4 py-3 text-emerald-400">{data.min}</td>
                      <td className="text-right px-4 py-3 text-amber-400 font-semibold">{data.avg}</td>
                      <td className="text-right px-4 py-3 text-orange-400">{data.max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chart */}
          {history.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Your Estimates vs Benchmarks</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={history.map(h => ({
                  name: h.project_name.slice(0, 15),
                  actual: h.total_kgCO2e / (h.floor_area * 1000),
                  benchmark: BENCHMARK_DATA[h.construction_type as keyof typeof BENCHMARK_DATA]?.avg || 600
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" tick={{ fill: '#9CA3AF' }} />
                  <YAxis tick={{ fill: '#9CA3AF' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="actual" fill="#F59E0B" name="Your Estimate" />
                  <Bar dataKey="benchmark" fill="#6B7280" name="Benchmark Avg" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* RIBA & Standards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-sm font-semibold text-amber-400 mb-3">RIBA 2030 Climate Challenge Targets</h3>
              <div className="space-y-2 text-sm text-gray-300">
                <p><span className="text-gray-500">Offices:</span> 490 kgCO2e/m² by 2025</p>
                <p><span className="text-gray-500">Retail:</span> 490 kgCO2e/m² by 2025</p>
                <p><span className="text-gray-500">Residential:</span> 350 kgCO2e/m² by 2030</p>
                <p><span className="text-gray-500">Industrial:</span> 240 kgCO2e/m² by 2030</p>
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-sm font-semibold text-green-400 mb-3">BREEAM & EPC Rating Scale</h3>
              <div className="space-y-1 text-xs text-gray-300">
                <p><span className="text-gray-500">BREEAM:</span> Excellent (≥85%), Very Good (70-84%), Good (55-69%)</p>
                <p><span className="text-gray-500">EPC A:</span> 0-39 kWh/m²/yr (best) → EPC G: 450+ (worst)</p>
                <p className="text-blue-400 text-xs mt-2">UK Net Zero Carbon Buildings Standard (PAS 2080)</p>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === 'reports' && (
        <div className="space-y-6">
          {!result ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
              <FileText size={48} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">Generate an estimate first to view reports</p>
            </div>
          ) : (
            <>
              {/* Report Actions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-white text-sm font-medium transition-colors border border-gray-700"
                >
                  <Download size={16} />
                  Export PDF
                </button>
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-white text-sm font-medium transition-colors border border-gray-700"
                >
                  <Download size={16} />
                  Export CSV
                </button>
                <button
                  onClick={shareReport}
                  className="flex items-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-white text-sm font-medium transition-colors border border-gray-700"
                >
                  <Share2 size={16} />
                  Share Link
                </button>
                <button
                  onClick={() => setActiveTab('estimate')}
                  className="flex items-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm font-medium transition-colors"
                >
                  <Calculator size={16} />
                  New Estimate
                </button>
              </div>

              {/* Report Preview Card */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 space-y-6">
                <div className="text-center pb-6 border-b border-gray-800">
                  <h2 className="text-2xl font-display text-white mb-2">Carbon Estimate Report</h2>
                  <p className="text-gray-500 text-sm">{new Date().toLocaleDateString('en-GB')}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <p className="text-gray-500 text-xs mb-1">Rating</p>
                    <p className={`text-3xl font-display ${RATING_LABELS[result.summary.rating]?.colour}`}>
                      {result.summary.rating}
                    </p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <p className="text-gray-500 text-xs mb-1">Total Lifetime</p>
                    <p className="text-lg font-semibold text-white">{(result.summary.total_lifetime_kgCO2e / 1000).toFixed(1)} tCO2e</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <p className="text-gray-500 text-xs mb-1">Per m² Intensity</p>
                    <p className="text-lg font-semibold text-green-400">{result.summary.kgCO2e_per_m2.toFixed(0)} kgCO2e/m²</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <p className="text-gray-500 text-xs mb-1">Embodied %</p>
                    <p className="text-lg font-semibold text-orange-400">{result.summary.embodied_pct}%</p>
                  </div>
                </div>

                <div className="border-t border-gray-800 pt-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Carbon Reduction Opportunities</h3>
                  <div className="space-y-3">
                    {reductionRecommendations.map((rec, i) => (
                      <div key={i} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 hover:border-green-600/50 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-white">{rec.title}</h4>
                          <span className="text-green-400 font-semibold text-sm">-{rec.reduction}%</span>
                        </div>
                        <p className="text-sm text-gray-400">{rec.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-800 pt-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Benchmark Comparison</h3>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-3">
                      Your estimate of <span className="text-amber-400 font-semibold">{result.summary.kgCO2e_per_m2.toFixed(0)} kgCO2e/m²</span> is{' '}
                      {result.summary.kgCO2e_per_m2 > (BENCHMARK_DATA[constructionType as keyof typeof BENCHMARK_DATA]?.avg || 600) ? 'above' : 'below'} the UK industry benchmark for <span className="text-white font-semibold">{constructionType}</span>.
                    </p>
                    <p className="text-xs text-gray-500">
                      Benchmark range: {BENCHMARK_DATA[constructionType as keyof typeof BENCHMARK_DATA]?.min || 400}–{BENCHMARK_DATA[constructionType as keyof typeof BENCHMARK_DATA]?.max || 800} kgCO2e/m²
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        )}
      </div>
    </>
  );
}

export default CarbonEstimating;
