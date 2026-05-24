// Shared UI components for Admin Dashboard tabs

import { X } from 'lucide-react';
import { KPICardSkeleton } from '../ui/Skeleton';
import {
  PLAN_COLORS, STATUS_COLORS, HEALTH_COLORS, getTimeAgo, getTrendIcon,
  type ActivityFeedItem, type ChartDataPoint,
} from './types';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ─── KPI Card Component ───────────────────────────────────────────────────────

interface KPICardProps {
  title: string;
  value: number | string;
  change?: number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
  loading?: boolean;
}

export function KPICard({ title, value, change, icon: Icon, color, subtitle, loading }: KPICardProps) {
  if (loading) return <KPICardSkeleton />;

  const TrendIcon = getTrendIcon(change ?? 0);
  const changeColor = change !== undefined && change >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="card p-5 hover:shadow-lg transition-shadow duration-300">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-white mb-1">{value}</h3>
          {change !== undefined && (
            <div className="flex items-center gap-1 text-sm">
              <TrendIcon className={`w-4 h-4 ${changeColor}`} />
              <span className={changeColor}>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</span>
              <span className="text-gray-500">vs last week</span>
            </div>
          )}
          {subtitle && <p className="text-xs text-gray-500 mt-2">{subtitle}</p>}
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: `${color}20`, color }}
        >
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

// ─── Status Badge Component ───────────────────────────────────────────────────

interface StatusBadgeProps {
  status: string;
  type?: 'user' | 'company' | 'plan' | 'health';
}

export function StatusBadge({ status, type = 'user' }: StatusBadgeProps) {
  const colors = type === 'plan' ? PLAN_COLORS : type === 'health' ? HEALTH_COLORS : STATUS_COLORS;
  const color = colors[status] || 'bg-gray-500/20 text-gray-400';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' || status === 'healthy' ? 'bg-current animate-pulse' : 'bg-current'}`} />
      {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
    </span>
  );
}

// ─── Modal Component ──────────────────────────────────────────────────────────

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, footer, size = 'md' }: ModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-hidden flex flex-col`}>
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
        {footer && (
          <div className="p-6 border-t border-gray-800 bg-gray-900/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Activity Feed Component ──────────────────────────────────────────────────

interface ActivityFeedProps {
  activities: ActivityFeedItem[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div className="card p-5">
      <h3 className="text-lg font-bold text-white mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {activities.map((activity, index) => {
          const Icon = activity.icon;
          const colors = {
            user: 'bg-blue-500/20 text-blue-400',
            system: 'bg-gray-500/20 text-gray-400',
            alert: 'bg-amber-500/20 text-amber-400',
            success: 'bg-emerald-500/20 text-emerald-400',
          };
          return (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-800/50 transition-colors"
              style={{ animation: `fadeIn 0.3s ease-out ${index * 0.05}s both` }}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colors[activity.type]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{activity.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{activity.description}</p>
              </div>
              <span className="text-xs text-gray-500">{getTimeAgo(activity.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Overview Charts Component ────────────────────────────────────────────────

interface OverviewChartsProps {
  stats: { totalUsers: number; totalCompanies: number; totalProjects: number };
  userGrowthData?: { name: string; users: number }[];
}

export function OverviewCharts({ stats, userGrowthData }: OverviewChartsProps) {
  const chartData: ChartDataPoint[] = [
    { name: 'Users', value: stats.totalUsers, fill: '#3b82f6' },
    { name: 'Companies', value: stats.totalCompanies, fill: '#10b981' },
    { name: 'Projects', value: stats.totalProjects, fill: '#f59e0b' },
  ];

  const growthData = userGrowthData || [
    { name: 'Oct', users: stats.totalUsers },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5">
        <h3 className="text-lg font-bold text-white mb-4">User Growth</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={growthData}>
            <defs>
              <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} stroke="#374151" />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} stroke="#374151" />
            <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} labelStyle={{ color: '#9ca3af' }} />
            <Area type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2} fill="url(#userGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="card p-5">
        <h3 className="text-lg font-bold text-white mb-4">Resource Distribution</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
              {chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill as string} />))}
            </Pie>
            <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
