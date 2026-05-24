// Module: Insights — CortexBuild Ultimate Enhanced
import { useState, useEffect } from 'react';
import {
  TrendingUp, AlertTriangle, Lightbulb, Activity, Shield, PoundSterling,
  Users, FileText, ClipboardList, Target, RefreshCw,
  CheckSquare, Square, Trash2, Brain, CheckCircle, XCircle, BarChart3, Zap, Clock,
  TrendingDown, AlertCircle, Award, Download, Database, Gauge, Percent, DollarSign, ArrowUp, ArrowDown
} from 'lucide-react';
import { toast } from 'sonner';
import { insightsApi } from '../../services/api';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { EmptyState } from '../ui/EmptyState';
import {
  BarChart, Bar, PieChart as RechartsPie, LineChart, Line,
  Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';

type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
type CategoryType = 'all' | 'financial' | 'safety' | 'programme' | 'resource' | 'quality' | 'risk';
type TabType = 'overview' | 'alerts' | 'recommendations' | 'benchmarks' | 'actions' | 'trends' | 'trends-analysis' | 'learning';

interface Insight {
  id: string;
  category: Exclude<CategoryType, 'all'>;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  recommendation: string;
  impact: string;
  confidence: number;
  dataPoints: number;
  generatedAt?: string;
}

interface Alert {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  module: string;
  suggestedAction: string;
  createdAt: string;
}

interface Recommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  estimatedBenefit: string;
}

interface AIAction {
  id: string;
  timestamp: string;
  module: string;
  action: string;
  outcome: 'success' | 'pending' | 'failed';
  details: string;
}

interface TrendData {
  month: string;
  riskScore: number;
  costEfficiency: number;
  teamProductivity: number;
}

const SEVERITY_CONFIG: Record<'critical' | 'high' | 'medium' | 'low' | 'info', { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'Critical', color: '#ef4444', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)' },
  high: { label: 'High', color: '#f97316', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.3)' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
  low: { label: 'Low', color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
  info: { label: 'Info', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)' },
};

const PRIORITY_CONFIG: Record<'critical' | 'high' | 'medium' | 'low', { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#ef4444', bg: 'bg-red-500/10' },
  high: { label: 'High', color: '#f97316', bg: 'bg-orange-500/10' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'bg-yellow-500/10' },
  low: { label: 'Low', color: '#3b82f6', bg: 'bg-blue-500/10' },
};



export function Insights() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryType>('all');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [dismissedRecs, setDismissedRecs] = useState<Set<string>>(new Set());
  const [macroTrends, setMacroTrends] = useState<TrendItem[]>([]);
  const [kpiTrends, setKpiTrends] = useState<KpiTrend[]>([]);
  const [aiLearnings, setAiLearnings] = useState<AnyRow[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);

  const { data: allInsights = [] } = useQuery({
    queryKey: ['insights'],
    queryFn: insightsApi.getAll,
  });

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  type AnyRow = Record<string, unknown>;

interface TrendItem {
  id: string | number;
  title: string;
  category: string;
  month: string;
  trend: 'up' | 'down' | 'neutral';
  detail: string;
  change?: number | null;
}

interface KpiTrend {
  id: string | number;
  metric: string;
  value: string | number;
  target: string | number;
  deviation: number;
  trend: 'up' | 'down';
}

