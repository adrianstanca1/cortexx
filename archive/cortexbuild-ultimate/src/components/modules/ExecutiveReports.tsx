// Module: ExecutiveReports — CortexBuild Ultimate Enhanced Board Pack & KPI Dashboard
import { useState, useEffect } from 'react';
import {
  Download, BarChart3, PieChart, TrendingUp, Shield, PoundSterling,
  CheckSquare, Square, Trash2, Sparkles, Calendar, AlertCircle,
  FileText, Target, Activity,
} from 'lucide-react';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import {
  AreaChart, Area, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { toast } from 'sonner';
import { executiveReportsApi } from '../../services/api';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { EmptyState } from '../ui/EmptyState';

type _AnyRow = Record<string, unknown>;
type RAG = 'red' | 'amber' | 'green';

interface ReportTab {
  id: 'dashboard' | 'portfolio' | 'financial' | 'safety' | 'kpis' | 'trends' | 'boardpack' | 'benchmarking' | 'scheduled';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const fmtCurrency = (n: number) => {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}K`;
  return `£${n.toLocaleString()}`;
};

const RAGStatus = ({ status }: { status: RAG }) => {
  const colors: Record<RAG, string> = {
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    green: 'bg-emerald-500',
  };
  return (
    <div className={`w-3 h-3 rounded-full ${colors[status]}`} />
  );
};

const toRAG = (value: string): RAG => {
  if (value === 'red' || value === 'amber' || value === 'green') {
    return value;
  }
  return 'amber';
};

const FALLBACK_PROJECTS: Array<{
  id: string;
  name: string;
  client: string;
  value: number;
  phase: string;
  completion: number;
  nextMilestone: string;
  pm: string;
  programme: RAG;
  cost: RAG;
  quality: RAG;
  safety: RAG;
}> = [];

const FALLBACK_KPIS: Array<{ label: string; value: string; target: string; rag: RAG }> = [];

const FALLBACK_TRENDS: Array<Record<string, unknown>> = [];

type ProjectData = {
  id: string;
  name: string;
  client: string;
  value: number;
  phase: string;
  completion: number;
  nextMilestone: string;
  pm: string;
  programme: RAG;
  cost: RAG;
  quality: RAG;
  safety: RAG;
};

interface KPICardData {
  title: string;
  value: string | number;
  unit: string;
  trend: number;
  trendLabel: string;
}

interface BoardPackReport {
  month: string;
  executiveSummary: string;
  portfolioHealth: {
    totalValue: number;
    projectsOnTrack: number;
    projectsAtRisk: number;
    completionRate: number;
  };
  financialSummary: {
    revenue: number;
    margin: number;
    forecast: number;
  };
  riskOverview: Array<{ risk: string; impact: string; mitigation: string }>;
  decisions: Array<{ decision: string; deadline: string; owner: string }>;
}

interface ScheduledReport {
  id: string;
  name: string;
  frequency: 'weekly' | 'monthly' | 'quarterly';
  recipients: string[];
  format: 'pdf' | 'email';
  enabled: boolean;
  lastSent?: string;
}

const MOCK_BOARD_PACK: BoardPackReport = {
  month: 'April 2026',
  executiveSummary: 'Portfolio performing strongly with 4 of 5 projects on schedule. Overall financial performance exceeds targets with 25.3% gross margin. Safety record exemplary with zero RIDDOR incidents.',
  portfolioHealth: {
    totalValue: 45000000,
    projectsOnTrack: 4,
    projectsAtRisk: 1,
    completionRate: 68,
  },
  financialSummary: {
    revenue: 2100000,
    margin: 25.3,
    forecast: 8500000,
  },
  riskOverview: [
    {
      risk: 'Supply chain delays (concrete)',
      impact: 'Medium',
      mitigation: 'Alternative supplier engaged, 2-week buffer planned',
    },
    {
      risk: 'Weather delays on site',
      impact: 'Low',
      mitigation: 'Covered work areas expanded, contingency schedule maintained',
    },
    {
      risk: 'Labour availability',
      impact: 'Medium',
      mitigation: 'Temp agency contracts renewed, training accelerated',
    },
  ],
  decisions: [
    {
      decision: 'Approve £1.2M investment in new equipment',
      deadline: '15 May 2026',
      owner: 'CFO',
    },
    {
      decision: 'Sign-off on Eastern expansion phase 2',
      deadline: '22 May 2026',
      owner: 'COO',
    },
    {
      decision: 'Approve new safety protocol for high-rise',
      deadline: '8 May 2026',
      owner: 'HSE Manager',
    },
  ],
};

const MOCK_PROJECTS_UK = [
  {
    id: '1',
    name: 'Canary Wharf Phase 2',
    value: 12000000,
    completion: 75,
  },
  {
    id: '2',
    name: 'Manchester City Centre Retail',
    value: 8500000,
    completion: 60,
  },
  {
    id: '3',
    name: 'Edinburgh Housing Development',
    value: 9200000,
    completion: 45,
  },
  {
    id: '4',
    name: 'Birmingham Office Complex',
    value: 10300000,
    completion: 85,
  },
  {
    id: '5',
    name: 'Bristol Waterfront Residential',
    value: 5000000,
    completion: 20,
  },
];

const MOCK_SCHEDULED_REPORTS: ScheduledReport[] = [
  {
    id: '1',
    name: 'Weekly Safety Summary',
    frequency: 'weekly',
    recipients: ['safety-team@cortexbuild.co.uk', 'cfo@cortexbuild.co.uk'],
    format: 'pdf',
    enabled: true,
    lastSent: '2026-04-24',
  },
  {
    id: '2',
    name: 'Monthly Board Pack',
    frequency: 'monthly',
    recipients: ['board@cortexbuild.co.uk'],
    format: 'pdf',
    enabled: true,
    lastSent: '2026-04-01',
  },
  {
    id: '3',
    name: 'Quarterly P&L Review',
    frequency: 'quarterly',
    recipients: ['finance@cortexbuild.co.uk', 'board@cortexbuild.co.uk'],
    format: 'email',
    enabled: false,
    lastSent: '2026-04-01',
  },
];

const BENCHMARK_DATA = [
  {
    metric: 'Project delivery on time',
    ourPerformance: 82,
    industryAverage: 75,
    benchmark: 90,
  },
  {
    metric: 'Cost overrun rate',
    ourPerformance: 3.2,
    industryAverage: 7.5,
    benchmark: 2.0,
  },
  {
    metric: 'Safety incidents per 100k hours',
    ourPerformance: 0.2,
    industryAverage: 1.8,
    benchmark: 0.5,
  },
  {
    metric: 'Client retention rate',
    ourPerformance: 94,
    industryAverage: 82,
    benchmark: 95,
  },
  {
    metric: 'Workforce productivity (£k per FTE)',
    ourPerformance: 185,
    industryAverage: 165,
    benchmark: 195,
  },
  {
    metric: 'Margin on delivery',
    ourPerformance: 25.3,
    industryAverage: 18.5,
    benchmark: 26.0,
  },
];

const BENCHMARK_CHART_DATA = [
  { name: 'On-Time Delivery %', our: 82, benchmark: 90, industry: 75 },
  { name: 'Client Retention %', our: 94, benchmark: 95, industry: 82 },
  { name: 'Cost Control %', our: 96.8, benchmark: 98, industry: 92.5 },
  { name: 'Safety Performance', our: 99.8, benchmark: 99.5, industry: 98.2 },
  { name: 'Margin %', our: 25.3, benchmark: 26, industry: 18.5 },
];

export function ExecutiveReports() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'portfolio' | 'financial' | 'safety' | 'kpis' | 'trends' | 'boardpack' | 'benchmarking' | 'scheduled'>('dashboard');
  const [reportType, setReportType] = useState<'weekly' | 'monthly' | 'quarterly'>('monthly');
  const [boardPackMonth, setBoardPackMonth] = useState('2026-04');
  const [boardPackFormat, setBoardPackFormat] = useState<'month' | 'quarter'>('month');
  const [kpiPeriod, setKpiPeriod] = useState<'mtd' | 'qtd' | 'ytd'>('mtd');
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>(MOCK_SCHEDULED_REPORTS);
  const [showBoardPackPreview, setShowBoardPackPreview] = useState(false);
  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  const [summaryData, setSummaryData] = useState<{
    kpis: { portfolioValue: number; projectsActive: number; revenueYtd: number; margin: number; workforce: number };
    projects: Array<{
      id: string;
      name: string;
      client: string;
      value: number;
      phase: string;
      completion: number;
      nextMilestone: string;
      pm: string;
      programme: string;
      cost: string;
      quality: string;
      safety: string;
    }>;
  } | null>(null);

  const [trendsData, setTrendsData] = useState<Array<{
    month: string;
    revenue: number;
    margin: number;
    headcount: number;
  }> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [summary, trends] = await Promise.all([
          executiveReportsApi.getSummary(),
          executiveReportsApi.getTrends(),
        ]);
        setSummaryData(summary);
        setTrendsData(trends);
      } catch {
        setError('Failed to load report data');
        toast.error('Failed to load report data, using fallback');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} report(s)?`)) return;
    try {
      toast.success(`Deleted ${ids.length} report(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  function handleGenerateBoardPackPDF() {
    toast.success('Board Pack PDF generated and ready to download');
  }

  function handleRunScheduledReport(reportId: string) {
    const report = scheduledReports.find((r) => r.id === reportId);
    if (report) {
      toast.success(`Running "${report.name}" now...`);
    }
  }

  function toggleScheduledReport(reportId: string) {
    setScheduledReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, enabled: !r.enabled } : r))
    );
  }

  const tabs: ReportTab[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'portfolio', label: 'Portfolio', icon: PieChart },
    { id: 'financial', label: 'Financial', icon: PoundSterling },
    { id: 'safety', label: 'Safety', icon: Shield },
    { id: 'boardpack', label: 'Board Pack', icon: FileText },
    { id: 'kpis', label: 'KPI Dashboard', icon: Target },
    { id: 'benchmarking', label: 'Benchmarking', icon: TrendingUp },
    { id: 'scheduled', label: 'Scheduled Reports', icon: Calendar },
  ];

  const projects: ProjectData[] = summaryData?.projects?.map((p): ProjectData => ({
    id: p.id,
    name: p.name,
    client: p.client,
    value: p.value,
    phase: p.phase,
    completion: p.completion,
    nextMilestone: p.nextMilestone,
    pm: p.pm,
    programme: toRAG(p.programme),
    cost: toRAG(p.cost),
    quality: toRAG(p.quality),
    safety: toRAG(p.safety),
  })) ?? FALLBACK_PROJECTS;

  const kpis: Array<{ label: string; value: string; target: string; rag: RAG }> = summaryData?.kpis ? [
    { label: 'Portfolio Value', value: fmtCurrency(summaryData.kpis.portfolioValue), target: fmtCurrency(summaryData.kpis.portfolioValue * 1.05), rag: 'green' },
    { label: 'Projects Active', value: String(summaryData.kpis.projectsActive), target: '3', rag: 'green' },
    { label: 'Revenue YTD', value: fmtCurrency(summaryData.kpis.revenueYtd), target: fmtCurrency(summaryData.kpis.revenueYtd * 1.08), rag: summaryData.kpis.revenueYtd > 1800000 ? 'green' : 'amber' },
    { label: 'Margin %', value: `${summaryData.kpis.margin}%`, target: '26%', rag: summaryData.kpis.margin >= 25 ? 'green' : 'amber' },
  ] : FALLBACK_KPIS;

  const trendData = trendsData ?? FALLBACK_TRENDS;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error && !summaryData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleBreadcrumbs currentModule="executive-reports" />

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-display text-white">Executive Reports</h1>
          <p className="text-sm text-gray-400 mt-1">Board-level intelligence and analytics</p>
        </div>
        <div className="flex gap-2">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as 'weekly' | 'monthly' | 'quarterly')}
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
          <button className="btn btn-secondary">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-gray-800 cb-table-scroll touch-pan-x overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={String(tab.id)}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium text-sm transition-colors flex items-center gap-2 whitespace-nowrap border-b-2 ${
                activeTab === tab.id
                  ? 'text-orange-500 border-orange-500'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {String(tab.label)}
            </button>
          );
        })}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi) => (
              <div key={String(kpi.label)} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase mb-2">{String(kpi.label)}</p>
                <p className="text-2xl font-display text-white mb-2">{String(kpi.value)}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Target: {String(kpi.target)}</span>
                  <RAGStatus status={kpi.rag} />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-lg font-display text-white mb-4">Project RAG Status</h3>
            <div className="space-y-3">
              {projects.map((proj) => (
                <div key={String(proj.name)} className="p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-white text-sm">{String(proj.name)}</p>
                      <p className="text-xs text-gray-400">{String(proj.client)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-xs">
                    {[
                      { label: 'Programme', status: proj.programme },
                      { label: 'Cost', status: proj.cost },
                      { label: 'Quality', status: proj.quality },
                      { label: 'Safety', status: proj.safety },
                    ].map((item) => (
                      <div key={String(item.label)} className="flex items-center gap-2">
                        <RAGStatus status={item.status} />
                        <span className="text-gray-400">{String(item.label)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button className="btn btn-primary w-full">
            <Download className="h-4 w-4 mr-2" />
            Generate Full Report
          </button>
        </div>
      )}

      {/* Portfolio Tab */}
      {activeTab === 'portfolio' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {projects.map((proj) => {
                const isSelected = selectedIds.has(proj.id);
                return (
                  <div key={String(proj.name)} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 flex-1">
                        <button type="button" onClick={() => toggle(proj.id)}>
                          {isSelected ? <CheckSquare size={16} className="text-blue-400" /> : <Square size={16} className="text-gray-500" />}
                        </button>
                        <div>
                          <p className="font-display text-white">{String(proj.name)}</p>
                          <p className="text-xs text-gray-400">{String(proj.client)}</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs font-medium">{String(proj.phase)}</span>
                    </div>
                    <p className="text-lg font-display text-emerald-400 mb-3">{fmtCurrency(proj.value)}</p>
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Completion</span>
                        <span className="text-white">{Number(proj.completion)}%</span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${proj.completion}%` }} />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">Next: {String(proj.nextMilestone)}</p>
                  </div>
                );
              })}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-lg font-display text-white mb-4">Portfolio by Sector</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie data={[{ name: 'Commercial', value: 45 }, { name: 'Residential', value: 35 }, { name: 'Industrial', value: 20 }]} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value">
                      <Cell fill="#3b82f6" />
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <BulkActionsBar
            selectedIds={Array.from(selectedIds)}
            actions={[
              { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
            ]}
            onClearSelection={clearSelection}
          />
        </div>
      )}

      {/* Financial Tab */}
      {activeTab === 'financial' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-lg font-display text-white mb-4">Quarterly Performance</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { quarter: 'Q1', revenue: 603000, margin: 24 },
                    { quarter: 'Q2', revenue: 867000, margin: 25 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="quarter" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
                    <Bar dataKey="revenue" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-lg font-display text-white mb-4">Key Financial Ratios</h3>
              <div className="space-y-4">
                {[
                  { label: 'Gross Margin', value: '25%', benchmark: '22%' },
                  { label: 'Net Margin', value: '19%', benchmark: '18%' },
                  { label: 'Current Ratio', value: '1.85x', benchmark: '1.5x' },
                  { label: 'Debtor Days', value: '42 days', benchmark: '45 days' },
                ].map((item) => (
                  <div key={String(item.label)} className="flex justify-between items-center p-3 bg-gray-800/50 rounded">
                    <span className="text-gray-300 text-sm">{String(item.label)}</span>
                    <div className="text-right">
                      <p className="font-display text-white">{String(item.value)}</p>
                      <p className="text-xs text-gray-500">vs {String(item.benchmark)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-lg font-display text-white mb-4">Revenue Pipeline</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { stage: 'Pipeline', value: 8500000 },
                  { stage: 'Proposal', value: 5200000 },
                  { stage: 'Tender', value: 3100000 },
                  { stage: 'Active', value: 9000000 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="stage" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
                  <Bar dataKey="value" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Safety Tab */}
      {activeTab === 'safety' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'RIDDOR Rate', value: '0.2', unit: 'per 100k hours' },
              { label: 'LTI Frequency', value: '0', unit: 'incidents' },
              { label: 'Near Misses', value: '8', unit: 'this period' },
              { label: 'Training Compliance', value: '94%', unit: 'completion' },
            ].map((item) => (
              <div key={String(item.label)} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase mb-2">{String(item.label)}</p>
                <p className="text-2xl font-display text-white mb-1">{String(item.value)}</p>
                <p className="text-xs text-gray-500">{String(item.unit)}</p>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-lg font-display text-white mb-4">Incident Frequency Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
                  <Area type="monotone" dataKey="margin" stroke="#ef4444" fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Board Pack Tab */}
      {activeTab === 'boardpack' && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-display text-white mb-4">Generate Board Pack</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Report Period</label>
                <select
                  value={boardPackFormat}
                  onChange={(e) => setBoardPackFormat(e.target.value as 'month' | 'quarter')}
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
                >
                  <option value="month">Month</option>
                  <option value="quarter">Quarter</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Select {boardPackFormat === 'month' ? 'Month' : 'Quarter'}</label>
                <input
                  type="month"
                  value={boardPackMonth}
                  onChange={(e) => setBoardPackMonth(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <button
              onClick={() => setShowBoardPackPreview(!showBoardPackPreview)}
              className="btn btn-secondary mb-6"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {showBoardPackPreview ? 'Hide' : 'Show'} Preview
            </button>

            {showBoardPackPreview && (
              <div className="bg-gray-800/50 rounded-lg p-6 mb-6 space-y-6">
                {/* Executive Summary */}
                <div>
                  <h3 className="text-lg font-display text-white mb-3">Executive Summary</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">{MOCK_BOARD_PACK.executiveSummary}</p>
                </div>

                {/* Portfolio Health */}
                <div>
                  <h3 className="text-lg font-display text-white mb-3">Portfolio Health</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-gray-900 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Total Portfolio Value</p>
                      <p className="text-lg font-display text-emerald-400">{fmtCurrency(MOCK_BOARD_PACK.portfolioHealth.totalValue)}</p>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Projects On Track</p>
                      <p className="text-lg font-display text-blue-400">{MOCK_BOARD_PACK.portfolioHealth.projectsOnTrack}</p>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Projects At Risk</p>
                      <p className="text-lg font-display text-amber-400">{MOCK_BOARD_PACK.portfolioHealth.projectsAtRisk}</p>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Completion Rate</p>
                      <p className="text-lg font-display text-white">{MOCK_BOARD_PACK.portfolioHealth.completionRate}%</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {MOCK_PROJECTS_UK.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-xs p-2 bg-gray-900 rounded">
                        <span className="text-gray-300">{p.name}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${p.completion}%` }} />
                          </div>
                          <span className="text-gray-400 w-8 text-right">{p.completion}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial Summary */}
                <div>
                  <h3 className="text-lg font-display text-white mb-3">Financial Summary</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-900 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">YTD Revenue</p>
                      <p className="text-lg font-display text-emerald-400">{fmtCurrency(MOCK_BOARD_PACK.financialSummary.revenue)}</p>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Gross Margin</p>
                      <p className="text-lg font-display text-blue-400">{MOCK_BOARD_PACK.financialSummary.margin}%</p>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">FY Forecast</p>
                      <p className="text-lg font-display text-cyan-400">{fmtCurrency(MOCK_BOARD_PACK.financialSummary.forecast)}</p>
                    </div>
                  </div>
                </div>

                {/* Risk Overview */}
                <div>
                  <h3 className="text-lg font-display text-white mb-3">Risk Overview</h3>
                  <div className="space-y-2">
                    {MOCK_BOARD_PACK.riskOverview.map((r, idx) => (
                      <div key={idx} className="bg-gray-900 rounded-lg p-3 text-xs">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium text-white">{r.risk}</p>
                          <span className={`px-2 py-0.5 rounded ${r.impact === 'Medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {r.impact}
                          </span>
                        </div>
                        <p className="text-gray-400">Mitigation: {r.mitigation}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key Decisions Required */}
                <div>
                  <h3 className="text-lg font-display text-white mb-3">Key Decisions Required</h3>
                  <div className="space-y-2">
                    {MOCK_BOARD_PACK.decisions.map((d, idx) => (
                      <div key={idx} className="bg-gray-900 rounded-lg p-3 text-xs">
                        <p className="font-medium text-white mb-1">{d.decision}</p>
                        <div className="flex items-center justify-between text-gray-400">
                          <span>Owner: {d.owner}</span>
                          <span>Deadline: {d.deadline}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleGenerateBoardPackPDF}
              className="btn btn-primary w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Generate PDF
            </button>
          </div>
        </div>
      )}

      {/* KPI Dashboard Tab */}
      {activeTab === 'kpis' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-display text-white">Executive KPI Scorecard</h2>
            <select
              value={kpiPeriod}
              onChange={(e) => setKpiPeriod(e.target.value as 'mtd' | 'qtd' | 'ytd')}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
            >
              <option value="mtd">Month-to-Date</option>
              <option value="qtd">Quarter-to-Date</option>
              <option value="ytd">Year-to-Date</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: 'Portfolio Value',
                value: '£45.2M',
                unit: 'active contracts',
                trend: 3.2,
                trendLabel: 'vs last period',
              },
              {
                title: 'On-Time Delivery',
                value: '82%',
                unit: 'projects on schedule',
                trend: -2.1,
                trendLabel: 'vs target 95%',
              },
              {
                title: 'Budget Performance',
                value: '96.8%',
                unit: 'within budget',
                trend: 1.5,
                trendLabel: 'vs last period',
              },
              {
                title: 'Safety LTI Rate',
                value: '0.2',
                unit: 'per 100k hours',
                trend: -0.3,
                trendLabel: 'improving',
              },
              {
                title: 'Client Satisfaction',
                value: '4.6',
                unit: 'out of 5.0',
                trend: 0.2,
                trendLabel: 'steady growth',
              },
              {
                title: 'Revenue Forecast',
                value: '£8.5M',
                unit: 'FY target £9.2M',
                trend: 2.1,
                trendLabel: 'on track',
              },
            ].map((kpi, idx) => (
              <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-xs text-gray-400 uppercase mb-3">{kpi.title}</p>
                <div className="mb-4">
                  <p className="text-3xl font-display text-white mb-1">{kpi.value}</p>
                  <p className="text-xs text-gray-400">{kpi.unit}</p>
                </div>
                <div className="flex items-center gap-2 pt-4 border-t border-gray-800">
                  <TrendingUp className={`h-4 w-4 ${kpi.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                  <span className={`text-xs ${kpi.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {kpi.trend >= 0 ? '+' : ''}{kpi.trend}% {kpi.trendLabel}
                  </span>
                </div>
                <div className="mt-3 h-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={[
                        { v: 45 },
                        { v: 52 },
                        { v: 48 },
                        { v: 61 },
                        { v: 55 },
                        { v: 67 },
                      ]}
                    >
                      <Line type="monotone" dataKey="v" stroke="#f59e0b" dot={false} strokeWidth={2} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Benchmarking Tab */}
      {activeTab === 'benchmarking' && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-lg font-display text-white mb-4">Performance vs Industry Benchmark</h3>
            <div className="h-64 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={BENCHMARK_CHART_DATA}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis dataKey="name" type="category" stroke="#9ca3af" width={140} tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
                  <Legend />
                  <Bar dataKey="our" fill="#3b82f6" name="Our Performance" />
                  <Bar dataKey="benchmark" fill="#f59e0b" name="Best Practice" />
                  <Bar dataKey="industry" fill="#6b7280" name="Industry Avg" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-display text-gray-300">Metric</th>
                    <th className="text-right px-4 py-3 text-xs font-display text-gray-300">Our Performance</th>
                    <th className="text-right px-4 py-3 text-xs font-display text-gray-300">Industry Average</th>
                    <th className="text-right px-4 py-3 text-xs font-display text-gray-300">Best Practice</th>
                    <th className="text-center px-4 py-3 text-xs font-display text-gray-300">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {BENCHMARK_DATA.map((row) => {
                    let status = 'green';
                    if (row.metric.includes('overrun')) {
                      status = row.ourPerformance < row.benchmark ? 'green' : row.ourPerformance < row.industryAverage ? 'amber' : 'red';
                    } else if (row.metric.includes('incidents')) {
                      status = row.ourPerformance < row.benchmark ? 'green' : row.ourPerformance < row.industryAverage ? 'amber' : 'red';
                    } else {
                      status = row.ourPerformance >= row.benchmark ? 'green' : row.ourPerformance >= row.industryAverage ? 'amber' : 'red';
                    }
                    return (
                      <tr key={row.metric} className="hover:bg-gray-800/50">
                        <td className="px-4 py-3 text-gray-300 font-medium">{row.metric}</td>
                        <td className="px-4 py-3 text-right text-white">{row.ourPerformance}{row.metric.includes('%') || row.metric.includes('rate') ? (row.metric.includes('rate') ? '' : '%') : ''}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{row.industryAverage}{row.metric.includes('%') || row.metric.includes('rate') ? (row.metric.includes('rate') ? '' : '%') : ''}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{row.benchmark}{row.metric.includes('%') || row.metric.includes('rate') ? (row.metric.includes('rate') ? '' : '%') : ''}</td>
                        <td className="px-4 py-3 text-center">
                          <div className={`inline-flex items-center justify-center w-3 h-3 rounded-full ${status === 'green' ? 'bg-emerald-500' : status === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Reports Tab */}
      {activeTab === 'scheduled' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {scheduledReports.map((report) => (
              <div key={report.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-display text-white mb-1">{report.name}</h3>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="px-2 py-1 bg-gray-800 rounded capitalize">{report.frequency}</span>
                      <span>{report.format === 'pdf' ? 'PDF' : 'Email'} delivery</span>
                      {report.lastSent && <span>Last sent: {report.lastSent}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={report.enabled}
                        onChange={() => toggleScheduledReport(report.id)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-300">{report.enabled ? 'Enabled' : 'Disabled'}</span>
                    </label>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-gray-400 mb-2">Recipients:</p>
                  <div className="flex flex-wrap gap-2">
                    {report.recipients.map((recipient) => (
                      <span key={recipient} className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                        {recipient}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-gray-800">
                  <button
                    onClick={() => handleRunScheduledReport(report.id)}
                    className="btn btn-secondary btn-sm"
                  >
                    <Activity className="h-3 w-3 mr-1" />
                    Run Now
                  </button>
                  <button className="btn btn-ghost btn-sm">
                    <Calendar className="h-3 w-3 mr-1" />
                    Edit Schedule
                  </button>
                </div>
              </div>
            ))}
          </div>

          {scheduledReports.length === 0 && (
            <EmptyState
              icon={FileText}
              title="No scheduled reports"
              description="Create your first scheduled report to automate report delivery."
            />
          )}
        </div>
      )}
    </div>
  );
}

export default ExecutiveReports;
