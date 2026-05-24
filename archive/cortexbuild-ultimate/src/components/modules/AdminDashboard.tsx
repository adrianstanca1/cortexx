// Module: Admin Dashboard — CortexBuild Ultimate
// Comprehensive administration panel for system management, user oversight,
// company settings, analytics, audit logs, and backup operations.

import { useState } from 'react';
import {
  Users, Settings2, BarChart3, FileText,
  RefreshCw, Activity, TrendingUp, Download, GitBranch, AlertTriangle,
  AlertCircle, CheckCircle2, HardDrive, Cpu, Clock, Zap,
  Plus, Trash2, Mail, Search,
} from 'lucide-react';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import clsx from 'clsx';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type _AnyRow = Record<string, unknown>;
type AdminTab = 'overview' | 'users' | 'system' | 'logs' | 'billing' | 'companies' | 'analytics' | 'deployment';

interface SystemEvent {
  id: string;
  timestamp: string;
  type: 'info' | 'warning' | 'error';
  message: string;
  source: string;
}

interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  lastLogin: string;
  status: 'active' | 'inactive' | 'suspended';
  joinDate: string;
}

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  createdAt: string;
}

interface SystemLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  source: string;
  userId?: string;
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  description: string;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────────

const MOCK_SYSTEM_EVENTS: SystemEvent[] = [
  { id: '1', timestamp: '2026-04-27T14:32:00Z', type: 'info', message: 'Database backup completed', source: 'system' },
  { id: '2', timestamp: '2026-04-27T12:15:00Z', type: 'warning', message: 'High CPU usage detected (87%)', source: 'monitor' },
  { id: '3', timestamp: '2026-04-27T10:45:00Z', type: 'error', message: 'Failed API gateway restart', source: 'deployment' },
  { id: '4', timestamp: '2026-04-27T09:20:00Z', type: 'info', message: 'User cleanup task executed', source: 'scheduler' },
];

const MOCK_USERS: SystemUser[] = [
  { id: '1', name: 'Sarah Johnson', email: 'sarah@cortexbuild.uk', role: 'admin', lastLogin: '2026-04-27', status: 'active', joinDate: '2025-01-15' },
  { id: '2', name: 'Mike Chen', email: 'mike@cortexbuild.uk', role: 'manager', lastLogin: '2026-04-26', status: 'active', joinDate: '2025-02-20' },
  { id: '3', name: 'Emma Roberts', email: 'emma@cortexbuild.uk', role: 'user', lastLogin: '2026-04-25', status: 'active', joinDate: '2025-03-10' },
  { id: '4', name: 'James Wilson', email: 'james@cortexbuild.uk', role: 'user', lastLogin: '2026-04-01', status: 'inactive', joinDate: '2025-04-05' },
];

const MOCK_FEATURE_FLAGS: FeatureFlag[] = [
  { id: '1', name: 'new-rfi-workflow', description: 'Streamlined RFI submission process', enabled: true, rolloutPercentage: 100, createdAt: '2026-03-15' },
  { id: '2', name: 'dark-mode', description: 'Dark theme support', enabled: true, rolloutPercentage: 100, createdAt: '2026-02-01' },
  { id: '3', name: 'advanced-analytics', description: 'Enhanced project analytics dashboard', enabled: false, rolloutPercentage: 0, createdAt: '2026-04-10' },
  { id: '4', name: 'ai-document-parser', description: 'AI-powered document classification', enabled: true, rolloutPercentage: 25, createdAt: '2026-04-15' },
  { id: '5', name: 'mobile-app', description: 'Mobile application support', enabled: false, rolloutPercentage: 0, createdAt: '2026-04-01' },
];

const MOCK_LOGS: SystemLog[] = [
  { id: '1', timestamp: '2026-04-27T14:45:32Z', level: 'info', message: 'User login successful', source: 'auth', userId: 'user-123' },
  { id: '2', timestamp: '2026-04-27T14:40:15Z', level: 'info', message: 'RFI document uploaded', source: 'rfi', userId: 'user-456' },
  { id: '3', timestamp: '2026-04-27T14:35:00Z', level: 'warn', message: 'API response time exceeded 2s', source: 'api-gateway' },
  { id: '4', timestamp: '2026-04-27T14:30:22Z', level: 'error', message: 'Database connection timeout', source: 'database' },
  { id: '5', timestamp: '2026-04-27T14:25:10Z', level: 'info', message: 'Project created', source: 'projects', userId: 'user-789' },
  { id: '6', timestamp: '2026-04-27T14:20:00Z', level: 'warn', message: 'Disk space low (78% used)', source: 'system' },
];