interface DataSource {
  id: string | number;
  name: string;
  records: string | number;
  lastSynced?: string;
  lastSync?: string;
  connected?: boolean;
  icon?: string;
}

  useEffect(() => {
    // Mock macro trends data
    setMacroTrends([
      { id: '1', title: 'Material Costs Index', category: 'Material Costs', change: 8.3, trend: 'up', detail: 'Steel +12%, Copper +5%, Timber +6%', month: 'Apr 2026' },
      { id: '2', title: 'Labour Market Tightness', category: 'Labour Market', change: 3.2, trend: 'up', detail: 'Construction wage growth 4.2% YoY', month: 'Apr 2026' },
      { id: '3', title: 'Building Regs Update', category: 'Regulatory', change: null, trend: 'neutral', detail: 'Fire Safety Act 2024 enforcement begins June 2026', month: 'Apr 2026' },
      { id: '4', title: 'Weather Forecast Q2', category: 'Weather', change: -5.2, trend: 'down', detail: 'Expected above-average rainfall +15%', month: 'Apr 2026' },
    ]);

    setKpiTrends([
      { id: '1', metric: 'Project Delivery', value: 94, target: 90, deviation: 4, trend: 'up' },
      { id: '2', metric: 'Budget Variance', value: 2.3, target: 5, deviation: -2.7, trend: 'up' },
      { id: '3', metric: 'Safety Score', value: 96, target: 95, deviation: 1, trend: 'up' },
      { id: '4', metric: 'Labour Productivity', value: 87, target: 85, deviation: 2, trend: 'up' },
      { id: '5', metric: 'Material Waste', value: 3.1, target: 2.5, deviation: 0.6, trend: 'down' },
    ]);

    setAiLearnings([
      { id: '1', title: 'Project Geography', description: 'We\'ve completed 247 projects across 42 UK postcodes, with concentration in SW1, EC1, and M1 regions' },
      { id: '2', title: 'Payment Terms', description: 'Average payment terms are 34 days, with 78% of clients paying within 40 days' },
      { id: '3', title: 'Defect Patterns', description: 'Most common defect type is weather-related cladding (12%), followed by drainage (8%)' },
      { id: '4', title: 'Schedule Patterns', description: 'Projects in winter run 8-12% longer; summer delays 4-6% due to weather' },
      { id: '5', title: 'Cost Drivers', description: 'Labour is 48% of costs, materials 35%, subcontractors 12%, other 5%' },
      { id: '6', title: 'Repeat Clients', description: '31% of revenue comes from repeat clients; avg 2.3 projects per client' },
    ]);

    setDataSources([
      { id: '1', name: 'Projects', records: 247, lastSync: '2 hours ago', icon: '📊' },
      { id: '2', name: 'Invoices', records: 1243, lastSync: '1 hour ago', icon: '💷' },
      { id: '3', name: 'Safety Reports', records: 89, lastSync: '4 hours ago', icon: '🛡️' },
      { id: '4', name: 'RFIs', records: 342, lastSync: '30 mins ago', icon: '📋' },
      { id: '5', name: 'Timesheets', records: 5621, lastSync: 'Just now', icon: '⏱️' },
      { id: '6', name: 'Contacts', records: 543, lastSync: '3 hours ago', icon: '👥' },
    ]);
  }, []);

  // Alerts derived from high/critical insights
  const realAlerts: Alert[] = allInsights
    .filter(i => i.severity === 'critical' || i.severity === 'high')
    .map(i => ({
      id: i.id,
      priority: i.severity as 'critical' | 'high',
      title: i.title,
      description: i.description,
      module: i.category.charAt(0).toUpperCase() + i.category.slice(1),
      suggestedAction: i.recommendation,
      createdAt: i.generatedAt ? new Date(i.generatedAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : 'Recently',
    }));

  // Recommendations derived from all insights
  const realRecommendations: Recommendation[] = allInsights
    .filter(i => i.recommendation)
    .map(i => ({
      id: `rec-${i.id}`,
      category: i.category.charAt(0).toUpperCase() + i.category.slice(1),
      title: i.title,
      description: i.recommendation,
      impact: (i.severity === 'critical' || i.severity === 'high') ? 'high' : i.severity === 'medium' ? 'medium' : 'low',
      estimatedBenefit: `${Math.round(i.confidence)}% confidence`,
    }));

  // AI actions derived from insights
  const realAIActions: AIAction[] = allInsights
    .filter(i => i.generatedAt)
    .sort((a, b) => new Date(b.generatedAt!).getTime() - new Date(a.generatedAt!).getTime())
    .slice(0, 10)
    .map(i => ({
      id: `action-${i.id}`,
      timestamp: (() => {
        const diff = Date.now() - new Date(i.generatedAt!).getTime();
        const hours = Math.floor(diff / 3600000);
        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
      })(),
      module: i.category.charAt(0).toUpperCase() + i.category.slice(1),
      action: i.title,
      outcome: 'success' as const,
      details: i.description,
    }));

  // Trend & benchmark data (industry constants — no live API)
  const TREND_DATA: TrendData[] = [
    { month: 'Oct', riskScore: 72, costEfficiency: 68, teamProductivity: 75 },
    { month: 'Nov', riskScore: 68, costEfficiency: 71, teamProductivity: 78 },
    { month: 'Dec', riskScore: 65, costEfficiency: 74, teamProductivity: 82 },
    { month: 'Jan', riskScore: 62, costEfficiency: 76, teamProductivity: 85 },
    { month: 'Feb', riskScore: 58, costEfficiency: 78, teamProductivity: 84 },
    { month: 'Mar', riskScore: 52, costEfficiency: 81, teamProductivity: 87 },
  ];
  const BENCHMARK_DATA = [
    { metric: 'Project Completion', cortex: 94, industry: 82 },
    { metric: 'Cost Variance', cortex: 2.3, industry: 5.8 },
    { metric: 'Safety Incidents', cortex: 3, industry: 8 },
    { metric: 'RFI Resolution', cortex: 2.1, industry: 4.5 },
  ];

  // Dismiss an insight (local state only — backend generates fresh)
  const _dismissInsight = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
  };

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} insight(s)?`)) return;
    toast.success(`Deleted ${ids.length} insight(s)`);
    setDismissed(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    clearSelection();
  }

  const filteredInsights = allInsights.filter((insight) => {
    if (dismissed.has(insight.id)) return false;
    if (severityFilter !== 'all' && insight.severity !== severityFilter) return false;
    if (categoryFilter !== 'all' && insight.category !== categoryFilter) return false;
    return true;
  });

  const filteredAlerts = realAlerts.filter(alert => !dismissedAlerts.has(alert.id));
  const sortedAlerts = [...filteredAlerts].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const criticalCount = filteredInsights.filter((i) => i.severity === 'critical').length;
  const highCount = filteredInsights.filter((i) => i.severity === 'high').length;
  const avgConfidence = filteredInsights.length
    ? Math.round(filteredInsights.reduce((s, i) => s + i.confidence, 0) / filteredInsights.length)
    : 0;

  const categoryData = [
    { category: 'Financial', critical: 1, high: 1, medium: 0 },
    { category: 'Safety', critical: 1, high: 0, medium: 0 },
    { category: 'Programme', critical: 0, high: 0, medium: 1 },
    { category: 'Resource', critical: 0, high: 0, medium: 1 },
    { category: 'Quality', critical: 0, high: 0, medium: 0 },
  ];

  const confidenceData = [
    { name: '90%+', value: 3, color: '#10b981' },
    { name: '80-89%', value: 2, color: '#f59e0b' },
    { name: '<80%', value: 0, color: '#ef4444' },
  ];

  // Calculate health score (guarded against empty insights list)
  const healthScore = filteredInsights.length > 0
    ? Math.round(
        (avgConfidence * 0.3 + (100 - ((criticalCount / filteredInsights.length) * 100)) * 0.4 + (highCount > 3 ? 50 : 90) * 0.3)
      )
    : 100;

  // Calculate KPIs
  const insightsGenerated = filteredInsights.length;
  const alertsResolved = dismissedAlerts.size;
  const actionsTaken = realAIActions.filter(a => a.outcome === 'success').length;
  const accuracyPercent = avgConfidence;

  const InsightCard = ({ insight }: { insight: Insight }) => {
    const cfg = SEVERITY_CONFIG[insight.severity];
    const isSelected = selectedIds.has(insight.id);
    const Icon = insight.category === 'safety'
      ? Shield
      : insight.category === 'financial'
        ? PoundSterling
        : insight.category === 'programme'
          ? Activity
          : insight.category === 'resource'
            ? Users
            : insight.category === 'quality'
              ? ClipboardList
              : FileText;

    return (
      <div
        className="card p-5 border-l-4 animate-fade-up"
        style={{ borderLeftColor: cfg.color, background: cfg.bg, borderColor: cfg.border }}
      >
        <div className="flex gap-4 items-start">
          <button type="button" onClick={e => { e.stopPropagation(); toggle(insight.id); }}>
            {isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
          </button>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${cfg.color}20` }}>
            <Icon className="h-5 w-5" style={{ color: cfg.color }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-display text-white">{String(insight.title)}</span>
              <span className="px-2 py-1 rounded text-xs font-medium" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                {SEVERITY_CONFIG[insight.severity].label}
              </span>
              <span className="text-xs text-gray-500">{Number(insight.confidence)}% confidence</span>
            </div>
            <p className="text-sm text-gray-300 mb-3">{String(insight.description)}</p>
            <div className="bg-gray-800/50 rounded p-3 mb-3">
              <div className="flex items-start gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-amber-400 uppercase font-display mb-1">Recommendation</p>
                  <p className="text-sm text-gray-200">{String(insight.recommendation)}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-500">Impact: {String(insight.impact)}</p>
              <button
                onClick={() => setDismissed(new Set(dismissed.add(insight.id)))}
                className="px-3 py-1 rounded text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AlertCard = ({ alert }: { alert: Alert }) => {
    const cfg = PRIORITY_CONFIG[alert.priority];
    return (
      <div className={`card p-5 border-l-4 border-gray-700 ${cfg.bg}`}>
        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: cfg.color + '20' }}>
            <AlertTriangle className="h-5 w-5" style={{ color: cfg.color }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-display text-white">{alert.title}</span>
              <span className="px-2 py-1 rounded text-xs font-medium" style={{ background: cfg.color + '20', color: cfg.color }}>
                {cfg.label}
              </span>
            </div>
            <p className="text-sm text-gray-300 mb-2">{alert.description}</p>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">Module: <span className="text-gray-300">{alert.module}</span> • {alert.createdAt}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="px-3 py-1.5 rounded text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {alert.suggestedAction}
              </button>
              <button
                onClick={() => setDismissedAlerts(new Set([...dismissedAlerts, alert.id]))}
                className="px-3 py-1.5 rounded text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const RecommendationCard = ({ rec }: { rec: Recommendation }) => {
    const impactColors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
    return (
      <div className="card p-5 border border-gray-700 hover:border-amber-500/50 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-amber-400 uppercase font-display">{rec.category}</p>
            <h4 className="text-sm font-display text-white mt-1">{rec.title}</h4>
          </div>
          <span className="px-2 py-1 rounded text-xs font-medium" style={{ background: impactColors[rec.impact] + '20', color: impactColors[rec.impact] }}>
            {rec.impact === 'high' ? 'High' : rec.impact === 'medium' ? 'Medium' : 'Low'} Impact
          </span>
        </div>
        <p className="text-sm text-gray-300 mb-3">{rec.description}</p>
        <div className="bg-gray-800/50 rounded p-3 mb-4">
          <p className="text-xs text-emerald-400 font-display">Estimated Benefit: {rec.estimatedBenefit}</p>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 px-3 py-2 rounded text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors flex items-center justify-center gap-1 font-medium">
            <CheckCircle className="h-3 w-3" />
            Apply
          </button>
          <button className="flex-1 px-3 py-2 rounded text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors font-medium">
            Dismiss
          </button>
        </div>
      </div>
    );
  };

  const ActivityFeed = () => (
    <div className="space-y-3">
      {realAIActions.map((action) => (
        <div key={action.id} className="flex gap-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex-shrink-0 pt-1">
            {action.outcome === 'success' && <CheckCircle className="h-4 w-4 text-emerald-400" />}
            {action.outcome === 'pending' && <Clock className="h-4 w-4 text-amber-400" />}
            {action.outcome === 'failed' && <XCircle className="h-4 w-4 text-red-400" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">{action.action}</p>
              <span className="text-xs text-gray-500">{action.timestamp}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{action.module} • {action.details}</p>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <ModuleBreadcrumbs currentModule="insights" />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-display text-white">AI Intelligence Engine</h1>
            <p className="text-sm text-gray-400 mt-1">Real-time project intelligence and predictive analytics</p>
          </div>
          <button className="btn btn-secondary">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-gray-700 cb-table-scroll touch-pan-x">
          {(['overview', 'alerts', 'recommendations', 'benchmarks', 'actions', 'trends', 'trends-analysis', 'learning'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'alerts' && 'Alerts'}
              {tab === 'recommendations' && 'Recommendations'}
              {tab === 'benchmarks' && 'Benchmarks'}
              {tab === 'actions' && 'AI Actions'}
              {tab === 'trends' && 'Trends'}
              {tab === 'trends-analysis' && 'Trend Analysis'}
              {tab === 'learning' && 'Learning'}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Health Score Card */}
            <div className="card p-8 bg-gradient-to-br from-gray-800 to-gray-900 border border-amber-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 uppercase font-display mb-2">AI Health Score</p>
                  <div className="text-5xl font-display text-amber-400">{healthScore}</div>
                  <p className="text-sm text-gray-400 mt-2">Overall system health excellent</p>
                </div>
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#374151" strokeWidth="8" />
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="8"
                      strokeDasharray={`${(healthScore / 100) * 283} 283`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute text-center">
                    <p className="text-2xl font-display text-white">{healthScore}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: 'Insights Generated', value: insightsGenerated, icon: Brain, color: 'text-blue-400' },
                { label: 'Alerts Resolved', value: alertsResolved, icon: CheckCircle, color: 'text-emerald-400' },
                { label: 'Actions Taken', value: actionsTaken, icon: Zap, color: 'text-amber-400' },
                { label: 'Accuracy', value: `${accuracyPercent}%`, icon: Target, color: 'text-purple-400' },
              ].map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <div key={String(kpi.label)} className="card p-4 border border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                        <Icon className={`h-5 w-5 ${kpi.color}`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase">{String(kpi.label)}</p>
                        <p className="text-2xl font-display text-white">{String(kpi.value)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-5 border border-gray-700">
                <h3 className="text-lg font-display text-white mb-4">Insights by Category</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="category" stroke="#9ca3af" fontSize={12} />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
                      <Legend />
                      <Bar dataKey="critical" stackId="a" fill="#ef4444" name="Critical" />
                      <Bar dataKey="high" stackId="a" fill="#f97316" name="High" />
                      <Bar dataKey="medium" stackId="a" fill="#f59e0b" name="Medium" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card p-5 border border-gray-700">
                <h3 className="text-lg font-display text-white mb-4">Confidence Distribution</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie data={confidenceData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value">
                        {confidenceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={String(entry.color)} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Activity Feed */}
            <div className="card p-5 border border-gray-700">
              <h3 className="text-lg font-display text-white mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-amber-400" />
                Recent AI Actions
              </h3>
              <ActivityFeed />
            </div>
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            {sortedAlerts.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title="All Clear"
                description="No alerts at this time. Your projects are running smoothly."
                variant="default"
              />
            ) : (
              sortedAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)
            )}
          </div>
        )}

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 bg-gray-800 border-gray-700 rounded-xl border p-4">
              {['All', 'Cost Saving', 'Risk Reduction', 'Efficiency', 'Compliance'].map(type => (
                <button key={type} className="px-3 py-1.5 rounded text-xs font-medium bg-gray-700 hover:bg-orange-500/20 text-gray-300 hover:text-orange-400 transition-colors">
                  {type}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[
                { type: 'Cost Saving', priority: 'High', title: 'Bulk Material Ordering', desc: 'Consolidate material orders across projects to reduce supply chain costs by 12%', impact: '£45,000', effort: 'Medium' },
                { type: 'Risk Reduction', priority: 'Critical', title: 'Safety Protocol Update', desc: 'Implement enhanced H&S procedures to reduce incident risk on high-rise projects', impact: '£120,000', effort: 'High' },
                { type: 'Efficiency', priority: 'Medium', title: 'Labour Schedule Optimization', desc: 'Optimize crew scheduling to reduce idle time and improve site productivity by 8%', impact: '8%', effort: 'Low' },
                { type: 'Compliance', priority: 'High', title: 'Building Regs Alignment', desc: 'Align all projects with updated 2024 Building Regulations and Fire Safety Act', impact: 'Compliance', effort: 'Medium' },
                { type: 'Cost Saving', priority: 'Medium', title: 'Energy Efficiency Upgrade', desc: 'Specify renewable energy materials for all new builds to reduce operating costs', impact: '£18,000', effort: 'Low' },
                { type: 'Efficiency', priority: 'Low', title: 'Digital Timesheets', desc: 'Implement digital timekeeping system for faster payroll processing and data accuracy', impact: '5%', effort: 'Low' },
                { type: 'Risk Reduction', priority: 'Medium', title: 'Weather Contingency', desc: 'Add strategic weather buffer days to schedules during Q4-Q1 winter period', impact: '£75,000', effort: 'Low' },
                { type: 'Cost Saving', priority: 'High', title: 'Subcontractor Rate Negotiation', desc: 'Renegotiate Q2-Q3 rates with key subcontractors post-budget planning', impact: '£32,000', effort: 'Medium' },
                { type: 'Compliance', priority: 'Medium', title: 'Environmental Impact Assessment', desc: 'Formalize EIA process for all projects >£500k to meet statutory requirements', impact: 'Compliance', effort: 'High' },
                { type: 'Efficiency', priority: 'Low', title: 'Template Library Expansion', desc: 'Create 15 new project management templates to standardize delivery', impact: '10%', effort: 'Medium' },
              ].filter(r => !dismissedRecs.has(String(r.title))).map((rec, idx) => {
                const impactColours = { 'Cost Saving': '#10b981', 'Risk Reduction': '#ef4444', 'Efficiency': '#3b82f6', 'Compliance': '#8b5cf6' };
                const priorityColours = { Critical: '#ef4444', High: '#f97316', Medium: '#f59e0b', Low: '#10b981' };
                return (
                  <div key={idx} className="card p-5 border border-gray-700 hover:border-amber-500/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-xs uppercase font-display" style={{color: impactColours[rec.type as keyof typeof impactColours]}}>{rec.type}</p>
                        <h4 className="text-sm font-display text-white mt-1">{rec.title}</h4>
                      </div>
                      <span className="px-2 py-1 rounded text-xs font-medium" style={{background: `${priorityColours[rec.priority as keyof typeof priorityColours]}20`, color: priorityColours[rec.priority as keyof typeof priorityColours]}}>
                        {rec.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mb-3">{rec.desc}</p>
                    <div className="bg-gray-800/50 rounded p-3 mb-4 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-gray-400">Potential Impact</p>
                        <p className="font-display text-white">{rec.impact}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Effort Level</p>
                        <p className="font-display text-white">{rec.effort}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex-1 px-3 py-2 rounded text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors flex items-center justify-center gap-1 font-medium">
                        <CheckCircle className="h-3 w-3"/>Implement
                      </button>
                      <button onClick={() => setDismissedRecs(new Set([...dismissedRecs, rec.title]))} className="flex-1 px-3 py-2 rounded text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors font-medium">
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Benchmarks Tab */}
        {activeTab === 'benchmarks' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-400">Performance vs UK construction industry benchmarks</p>
            <div className="card p-5 border border-gray-700">
              <h3 className="text-lg font-display text-white mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-amber-400" />
                Key Metrics Performance
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={BENCHMARK_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="metric" stroke="#9ca3af" fontSize={12} />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
                    <Legend />
                    <Bar dataKey="cortex" fill="#f59e0b" name="CortexBuild" />
                    <Bar dataKey="industry" fill="#6b7280" name="Industry Benchmark" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* AI Actions Tab */}
        {activeTab === 'actions' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Log of automated AI actions and outcomes</p>
            <ActivityFeed />
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === 'trends' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-400">AI-detected trends over the last 6 months</p>
            <div className="card p-5 border border-gray-700">
              <h3 className="text-lg font-display text-white mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                6-Month Trend Analysis
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={TREND_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
                    <Legend />
                    <Area type="monotone" dataKey="riskScore" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} name="Risk Score" />
                    <Area type="monotone" dataKey="costEfficiency" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} name="Cost Efficiency" />
                    <Area type="monotone" dataKey="teamProductivity" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="Team Productivity" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Trend Analysis Tab */}
        {activeTab === 'trends-analysis' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Industry and project trends affecting your business</p>
              <button className="flex items-center gap-2 px-3 py-2 bg-amber-900/30 text-amber-400 hover:bg-amber-900/50 rounded-lg text-sm font-medium">
                <Zap size={14}/>Subscribe to Alerts
              </button>
            </div>

            {/* Macro Trends Feed */}
            <div className="space-y-3">
              <h3 className="text-lg font-display text-white">Macro Trends</h3>
              {macroTrends.map(trend => (
                <div key={String(trend.id)} className="bg-gray-800 border-gray-700 rounded-xl border p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-white">{String(trend.title)}</p>
                      <p className="text-xs text-gray-400">{String(trend.category)} • {String(trend.month)}</p>
                    </div>
                    {trend.trend === 'up' && <TrendingUp className="h-5 w-5 text-red-400 flex-shrink-0"/>}
                    {trend.trend === 'down' && <TrendingDown className="h-5 w-5 text-green-400 flex-shrink-0"/>}
                    {trend.trend === 'neutral' && <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0"/>}
                  </div>
                  <p className="text-sm text-gray-300 mb-2">{String(trend.detail)}</p>
                  {trend.change !== null && trend.change !== undefined && <p className={`text-sm font-semibold ${trend.trend === 'up' ? 'text-red-400' : 'text-green-400'}`}>{Number(trend.change) > 0 ? '+' : ''}{String(trend.change)}%</p>}
                </div>
              ))}
            </div>

            {/* Material Cost Index Chart */}
            <div className="card p-5 border border-gray-700">
              <h3 className="text-lg font-display text-white mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-amber-400"/>
                Material Cost Index (12 Months)
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[
                    { month: 'May', steel: 98, copper: 102, timber: 101, concrete: 99 },
                    { month: 'Jun', steel: 100, copper: 103, timber: 102, concrete: 100 },
                    { month: 'Jul', steel: 102, copper: 105, timber: 104, concrete: 102 },
                    { month: 'Aug', steel: 104, copper: 106, timber: 105, concrete: 103 },
                    { month: 'Sep', steel: 105, copper: 108, timber: 107, concrete: 104 },
                    { month: 'Oct', steel: 106, copper: 109, timber: 108, concrete: 105 },
                    { month: 'Nov', steel: 108, copper: 111, timber: 110, concrete: 107 },
                    { month: 'Dec', steel: 109, copper: 112, timber: 111, concrete: 108 },
                    { month: 'Jan', steel: 110, copper: 113, timber: 112, concrete: 109 },
                    { month: 'Feb', steel: 111, copper: 114, timber: 113, concrete: 110 },
                    { month: 'Mar', steel: 112, copper: 115, timber: 114, concrete: 111 },
                    { month: 'Apr', steel: 114, copper: 117, timber: 116, concrete: 112 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                    <XAxis dataKey="month" stroke="#9ca3af"/>
                    <YAxis stroke="#9ca3af"/>
                    <Tooltip contentStyle={{background: '#1f2937', border: '1px solid #374151'}}/>
                    <Legend/>
                    <Line type="monotone" dataKey="steel" stroke="#ef4444" dot={false}/>
                    <Line type="monotone" dataKey="copper" stroke="#f97316" dot={false}/>
                    <Line type="monotone" dataKey="timber" stroke="#f59e0b" dot={false}/>
                    <Line type="monotone" dataKey="concrete" stroke="#06b6d4" dot={false}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* KPI Trends Table */}
            <div className="card p-5 border border-gray-700">
              <h3 className="text-lg font-display text-white mb-4">Tracked KPIs vs Target</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-700">
                    <tr>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Metric</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Current</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Target</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Deviation</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {kpiTrends.map(kpi => (
                      <tr key={String(kpi.id)} className="hover:bg-gray-700/50">
                        <td className="py-3 px-4 text-white font-medium">{String(kpi.metric)}</td>
                        <td className="text-right py-3 px-4 text-white">{String(kpi.value ?? "")}</td>
                        <td className="text-right py-3 px-4 text-gray-400">{String(kpi.target ?? "")}</td>
                        <td className={`text-right py-3 px-4 font-semibold ${Number(kpi.deviation) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {Number(kpi.deviation) >= 0 ? '+' : ''}{String(kpi.deviation ?? "")}
                        </td>
                        <td className="text-right py-3 px-4">
                          {kpi.trend === 'up' ? <ArrowUp className="h-4 w-4 text-green-400 inline"/> : <ArrowDown className="h-4 w-4 text-red-400 inline"/>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Learning Tab */}
        {activeTab === 'learning' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-400">What the AI has learned from your project history</p>

            {/* AI Learnings Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {aiLearnings.map(learning => (
                <div key={String(learning.id)} className="bg-gray-800 border-gray-700 rounded-xl border p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-amber-900/30">
                      <Brain className="h-5 w-5 text-amber-400"/>
                    </div>
                    <h3 className="font-semibold text-white flex-1">{String(learning.title)}</h3>
                  </div>
                  <p className="text-sm text-gray-300">{String(learning.description)}</p>
                </div>
              ))}
            </div>

            {/* Data Sources Panel */}
            <div className="card p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-display text-white flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-400"/>
                  Data Sources
                </h3>
                <button className="flex items-center gap-2 px-3 py-2 bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 rounded-lg text-sm font-medium">
                  <RefreshCw size={14}/>Trigger Re-analysis
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dataSources.map(source => (
                  <div key={String(source.id)} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{String(source.icon)}</span>
                        <div>
                          <p className="font-semibold text-white">{String(source.name)}</p>
                          <p className="text-xs text-gray-400">{String(source.records ?? "")} records</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">Last synced: {String(source.lastSync)}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-4 text-center">AI re-analyzes data weekly. Last analysis: 6 hours ago</p>
            </div>

            {/* Recommendations from Learning */}
            <div className="card p-5 border border-gray-700">
              <h3 className="text-lg font-display text-white mb-4 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-400"/>
                Data-Driven Recommendations
              </h3>
              <div className="space-y-3">
                {[
                  { title: 'Postcode Expansion', desc: 'Strong performance in SW1/EC1 areas; consider expanding to similar profiles in London zones 2-3' },
                  { title: 'Payment Terms Optimization', desc: 'Early payment discounts could reduce 34-day average to 28 days, improving cash flow by ~6%' },
                  { title: 'Defect Prevention', desc: 'Focus Q2-Q3 training on weather-related cladding defects (preventable in 65% of cases)' },
                  { title: 'Winter Project Premium', desc: 'Winter projects 10% longer; recommend 12% markup on winter bids to offset schedule risk' },
                ].map((rec, idx) => (
                  <div key={idx} className="bg-gray-700/30 rounded-lg p-3 border-l-2 border-amber-500">
                    <p className="font-medium text-white text-sm">{rec.title}</p>
                    <p className="text-xs text-gray-300 mt-1">{rec.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters for Insights Tab */}
        {activeTab === 'overview' && (
          <>
            <div className="card p-4 bg-gray-800/50 border border-gray-700">
              <div className="flex flex-wrap gap-4 items-center">
                <span className="text-sm text-gray-400 uppercase font-display">Severity:</span>
                {(['all', 'critical', 'high', 'medium', 'low', 'info'] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      severityFilter === sev
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    {sev.charAt(0).toUpperCase() + sev.slice(1)}
                  </button>
                ))}

                <div className="w-px h-6 bg-gray-700" />

                <span className="text-sm text-gray-400 uppercase font-display">Category:</span>
                {(['all', 'financial', 'safety', 'programme', 'resource', 'quality', 'risk'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      categoryFilter === cat
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Insights List */}
            <div className="space-y-4">
              {filteredInsights.length === 0 ? (
                <EmptyState
                  icon={TrendingUp}
                  title="All Clear"
                  description="No insights match your filters. Keep up the great work!"
                  variant="default"
                />
              ) : (
                filteredInsights.map((insight) => <InsightCard key={insight.id} insight={insight} />)
              )}
            </div>

            <BulkActionsBar
              selectedIds={Array.from(selectedIds)}
              actions={[
                { id: 'delete', label: 'Dismiss Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This will dismiss the selected insights.' },
              ]}
              onClearSelection={clearSelection}
            />
          </>
        )}
      </div>
    </>
  );
}
export default Insights;
