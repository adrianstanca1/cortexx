// Module: Cost Management — CortexBuild Ultimate
import React, { useState, useEffect } from 'react';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import {
  TrendingUp, TrendingDown, DollarSign, Plus, FileText, Calculator, Target,
  BarChart3, PieChart as PieChartIcon, Activity, Loader2, BrainCircuit, AlertTriangle,
  X, ChevronRight, Edit2, Trash2, Trees, LineChart as LineChartIcon
} from 'lucide-react';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, LineChart, Line,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Pie, Cell, PieChart, ComposedChart
} from 'recharts';
import { toast } from 'sonner';
import { costManagementApi, predictiveApi } from '../../services/api';

interface BudgetItem {
  id: string;
  category: string;
  description: string;
  budgeted: number;
  spent: number;
  committed: number;
  remaining: number;
  variance: number;
  variancePercent: number;
  status: 'on-track' | 'at-risk' | 'over-budget';
}

interface CostForecast {
  month: string;
  projected: number;
  actual?: number;
  cumulative: number;
}

interface CommitmentItem {
  id: string;
  reference: string;
  supplier: string;
  description: string;
  originalValue: number;
  approvedVariations: number;
  revisedValue: number;
  paidToDate: number;
  remaining: number;
}

interface CostCode {
  id: string;
  level: number;
  division: string;
  category?: string;
  subCategory?: string;
  lineItem?: string;
  budget: number;
  actual: number;
  children?: CostCode[];
}

interface ForecastMetric {
  workPackage: string;
  budget: number;
  actual: number;
  forecast: number;
  variance: number;
}

interface EVMMetric {
  label: string;
  value: string;
  description: string;
}

const CHART_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

