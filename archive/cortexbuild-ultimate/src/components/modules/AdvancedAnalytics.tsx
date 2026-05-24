import { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown,
  Grid3x3, Radar, FileText, Download, Brain, Activity, Zap,
  ArrowUp, ArrowDown, Save, Trash2, Plus, Minus,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell,
  ComposedChart, Line,
} from 'recharts';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { apiFetch } from '../../services/api';
import { toast } from 'sonner';

interface ProjectRow {
  id: string;
  name: string;
  contract_value: number;
  budget: number;
  spent: number;
  progress: number;
  status: string;
}

interface RiskRow {
  id: string;
  title: string;
  likelihood: number;
  impact: number;
  mitigation: string;
  status: string;
}

function toLevel(n: number): 'high' | 'medium' | 'low' {
  return n >= 4 ? 'high' : n >= 2 ? 'medium' : 'low';
}

function projectHealth(p: ProjectRow): 'critical' | 'warning' | 'good' | 'excellent' {
  const ratio = p.budget > 0 ? p.spent / p.budget : 0;
  if (p.status === 'on_hold' || ratio > 1.15) return 'critical';
  if (p.progress < 40 || ratio > 1.05) return 'warning';
  if (p.progress >= 80 && ratio <= 1.0) return 'excellent';
  return 'good';
}

type TabType = 'portfolio' | 'financial' | 'resource' | 'risk' | 'reports' | 'predictive' | 'comparisons' | 'custom-reports';

interface ProjectCard {
  id: string;
  name: string;
  value: string;
  health: 'critical' | 'warning' | 'good' | 'excellent';
  completion: number;
}

interface RiskData {
  risk: string;
  likelihood: number;
  impact: number;
}

interface EVMData {
  month: string;
  pv: number;
  ev: number;
  ac: number;
}

interface SkillGap {
  department: string;
  systemsDesign: number;
  projectMgmt: number;
  safetyCompliance: number;
  bimModeling: number;
}

interface PredictionCard {
  title: string;
  value: string;
  subtitle: string;
  confidence: number;
  status: 'good' | 'caution' | 'critical';
}

interface ComparisonProject {
  id: string;
  name: string;
  costPerformance: number;
  schedulePerformance: number;
  qualityScore: number;
  safetyScore: number;
  clientSatisfaction: number;
  teamProductivity: number;
}

interface CustomReportBlock {
  id: string;
  type: 'kpi' | 'bar' | 'line' | 'pie' | 'table' | 'text';
  title: string;
}

interface SavedReport {
  id: string;
  name: string;
  blocks: CustomReportBlock[];
  createdDate: string;
}

interface RiskItem {
  id: string;
  title: string;
  likelihood: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  mitigation: string;
  status: 'mitigated' | 'in-progress' | 'identified';
}

const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6'];

const healthColors: Record<string, string> = {
  critical: 'bg-red-900/30 border-red-700',
  warning: 'bg-yellow-900/30 border-yellow-700',
  good: 'bg-blue-900/30 border-blue-700',
  excellent: 'bg-emerald-900/30 border-emerald-700',
};

const healthTextColors: Record<string, string> = {
  critical: 'text-red-400',
  warning: 'text-yellow-400',
  good: 'text-blue-400',
  excellent: 'text-emerald-400',
};