const MOCK_INVOICES: Invoice[] = [
  { id: 'INV-001', date: '2026-04-01', amount: 2500, status: 'paid', description: 'April 2026 Professional Plan' },
  { id: 'INV-002', date: '2026-03-01', amount: 2500, status: 'paid', description: 'March 2026 Professional Plan' },
  { id: 'INV-003', date: '2026-02-01', amount: 2000, status: 'paid', description: 'February 2026 Standard Plan' },
  { id: 'INV-004', date: '2026-01-01', amount: 2000, status: 'paid', description: 'January 2026 Standard Plan' },
];

// ─── Tab Definitions ──────────────────────────────────────────────────────────

const TABS: { key: AdminTab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'system', label: 'System', icon: Settings2 },
  { key: 'logs', label: 'Logs', icon: FileText },
  { key: 'billing', label: 'Billing', icon: TrendingUp },
];

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTabContent() {
  const [events] = useState<SystemEvent[]>(MOCK_SYSTEM_EVENTS);

  const healthMetrics = [
    { label: 'System Health', value: '94%', icon: Activity, color: 'emerald', subtext: 'All systems operational' },
    { label: 'CPU Usage', value: '42%', icon: Cpu, color: 'blue', subtext: 'Within normal range' },
    { label: 'Memory Usage', value: '68%', icon: HardDrive, color: 'amber', subtext: '12.2 GB of 18 GB' },
    { label: 'Uptime', value: '45d', icon: Clock, color: 'emerald', subtext: 'Since last restart' },
    { label: 'Active Users', value: '324', icon: Users, color: 'blue', subtext: 'Last 24 hours' },
    { label: 'Requests/min', value: '1.2k', icon: Zap, color: 'amber', subtext: 'Peak: 3.4k' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {healthMetrics.map((metric, idx) => {
          const Icon = metric.icon;
          const colorClasses = {
            emerald: 'bg-emerald-500/10 text-emerald-400',
            blue: 'bg-blue-500/10 text-blue-400',
            amber: 'bg-amber-500/10 text-amber-400',
          };
          return (
            <div key={idx} className="rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-lg ${colorClasses[metric.color as keyof typeof colorClasses]}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-gray-400 text-sm mb-1">{metric.label}</p>
              <p className="text-2xl font-bold text-white">{metric.value}</p>
              <p className="text-xs text-gray-500 mt-2">{metric.subtext}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Events Table */}
      <div className="rounded-lg bg-gray-800 border border-gray-700">
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            Recent System Events
          </h3>
          <button className="text-xs px-3 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Time</th>
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Type</th>
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Message</th>
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const typeColors = {
                  info: 'bg-blue-500/10 text-blue-400',
                  warning: 'bg-amber-500/10 text-amber-400',
                  error: 'bg-red-500/10 text-red-400',
                };
                return (
                  <tr key={event.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="px-6 py-3 text-gray-300">
                      {new Date(event.timestamp).toLocaleTimeString('en-GB')}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[event.type]}`}>
                        {event.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-300">{event.message}</td>
                    <td className="px-6 py-3 text-gray-400">{event.source}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg bg-gray-800 border border-gray-700 p-6">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-sm font-medium flex items-center gap-2 transition-colors">
            <RefreshCw className="w-4 h-4" />
            Refresh Cache
          </button>
          <button className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-sm font-medium flex items-center gap-2 transition-colors">
            <Download className="w-4 h-4" />
            Run Backup
          </button>
          <button className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-sm font-medium flex items-center gap-2 transition-colors">
            <AlertTriangle className="w-4 h-4" />
            Check Health
          </button>
          <button className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 text-sm font-medium flex items-center gap-2 transition-colors">
            <Mail className="w-4 h-4" />
            Send Alert
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTabContent() {
  const [users, setUsers] = useState<SystemUser[]>(MOCK_USERS);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'user'>('user');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleInvite = () => {
    if (!inviteEmail) {
      toast.error('Please enter an email address');
      return;
    }
    toast.success(`Invitation sent to ${inviteEmail}`);
    setInviteEmail('');
    setShowInviteForm(false);
  };

  const handleRoleChange = (userId: string, newRole: SystemUser['role']) => {
    setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    toast.success('User role updated');
  };

  const handleRemoveUser = (userId: string) => {
    setUsers(users.filter(u => u.id !== userId));
    toast.success('User removed');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Invite Form */}
      {showInviteForm && (
        <div className="rounded-lg bg-gray-800 border border-gray-700 p-6">
          <h3 className="font-semibold text-white mb-4">Invite New User</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as SystemUser['role'])}
              className="px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleInvite}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 font-medium transition-colors"
              >
                Send Invite
              </button>
              <button
                onClick={() => setShowInviteForm(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-lg bg-gray-800 border border-gray-700">
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            User Management
          </h3>
          {!showInviteForm && (
            <button
              onClick={() => setShowInviteForm(true)}
              className="text-xs px-3 py-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Invite User
            </button>
          )}
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Name</th>
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Email</th>
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Role</th>
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Last Login</th>
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Status</th>
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const statusColors = {
                  active: 'bg-emerald-500/10 text-emerald-400',
                  inactive: 'bg-gray-500/10 text-gray-400',
                  suspended: 'bg-red-500/10 text-red-400',
                };
                return (
                  <tr key={user.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="px-6 py-3 text-white font-medium">{user.name}</td>
                    <td className="px-6 py-3 text-gray-300">{user.email}</td>
                    <td className="px-6 py-3">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as SystemUser['role'])}
                        className="px-2 py-1 rounded bg-gray-700 border border-gray-600 text-white text-xs focus:outline-none focus:border-blue-500"
                      >
                        <option value="user">User</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-3 text-gray-400">{new Date(user.lastLogin).toLocaleDateString('en-GB')}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[user.status]}`}>
                        {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => handleRemoveUser(user.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── System Tab ────────────────────────────────────────────────────────────────

function SystemTabContent() {
  const [flags, setFlags] = useState<FeatureFlag[]>(MOCK_FEATURE_FLAGS);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [apiRateLimit, setApiRateLimit] = useState(10000);

  const handleToggleFlag = (flagId: string) => {
    setFlags(flags.map(f => f.id === flagId ? { ...f, enabled: !f.enabled } : f));
    toast.success('Feature flag updated');
  };

  const handleRolloutChange = (flagId: string, percentage: number) => {
    setFlags(flags.map(f => f.id === flagId ? { ...f, rolloutPercentage: percentage } : f));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Maintenance Mode & API Limits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg bg-gray-800 border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Maintenance Mode
            </h3>
            <button
              onClick={() => setMaintenanceMode(!maintenanceMode)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                maintenanceMode
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {maintenanceMode ? 'ENABLED' : 'Disabled'}
            </button>
          </div>
          <p className="text-gray-400 text-sm">
            {maintenanceMode ? 'System is in maintenance mode. Only admins can access.' : 'System is running normally.'}
          </p>
        </div>

        <div className="rounded-lg bg-gray-800 border border-gray-700 p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-400" />
            API Rate Limit
          </h3>
          <div className="space-y-2">
            <p className="text-gray-400 text-sm">Requests per hour</p>
            <input
              type="number"
              value={apiRateLimit}
              onChange={(e) => setApiRateLimit(parseInt(e.target.value))}
              className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => toast.success('API rate limit updated')}
              className="w-full px-3 py-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-sm font-medium transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="rounded-lg bg-gray-800 border border-gray-700">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-blue-400" />
            Feature Flags
          </h3>
        </div>
        <div className="divide-y divide-gray-700">
          {flags.map((flag) => (
            <div key={flag.id} className="px-6 py-4 hover:bg-gray-700/20">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-white font-medium">{flag.name}</h4>
                  <p className="text-gray-400 text-sm mt-1">{flag.description}</p>
                  <div className="mt-3 flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={flag.enabled}
                        onChange={() => handleToggleFlag(flag.id)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 cursor-pointer"
                      />
                      {flag.enabled ? 'Enabled' : 'Disabled'}
                    </label>
                    {flag.enabled && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-400">Rollout:</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="10"
                          value={flag.rolloutPercentage}
                          onChange={(e) => handleRolloutChange(flag.id, parseInt(e.target.value))}
                          className="w-24"
                        />
                        <span className="text-xs text-gray-400 w-8">{flag.rolloutPercentage}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────

function LogsTabContent() {
  const [logs] = useState<SystemLog[]>(MOCK_LOGS);
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = logs.filter(log => {
    const levelMatch = levelFilter === 'all' || log.level === levelFilter;
    const searchMatch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       log.source.toLowerCase().includes(searchQuery.toLowerCase());
    return levelMatch && searchMatch;
  });

  const handleDownloadLogs = () => {
    const csv = [
      'Timestamp,Level,Message,Source,User ID',
      ...filteredLogs.map(log => `"${log.timestamp}","${log.level}","${log.message}","${log.source}","${log.userId || '-'}"`)
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Logs downloaded');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Filters */}
      <div className="rounded-lg bg-gray-800 border border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-2">Search Logs</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search message or source..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Log Level</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as typeof levelFilter)}
              className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleDownloadLogs}
              className="w-full px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-lg bg-gray-800 border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Timestamp</th>
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Level</th>
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Message</th>
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Source</th>
                <th className="px-6 py-3 text-left text-gray-400 font-medium">User</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const levelColors = {
                  info: 'bg-blue-500/10 text-blue-400',
                  warn: 'bg-amber-500/10 text-amber-400',
                  error: 'bg-red-500/10 text-red-400',
                };
                return (
                  <tr key={log.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="px-6 py-3 text-gray-300">
                      {new Date(log.timestamp).toLocaleTimeString('en-GB')}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${levelColors[log.level]}`}>
                        {log.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-300 max-w-md truncate">{log.message}</td>
                    <td className="px-6 py-3 text-gray-400">{log.source}</td>
                    <td className="px-6 py-3 text-gray-400">{log.userId || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Billing Tab ──────────────────────────────────────────────────────────────

function BillingTabContent() {
  const [invoices] = useState<Invoice[]>(MOCK_INVOICES);

  const currentPlan = {
    name: 'Professional Plan',
    price: '£2,500',
    period: 'per month',
    features: ['Unlimited projects', 'Advanced analytics', 'Priority support', 'Custom integrations'],
  };

  const usageMetrics = [
    { label: 'API Calls', current: 8450, limit: 100000, percentage: 8 },
    { label: 'Storage Used', current: 320, limit: 1000, percentage: 32, unit: 'GB' },
    { label: 'Users', current: 24, limit: 50, percentage: 48 },
    { label: 'Projects', current: 18, limit: 100, percentage: 18 },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Current Plan */}
      <div className="rounded-lg bg-gradient-to-br from-blue-900/40 to-blue-800/20 border border-blue-700/50 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">{currentPlan.name}</h3>
            <p className="text-gray-400 text-sm mb-4">Next billing: May 1, 2026</p>
            <p className="text-2xl font-bold text-blue-400 mb-4">
              {currentPlan.price}
              <span className="text-sm text-gray-400 ml-1">{currentPlan.period}</span>
            </p>
            <button className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 font-medium transition-colors">
              Upgrade Plan
            </button>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3">Plan Features</h4>
            <ul className="space-y-2">
              {currentPlan.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2 text-gray-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Usage Metrics */}
      <div className="rounded-lg bg-gray-800 border border-gray-700 p-6">
        <h3 className="font-semibold text-white mb-4">Usage Metrics</h3>
        <div className="space-y-4">
          {usageMetrics.map((metric, idx) => (
            <div key={idx}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300 text-sm">{metric.label}</span>
                <span className="text-white text-sm font-medium">
                  {metric.current.toLocaleString('en-GB')} {metric.unit || ''}
                  <span className="text-gray-400"> / {metric.limit.toLocaleString('en-GB')}</span>
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    metric.percentage > 80
                      ? 'bg-red-500'
                      : metric.percentage > 60
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${metric.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invoice History */}
      <div className="rounded-lg bg-gray-800 border border-gray-700">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            Invoice History
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Invoice ID</th>
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Date</th>
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Description</th>
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Amount</th>
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Status</th>
                <th className="px-6 py-3 text-left text-gray-400 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const statusColors = {
                  paid: 'bg-emerald-500/10 text-emerald-400',
                  pending: 'bg-amber-500/10 text-amber-400',
                  overdue: 'bg-red-500/10 text-red-400',
                };
                return (
                  <tr key={invoice.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="px-6 py-3 text-white font-medium">{invoice.id}</td>
                    <td className="px-6 py-3 text-gray-300">
                      {new Date(invoice.date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-3 text-gray-300">{invoice.description}</td>
                    <td className="px-6 py-3 text-white font-medium">£{invoice.amount.toLocaleString('en-GB')}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[invoice.status]}`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <button className="text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium">
                        Download
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Dashboard Component ───────────────────────────────────────────

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    toast.success('Dashboard refreshed');
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTabContent />;
      case 'users': return <UsersTabContent />;
      case 'system': return <SystemTabContent />;
      case 'logs': return <LogsTabContent />;
      case 'billing': return <BillingTabContent />;
      default: return null;
    }
  };

  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      <div className="mb-6">
        <ModuleBreadcrumbs currentModule="dashboard" extraItems={[{ label: 'Admin Dashboard' }]} />
        <div className="flex items-center justify-between mt-4">
          <div>
            <h1 className="text-2xl font-display text-white">Admin Dashboard</h1>
            <p className="text-gray-400 mt-1">System administration and oversight</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 cb-table-scroll touch-pan-x pb-2">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all',
                activeTab === tab.key
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="animate-fadeIn">{renderTab()}</div>
    </div>
  );
}

export default AdminDashboard;
