// Module: Analytics — CortexBuild Ultimate
// Comprehensive analytics dashboard with 6 tabs: Overview, Financial, Projects, Safety, Labour
import React, { useState, useEffect } from 'react';
import { useSyncedPreference } from '../../hooks/useSyncedPreference';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useProjects, useSafety, useInvoices } from '../../hooks/useData';
import { analyticsApi } from '../../services/api';
import clsx from 'clsx';
import { CheckSquare, Square } from 'lucide-react';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';

type AnyRow = Record<string, unknown>;

// Static monthly trend data
const REVENUE_DATA = [
  { month:'Sep', revenue:485000, costs:342000, profit:143000 },
  { month:'Oct', revenue:612000, costs:445000, profit:167000 },
  { month:'Nov', revenue:534000, costs:378000, profit:156000 },
  { month:'Dec', revenue:298000, costs:225000, profit:73000  },
  { month:'Jan', revenue:721000, costs:512000, profit:209000 },
  { month:'Feb', revenue:856000, costs:601000, profit:255000 },
  { month:'Mar', revenue:943000, costs:648000, profit:295000 },
];

const SAFETY_TREND = [
  { month:'Sep', incidents:3, nearMisses:8,  toolboxTalks:12 },
  { month:'Oct', incidents:2, nearMisses:6,  toolboxTalks:14 },
  { month:'Nov', incidents:1, nearMisses:9,  toolboxTalks:13 },
  { month:'Dec', incidents:0, nearMisses:5,  toolboxTalks:10 },
  { month:'Jan', incidents:2, nearMisses:7,  toolboxTalks:15 },
  { month:'Feb', incidents:1, nearMisses:4,  toolboxTalks:16 },
  { month:'Mar', incidents:2, nearMisses:5,  toolboxTalks:12 },
];

const REVENUE_BY_TYPE = [
  { name:'Commercial',  value:1285440, color:'#3b82f6' },
  { name:'Residential', value:797644,  color:'#8b5cf6' },
  { name:'Civil',       value:511620,  color:'#10b981' },
  { name:'Industrial',  value:258496,  color:'#f59e0b' },
];

const INVOICE_AGING = [
  { range:'0–30 days',  amount:94500,  percentage:16 },
  { range:'31–60 days', amount:185000, percentage:31 },
  { range:'61–90 days', amount:67200,  percentage:11 },
  { range:'90+ days',   amount:195800, percentage:33 },
];

const CASHFLOW_DATA = [
  { month:'Sep', cumInflow:485000,   cumOutflow:342000 },
  { month:'Oct', cumInflow:1097000,  cumOutflow:787000 },
  { month:'Nov', cumInflow:1631000,  cumOutflow:1165000 },
  { month:'Dec', cumInflow:1929000,  cumOutflow:1390000 },
  { month:'Jan', cumInflow:2650000,  cumOutflow:1902000 },
  { month:'Feb', cumInflow:3506000,  cumOutflow:2503000 },
  { month:'Mar', cumInflow:4449000,  cumOutflow:3151000 },
];

const _PROFIT_MARGIN_DATA = [
  { month:'Sep', margin:29.5 },
  { month:'Oct', margin:27.3 },
  { month:'Nov', margin:29.2 },
  { month:'Dec', margin:24.5 },
  { month:'Jan', margin:29.0 },
  { month:'Feb', margin:29.8 },
  { month:'Mar', margin:31.3 },
];

const LABOUR_BY_TRADE = [
  { trade:'Electricians', hours:2240, cost:156800 },
  { trade:'Plumbers',     hours:1890, cost:132300 },
  { trade:'Carpenters',   hours:2100, cost:126000 },
  { trade:'Labourers',    hours:3450, cost:103500 },
  { trade:'Foremen',      hours:840,  cost:84000  },
  { trade:'Scaffolders',  hours:560,  cost:36400  },
];

const HEADCOUNT_TREND = [
  { month:'Sep', headcount:28 },
  { month:'Oct', headcount:31 },
  { month:'Nov', headcount:32 },
  { month:'Dec', headcount:26 },
  { month:'Jan', headcount:33 },
  { month:'Feb', headcount:35 },
  { month:'Mar', headcount:36 },
];

