import { LayoutDashboard, FolderOpen, FileText, Shield, HardHat } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartSkeleton } from '../../ui/Skeleton';

interface AnalyticsTabProps {
  loading: boolean;
}

export default function AnalyticsTab({ loading }: AnalyticsTabProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton height={300} />
          <ChartSkeleton height={300} />
          <ChartSkeleton height={300} />
          <ChartSkeleton height={300} />
        </div>
      </div>
    );
  }

  const userGrowthData = [
    { month: 'May', users: 120, companies: 15 },
    { month: 'Jun', users: 145, companies: 18 },
    { month: 'Jul', users: 178, companies: 22 },
    { month: 'Aug', users: 210, companies: 26 },
    { month: 'Sep', users: 245, companies: 31 },
    { month: 'Oct', users: 289, companies: 35 },
  ];

  const moduleUsageData = [
    { name: 'Projects', value: 85, color: '#3b82f6' },
    { name: 'Invoicing', value: 72, color: '#10b981' },
    { name: 'Safety', value: 68, color: '#f59e0b' },
    { name: 'RFIs', value: 54, color: '#8b5cf6' },
    { name: 'Documents', value: 48, color: '#06b6d4' },
    { name: 'Teams', value: 42, color: '#ec4899' },
  ];

  const projectCreationData = [
    { week: 'Week 1', projects: 12 },
    { week: 'Week 2', projects: 18 },
    { week: 'Week 3', projects: 15 },
    { week: 'Week 4', projects: 24 },
  ];

  const errorTrackingData = [
    { date: 'Mon', errors: 5, warnings: 12 },
    { date: 'Tue', errors: 3, warnings: 8 },
    { date: 'Wed', errors: 8, warnings: 15 },
    { date: 'Thu', errors: 2, warnings: 6 },
    { date: 'Fri', errors: 6, warnings: 10 },
    { date: 'Sat', errors: 1, warnings: 3 },
    { date: 'Sun', errors: 2, warnings: 4 },
  ];

  return (
    <div className="space-y-6">
      {/* User Growth & Project Creation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-lg font-bold text-white mb-4">User & Company Growth</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={userGrowthData}>
              <defs>
                <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="companiesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} stroke="#374151" />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} stroke="#374151" />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
              <Legend />
              <Area type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2} fill="url(#usersGradient)" name="Users" />
              <Area type="monotone" dataKey="companies" stroke="#10b981" strokeWidth={2} fill="url(#companiesGradient)" name="Companies" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="text-lg font-bold text-white mb-4">Project Creation Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={projectCreationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 11 }} stroke="#374151" />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} stroke="#374151" />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
              <Bar dataKey="projects" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Module Usage & Error Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-lg font-bold text-white mb-4">Module Usage Statistics</h3>
          <div className="space-y-4">
            {moduleUsageData.map((module) => (
              <div key={module.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">{module.name}</span>
                  <span className="text-sm font-medium text-white">{module.value}% adoption</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${module.value}%`, background: module.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-lg font-bold text-white mb-4">Error Tracking (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={errorTrackingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} stroke="#374151" />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} stroke="#374151" />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
              <Legend />
              <Bar dataKey="errors" fill="#ef4444" radius={[4, 4, 0, 0]} name="Errors" />
              <Bar dataKey="warnings" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Warnings" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Popular Features */}
      <div className="card p-5">
        <h3 className="text-lg font-bold text-white mb-4">Popular Features</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { name: 'Dashboard', usage: '92%', icon: LayoutDashboard },
            { name: 'Projects', usage: '87%', icon: FolderOpen },
            { name: 'Invoicing', usage: '78%', icon: FileText },
            { name: 'Safety', usage: '71%', icon: Shield },
            { name: 'RFIs', usage: '65%', icon: HardHat },
            { name: 'Documents', usage: '58%', icon: FileText },
          ].map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div key={i} className="p-4 bg-gray-800/50 rounded-lg text-center">
                <Icon className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-white">{feature.name}</p>
                <p className="text-xs text-gray-500 mt-1">{feature.usage} active</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