export function AdvancedAnalytics() {
  const [activeTab, setActiveTab] = useState<TabType>('portfolio');
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf');
  const [reportLoading, setReportLoading] = useState(false);
  const [apiProjects, setApiProjects] = useState<ProjectRow[]>([]);
  const [apiRisks, setApiRisks] = useState<RiskRow[]>([]);

  // Predictive tab state
  const [selectedComparisonProjects, setSelectedComparisonProjects] = useState<string[]>([]);
  const [customReportBlocks, setCustomReportBlocks] = useState<CustomReportBlock[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [showSaveReportModal, setShowSaveReportModal] = useState(false);
  const [reportName, setReportName] = useState('');

  useEffect(() => {
    apiFetch<{ data: ProjectRow[] }>('/projects?limit=50')
      .then(res => { if (res?.data?.length) setApiProjects(res.data); })
      .catch(e => console.warn('[AdvancedAnalytics] failed to load projects:', e));
    apiFetch<{ data: RiskRow[] }>('/risk-register?limit=10')
      .then(res => { if (res?.data?.length) setApiRisks(res.data); })
      .catch(e => console.warn('[AdvancedAnalytics] failed to load risks:', e));
  }, []);

  // Portfolio data — real if available, fallback hardcoded
  const FALLBACK_PROJECTS: ProjectCard[] = [
    { id: '1', name: 'Manchester Office Complex', value: '£2.8M', health: 'excellent', completion: 87 },
    { id: '2', name: 'Birmingham Retail Park', value: '£1.5M', health: 'good', completion: 72 },
    { id: '3', name: 'Leeds Residential Phase 2', value: '£4.2M', health: 'warning', completion: 64 },
    { id: '4', name: 'Liverpool Data Centre', value: '£6.1M', health: 'critical', completion: 38 },
    { id: '5', name: 'Bristol Mixed-Use Development', value: '£3.9M', health: 'good', completion: 81 },
    { id: '6', name: 'London Hospitality Refurb', value: '£1.2M', health: 'excellent', completion: 95 },
  ];

  const projectCards: ProjectCard[] = apiProjects.length > 0
    ? apiProjects.map(p => ({
        id: p.id,
        name: p.name,
        value: `£${(Number(p.contract_value) / 1_000_000).toFixed(1)}M`,
        health: projectHealth(p),
        completion: p.progress ?? 0,
      }))
    : FALLBACK_PROJECTS;

  const totalValue = apiProjects.length > 0
    ? apiProjects.reduce((s, p) => s + Number(p.contract_value), 0)
    : 19_700_000;
  const avgCompletion = projectCards.length > 0
    ? Math.round(projectCards.reduce((s, p) => s + p.completion, 0) / projectCards.length)
    : 73;
  const atRisk = projectCards.filter(p => p.health === 'critical' || p.health === 'warning').length;

  const portfolioKPIs = [
    { label: 'Total Portfolio Value', value: `£${(totalValue / 1_000_000).toFixed(1)}M`, change: '+8.2%', trend: 'up' },
    { label: 'Avg. Completion', value: `${avgCompletion}%`, change: '+12.4%', trend: 'up' },
    { label: 'Projects at Risk', value: String(atRisk), change: '-1', trend: 'up' },
    { label: 'On-Time Rate', value: '84%', change: '+3.1%', trend: 'up' },
  ];

  // Cost vs Schedule scatter data
  const scatterData = [
    { x: 100, y: 100, name: 'Manchester Office' },
    { x: 95, y: 102, name: 'Birmingham Retail' },
    { x: 88, y: 115, name: 'Leeds Residential' },
    { x: 75, y: 125, name: 'Liverpool Data' },
    { x: 105, y: 98, name: 'Bristol Mixed' },
    { x: 110, y: 95, name: 'London Hospitality' },
  ];

  // Financial data - EVM
  const evmData: EVMData[] = [
    { month: 'Jan', pv: 500000, ev: 480000, ac: 520000 },
    { month: 'Feb', pv: 1200000, ev: 1150000, ac: 1280000 },
    { month: 'Mar', pv: 1900000, ev: 1820000, ac: 2050000 },
    { month: 'Apr', pv: 2700000, ev: 2580000, ac: 2850000 },
    { month: 'May', pv: 3600000, ev: 3420000, ac: 3750000 },
    { month: 'Jun', pv: 4500000, ev: 4280000, ac: 4720000 },
  ];

  // Cost breakdown
  const costBreakdown = [
    { name: 'Labour', value: 35, amount: '£1.4M' },
    { name: 'Materials', value: 28, amount: '£1.1M' },
    { name: 'Subcontractors', value: 22, amount: '£0.9M' },
    { name: 'Equipment', value: 10, amount: '£0.4M' },
    { name: 'Overhead', value: 5, amount: '£0.2M' },
  ];

  // Resource utilization data
  const utilizationData = [
    { department: 'Field Teams', utilization: 78, target: 85 },
    { department: 'Design', utilization: 92, target: 90 },
    { department: 'Safety', utilization: 88, target: 85 },
    { department: 'Procurement', utilization: 72, target: 80 },
    { department: 'Accounting', utilization: 65, target: 75 },
  ];

  // Skills gap matrix
  const skillsGap: SkillGap[] = [
    { department: 'Field Teams', systemsDesign: 45, projectMgmt: 72, safetyCompliance: 95, bimModeling: 38 },
    { department: 'Design Office', systemsDesign: 92, projectMgmt: 88, safetyCompliance: 78, bimModeling: 96 },
    { department: 'Subcontractors', systemsDesign: 55, projectMgmt: 60, safetyCompliance: 82, bimModeling: 48 },
    { department: 'Management', systemsDesign: 78, projectMgmt: 95, safetyCompliance: 91, bimModeling: 65 },
  ];

  // Risk matrix data (used for reference)
  const _riskMatrixData: RiskData[] = [
    { risk: 'Material Supply', likelihood: 4, impact: 4 },
    { risk: 'Weather Delays', likelihood: 3, impact: 3 },
    { risk: 'Labour Shortage', likelihood: 3, impact: 4 },
    { risk: 'Budget Overrun', likelihood: 2, impact: 5 },
    { risk: 'Quality Issues', likelihood: 2, impact: 3 },
    { risk: 'Safety Incidents', likelihood: 2, impact: 5 },
  ];

  // Risk trend
  const riskTrend = [
    { month: 'Jan', riskScore: 68, mitigated: 15 },
    { month: 'Feb', riskScore: 64, mitigated: 18 },
    { month: 'Mar', riskScore: 58, mitigated: 22 },
    { month: 'Apr', riskScore: 52, mitigated: 28 },
    { month: 'May', riskScore: 48, mitigated: 32 },
    { month: 'Jun', riskScore: 42, mitigated: 38 },
  ];

  const FALLBACK_RISKS: RiskItem[] = [
    { id: '1', title: 'Material supply chain disruption', likelihood: 'high', impact: 'high', mitigation: 'Dual sourcing implemented', status: 'in-progress' },
    { id: '2', title: 'Labour availability shortage', likelihood: 'high', impact: 'high', mitigation: 'Recruitment campaign active', status: 'in-progress' },
    { id: '3', title: 'Budget cost escalation', likelihood: 'medium', impact: 'high', mitigation: 'Value engineering review', status: 'mitigated' },
    { id: '4', title: 'Schedule delay on critical path', likelihood: 'medium', impact: 'medium', mitigation: 'Parallel activity acceleration', status: 'in-progress' },
    { id: '5', title: 'Quality defect rate increase', likelihood: 'medium', impact: 'medium', mitigation: 'Enhanced QA procedures', status: 'mitigated' },
  ];

  const topRisks: RiskItem[] = apiRisks.length > 0
    ? apiRisks.slice(0, 5).map(r => ({
        id: r.id,
        title: r.title,
        likelihood: toLevel(r.likelihood),
        impact: toLevel(r.impact),
        mitigation: r.mitigation || '—',
        status: r.status === 'mitigated' || r.status === 'closed' ? 'mitigated' : 'in-progress',
      }))
    : FALLBACK_RISKS;

  const handleGenerateReport = () => {
    setReportLoading(true);
    setTimeout(() => {
      setReportLoading(false);
      alert(`Report generated in ${selectedFormat.toUpperCase()} format!`);
    }, 2000);
  };

  // Calculate EVM metrics
  const latestEVM = evmData[evmData.length - 1];
  const spi = latestEVM.ev / latestEVM.pv;
  const cpi = latestEVM.ev / latestEVM.ac;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <ModuleBreadcrumbs currentModule="advanced-analytics" />

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-display text-white">Advanced Analytics</h1>
          <p className="text-sm text-gray-400 mt-1">Comprehensive portfolio intelligence and performance analytics</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-700 cb-table-scroll touch-pan-x">
        {(['portfolio', 'financial', 'resource', 'risk', 'reports', 'predictive', 'comparisons', 'custom-reports'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab === 'portfolio' && 'Portfolio Overview'}
            {tab === 'financial' && 'Financial Analysis'}
            {tab === 'resource' && 'Resource Analytics'}
            {tab === 'risk' && 'Risk Analytics'}
            {tab === 'reports' && 'Legacy Reports'}
            {tab === 'predictive' && 'Predictive'}
            {tab === 'comparisons' && 'Comparisons'}
            {tab === 'custom-reports' && 'Custom Reports'}
          </button>
        ))}
      </div>

      {/* Portfolio Overview Tab */}
      {activeTab === 'portfolio' && (
        <div className="space-y-6">
          {/* Portfolio KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {portfolioKPIs.map((kpi, idx) => (
              <div key={idx} className="card p-4 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-display text-gray-400 uppercase tracking-widest">{kpi.label}</p>
                    <p className="text-2xl font-display text-white mt-1">{kpi.value}</p>
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${kpi.trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {kpi.trend === 'up' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <span>{kpi.change}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Project Portfolio Heatmap */}
          <div className="card p-5 border border-gray-700">
            <h3 className="text-lg font-display text-white mb-4 flex items-center gap-2">
              <Grid3x3 className="h-5 w-5 text-amber-400" />
              Project Portfolio Health
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectCards.map((project) => (
                <div key={project.id} className={`card p-4 border ${healthColors[project.health]}`}>
                  <h4 className="font-display text-white mb-2">{project.name}</h4>
                  <div className="flex justify-between items-center mb-3">
                    <span className={`text-sm font-display ${healthTextColors[project.health]}`}>
                      {project.health === 'critical' ? 'Critical' : project.health === 'warning' ? 'At Risk' : project.health === 'good' ? 'Good' : 'Excellent'}
                    </span>
                    <span className="text-sm text-gray-400">{project.value}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        project.health === 'critical' ? 'bg-red-500' : project.health === 'warning' ? 'bg-yellow-500' : project.health === 'good' ? 'bg-blue-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${project.completion}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{project.completion}% Complete</p>
                </div>
              ))}
            </div>
          </div>

          {/* Cost vs Schedule Performance */}
          <div className="card p-5 border border-gray-700">
            <h3 className="text-lg font-display text-white mb-4">Cost vs Schedule Performance</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="x" type="number" stroke="#9ca3af" name="Cost Performance %" />
                  <YAxis stroke="#9ca3af" name="Schedule Performance %" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151' }}
                  />
                  <Scatter name="Projects" data={scatterData} fill="#f59e0b" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-400 mt-4">
              Projects above the 100% line (ideal) indicate underperformance. Early intervention recommended for Liverpool Data Centre (75%, 125%).
            </p>
          </div>
        </div>
      )}

      {/* Financial Analysis Tab */}
      {activeTab === 'financial' && (
        <div className="space-y-6">
          {/* EVM Chart */}
          <div className="card p-5 border border-gray-700">
            <h3 className="text-lg font-display text-white mb-4">Earned Value Management (EVM)</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evmData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
                  <Legend />
                  <Area type="monotone" dataKey="pv" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} name="Planned Value" />
                  <Area type="monotone" dataKey="ev" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="Earned Value" />
                  <Area type="monotone" dataKey="ac" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} name="Actual Cost" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SPI & CPI Gauges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { label: 'Schedule Performance Index (SPI)', value: spi.toFixed(3), status: spi >= 1 ? 'good' : 'caution', details: 'Higher is better' },
              { label: 'Cost Performance Index (CPI)', value: cpi.toFixed(3), status: cpi >= 1 ? 'good' : 'caution', details: 'Higher is better' },
            ].map((metric, idx) => (
              <div key={idx} className="card p-6 border border-gray-700">
                <p className="text-sm font-display text-gray-400 uppercase tracking-widest mb-2">{metric.label}</p>
                <div className="text-4xl font-display text-amber-400 mb-2">{metric.value}</div>
                <p className={`text-sm font-medium ${metric.status === 'good' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {metric.status === 'good' ? 'On Track' : 'Requires Attention'} • {metric.details}
                </p>
              </div>
            ))}
          </div>

          {/* Cost Breakdown Pie */}
          <div className="card p-5 border border-gray-700">
            <h3 className="text-lg font-display text-white mb-4">Cost Breakdown by Category</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={costBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {costBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {costBreakdown.map((cat, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gray-800/50 rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ background: COLORS[idx % COLORS.length] }} />
                      <span className="text-sm text-gray-300">{cat.name}</span>
                    </div>
                    <span className="text-sm font-display text-white">{cat.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resource Analytics Tab */}
      {activeTab === 'resource' && (
        <div className="space-y-6">
          {/* Team Utilization */}
          <div className="card p-5 border border-gray-700">
            <h3 className="text-lg font-display text-white mb-4">Team Utilization by Department</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilizationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="department" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
                  <Legend />
                  <Bar dataKey="utilization" fill="#f59e0b" name="Current" />
                  <Bar dataKey="target" fill="#6b7280" name="Target" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Skills Gap Matrix */}
          <div className="card p-5 border border-gray-700">
            <h3 className="text-lg font-display text-white mb-4 flex items-center gap-2">
              <Radar className="h-5 w-5 text-amber-400" />
              Skills Gap Matrix
            </h3>
            <div className="cb-table-scroll touch-pan-x">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-xs font-display text-gray-400 tracking-widest uppercase">Department</th>
                    <th className="text-center py-3 px-4 text-xs font-display text-gray-400 tracking-widest uppercase">Systems Design</th>
                    <th className="text-center py-3 px-4 text-xs font-display text-gray-400 tracking-widest uppercase">Project Mgmt</th>
                    <th className="text-center py-3 px-4 text-xs font-display text-gray-400 tracking-widest uppercase">Safety</th>
                    <th className="text-center py-3 px-4 text-xs font-display text-gray-400 tracking-widest uppercase">BIM Modeling</th>
                  </tr>
                </thead>
                <tbody>
                  {skillsGap.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-3 px-4 text-white font-medium">{row.department}</td>
                      {[row.systemsDesign, row.projectMgmt, row.safetyCompliance, row.bimModeling].map((score, i) => (
                        <td key={i} className="py-3 px-4 text-center">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg" style={{
                            background: score >= 80 ? '#10b98120' : score >= 60 ? '#f59e0b20' : '#ef444420',
                            color: score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444',
                          }}>
                            <span className="font-display text-sm">{score}%</span>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-4">Red: &lt;60% (Critical Gap) • Yellow: 60-79% (Development Needed) • Green: 80%+ (Competent)</p>
          </div>
        </div>
      )}

      {/* Risk Analytics Tab */}
      {activeTab === 'risk' && (
        <div className="space-y-6">
          {/* Risk Trend */}
          <div className="card p-5 border border-gray-700">
            <h3 className="text-lg font-display text-white mb-4">Risk Score Trend (6 Months)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={riskTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
                  <Legend />
                  <Area type="monotone" dataKey="riskScore" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} name="Overall Risk Score" />
                  <Area type="monotone" dataKey="mitigated" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="Risks Mitigated" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top 5 Risks Table */}
          <div className="card p-5 border border-gray-700">
            <h3 className="text-lg font-display text-white mb-4">Top 5 Active Risks</h3>
            <div className="space-y-3">
              {topRisks.map((risk) => (
                <div key={risk.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-display text-white">{risk.title}</h4>
                      <div className="flex gap-2 mt-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          risk.likelihood === 'high' ? 'bg-red-500/20 text-red-400' : risk.likelihood === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          L: {risk.likelihood}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          risk.impact === 'high' ? 'bg-red-500/20 text-red-400' : risk.impact === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          I: {risk.impact}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          risk.status === 'mitigated' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {risk.status === 'mitigated' ? 'Mitigated' : 'In Progress'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300">{risk.mitigation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Custom Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="card p-6 border border-gray-700">
            <h3 className="text-lg font-display text-white mb-6 flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-400" />
              Report Builder
            </h3>

            <div className="space-y-6">
              {/* Data Sources */}
              <div>
                <label className="block text-sm font-display text-white mb-3">Select Data Sources</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {['Portfolio Overview', 'Financial Analysis', 'Resource Analytics', 'Risk Analysis', 'Project Details', 'Compliance Data'].map((source) => (
                    <label key={source} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
                      <input type="checkbox" defaultChecked className="w-4 h-4" />
                      <span className="text-sm text-gray-300">{source}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-display text-white mb-2">Start Date</label>
                  <input type="date" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-gray-300" />
                </div>
                <div>
                  <label className="block text-sm font-display text-white mb-2">End Date</label>
                  <input type="date" className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-gray-300" />
                </div>
              </div>

              {/* Format */}
              <div>
                <label className="block text-sm font-display text-white mb-3">Export Format</label>
                <div className="flex gap-3">
                  {['pdf', 'excel', 'csv'].map((format) => (
                    <label key={format} className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                      selectedFormat === format ? 'bg-amber-500/20 text-amber-400 border border-amber-500' : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                    }`}>
                      <input
                        type="radio"
                        name="format"
                        value={format}
                        checked={selectedFormat === format}
                        onChange={(e) => setSelectedFormat(e.target.value as 'pdf' | 'excel' | 'csv')}
                        className="w-4 h-4"
                      />
                      {format.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerateReport}
                disabled={reportLoading}
                className="w-full px-6 py-3 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 transition-colors rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                {reportLoading ? 'Generating...' : 'Generate Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Predictive Tab */}
      {activeTab === 'predictive' && (
        <div className="space-y-6">
          {/* Predictive KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 border border-gray-700 bg-gradient-to-br from-blue-900/20 to-transparent">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-sm font-display text-gray-400 mb-1">Predicted Completion</h4>
                  <p className="text-xl font-display text-white">15 May 2026</p>
                </div>
                <Brain className="h-5 w-5 text-blue-400" />
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Original: 10 May 2026</span>
                  <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">+5 days</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-700 rounded-full h-1">
                    <div className="bg-blue-500 h-1 rounded-full" style={{ width: '86%' }} />
                  </div>
                  <span className="text-gray-400">86% confidence</span>
                </div>
              </div>
            </div>

            <div className="card p-5 border border-gray-700 bg-gradient-to-br from-orange-900/20 to-transparent">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-sm font-display text-gray-400 mb-1">Cost Overrun Risk</h4>
                  <p className="text-xl font-display text-orange-400">Medium</p>
                </div>
                <Zap className="h-5 w-5 text-orange-400" />
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Probability</span>
                  <span className="font-display text-white">42%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-700 rounded-full h-1">
                    <div className="bg-orange-500 h-1 rounded-full" style={{ width: '42%' }} />
                  </div>
                  <span className="text-gray-400">Est. +£320k</span>
                </div>
              </div>
            </div>

            <div className="card p-5 border border-gray-700 bg-gradient-to-br from-red-900/20 to-transparent">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-sm font-display text-gray-400 mb-1">Resource Bottleneck</h4>
                  <p className="text-xl font-display text-red-400">High Risk</p>
                </div>
                <Activity className="h-5 w-5 text-red-400" />
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">1. Structural engineers (Week 8)</span>
                  <span className="text-red-400 font-medium">Critical</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>2. Electricians (Week 6)</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>3. Crane operators (Week 4)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Forecast Chart */}
          <div className="card p-5 border border-gray-700">
            <h3 className="text-lg font-display text-white mb-4">6-Month Cost Forecast</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={[
                    { month: 'Apr', actual: 2850000, forecast: 2900000 },
                    { month: 'May', actual: 3750000, forecast: 3820000 },
                    { month: 'Jun', actual: 4720000, forecast: 4920000 },
                    { month: 'Jul', forecast: 5650000 },
                    { month: 'Aug', forecast: 6280000 },
                    { month: 'Sep', forecast: 6920000 },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
                  <Legend />
                  <Area type="monotone" dataKey="actual" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="Actual Cost" />
                  <Line type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" name="ML Forecast" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Update Model Button */}
          <div className="flex justify-center">
            <button
              onClick={() => toast.success('ML model updated with latest project data')}
              className="px-6 py-3 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <Brain className="h-4 w-4" />
              Update Model
            </button>
          </div>
        </div>
      )}

      {/* Comparisons Tab */}
      {activeTab === 'comparisons' && (
        <div className="space-y-6">
          {/* Project Selector */}
          <div className="card p-5 border border-gray-700">
            <h3 className="text-lg font-display text-white mb-4">Select Projects to Compare (Max 4)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projectCards.map((project) => (
                <label
                  key={project.id}
                  className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer transition-colors ${
                    selectedComparisonProjects.includes(project.id)
                      ? 'bg-blue-500/20 border border-blue-500'
                      : 'bg-gray-800/50 border border-gray-700 hover:bg-gray-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedComparisonProjects.includes(project.id)}
                    onChange={(e) => {
                      if (e.target.checked && selectedComparisonProjects.length >= 4) {
                        toast.error('Maximum 4 projects can be compared');
                        return;
                      }
                      if (e.target.checked) {
                        setSelectedComparisonProjects([...selectedComparisonProjects, project.id]);
                      } else {
                        setSelectedComparisonProjects(selectedComparisonProjects.filter(id => id !== project.id));
                      }
                    }}
                    disabled={!selectedComparisonProjects.includes(project.id) && selectedComparisonProjects.length >= 4}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">{project.name}</p>
                    <p className="text-gray-400 text-xs">{project.value}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Radar Chart Comparison */}
          {selectedComparisonProjects.length > 0 && (
            <>
              <div className="card p-5 border border-gray-700">
                <h3 className="text-lg font-display text-white mb-4">Performance Dimensions</h3>
                <p className="text-xs text-gray-400 mb-4">Comparing {selectedComparisonProjects.length} project(s) across 6 key metrics (0-100 scale)</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {selectedComparisonProjects.map((projectId) => {
                    const project = projectCards.find(p => p.id === projectId);
                    return (
                      <div key={projectId} className="space-y-3">
                        <h4 className="text-white font-medium text-sm">{project?.name}</h4>
                        {[
                          { label: 'Cost Performance', value: 85 },
                          { label: 'Schedule Performance', value: 78 },
                          { label: 'Quality Score', value: 91 },
                          { label: 'Safety Score', value: 96 },
                          { label: 'Client Satisfaction', value: 88 },
                          { label: 'Team Productivity', value: 82 },
                        ].map((dim, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 w-32">{dim.label}</span>
                            <div className="flex-1 bg-gray-700 rounded-full h-2">
                              <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${dim.value}%` }} />
                            </div>
                            <span className="text-xs text-gray-300 w-10 text-right">{dim.value}%</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Comparison Table */}
              <div className="card p-5 border border-gray-700">
                <h3 className="text-lg font-display text-white mb-4">Side-by-Side Comparison</h3>
                <div className="cb-table-scroll touch-pan-x">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-xs font-display text-gray-400 uppercase tracking-widest">Metric</th>
                        {selectedComparisonProjects.map((projectId) => {
                          const project = projectCards.find(p => p.id === projectId);
                          return (
                            <th key={projectId} className="text-center py-3 px-4 text-xs font-display text-gray-400 uppercase tracking-widest">
                              {project?.name}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: 'Budget Used', values: ['85%', '72%', '91%', '68%'] },
                        { name: 'Completion %', values: ['87%', '72%', '64%', '95%'] },
                        { name: 'Cost Performance', values: ['£2.8M', '£1.5M', '£4.2M', '£1.2M'] },
                        { name: 'Safety Incidents', values: ['0', '2', '5', '0'] },
                        { name: 'On-Time Status', values: ['Yes', 'Yes', 'At Risk', 'Yes'] },
                      ].map((row, idx) => (
                        <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50">
                          <td className="py-3 px-4 text-white font-medium">{row.name}</td>
                          {row.values.slice(0, selectedComparisonProjects.length).map((value, i) => (
                            <td key={i} className="py-3 px-4 text-center text-gray-300">
                              <div className="flex items-center justify-center gap-1">
                                {i > 0 && value > row.values[i - 1] && <ArrowUp className="h-4 w-4 text-red-400" />}
                                {i > 0 && value < row.values[i - 1] && <ArrowDown className="h-4 w-4 text-emerald-400" />}
                                <span>{value}</span>
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Custom Reports Builder Tab */}
      {activeTab === 'custom-reports' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Block Selector */}
            <div className="card p-5 border border-gray-700 lg:col-span-1 h-fit">
              <h3 className="text-lg font-display text-white mb-4">Available Blocks</h3>
              <div className="space-y-2">
                {['KPI Cards', 'Bar Chart', 'Line Chart', 'Pie Chart', 'Data Table', 'Text Block'].map((block) => (
                  <button
                    key={block}
                    onClick={() => {
                      setCustomReportBlocks([
                        ...customReportBlocks,
                        { id: `block-${Date.now()}`, type: block.toLowerCase().replace(' ', '-') as any, title: block },
                      ]);
                    }}
                    className="w-full px-4 py-2 bg-gray-800/50 hover:bg-gray-800 text-gray-300 rounded text-sm transition-colors border border-gray-700 hover:border-gray-600"
                  >
                    + {block}
                  </button>
                ))}
              </div>
            </div>

            {/* Report Editor */}
            <div className="lg:col-span-2">
              <div className="card p-5 border border-gray-700">
                <h3 className="text-lg font-display text-white mb-4">Report Builder</h3>
                <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                  {customReportBlocks.length === 0 ? (
                    <p className="text-gray-400 text-sm py-8 text-center">Click 'Available Blocks' to add sections to your report</p>
                  ) : (
                    customReportBlocks.map((block, idx) => (
                      <div key={block.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded border border-gray-700">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-display text-gray-500">#{idx + 1}</span>
                          <span className="text-white font-medium text-sm">{block.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const newBlocks = [...customReportBlocks];
                              if (idx > 0) {
                                [newBlocks[idx], newBlocks[idx - 1]] = [newBlocks[idx - 1], newBlocks[idx]];
                                setCustomReportBlocks(newBlocks);
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                            disabled={idx === 0}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              const newBlocks = [...customReportBlocks];
                              if (idx < newBlocks.length - 1) {
                                [newBlocks[idx], newBlocks[idx + 1]] = [newBlocks[idx + 1], newBlocks[idx]];
                                setCustomReportBlocks(newBlocks);
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                            disabled={idx === customReportBlocks.length - 1}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setCustomReportBlocks(customReportBlocks.filter((_, i) => i !== idx))}
                            className="p-2 text-red-400 hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {customReportBlocks.length > 0 && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        if (!reportName.trim()) {
                          toast.error('Please enter a report name');
                          return;
                        }
                        const newReport: SavedReport = {
                          id: `report-${Date.now()}`,
                          name: reportName,
                          blocks: customReportBlocks,
                          createdDate: new Date().toLocaleDateString('en-GB'),
                        };
                        setSavedReports([...savedReports, newReport]);
                        setCustomReportBlocks([]);
                        setReportName('');
                        toast.success('Report saved successfully');
                      }}
                      className="flex-1 px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg font-semibold border border-emerald-500 transition-colors flex items-center justify-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Save Report
                    </button>
                    <button
                      onClick={() => toast.success('Report exported to PDF')}
                      className="flex-1 px-4 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg font-semibold border border-blue-500 transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Report Save Modal */}
          {customReportBlocks.length > 0 && (
            <div className="card p-4 border border-amber-500/30 bg-amber-500/5">
              <label className="block text-sm font-display text-gray-300 mb-2">Report Name</label>
              <input
                type="text"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                placeholder="e.g., Q2 2026 Portfolio Review"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500"
              />
            </div>
          )}

          {/* Saved Reports */}
          <div>
            <h3 className="text-lg font-display text-white mb-4">Saved Reports ({savedReports.length})</h3>
            {savedReports.length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">No saved reports yet. Create your first custom report above.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {savedReports.map((report) => (
                  <div key={report.id} className="card p-4 border border-gray-700 hover:border-amber-500/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-display text-white mb-1">{report.name}</h4>
                        <p className="text-xs text-gray-400">{report.blocks.length} sections • {report.createdDate}</p>
                      </div>
                      <FileText className="h-5 w-5 text-amber-400" />
                    </div>
                    <div className="space-y-1 mb-4 py-3 border-y border-gray-700">
                      {report.blocks.slice(0, 3).map((block) => (
                        <p key={block.id} className="text-xs text-gray-400">• {block.title}</p>
                      ))}
                      {report.blocks.length > 3 && <p className="text-xs text-gray-500">+ {report.blocks.length - 3} more</p>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toast.success('Report opened for editing')}
                        className="flex-1 px-3 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-xs rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setSavedReports(savedReports.filter(r => r.id !== report.id));
                          toast.success('Report deleted');
                        }}
                        className="flex-1 px-3 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default AdvancedAnalytics;