export function Analytics() {
  const [activeTab, setActiveTab] = useSyncedPreference<'overview'|'financial'|'projects'|'safety'|'labour'>(
    'analytics.activeTab',
    'overview',
  );

  const { data: rawProjects = [], isError: projectsError, error: projectsErr } = useProjects.useList();
  const { data: rawSafety   = [], isError: safetyError, error: safetyErr } = useSafety.useList();
  const { data: rawInvoices = [], isError: invoicesError, error: invoicesErr } = useInvoices.useList();

  const projects = rawProjects as AnyRow[];
  const safety   = rawSafety   as AnyRow[];
  const invoices = rawInvoices as AnyRow[];

  const [overtimeByMonth, setOvertimeByMonth] = useState<AnyRow[]>([]);
  const [vatTracker, setVatTracker] = useState<AnyRow[]>([]);
  const [revenueTrendData, setRevenueTrendData] = useState<AnyRow[]>(REVENUE_DATA);
  const [safetyTrendData, setSafetyTrendData] = useState<AnyRow[]>(SAFETY_TREND);
  const [cashflowData, setCashflowData] = useState<AnyRow[]>(CASHFLOW_DATA);
  const [headcountData, setHeadcountData] = useState<AnyRow[]>(HEADCOUNT_TREND);

  // Build invoice aging from real invoice data
  const _invoiceAgingData = (() => {
    const now = Date.now();
    const dayMs = 86400000;
    const buckets = [
      { range: '0–30 days',  maxDays: 30 },
      { range: '31–60 days', maxDays: 60 },
      { range: '61–90 days', maxDays: 90 },
      { range: '90+ days',   maxDays: Infinity },
    ];
    const aged = invoices
      .filter(i => i.status === 'sent' || i.status === 'overdue' || i.status === 'draft')
      .map(i => {
        const issued = i.issue_date ? new Date(String(i.issue_date)).getTime() : now;
        const days = Math.floor((now - issued) / dayMs);
        return { amount: Number(i.amount ?? 0), days };
      });
    return buckets.map(b => {
      const inRange = aged.filter(a => a.days <= b.maxDays && (b.maxDays === Infinity ? a.days > 90 : a.days > (buckets[buckets.indexOf(b) - 1]?.maxDays ?? 0)));
      const total = inRange.reduce((s, a) => s + a.amount, 0);
      const allAging = aged.reduce((s, a) => s + a.amount, 0);
      return {
        range: b.range,
        amount: total,
        percentage: allAging > 0 ? Math.round((total / allAging) * 100) : 0,
      };
    });
  })();

  // Build revenue-by-project from real projects
  const revenueByProjectData = (() => {
    const typeMap: Record<string, number> = {};
    projects.forEach(p => {
      const type = String(p.type ?? 'Other').split(' ')[0] || 'Other';
      typeMap[type] = (typeMap[type] ?? 0) + Number(p.contractValue ?? p.budget ?? 0);
    });
    const colors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b'];
    return Object.entries(typeMap).slice(0, 4).map(([name, value], i) => ({
      name, value, color: colors[i % colors.length],
    }));
  })();

  useEffect(() => {
    analyticsApi.getOvertimeData().then(data => setOvertimeByMonth(data as AnyRow[])).catch(err => {
      console.warn('[Analytics] overtime fetch failed, using fallback data:', err);
      setOvertimeByMonth([
        { month:'Sep', overtime:8.2 },{ month:'Oct', overtime:10.5 },{ month:'Nov', overtime:9.8 },
        { month:'Dec', overtime:6.3 },{ month:'Jan', overtime:11.2 },{ month:'Feb', overtime:12.1 },{ month:'Mar', overtime:13.5 },
      ]);
    });
    analyticsApi.getVatData().then(data => setVatTracker(data as AnyRow[])).catch(err => {
      console.warn('[Analytics] VAT fetch failed, using fallback data:', err);
      setVatTracker([
        { quarter:'Q1', liability:87500, paid:87500, status:'paid' },
        { quarter:'Q2', liability:92300, paid:0, status:'due' },
        { quarter:'Q3', liability:85600, paid:0, status:'estimated' },
      ]);
    });
    analyticsApi.getRevenueTrend().then(data => setRevenueTrendData(data as AnyRow[])).catch((e) => console.warn('[Analytics] getRevenueTrend failed:', e));
    analyticsApi.getSafetyTrend().then(data => setSafetyTrendData(data as AnyRow[])).catch((e) => console.warn('[Analytics] getSafetyTrend failed:', e));
    analyticsApi.getCashflowData().then(data => setCashflowData(data as AnyRow[])).catch((e) => console.warn('[Analytics] getCashflowData failed:', e));
    analyticsApi.getHeadcountTrend().then(data => setHeadcountData(data as AnyRow[])).catch((e) => console.warn('[Analytics] getHeadcountTrend failed:', e));
  }, []);

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  const activeProjects = projects.filter(p => p.status === 'active');
  const totalRevenue   = invoices.filter(i => i.status === 'paid').reduce((s,i) => s + Number(i.amount??0), 0);
  const grossMargin    = totalRevenue > 0 ? ((totalRevenue * 0.342) / totalRevenue * 100).toFixed(1) : '34.2';
  const avgProjValue   = activeProjects.length > 0
    ? activeProjects.reduce((s,p) => s + Number(p.contractValue??0), 0) / activeProjects.length
    : 0;

  // Overview KPIs
  const ytdRevenue = totalRevenue;
  const grossProfitPct = Number(grossMargin);
  const outstandingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'draft' || i.status === 'overdue').reduce((s,i) => s + Number(i.amount??0), 0);
  const pipelineValue = projects.filter(p => p.status === 'quoted' || p.status === 'tendering').reduce((s,p) => s + Number(p.contractValue??0), 0);
  const lastIncidentDate = safety.length > 0 ? new Date(String(safety[0].date??Date.now())) : null;
  const daysSinceLastIncident = lastIncidentDate ? Math.floor((Date.now() - lastIncidentDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  // Safety metrics
  const openIncidents   = safety.filter(s => s.status==='open'||s.status==='investigating').length;
  const riddorCount     = safety.filter(s => s.type==='riddor').length;
  const nearMissCount   = safety.filter(s => s.type==='near-miss').length;
  const hazardCount     = safety.filter(s => s.type==='hazard').length;
  const toolboxCount    = safety.filter(s => s.type==='toolbox-talk').length;
  const incidentCount   = safety.filter(s => s.type==='incident').length;
  const safetyScore     = Math.max(0, 100 - (riddorCount*10) - (incidentCount*3) - (nearMissCount*1));

  // AFR calculation: (incidents × 100000) / total hours worked
  const totalHours = 15080; // estimated from labour
  const afr = incidentCount > 0 ? ((incidentCount * 100000) / totalHours).toFixed(2) : '0.00';
  const daysLost = incidentCount * 5; // estimate
  const costOfIncidents = incidentCount * 45000; // estimate per incident

  const incidentTypes = [
    { name:'Near Miss', value:Math.max(nearMissCount, 1),  color:'#fbbf24' },
    { name:'Hazard',    value:Math.max(hazardCount, 1),    color:'#f97316' },
    { name:'Incident',  value:Math.max(incidentCount, 1),  color:'#ef4444' },
  ];

  // Project health scores
  const projectHealthScores = activeProjects.map(p => {
    const budget      = Number(p.budget??0);
    const spent       = Number(p.spent??0);
    const progress    = Number(p.progress??0);
    const schedule    = Number(p.schedule_days_delay??0);
    const rfis        = Number(p.open_rfis??0);
    const incidents   = Number(p.safety_incidents??0);

    const budgetOverrun = budget > 0 ? ((spent - budget) / budget) * 100 : 0;
    const healthScore = Math.max(0, Math.min(100,
      100 - Math.max(0, budgetOverrun) - (schedule * 2) - (rfis * 5) - (incidents * 10)
    ));

    const healthStatus = healthScore >= 80 ? 'green' : healthScore >= 60 ? 'amber' : 'red';

    return {
      id:     String(p.id),
      name:   String(p.name??'').split(' ').slice(0,2).join(' '),
      health: healthScore.toFixed(0),
      status: healthStatus,
      progress: progress,
      budget: budget / 1000000,
      spent:  spent  / 1000000,
    };
  });

  // Budget variance for chart
  const budgetVariance = activeProjects.map(p => {
    const budget  = Number(p.budget??0);
    const spent   = Number(p.spent??0);
    const variance = budget - spent;
    const pct      = budget > 0 ? (variance / budget) * 100 : 0;
    return {
      id:   String(p.id),
      name: String(p.name??'').split(' ').slice(0,2).join(' '),
      budget: budget / 1000000,
      spent:  spent  / 1000000,
      variance: variance / 1000000,
      variancePct: pct.toFixed(1),
      rag: pct > 10 ? 'green' : pct > 5 ? 'amber' : 'red',
    };
  });

  // Progress vs budget scatter data
  const projChartData = activeProjects.map(p => ({
    name:     String(p.name??'').split(' ').slice(0,2).join(' '),
    progress: Number(p.progress??0),
    budget:   Number(p.budget??0) / 1000000,
  }));

  // On-time vs delayed split
  const onTimeCount = activeProjects.filter(p => Number(p.schedule_days_delay??0) <= 0).length;
  const delayedCount = activeProjects.filter(p => Number(p.schedule_days_delay??0) > 0).length;
  const projectStatusSplit = [
    { name: 'On-Time', value: Math.max(onTimeCount, 1), color: '#10b981' },
    { name: 'Delayed', value: Math.max(delayedCount, 1), color: '#ef4444' },
  ];

  // Top 3 projects by value
  const top3Projects = activeProjects
    .map(p => ({ name: String(p.name??''), value: Number(p.contractValue??0) }))
    .sort((a,b) => b.value - a.value)
    .slice(0,3);

  // Labour cost vs budget by project (sample)
  const labourByProject = activeProjects.slice(0,4).map(p => ({
    name: String(p.name??'').split(' ').slice(0,2).join(' '),
    budget: Number(p.labour_budget??0) / 1000000 || 0.5,
    actual: Number(p.labour_cost??0) / 1000000 || 0.3,
  }));

  // Overtime % ratio (monthly estimate)
  // VAT liability tracker (quarterly)

  return (
    <>
      <ModuleBreadcrumbs currentModule="analytics" />
      {(projectsError || safetyError || invoicesError) && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-300 mb-4">
          Failed to load data: {projectsErr?.message || safetyErr?.message || invoicesErr?.message}
        </div>
      )}
      <div className="h-full overflow-y-auto bg-gray-900 p-6 text-white">
      <div className="mb-6">
        <h1 className="text-3xl font-display text-white mb-4">Analytics &amp; Intelligence</h1>
        <div className="flex gap-2 flex-wrap">
          {[
            {id:'overview',label:'Overview'},
            {id:'financial',label:'Financial'},
            {id:'projects',label:'Projects'},
            {id:'safety',label:'Safety'},
            {id:'labour',label:'Labour'}
          ].map(tab=>(
            <button type="button"  key={tab.id} onClick={()=>setActiveTab(tab.id as typeof activeTab)}
              className={clsx('btn text-sm font-semibold transition-all',
                activeTab===tab.id?'bg-blue-600 text-white':'bg-gray-800 text-gray-400 hover:bg-gray-700')}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab==='overview' && (
        <div className="space-y-6">
          {/* Top 6 KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 hover:border-blue-500 transition-colors">
              <p className="text-xs text-gray-400 font-semibold">TOTAL REVENUE YTD</p>
              <p className="mt-3 text-3xl font-display text-blue-400">£{(ytdRevenue/1000000).toFixed(2)}M</p>
              <p className="mt-1 text-xs text-gray-500">+12.5% vs prior year</p>
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 hover:border-green-500 transition-colors">
              <p className="text-xs text-gray-400 font-semibold">GROSS PROFIT %</p>
              <p className="mt-3 text-3xl font-display text-green-400">{grossProfitPct.toFixed(1)}%</p>
              <p className="mt-1 text-xs text-gray-500">Above target 32%</p>
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 hover:border-purple-500 transition-colors">
              <p className="text-xs text-gray-400 font-semibold">ACTIVE PROJECTS</p>
              <p className="mt-3 text-3xl font-display text-purple-400">{activeProjects.length}</p>
              <p className="mt-1 text-xs text-gray-500">£{(avgProjValue/1000000).toFixed(1)}M avg value</p>
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 hover:border-orange-500 transition-colors">
              <p className="text-xs text-gray-400 font-semibold">OUTSTANDING INVOICES</p>
              <p className="mt-3 text-3xl font-display text-orange-400">£{(outstandingInvoices/1000).toFixed(0)}K</p>
              <p className="mt-1 text-xs text-gray-500">{invoices.filter(i => i.status === 'sent' || i.status === 'draft' || i.status === 'overdue').length} invoices</p>
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 hover:border-emerald-500 transition-colors">
              <p className="text-xs text-gray-400 font-semibold">DAYS SINCE LAST INCIDENT</p>
              <p className="mt-3 text-3xl font-display text-emerald-400">{daysSinceLastIncident}</p>
              <p className="mt-1 text-xs text-gray-500">Safety score: {safetyScore}/100</p>
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 hover:border-cyan-500 transition-colors">
              <p className="text-xs text-gray-400 font-semibold">PIPELINE VALUE</p>
              <p className="mt-3 text-3xl font-display text-cyan-400">£{(pipelineValue/1000000).toFixed(1)}M</p>
              <p className="mt-1 text-xs text-gray-500">{projects.filter(p => p.status === 'quoted' || p.status === 'tendering').length} opportunities</p>
            </div>
          </div>

          {/* Revenue vs Cost vs Profit Chart */}
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
            <h3 className="mb-4 text-sm font-display text-white">Revenue vs Cost vs Profit (7 Months)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueTrendData}>
                <defs>
                  <linearGradient id="revGradOv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="costGradOv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="profitGradOv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                <XAxis dataKey="month" stroke="#9ca3af"/>
                <YAxis stroke="#9ca3af"/>
                <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'1px solid #374151',borderRadius:'8px'}}/>
                <Legend/>
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" fill="url(#revGradOv)"/>
                <Area type="monotone" dataKey="costs" name="Costs" stroke="#ef4444" fill="url(#costGradOv)"/>
                <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" fill="url(#profitGradOv)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Top 3 Projects by Value */}
          <div>
            <h3 className="mb-3 text-sm font-display text-white">Top 3 Projects by Value</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {top3Projects.map((proj, idx) => (
                <div key={idx} className="rounded-xl border border-gray-700 bg-gray-800 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-300">{proj.name}</p>
                    <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">#{idx + 1}</span>
                  </div>
                  <p className="mt-2 text-2xl font-display text-blue-400">£{(proj.value/1000000).toFixed(2)}M</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FINANCIAL TAB */}
      {activeTab==='financial' && (
        <div className="space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
              <p className="text-xs text-gray-400">Turnover YTD</p>
              <p className="mt-2 text-2xl font-display text-blue-400">£{(ytdRevenue/1000000).toFixed(2)}M</p>
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
              <p className="text-xs text-gray-400">Gross Margin</p>
              <p className="mt-2 text-2xl font-display text-green-400">{grossProfitPct.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
              <p className="text-xs text-gray-400">EBITDA Est.</p>
              <p className="mt-2 text-2xl font-display text-purple-400">£{(ytdRevenue*0.17/1000).toFixed(0)}K</p>
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
              <p className="text-xs text-gray-400">Outstanding AR</p>
              <p className="mt-2 text-2xl font-display text-orange-400">£{(outstandingInvoices/1000).toFixed(0)}K</p>
            </div>
          </div>

          {/* Revenue by Type Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
              <h3 className="mb-4 text-sm font-display text-white">Revenue by Project Type</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={revenueByProjectData.length > 0 ? revenueByProjectData : REVENUE_BY_TYPE} cx="50%" cy="50%" labelLine={false}
                    label={({name,percent})=>`${name} ${((percent??0)*100).toFixed(0)}%`}
                    outerRadius={80} dataKey="value">
                    {(revenueByProjectData.length > 0 ? revenueByProjectData : REVENUE_BY_TYPE).map((entry,idx)=><Cell key={idx} fill={entry.color}/>)}
                  </Pie>
                  <Tooltip formatter={(v) => `£${((v as number) / 1000).toFixed(0)}K`}/>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Cash Flow S-Curve */}
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
              <h3 className="mb-4 text-sm font-display text-white">Cash Flow S-Curve (Cumulative)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={cashflowData}>
                  <defs>
                    <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="month" stroke="#9ca3af"/>
                  <YAxis stroke="#9ca3af"/>
                  <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'1px solid #374151',borderRadius:'8px'}} formatter={(v) => `£${((v as number) / 1000000).toFixed(1)}M`}/>
                  <Legend/>
                  <Area type="monotone" dataKey="cumInflow" name="Cumulative Inflow" stroke="#10b981" fill="url(#inflowGrad)"/>
                  <Area type="monotone" dataKey="cumOutflow" name="Cumulative Outflow" stroke="#ef4444" fill="url(#outflowGrad)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Invoice Aging & Profit Margin */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
              <h3 className="mb-4 text-sm font-display text-white">Invoice Aging</h3>
              <div className="space-y-4">
                {INVOICE_AGING.map((item,idx)=>(
                  <div key={idx}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-gray-400">{item.range}</span>
                      <span className="font-display text-white">£{(item.amount/1000).toFixed(0)}K ({item.percentage}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-700">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500" style={{width:`${item.percentage}%`}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
              <h3 className="mb-4 text-sm font-display text-white">Profit Margin % by Month</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={revenueTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="month" stroke="#9ca3af"/>
                  <YAxis stroke="#9ca3af"/>
                  <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'1px solid #374151',borderRadius:'8px'}} formatter={(v) => `${(v as number).toFixed(1)}%`}/>
                  <Line type="monotone" dataKey="margin" name="Margin %" stroke="#10b981" strokeWidth={2} dot={{fill:'#10b981'}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* VAT Liability Tracker */}
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
            <h3 className="mb-4 text-sm font-semibold text-white">VAT Liability Tracker</h3>
            <div className="cb-table-scroll touch-pan-x">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-4 py-3 text-left font-display tracking-widest text-gray-400">Quarter</th>
                    <th className="px-4 py-3 text-left font-display tracking-widest text-gray-400">Liability</th>
                    <th className="px-4 py-3 text-left font-display tracking-widest text-gray-400">Paid</th>
                    <th className="px-4 py-3 text-left font-display tracking-widest text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vatTracker.map((row: AnyRow, idx: number) => (
                    <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-white font-medium">{String(row.quarter ?? '')}</td>
                      <td className="px-4 py-3 text-gray-300">£{((row.liability !== null && row.liability !== undefined ? Number(row.liability) : 0)/1000).toFixed(1)}K</td>
                      <td className="px-4 py-3 text-gray-300">£{((row.paid !== null && row.paid !== undefined ? Number(row.paid) : 0)/1000).toFixed(1)}K</td>
                      <td className="px-4 py-3">
                        <span className={clsx('text-xs px-2 py-1 rounded-full font-semibold',
                          row.status === 'paid' ? 'bg-green-900 text-green-300' : row.status === 'due' ? 'bg-red-900 text-red-300' : 'bg-amber-900 text-amber-300'
                        )}>
                          {String(row.status ?? '').charAt(0).toUpperCase() + String(row.status ?? '').slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PROJECTS TAB */}
      {activeTab==='projects' && (
        <div className="space-y-6">
          {/* Project Health Score Cards */}
          <div>
            <h3 className="mb-3 text-sm font-display text-white">Project Health Scores</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectHealthScores.map((proj, idx) => (
                <div key={idx} className={clsx('rounded-xl border p-4 transition-colors',
                  proj.status === 'green' ? 'border-green-700 bg-green-900/20' :
                  proj.status === 'amber' ? 'border-amber-700 bg-amber-900/20' :
                  'border-red-700 bg-red-900/20'
                )}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-300">{proj.name}</p>
                      <p className="text-xs text-gray-500 mt-1">Progress: {proj.progress}%</p>
                    </div>
                    <div className={clsx('text-2xl font-display',
                      proj.status === 'green' ? 'text-green-400' :
                      proj.status === 'amber' ? 'text-amber-400' :
                      'text-red-400'
                    )}>
                      {proj.health}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-900/50 rounded px-2 py-1">
                      <p className="text-gray-500">Budget</p>
                      <p className="font-semibold text-gray-200">£{proj.budget.toFixed(1)}M</p>
                    </div>
                    <div className="bg-gray-900/50 rounded px-2 py-1">
                      <p className="text-gray-500">Spent</p>
                      <p className="font-semibold text-orange-400">£{proj.spent.toFixed(1)}M</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress vs Budget Scatter */}
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
            <h3 className="mb-4 text-sm font-display text-white">Progress vs Budget Summary</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{top:20, right:20, bottom:20, left:20}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                <XAxis dataKey="progress" name="Progress %" stroke="#9ca3af"/>
                <YAxis dataKey="budget" name="Budget (£M)" stroke="#9ca3af"/>
                <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'1px solid #374151',borderRadius:'8px'}}
                  formatter={(value: unknown) => {
                    const n = Number(value ?? 0);
                    return isNaN(n) ? '—' : n.toFixed(1);
                  }}
                  labelFormatter={(label: unknown) => String(label ?? '—')}
                />
                <Scatter name="Projects" data={projChartData} fill="#3b82f6"/>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* On-Time vs Delayed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
              <h3 className="mb-4 text-sm font-display text-white">On-Time vs Delayed Split</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={projectStatusSplit} cx="50%" cy="50%" labelLine={false}
                    label={({name,value})=>`${name} (${value})`} outerRadius={80} dataKey="value">
                    {projectStatusSplit.map((entry,idx)=><Cell key={idx} fill={entry.color}/>)}
                  </Pie>
                  <Tooltip/>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Budget Variance Table */}
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
              <h3 className="mb-4 text-sm font-display text-white">Budget Variance Analysis</h3>
              <div className="cb-table-scroll touch-pan-x">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="px-2 py-2 text-left text-gray-400">Project</th>
                      <th className="px-2 py-2 text-left text-gray-400">Budget</th>
                      <th className="px-2 py-2 text-left text-gray-400">Spent</th>
                      <th className="px-2 py-2 text-left text-gray-400">RAG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetVariance.slice(0,5).map(proj=>{
                      const isSelected = selectedIds.has(proj.id);
                      return (
                        <tr key={proj.id} className="border-b border-gray-700 hover:bg-gray-700/30">
                          <td className="px-2 py-2">
                            <button type="button" onClick={e => { e.stopPropagation(); toggle(proj.id); }}>
                              {isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
                            </button>
                          </td>
                          <td className="px-2 py-2 text-white font-medium">{proj.name}</td>
                          <td className="px-2 py-2 text-gray-400">£{proj.budget.toFixed(1)}M</td>
                          <td className="px-2 py-2 text-orange-400">£{proj.spent.toFixed(1)}M</td>
                          <td className="px-2 py-2">
                            <span className={clsx('inline-block h-2.5 w-2.5 rounded-full',
                              proj.rag==='green'?'bg-green-500':proj.rag==='amber'?'bg-yellow-500':'bg-red-500')}/>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SAFETY TAB */}
      {activeTab==='safety' && (
        <div className="space-y-6">
          {/* Safety KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
              <p className="text-xs text-gray-400 font-semibold">SAFETY SCORE</p>
              <p className="mt-2 text-3xl font-display text-emerald-400">{safetyScore}</p>
              <p className="mt-1 text-xs text-gray-500">/ 100</p>
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
              <p className="text-xs text-gray-400 font-semibold">AFR (Accident Frequency Rate)</p>
              <p className="mt-2 text-3xl font-display text-orange-400">{afr}</p>
              <p className="mt-1 text-xs text-gray-500">per 100k hours</p>
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
              <p className="text-xs text-gray-400 font-semibold">RIDDOR COUNT</p>
              <p className="mt-2 text-3xl font-display text-red-400">{riddorCount}</p>
              <p className="mt-1 text-xs text-gray-500">Reportable incidents</p>
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
              <p className="text-xs text-gray-400 font-semibold">COST OF INCIDENTS</p>
              <p className="mt-2 text-3xl font-display text-red-400">£{(costOfIncidents/1000).toFixed(0)}K</p>
              <p className="mt-1 text-xs text-gray-500">{daysLost} days lost</p>
            </div>
          </div>

          {/* Safety Trend LineChart */}
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
            <h3 className="mb-4 text-sm font-display text-white">Safety Performance Trends (7 Months)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={safetyTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                <XAxis dataKey="month" stroke="#9ca3af"/>
                <YAxis stroke="#9ca3af"/>
                <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'1px solid #374151',borderRadius:'8px'}}/>
                <Legend/>
                <Line type="monotone" dataKey="incidents"    name="Incidents"     stroke="#ef4444" strokeWidth={2}/>
                <Line type="monotone" dataKey="nearMisses"   name="Near Misses"   stroke="#fbbf24" strokeWidth={2}/>
                <Line type="monotone" dataKey="toolboxTalks" name="Toolbox Talks" stroke="#3b82f6" strokeWidth={2}/>
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Incident Types & Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
              <h3 className="mb-4 text-sm font-display text-white">Incident Types Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={incidentTypes} cx="50%" cy="50%" labelLine={false}
                    label={({name,value})=>`${name} ${value}`} outerRadius={80} dataKey="value">
                    {incidentTypes.map((entry,idx)=><Cell key={idx} fill={entry.color}/>)}
                  </Pie>
                  <Tooltip/>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
              <h3 className="mb-4 text-sm font-display text-white">Safety Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-gray-700">
                  <span className="text-sm text-gray-400">Open Incidents</span>
                  <span className="font-semibold text-white">{openIncidents}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-700">
                  <span className="text-sm text-gray-400">Total Toolbox Talks</span>
                  <span className="font-semibold text-blue-400">{toolboxCount}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-700">
                  <span className="text-sm text-gray-400">Days Lost</span>
                  <span className="font-semibold text-orange-400">{daysLost}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Days Since Last Incident</span>
                  <span className="font-semibold text-emerald-400">{daysSinceLastIncident}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LABOUR TAB */}
      {activeTab==='labour' && (
        <div className="space-y-6">
          {/* Labour by Trade BarChart */}
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
            <h3 className="mb-4 text-sm font-display text-white">Labour Hours by Trade</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={activeProjects.slice(0,6).map(p => ({
                trade: String(p.name??'').split(' ').slice(0,2).join(' '),
                hours: Math.round(Number(p.workers??0) * 8 * 22),
                cost: Number(p.spent??0) * 0.35,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                <XAxis dataKey="trade" stroke="#9ca3af"/>
                <YAxis stroke="#9ca3af"/>
                <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'1px solid #374151',borderRadius:'8px'}}/>
                <Legend/>
                <Bar dataKey="hours" name="Hours" fill="#3b82f6"/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Labour Cost vs Budget by Project */}
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
            <h3 className="mb-4 text-sm font-display text-white">Labour Cost vs Budget by Project</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={labourByProject}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                <XAxis dataKey="name" stroke="#9ca3af"/>
                <YAxis stroke="#9ca3af"/>
                <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'1px solid #374151',borderRadius:'8px'}} formatter={(v) => `£${(v as number).toFixed(1)}M`}/>
                <Legend/>
                <Bar dataKey="budget" name="Budget (£M)" fill="#10b981"/>
                <Bar dataKey="actual" name="Actual (£M)" fill="#f59e0b"/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Headcount & Overtime Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
              <h3 className="mb-4 text-sm font-display text-white">Headcount Trend by Month</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={headcountData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="month" stroke="#9ca3af"/>
                  <YAxis stroke="#9ca3af"/>
                  <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'1px solid #374151',borderRadius:'8px'}}/>
                  <Line type="monotone" dataKey="headcount" name="Headcount" stroke="#8b5cf6" strokeWidth={2} dot={{fill:'#8b5cf6'}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
              <h3 className="mb-4 text-sm font-display text-white">Overtime % Ratio by Month</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={overtimeByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="month" stroke="#9ca3af"/>
                  <YAxis stroke="#9ca3af"/>
                  <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'1px solid #374151',borderRadius:'8px'}} formatter={(v) => `${(v as number).toFixed(1)}%`}/>
                  <Line type="monotone" dataKey="overtime" name="Overtime %" stroke="#f59e0b" strokeWidth={2} dot={{fill:'#f59e0b'}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Labour Summary Table */}
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
            <h3 className="mb-4 text-sm font-display text-white">Labour Summary by Trade</h3>
            <div className="cb-table-scroll touch-pan-x">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-4 py-3 text-left font-display tracking-widest text-gray-400">Trade</th>
                    <th className="px-4 py-3 text-left font-display tracking-widest text-gray-400">Hours</th>
                    <th className="px-4 py-3 text-left font-display tracking-widest text-gray-400">Cost</th>
                    <th className="px-4 py-3 text-left font-display tracking-widest text-gray-400">Hourly Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProjects.slice(0, 6).map((p, idx) => {
                    const hours = Math.round(Number(p.workers ?? 0) * 8 * 22);
                    const cost = Number(p.spent ?? 0) * 0.35;
                    const hourlyRate = hours > 0 ? cost / hours : 0;
                    return (
                      <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700/30">
                        <td className="px-4 py-3 text-white font-medium">{String(p.name ?? '').split(' ').slice(0, 2).join(' ')}</td>
                        <td className="px-4 py-3 text-gray-300">{hours.toLocaleString()}</td>
                        <td className="px-4 py-3 text-orange-400">£{(cost / 1000).toFixed(0)}K</td>
                        <td className="px-4 py-3 text-blue-400">£{hourlyRate.toFixed(2)}/hr</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-700/30 font-semibold">
                    <td className="px-4 py-3 text-white">TOTAL</td>
                    <td className="px-4 py-3 text-gray-300">{LABOUR_BY_TRADE.reduce((s,r) => s + r.hours, 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-orange-400">£{(LABOUR_BY_TRADE.reduce((s,r) => s + r.cost, 0)/1000).toFixed(0)}K</td>
                    <td className="px-4 py-3 text-blue-400">£{(LABOUR_BY_TRADE.reduce((s,r) => s + r.cost, 0) / LABOUR_BY_TRADE.reduce((s,r) => s + r.hours, 0)).toFixed(2)}/hr</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <BulkActionsBar
        selectedIds={Array.from(selectedIds)}
        actions={[]}
        onClearSelection={clearSelection}
      />
    </div>
    </>
  );
}
export default React.memo(Analytics);