export function CostManagement() {
  const [activeTab, setActiveTab] = useState<'budget' | 'forecast' | 'variance' | 'commitments' | 'costcodes' | 'forecasting'>('budget');
  const [showAddItem, setShowAddItem] = useState(false);
  const [loading, setLoading] = useState(true);

  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [forecast, setForecast] = useState<CostForecast[]>([]);
  const [predictiveData, setPredictiveData] = useState<Record<string, unknown> | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Add item form state
  const [newItem, setNewItem] = useState({ category: '', description: '', budgeted: '', committed: '' });

  // Commitments Tab State
  const [commitments] = useState<CommitmentItem[]>([
    { id: '1', reference: 'PO-2026-0145', supplier: 'Northern Steel Traders Ltd', description: 'Structural steel - Grade 50, 250 tonnes', originalValue: 195000, approvedVariations: 8500, revisedValue: 203500, paidToDate: 182500, remaining: 21000 },
    { id: '2', reference: 'PO-2026-0156', supplier: 'Precision Ready Mix', description: 'Concrete delivery - 2000 m³ @ £150/m³', originalValue: 300000, approvedVariations: -15000, revisedValue: 285000, paidToDate: 285000, remaining: 0 },
    { id: '3', reference: 'SC-2026-0089', supplier: 'Apex Construction Services', description: 'Formwork & falsework labour - 8 weeks', originalValue: 175000, approvedVariations: 12000, revisedValue: 187000, paidToDate: 140000, remaining: 47000 },
    { id: '4', reference: 'PO-2026-0167', supplier: 'MEP Electrical Supplies', description: 'Main switchboard & distribution boards', originalValue: 85000, approvedVariations: 3200, revisedValue: 88200, paidToDate: 50000, remaining: 38200 },
    { id: '5', reference: 'PO-2026-0178', supplier: 'Global Cladding Systems', description: 'Facade cladding system - aluminium composite', originalValue: 220000, approvedVariations: 0, revisedValue: 220000, paidToDate: 88000, remaining: 132000 },
    { id: '6', reference: 'SC-2026-0095', supplier: 'Landscape Contractors UK', description: 'External works & hard landscaping', originalValue: 95000, approvedVariations: 5500, revisedValue: 100500, paidToDate: 50000, remaining: 50500 },
  ]);

  const [showCreateCommitment, setShowCreateCommitment] = useState(false);

  // Cost Codes Tab State
  const [costCodes] = useState<CostCode[]>([
    {
      id: '1', level: 0, division: 'Preliminaries', budget: 450000, actual: 385200,
      children: [
        { id: '1.1', level: 1, division: 'Preliminaries', category: 'Site Management', budget: 180000, actual: 165000 },
        { id: '1.2', level: 1, division: 'Preliminaries', category: 'Health & Safety', budget: 120000, actual: 98500 },
        { id: '1.3', level: 1, division: 'Preliminaries', category: 'Temporary Works', budget: 150000, actual: 121700 },
      ]
    },
    {
      id: '2', level: 0, division: 'Substructure', budget: 580000, actual: 512300,
      children: [
        { id: '2.1', level: 1, division: 'Substructure', category: 'Excavation & Earthworks', budget: 180000, actual: 175000 },
        { id: '2.2', level: 1, division: 'Substructure', category: 'Concrete - Foundations', budget: 280000, actual: 265300 },
        { id: '2.3', level: 1, division: 'Substructure', category: 'Waterproofing', budget: 120000, actual: 72000 },
      ]
    },
    {
      id: '3', level: 0, division: 'Superstructure', budget: 950000, actual: 780000,
      children: [
        { id: '3.1', level: 1, division: 'Superstructure', category: 'Structural Frame', budget: 450000, actual: 380000 },
        { id: '3.2', level: 1, division: 'Superstructure', category: 'Floor Slabs', budget: 320000, actual: 280000 },
        { id: '3.3', level: 1, division: 'Superstructure', category: 'Roof Structure', budget: 180000, actual: 120000 },
      ]
    },
    {
      id: '4', level: 0, division: 'MEP Systems', budget: 780000, actual: 420000,
      children: [
        { id: '4.1', level: 1, division: 'MEP Systems', category: 'Electrical Installation', budget: 320000, actual: 185000 },
        { id: '4.2', level: 1, division: 'MEP Systems', category: 'Mechanical (HVAC)', budget: 280000, actual: 150000 },
        { id: '4.3', level: 1, division: 'MEP Systems', category: 'Plumbing & Drainage', budget: 180000, actual: 85000 },
      ]
    },
  ]);

  const [expandedCostCode, setExpandedCostCode] = useState<string | null>(null);

  // Forecasting Tab State
  const [forecastMetrics] = useState<ForecastMetric[]>([
    { workPackage: 'Preliminaries', budget: 450000, actual: 385200, forecast: 420000, variance: 30000 },
    { workPackage: 'Substructure', budget: 580000, actual: 512300, forecast: 575000, variance: -5000 },
    { workPackage: 'Superstructure', budget: 950000, actual: 780000, forecast: 920000, variance: 30000 },
    { workPackage: 'MEP Systems', budget: 780000, actual: 420000, forecast: 780000, variance: 0 },
    { workPackage: 'Internal Works', budget: 520000, actual: 180000, forecast: 525000, variance: -5000 },
  ]);

  const [sCurveData] = useState([
    { period: 'W1', budget: 85000, actual: 62000, forecast: 85000 },
    { period: 'W2', budget: 170000, actual: 125000, forecast: 170000 },
    { period: 'W4', budget: 340000, actual: 295000, forecast: 340000 },
    { period: 'W8', budget: 680000, actual: 640000, forecast: 685000 },
    { period: 'W12', budget: 1020000, actual: 980000, forecast: 1030000 },
    { period: 'W16', budget: 1360000, actual: 1320000, forecast: 1370000 },
    { period: 'W20', budget: 2080000, actual: 2050000, forecast: 2090000 },
    { period: 'W24', budget: 2800000, actual: 2900000, forecast: 2850000 },
  ]);

  const [evmMetrics] = useState<EVMMetric[]>([
    { label: 'Schedule Performance Index (SPI)', value: '0.98', description: 'On track (target: ≥1.0)' },
    { label: 'Cost Performance Index (CPI)', value: '1.02', description: 'Positive variance' },
    { label: 'Estimate at Completion (EAC)', value: '£2,850,000', description: 'Project final cost projection' },
    { label: 'Estimate to Complete (ETC)', value: '£650,000', description: 'Remaining budget needed' },
  ]);

  // Load data from API
  useEffect(() => {
    loadCostData();
  }, []);

  async function handleAddItem() {
    if (!newItem.category || !newItem.budgeted) {
      toast.error('Category and budgeted amount are required');
      return;
    }
    try {
      await costManagementApi.createBudget({
        cost_code_name: newItem.category,
        description: newItem.description,
        budgeted: parseFloat(newItem.budgeted) || 0,
        committed: parseFloat(newItem.committed) || 0,
      });
      toast.success('Budget item added');
      setShowAddItem(false);
      setNewItem({ category: '', description: '', budgeted: '', committed: '' });
      loadCostData();
    } catch {
      toast.error('Failed to add budget item');
    }
  }

  async function loadCostData() {
    try {
      setLoading(true);
      const [budgetData, forecastData] = await Promise.all([
        costManagementApi.getBudget(),
        costManagementApi.getForecast()
      ]);

      // Transform budget data
      const transformedBudget = budgetData.map((item: Record<string, unknown>) => ({
        id: String(item.id ?? ''),
        category: String(item.cost_code_name ?? item.name ?? ''),
        description: String(item.description ?? ''),
        budgeted: parseFloat(String(item.budgeted ?? 0)) || 0,
        spent: parseFloat(String(item.spent ?? 0)) || 0,
        committed: parseFloat(String(item.committed ?? 0)) || 0,
        remaining: parseFloat(String(item.remaining ?? 0)) || 0,
        variance: parseFloat(String(item.variance ?? 0)) || 0,
        variancePercent: parseFloat(String(item.variance_percent ?? 0)) || 0,
        status: String(item.status ?? 'on-track') as BudgetItem['status'],
      }));

      // Transform forecast data
      const transformedForecast = forecastData.map((f: Record<string, unknown>) => ({
        month: new Date(String(f.period_start ?? '')).toLocaleString('default', { month: 'short' }),
        projected: parseFloat(String(f.projected_cost ?? 0)) || 0,
        actual:
          f.actual_cost !== undefined && f.actual_cost !== null
            ? parseFloat(String(f.actual_cost))
            : undefined,
        cumulative: parseFloat(String(f.cumulative_cost ?? 0)) || 0,
      }));

      setBudgetItems(transformedBudget);
      setForecast(transformedForecast);
    } catch (err) {
      console.error('Failed to load cost data', err);
      toast.error('Failed to load cost data');
    } finally {
      setLoading(false);
    }
  }

  async function runPredictiveAnalysis() {
    // Use first project from budget items as reference if no specific project is selected
    const projectId = budgetItems[0]?.id || 'default';
    try {
      setIsAnalyzing(true);
      const result = await predictiveApi.getForecast(projectId);
      setPredictiveData(result);
      toast.success('AI Analysis complete');
    } catch (err) {
      console.error('Predictive analysis failed', err);
      toast.error('AI Analysis failed to generate forecast');
    } finally {
      setIsAnalyzing(false);
    }
  }

  const totalBudget = budgetItems.reduce((sum, item) => sum + item.budgeted, 0);
  const totalSpent = budgetItems.reduce((sum, item) => sum + item.spent, 0);
  const totalCommitted = budgetItems.reduce((sum, item) => sum + item.committed, 0);
  const totalVariance = budgetItems.reduce((sum, item) => sum + item.variance, 0);

  const fmt = (n: number) => `£${Math.abs(n).toLocaleString()}`;

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'on-track': return 'bg-emerald-900/30 text-emerald-400 border-emerald-700/50';
      case 'at-risk': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700/50';
      case 'over-budget': return 'bg-red-900/30 text-red-400 border-red-700/50';
      default: return 'bg-gray-700/50 text-gray-400 border-gray-600/50';
    }
  };

  const budgetVarianceData = budgetItems.map(item => ({
    name: item.category.substring(0, 8),
    budgeted: item.budgeted / 1000,
    spent: item.spent / 1000,
    variance: item.variance / 1000,
  }));

  const categoryDistribution = budgetItems.map(item => ({
    name: item.category,
    value: item.budgeted,
    color: CHART_COLORS[budgetItems.indexOf(item) % CHART_COLORS.length],
  }));

  return (
    <div className="space-y-6 bg-gray-900 min-h-screen p-6">
      <ModuleBreadcrumbs currentModule="cost-management" />
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <span className="ml-3 text-gray-400">Loading cost data...</span>
        </div>
      ) : (
        <>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display text-white flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-emerald-400" />
            Cost Management
          </h1>
          <p className="text-sm text-gray-400 mt-1">Budget tracking, forecasting & variance analysis</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowAddItem(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded-lg transition-colors">
            <Plus className="h-4 w-4" />
            Add Budget Item
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">
            <FileText className="h-4 w-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Budget', value: fmt(totalBudget), icon: Target, color: 'text-blue-400', bg: 'bg-blue-900/30' },
          { label: 'Spent to Date', value: fmt(totalSpent), sub: `${((totalSpent / totalBudget) * 100).toFixed(1)}% of budget`, icon: Calculator, color: 'text-orange-400', bg: 'bg-orange-900/30' },
          { label: 'Committed', value: fmt(totalCommitted), sub: 'Pending commitments', icon: Activity, color: 'text-purple-400', bg: 'bg-purple-900/30' },
          { label: 'Variance', value: `${totalVariance >= 0 ? '+' : '-'}${fmt(totalVariance)}`, sub: `${((totalVariance / totalBudget) * 100).toFixed(1)}% variance`, icon: totalVariance >= 0 ? TrendingUp : TrendingDown, color: totalVariance >= 0 ? 'text-green-400' : 'text-red-400', bg: totalVariance >= 0 ? 'bg-green-900/30' : 'bg-red-900/30' },
        ].map((item) => (
          <div key={item.label} className="card bg-base-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-gray-400 text-sm">{item.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{item.value}</p>
                {item.sub && <p className="text-xs text-gray-500 mt-1">{item.sub}</p>}
              </div>
              <div className={`p-2 rounded-lg ${item.bg}`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-700 pb-2 overflow-x-auto">
        {['budget', 'forecast', 'variance', 'commitments', 'costcodes', 'forecasting'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {tab === 'budget' && 'Budget Analysis'}
            {tab === 'forecast' && 'Forecast'}
            {tab === 'variance' && 'Variance'}
            {tab === 'commitments' && 'Commitments'}
            {tab === 'costcodes' && 'Cost Codes'}
            {tab === 'forecasting' && 'Forecasting'}
          </button>
        ))}
      </div>

      {/* Budget Tab */}
      {activeTab === 'budget' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Budget Table */}
            <div className="card bg-base-200 overflow-hidden lg:col-span-2">
              <div className="cb-table-scroll touch-pan-x">
                <table className="w-full text-sm">
                  <thead className="bg-gray-900 border-b border-gray-700">
                    <tr>
                      {['Category', 'Budgeted', 'Spent', 'Committed', 'Remaining', 'Variance', 'Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-display tracking-widest text-gray-400 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {budgetItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-900/40 transition-colors">
                        <td className="px-4 py-4">
                          <div>
                            <div className="font-medium text-white">{item.category}</div>
                            <div className="text-sm text-gray-500">{item.description}</div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right font-medium text-white">{fmt(item.budgeted)}</td>
                        <td className="px-4 py-4 text-right text-gray-300">{fmt(item.spent)}</td>
                        <td className="px-4 py-4 text-right text-gray-300">{fmt(item.committed)}</td>
                        <td className={`px-4 py-4 text-right font-medium ${item.remaining < 0 ? 'text-red-400' : 'text-green-400'}`}>{fmt(item.remaining)}</td>
                        <td className={`px-4 py-4 text-right font-medium ${item.variance < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {item.variance >= 0 ? '+' : '-'}{fmt(item.variance)}
                          <div className="text-xs text-gray-500">({item.variancePercent >= 0 ? '+' : ''}{item.variancePercent.toFixed(1)}%)</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(item.status)}`}>
                            {item.status.replace('-', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Budget vs Actual Chart */}
            <div className="card bg-base-200 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Budget vs Spent by Category
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={budgetVarianceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `£${v}K`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }} formatter={(v) => `£${((v as number) * 1000).toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="budgeted" name="Budgeted (£K)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spent" name="Spent (£K)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category Distribution */}
            <div className="card bg-base-200 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4" />
                Budget Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={categoryDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                    {categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} formatter={(v) => fmt(v as number)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Forecast Tab */}
      {activeTab === 'forecast' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Forecast Chart */}
            <div className="lg:col-span-2 card bg-base-200 p-6">
              <h3 className="text-white font-semibold mb-4">Monthly Spend Forecast</h3>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={forecast}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" tickFormatter={(v) => `£${(v / 1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} formatter={(v) => fmt(v as number)} />
                  <Legend />
                  <Area type="monotone" dataKey="projected" name="Projected" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="actual" name="Actual" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Cumulative Stats */}
            <div className="card bg-base-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-semibold">Cumulative Projection</h3>
                <button
                  onClick={runPredictiveAnalysis}
                  disabled={isAnalyzing}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
                  {isAnalyzing ? 'Analyzing...' : 'AI Insight'}
                </button>
              </div>
              <div className="bg-gray-900 rounded-lg p-6 text-center mb-6 border border-gray-700">
                <p className="text-gray-400 text-sm mb-2">Project Completion Forecast</p>
                <p className="text-4xl font-bold text-white">{fmt(2600000)}</p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-900 rounded-lg">
                  <span className="text-gray-400">Budget at Completion</span>
                  <span className="text-white font-bold">{fmt(totalBudget)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-900 rounded-lg">
                  <span className="text-gray-400">Estimated at Completion</span>
                  <span className="text-white font-bold">{fmt(2600000)}</span>
                </div>
                <div className={`flex justify-between items-center p-3 rounded-lg ${2600000 > totalBudget ? 'bg-red-900/20' : 'bg-green-900/20'}`}>
                  <span className="text-gray-400">Projected Variance</span>
                  <span className={`font-bold ${2600000 > totalBudget ? 'text-red-400' : 'text-green-400'}`}>
                    {2600000 > totalBudget ? '-' : '+'}{fmt(Math.abs(2600000 - totalBudget))}
                  </span>
                </div>
              </div>
            </div>

            {predictiveData && (
              <div className="card bg-base-200 p-6 border-l-4 border-emerald-500 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 mb-4 text-emerald-400">
                  <BrainCircuit className="w-5 h-5" />
                  <h3 className="text-white font-semibold">AI Predictive Analysis</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-3 bg-gray-900 rounded-lg border border-gray-700">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Risk Level</p>
                    <div className={`flex items-center gap-2 font-bold ${
                      (predictiveData as Record<string, unknown>).riskLevel === 'HIGH' ? 'text-red-400' :
                      (predictiveData as Record<string, unknown>).riskLevel === 'MEDIUM' ? 'text-yellow-400' : 'text-emerald-400'
                    }`}>
                      <AlertTriangle className="w-4 h-4" />
                      {String((predictiveData as Record<string, unknown>).riskLevel)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-900 rounded-lg border border-gray-700">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Predicted Final Cost</p>
                    <p className="text-lg font-bold text-white">{fmt((predictiveData as Record<string, unknown>).predictedFinalCost as number)}</p>
                  </div>
                  <div className="p-3 bg-gray-900 rounded-lg border border-gray-700">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Confidence</p>
                    <p className="text-lg font-bold text-white">{String((predictiveData as Record<string, unknown>).confidenceScore)}%</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold mb-2">Analysis</p>
                    <p className="text-sm text-gray-300 leading-relaxed italic">"{String((predictiveData as Record<string, unknown>).analysis)}"</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold mb-2">Recommendations</p>
                    <ul className="space-y-2">
                      {((predictiveData as Record<string, unknown>).recommendations as string[]).map((rec: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* KPI Cards */}
            <div className="space-y-4">
              <h3 className="text-white font-semibold">Key Performance Indicators</h3>
              {[
                { label: 'Budget Performance Index', value: '1.05', sub: 'Ahead of budget', color: 'text-green-400' },
                { label: 'Cost Performance Index', value: '0.95', sub: 'Slightly over spending rate', color: 'text-yellow-400' },
                { label: 'Earned Value', value: fmt(1420000), sub: 'Work completed value', color: 'text-blue-400' },
              ].map((kpi) => (
                <div key={kpi.label} className="card bg-base-200 p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">{kpi.label}</span>
                    <span className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{kpi.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Variance Tab */}
      {activeTab === 'variance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Variance Analysis */}
            <div className="card bg-base-200 p-6">
              <h3 className="text-white font-semibold mb-4">Variance Analysis</h3>
              <div className="space-y-3">
                {budgetItems
                  .filter(item => Math.abs(item.variancePercent) > 5)
                  .sort((a, b) => Math.abs(b.variancePercent) - Math.abs(a.variancePercent))
                  .map((item) => (
                    <div key={item.id} className="p-4 bg-gray-900 rounded-lg border border-gray-700">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-white">{item.category}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(item.status)}`}>
                          {item.status.replace('-', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{item.description}</p>
                      <div className={`text-lg font-bold ${item.variance < 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {item.variance >= 0 ? '+' : '-'}{fmt(item.variance)}
                        <span className="text-sm ml-1 text-gray-400">
                          ({item.variancePercent >= 0 ? '+' : ''}{item.variancePercent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Variance Trend Chart */}
            <div className="card bg-base-200 p-6">
              <h3 className="text-white font-semibold mb-4">Variance Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={budgetVarianceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `£${v}K`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} formatter={(v) => `£${((v as number) * 1000).toLocaleString()}`} />
                  <Bar dataKey="variance" name="Variance (£K)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Commitments Tab */}
      {activeTab === 'commitments' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Commitments', value: fmt(commitments.reduce((sum, c) => sum + c.revisedValue, 0)), icon: Target, color: 'text-blue-400', bg: 'bg-blue-900/30' },
              { label: 'Paid to Date', value: fmt(commitments.reduce((sum, c) => sum + c.paidToDate, 0)), icon: Calculator, color: 'text-green-400', bg: 'bg-green-900/30' },
              { label: 'Remaining', value: fmt(commitments.reduce((sum, c) => sum + c.remaining, 0)), icon: Activity, color: 'text-amber-400', bg: 'bg-amber-900/30' },
              { label: 'Variations', value: fmt(commitments.reduce((sum, c) => sum + c.approvedVariations, 0)), icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-900/30' },
            ].map((item) => (
              <div key={item.label} className="card bg-base-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-gray-400 text-sm">{item.label}</p>
                    <p className="text-2xl font-bold text-white mt-1">{item.value}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${item.bg}`}>
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Commitments Table */}
          <div className="card bg-base-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Committed Costs</h3>
              <button onClick={() => setShowCreateCommitment(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm">
                <Plus className="h-4 w-4" />
                New Commitment
              </button>
            </div>
            <div className="cb-table-scroll touch-pan-x">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 border-b border-gray-700">
                  <tr>
                    {['Reference', 'Supplier', 'Description', 'Original Value', 'Variations', 'Revised Value', 'Paid to Date', 'Remaining'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-display tracking-widest text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {commitments.map((commitment) => (
                    <tr key={commitment.id} className="hover:bg-gray-900/40 transition-colors">
                      <td className="px-4 py-4 font-medium text-white">{commitment.reference}</td>
                      <td className="px-4 py-4 text-gray-300">{commitment.supplier}</td>
                      <td className="px-4 py-4 text-gray-300">{commitment.description}</td>
                      <td className="px-4 py-4 text-right font-medium text-white">{fmt(commitment.originalValue)}</td>
                      <td className="px-4 py-4 text-right font-medium text-amber-400">{commitment.approvedVariations >= 0 ? '+' : '-'}{fmt(Math.abs(commitment.approvedVariations))}</td>
                      <td className="px-4 py-4 text-right font-medium text-white">{fmt(commitment.revisedValue)}</td>
                      <td className="px-4 py-4 text-right text-green-400 font-medium">{fmt(commitment.paidToDate)}</td>
                      <td className="px-4 py-4 text-right font-medium text-orange-400">{fmt(commitment.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Cost Codes Tab */}
      {activeTab === 'costcodes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost Code Tree */}
            <div className="card bg-base-200 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Trees className="w-4 h-4" />
                Cost Code Structure
              </h3>
              <div className="space-y-2">
                {costCodes.map((code) => (
                  <div key={code.id} className="space-y-2">
                    <button
                      onClick={() => setExpandedCostCode(expandedCostCode === code.id ? null : code.id)}
                      className="w-full flex items-center gap-2 p-3 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors text-left"
                    >
                      <ChevronRight className={`h-4 w-4 transition-transform ${expandedCostCode === code.id ? 'rotate-90' : ''}`} />
                      <span className="font-medium text-white flex-1">{code.division}</span>
                      <span className="text-xs text-gray-400">{fmt(code.budget)} / {fmt(code.actual)}</span>
                    </button>
                    {expandedCostCode === code.id && code.children && (
                      <div className="ml-4 space-y-1">
                        {code.children.map((child) => (
                          <div key={child.id} className="p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-medium text-gray-300">{child.category}</p>
                              </div>
                              <div className="text-right text-xs">
                                <p className="text-gray-400">Budget: {fmt(child.budget)}</p>
                                <p className="text-gray-400">Actual: {fmt(child.actual)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Budget vs Actual by Division */}
            <div className="card bg-base-200 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Budget vs Actual by Division
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costCodes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="division" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }} formatter={(v) => fmt(v as number)} />
                  <Legend />
                  <Bar dataKey="budget" name="Budget (£)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" name="Actual (£)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Forecasting Tab */}
      {activeTab === 'forecasting' && (
        <div className="space-y-6">
          {/* S-Curve Chart */}
          <div className="card bg-base-200 p-6 lg:col-span-2">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <LineChartIcon className="w-4 h-4" />
              Cost S-Curve: Budget vs Actual vs Forecast
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={sCurveData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="period" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" tickFormatter={(v) => `£${(v / 1000000).toFixed(1)}M`} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} formatter={(v) => fmt(v as number)} />
                <Legend />
                <Line type="monotone" dataKey="budget" stroke="#3b82f6" strokeWidth={2} name="Budget" />
                <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} name="Actual" />
                <Line type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" name="Forecast" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* EVM Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {evmMetrics.map((metric, idx) => (
              <div key={idx} className="card bg-base-200 p-5">
                <p className="text-gray-400 text-xs font-medium uppercase mb-2">{metric.label}</p>
                <p className="text-2xl font-bold text-white mb-1">{metric.value}</p>
                <p className="text-xs text-gray-500">{metric.description}</p>
              </div>
            ))}
          </div>

          {/* Cost Variance by Work Package */}
          <div className="card bg-base-200 p-6">
            <h3 className="text-white font-semibold mb-4">Cost Variance by Work Package</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 border-b border-gray-700">
                  <tr>
                    {['Work Package', 'Budget', 'Actual', 'Forecast', 'Variance', '%'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-display tracking-widest text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {forecastMetrics.map((metric) => (
                    <tr key={metric.workPackage} className="hover:bg-gray-900/40 transition-colors">
                      <td className="px-4 py-4 font-medium text-white">{metric.workPackage}</td>
                      <td className="px-4 py-4 text-right text-gray-300">{fmt(metric.budget)}</td>
                      <td className="px-4 py-4 text-right text-gray-300">{fmt(metric.actual)}</td>
                      <td className="px-4 py-4 text-right text-gray-300">{fmt(metric.forecast)}</td>
                      <td className={`px-4 py-4 text-right font-medium ${metric.variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {metric.variance >= 0 ? '+' : '-'}{fmt(Math.abs(metric.variance))}
                      </td>
                      <td className={`px-4 py-4 text-right font-medium ${metric.variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {((metric.variance / metric.budget) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">Add Budget Item</h2>
              <button onClick={() => setShowAddItem(false)} className="text-gray-400 hover:text-white"><FileText className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
                <input value={newItem.category} onChange={e => setNewItem(n => ({ ...n, category: e.target.value }))} placeholder="e.g., Materials" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                <textarea value={newItem.description} onChange={e => setNewItem(n => ({ ...n, description: e.target.value }))} placeholder="Item description" rows={2} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Budgeted (£)</label>
                  <input type="number" value={newItem.budgeted} onChange={e => setNewItem(n => ({ ...n, budgeted: e.target.value }))} placeholder="0.00" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Committed (£)</label>
                  <input type="number" value={newItem.committed} onChange={e => setNewItem(n => ({ ...n, committed: e.target.value }))} placeholder="0.00" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-700">
              <button onClick={handleAddItem} className="flex-1 btn btn-primary rounded-lg py-2 text-sm font-semibold">
                Add Item
              </button>
              <button onClick={() => setShowAddItem(false)} className="flex-1 btn btn-ghost rounded-lg py-2 text-sm font-semibold">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Commitment Modal */}
      {showCreateCommitment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">Create New Commitment</h2>
              <button onClick={() => setShowCreateCommitment(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Reference</label>
                <input placeholder="e.g., PO-2026-0200" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Supplier</label>
                <input placeholder="Supplier name" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                <textarea placeholder="Item description" rows={2} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Value (£)</label>
                  <input type="number" placeholder="0.00" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Variations (£)</label>
                  <input type="number" placeholder="0.00" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-700">
              <button onClick={() => { setShowCreateCommitment(false); toast.success('Commitment created'); }} className="flex-1 btn btn-primary rounded-lg py-2 text-sm font-semibold">
                Create Commitment
              </button>
              <button onClick={() => setShowCreateCommitment(false)} className="flex-1 btn btn-ghost rounded-lg py-2 text-sm font-semibold">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
    )}
    </div>
  );
}

export default React.memo(CostManagement);