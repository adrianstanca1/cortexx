import { useState, useEffect } from 'react';
import { Users, Building2, BarChart3, Activity, Cloud, FileText, ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { KPICardSkeleton, ChartSkeleton } from '../../ui/Skeleton';
import { KPICard, ActivityFeed } from '../shared';
import { EmptyState } from '../../ui/EmptyState';
import { apiFetch } from '../../../services/api';
import {
  fmtNumber, fmtBytes, type SystemStats, type ActivityFeedItem, type ChartDataPoint,
} from '../types';

interface OverviewTabProps {
  stats?: SystemStats | null;
  activities?: ActivityFeedItem[];
  loading?: boolean;
}

export default function OverviewTab({ stats: propStats = null, activities = [], loading: propLoading = false }: OverviewTabProps) {
  const [fetchedStats, setFetchedStats] = useState<SystemStats | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);

  useEffect(() => {
    if (propStats) { setFetchLoading(false); return; }
    apiFetch<SystemStats>('/admin/stats')
      .then(data => setFetchedStats(data))
      .catch(e => console.warn('[OverviewTab] failed to load stats:', e))
      .finally(() => setFetchLoading(false));
  }, [propStats]);

  const stats = propStats ?? fetchedStats;
  const loading = propLoading || fetchLoading;
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <KPICardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton height={300} />
          <ChartSkeleton height={300} />
        </div>
      </div>
    );
  }

  if (!stats) return <EmptyState title="No data available" description="System stats could not be loaded" variant="error" />;

  const chartData: ChartDataPoint[] = [
    { name: 'Users', value: stats.totalUsers, fill: '#3b82f6' },
    { name: 'Companies', value: stats.totalCompanies, fill: '#10b981' },
    { name: 'Projects', value: stats.totalProjects, fill: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Users"
          value={fmtNumber(stats.totalUsers)}
          change={12.5}
          icon={Users}
          color="#3b82f6"
          subtitle={`${fmtNumber(stats.activeUsers)} active`}
        />
        <KPICard
          title="Companies"
          value={fmtNumber(stats.totalCompanies)}
          change={8.3}
          icon={Building2}
          color="#10b981"
          subtitle={`${fmtNumber(stats.activeCompanies)} active`}
        />
        <KPICard
          title="Projects"
          value={fmtNumber(stats.totalProjects)}
          change={-2.1}
          icon={BarChart3}
          color="#f59e0b"
          subtitle={`${fmtNumber(stats.activeProjects)} active`}
        />
        <KPICard
          title="System Health"
          value={stats.systemHealth === 'healthy' ? '98.5%' : stats.systemHealth === 'degraded' ? '85.2%' : '62.1%'}
          change={stats.systemHealth === 'healthy' ? 1.2 : -5.4}
          icon={stats.systemHealth === 'healthy' ? ShieldCheck : stats.systemHealth === 'degraded' ? AlertTriangle : ShieldAlert}
          color={stats.systemHealth === 'healthy' ? '#10b981' : stats.systemHealth === 'degraded' ? '#f59e0b' : '#ef4444'}
          subtitle={`Uptime: ${stats.uptime.toFixed(1)}%`}
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <Activity className="w-5 h-5 text-blue-400" />
            <span className="text-sm text-gray-400">Active Sessions</span>
          </div>
          <p className="text-2xl font-bold text-white">{fmtNumber(stats.activeSessions)}</p>
          <p className="text-xs text-gray-500 mt-1">Current concurrent users</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <Cloud className="w-5 h-5 text-green-400" />
            <span className="text-sm text-gray-400">Storage Used</span>
          </div>
          <p className="text-2xl font-bold text-white">{fmtBytes(stats.storageUsed)}</p>
          <p className="text-xs text-gray-500 mt-1">of {fmtBytes(stats.storageTotal)} total</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="w-5 h-5 text-purple-400" />
            <span className="text-sm text-gray-400">API Calls Today</span>
          </div>
          <p className="text-2xl font-bold text-white">{fmtNumber(stats.apiCallsToday)}</p>
          <p className="text-xs text-gray-500 mt-1">Total requests</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div className="card p-5">
          <h3 className="text-lg font-bold text-white mb-4">User Growth (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={[
              { name: 'May', users: 120 },
              { name: 'Jun', users: 145 },
              { name: 'Jul', users: 178 },
              { name: 'Aug', users: 210 },
              { name: 'Sep', users: 245 },
              { name: 'Oct', users: stats.totalUsers },
            ]}>
              <defs>
                <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} stroke="#374151" />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} stroke="#374151" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Area type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2} fill="url(#userGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Distribution Chart */}
        <div className="card p-5">
          <h3 className="text-lg font-bold text-white mb-4">Resource Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill as string} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity Feed */}
      <ActivityFeed activities={activities} />
    </div>
  );
}
