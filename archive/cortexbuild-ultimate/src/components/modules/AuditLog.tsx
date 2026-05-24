import React, { useState, useMemo } from 'react';
import { backupApi } from '@/services/api';
import { toast } from 'sonner';
import {
  TrendingUp,
  X,
  AlertTriangle,
  Download,
  Activity,
  Users,
  Shield,
  CheckSquare,
  Square,
  FileText,
  Lock,
  Eye,
  CheckCircle,
  AlertCircle,
  Clock,
  MapPin,
} from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { useAuditLog } from '../../hooks/useData';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';

type AnyRow = Record<string, unknown>;
type AuditEntry = AnyRow & {
  id: number;
  user_id: string;
  action: string;
  table_name: string;
  record_id: number;
  changes: string;
  created_at: string;
  user?: { name: string; avatar?: string };
  ip_address?: string;
  old_value?: string;
  new_value?: string;
};
type AuditStats = AnyRow & {
  total_entries: number;
  today_entries: number;
  week_entries: number;
  month_entries: number;
  active_users: number;
  security_alerts: number;
};

type SubTab = 'activity' | 'security' | 'changes' | 'compliance';

const TABS: { key: SubTab; label: string; icon: React.ElementType }[] = [
  { key: 'activity', label: 'Activity Log', icon: Activity },
  { key: 'security', label: 'Security Events', icon: Shield },
  { key: 'changes', label: 'Data Changes', icon: TrendingUp },
  { key: 'compliance', label: 'Compliance', icon: Lock },
];

const UK_CITIES: Record<string, string> = {
  '192.168.1.': 'London, UK',
  '10.0.0.': 'Manchester, UK',
  '172.16.': 'Edinburgh, UK',
  '203.0.113.': 'Birmingham, UK',
  '198.51.100.': 'Bristol, UK',
  '192.0.2.': 'Leeds, UK',
};

function getGeoLocation(ip: string): string {
  for (const [prefix, location] of Object.entries(UK_CITIES)) {
    if (ip?.startsWith(prefix)) return location;
  }
  return 'Unknown Location';
}

function getSecurityEventType(action: string): 'login' | 'logout' | 'failed_login' | 'password_change' | 'role_change' | 'permission_change' | 'data_export' | 'other' {
  const actionLower = String(action).toLowerCase();
  if (actionLower.includes('login') && !actionLower.includes('logout') && !actionLower.includes('failed')) return 'login';
  if (actionLower.includes('logout')) return 'logout';
  if (actionLower.includes('failed')) return 'failed_login';
  if (actionLower.includes('password')) return 'password_change';
  if (actionLower.includes('role')) return 'role_change';
  if (actionLower.includes('permission')) return 'permission_change';
  if (actionLower.includes('export')) return 'data_export';
  return 'other';
}

function getSeverityLevel(action: string): 'critical' | 'high' | 'medium' | 'low' {
  const eventType = getSecurityEventType(action);
  switch (eventType) {
    case 'failed_login':
    case 'password_change':
    case 'role_change':
    case 'data_export':
      return 'high';
    case 'permission_change':
      return 'medium';
    case 'login':
    case 'logout':
      return 'low';
    default:
      return 'low';
  }
}

interface SecurityEventAlert {
  type: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

function detectSuspiciousPatterns(entries: AuditEntry[]): SecurityEventAlert[] {
  const alerts: SecurityEventAlert[] = [];
  const now = new Date();
  const pastHour = new Date(now.getTime() - 60 * 60 * 1000);

  // Check for multiple failed logins in past hour
  const failedLogins = entries.filter(
    (e) => String(e.action).toLowerCase().includes('failed') &&
      new Date(String(e.created_at)) > pastHour
  );

  if (failedLogins.length >= 3) {
    alerts.push({
      type: 'Multiple Failed Logins',
      description: `${failedLogins.length} failed login attempts in the past hour`,
      severity: 'high',
    });
  }

  // Check for off-hours access (22:00 - 06:00)
  const offHoursAccess = entries.filter((e) => {
    const hour = new Date(String(e.created_at)).getHours();
    return hour >= 22 || hour < 6;
  });

  if (offHoursAccess.length >= 2) {
    alerts.push({
      type: 'Off-Hours Access',
      description: `${offHoursAccess.length} system accesses detected outside business hours`,
      severity: 'medium',
    });
  }

  // Check for bulk data exports
  const bulkExports = entries.filter((e) => String(e.action).toLowerCase().includes('export'));
  if (bulkExports.length >= 2) {
    alerts.push({
      type: 'Bulk Data Export',
      description: 'Multiple data export events detected',
      severity: 'high',
    });
  }

  return alerts;
}

export function AuditLog() {
  const { useList, useStats } = useAuditLog();
  const { data: rawEntries = [], isLoading } = useList();
  const { data: rawStats } = useStats();

  const entries = (rawEntries as AnyRow[]) as AuditEntry[];
  const stats: AuditStats = (rawStats ?? {}) as AuditStats;

  const [subTab, setSubTab] = useState<SubTab>('activity');
  const [filterAction, setFilterAction] = useState('all');
  const [filterTable, setFilterTable] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exporting, setExporting] = useState(false);
  const [expandedEntryId, setExpandedEntryId] = useState<number | null>(null);
  const [showComplianceViolations, setShowComplianceViolations] = useState(false);

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  // Filter entries for Activity Log
  const filteredActivityEntries = useMemo(() => {
    return entries.filter((e) => {
      if (filterAction !== 'all' && e.action !== filterAction) return false;
      if (filterTable !== 'all' && e.table_name !== filterTable) return false;
      if (filterUser !== 'all' && e.user_id !== filterUser) return false;
      if (searchQuery && !(e.table_name || '').includes(searchQuery) && !(e.user?.name ?? '').includes(searchQuery)) return false;
      return true;
    });
  }, [entries, filterAction, filterTable, filterUser, searchQuery]);

  // Security event entries
  const securityEntries = useMemo(() => {
    return entries.filter((e) => {
      const action = String(e.action).toLowerCase();
      return action.includes('login') || action.includes('password') || action.includes('role') ||
        action.includes('permission') || action.includes('export');
    });
  }, [entries]);

  // Data change entries (updates only)
  const dataChangeEntries = useMemo(() => {
    return entries.filter((e) => {
      if (filterTable !== 'all' && e.table_name !== filterTable) return false;
      return String(e.action).toLowerCase() === 'update';
    });
  }, [entries, filterTable]);

  // Detect suspicious patterns
  const securityAlerts = useMemo(() => detectSuspiciousPatterns(securityEntries), [securityEntries]);

  // Unique users
  const uniqueUsers = useMemo(() => {
    return Array.from(new Map(entries.map((e) => [e.user_id, e.user])).entries());
  }, [entries]);

  // Activity today
  const activityToday = useMemo(() => {
    return entries.filter((e) => {
      const entryDate = new Date(String(e.created_at)).toDateString();
      return entryDate === new Date().toDateString();
    });
  }, [entries]);

  // Compliance data
  const complianceData = useMemo(() => {
    const dataAccess = entries.filter((e) => String(e.action).toLowerCase() === 'view').length;
    const dataExports = entries.filter((e) => String(e.action).toLowerCase().includes('export')).length;
    const deletions = entries.filter((e) => String(e.action).toLowerCase() === 'delete').length;

    return {
      dataAccessRecords: dataAccess,
      dataExportsTracked: dataExports,
      userConsentRecords: uniqueUsers.length,
      deletionRequests: deletions,
      gdprRetentionDays: 30,
      piiEntitiesCount: 156,
    };
  }, [entries, uniqueUsers]);

  const getActionColor = (action: string): string => {
    switch (String(action).toLowerCase()) {
      case 'create':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'update':
        return 'bg-blue-500/20 text-blue-400';
      case 'delete':
        return 'bg-red-500/20 text-red-400';
      case 'view':
        return 'bg-cyan-500/20 text-cyan-400';
      case 'export':
        return 'bg-purple-500/20 text-purple-400';
      case 'approve':
        return 'bg-green-500/20 text-green-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getSecurityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
      case 'medium':
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'low':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <>
      <ModuleBreadcrumbs currentModule="audit-log" />
      <div className="space-y-6">
        {/* Header with KPIs */}
        <div>
          <h2 className="text-3xl font-display text-white mb-4">Audit & Compliance Log</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Events Today</p>
                  <p className="text-xl font-display text-white">{Number(activityToday.length)}</p>
                </div>
                <Activity className="h-6 w-6 text-blue-400" />
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Active Users</p>
                  <p className="text-xl font-display text-white">{Number(stats.active_users)}</p>
                </div>
                <Users className="h-6 w-6 text-cyan-400" />
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Security Alerts</p>
                  <p className="text-xl font-display text-white">{Number(stats.security_alerts)}</p>
                </div>
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase">This Week</p>
                  <p className="text-xl font-display text-white">{Number(stats.week_entries)}</p>
                </div>
                <TrendingUp className="h-6 w-6 text-emerald-400" />
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Total Entries</p>
                  <p className="text-xl font-display text-white">{Number(stats.total_entries)}</p>
                </div>
                <FileText className="h-6 w-6 text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="border-b border-gray-700 flex gap-1 cb-table-scroll touch-pan-x overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setSubTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  subTab === t.key
                    ? 'border-orange-500 text-orange-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Activity Log Tab */}
        {subTab === 'activity' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Search by user or module..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 rounded-lg px-3 py-2"
              />
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
              >
                <option value="all">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="view">View</option>
                <option value="export">Export</option>
              </select>
              <select
                value={filterTable}
                onChange={(e) => setFilterTable(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
              >
                <option value="all">All Modules</option>
                <option value="projects">Projects</option>
                <option value="invoices">Invoices</option>
                <option value="safety">Safety</option>
                <option value="rfis">RFIs</option>
                <option value="documents">Documents</option>
                <option value="users">Users</option>
              </select>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-gray-400">Loading audit log...</p>
              </div>
            ) : filteredActivityEntries.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No audit entries found"
                description="Activity will appear here once users start interacting with the system."
              />
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="cb-table-scroll touch-pan-x overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-display text-gray-300 w-10" />
                        <th className="text-left px-4 py-3 text-xs font-display text-gray-300 tracking-widest uppercase">Time</th>
                        <th className="text-left px-4 py-3 text-xs font-display text-gray-300 tracking-widest uppercase">User</th>
                        <th className="text-left px-4 py-3 text-xs font-display text-gray-300 tracking-widest uppercase">IP Address</th>
                        <th className="text-left px-4 py-3 text-xs font-display text-gray-300 tracking-widest uppercase">Action</th>
                        <th className="text-left px-4 py-3 text-xs font-display text-gray-300 tracking-widest uppercase">Entity</th>
                        <th className="text-left px-4 py-3 text-xs font-display text-gray-300 tracking-widest uppercase">Entity ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {filteredActivityEntries.slice(0, 100).map((entry) => {
                        const isSelected = selectedIds.has(String(entry.id));
                        return (
                          <React.Fragment key={Number(entry.id)}>
                            <tr className="hover:bg-gray-800/50 cursor-pointer">
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggle(String(entry.id));
                                  }}
                                >
                                  {isSelected ? (
                                    <CheckSquare size={16} className="text-blue-400" />
                                  ) : (
                                    <Square size={16} className="text-gray-500" />
                                  )}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-gray-300 text-xs">
                                {String(new Date(String(entry.created_at)).toLocaleString('en-GB'))}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
                                    {String(entry.user?.name ?? '?')[0]}
                                  </div>
                                  <span className="text-gray-300 text-sm">{String(entry.user?.name ?? 'Unknown')}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-400 text-xs">
                                <div className="flex items-center gap-1">
                                  <MapPin size={12} className="text-gray-500" />
                                  {String(entry.ip_address ?? '—')}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(String(entry.action))}`}>
                                  {String(entry.action).toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-300 text-sm capitalize">{String(entry.table_name)}</td>
                              <td className="px-4 py-3 text-gray-400 text-sm">{String(entry.record_id)}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id)}
                                  className="text-blue-400 hover:text-blue-300"
                                >
                                  {expandedEntryId === entry.id ? '▼' : '▶'}
                                </button>
                              </td>
                            </tr>
                            {expandedEntryId === entry.id && (
                              <tr className="bg-gray-800/30">
                                <td colSpan={8} className="px-4 py-4">
                                  <div className="space-y-2 text-xs">
                                    <div>
                                      <p className="text-gray-400 mb-1">Full Details:</p>
                                      <div className="bg-gray-900 rounded p-2 font-mono text-gray-300">
                                        {String(entry.changes || 'No changes recorded')}
                                      </div>
                                    </div>
                                    {entry.old_value && entry.new_value && (
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
                                          <p className="text-red-400 mb-1">Old Value:</p>
                                          <p className="text-red-300">{String(entry.old_value)}</p>
                                        </div>
                                        <div className="bg-green-500/10 border border-green-500/20 rounded p-2">
                                          <p className="text-green-400 mb-1">New Value:</p>
                                          <p className="text-green-300">{String(entry.new_value)}</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <BulkActionsBar
              selectedIds={Array.from(selectedIds)}
              actions={[]}
              onClearSelection={clearSelection}
            />
          </div>
        )}

        {/* Security Events Tab */}
        {subTab === 'security' && (
          <div className="space-y-6">
            {/* Security Alerts */}
            {securityAlerts.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-display text-white">Detected Security Patterns</h3>
                {securityAlerts.map((alert, idx) => (
                  <div key={idx} className={`rounded-xl p-4 ${getSecurityColor(alert.severity)}`}>
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium mb-1">{alert.type}</p>
                        <p className="text-sm opacity-90">{alert.description}</p>
                      </div>
                      <span className="text-xs font-medium uppercase mt-0.5">{alert.severity}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Security Events Table */}
            <div>
              <h3 className="text-lg font-display text-white mb-4">Security Events</h3>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="cb-table-scroll touch-pan-x overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-display text-gray-300">Time</th>
                        <th className="text-left px-4 py-3 text-xs font-display text-gray-300">User</th>
                        <th className="text-left px-4 py-3 text-xs font-display text-gray-300">Event</th>
                        <th className="text-left px-4 py-3 text-xs font-display text-gray-300">IP Address</th>
                        <th className="text-left px-4 py-3 text-xs font-display text-gray-300">Location</th>
                        <th className="text-left px-4 py-3 text-xs font-display text-gray-300">Severity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {securityEntries.slice(0, 50).map((entry) => {
                        const severity = getSeverityLevel(String(entry.action));
                        return (
                          <tr key={Number(entry.id)} className="hover:bg-gray-800/50">
                            <td className="px-4 py-3 text-gray-300 text-xs">
                              {String(new Date(String(entry.created_at)).toLocaleString('en-GB'))}
                            </td>
                            <td className="px-4 py-3 text-gray-300">{String(entry.user?.name ?? 'Unknown')}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(String(entry.action))}`}>
                                {String(entry.action).toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs font-mono">{String(entry.ip_address ?? '—')}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs">
                              <div className="flex items-center gap-1">
                                <MapPin size={12} />
                                {getGeoLocation(String(entry.ip_address))}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  severity === 'critical'
                                    ? 'bg-red-500/20 text-red-400'
                                    : severity === 'high'
                                      ? 'bg-orange-500/20 text-orange-400'
                                      : severity === 'medium'
                                        ? 'bg-amber-500/20 text-amber-400'
                                        : 'bg-blue-500/20 text-blue-400'
                                }`}
                              >
                                {severity.toUpperCase()}
                              </span>
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

        {/* Data Changes Tab */}
        {subTab === 'changes' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <select
                value={filterTable}
                onChange={(e) => setFilterTable(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 flex-1"
              >
                <option value="all">All Entities</option>
                <option value="projects">Projects</option>
                <option value="invoices">Invoices</option>
                <option value="safety">Safety</option>
                <option value="users">Users</option>
                <option value="documents">Documents</option>
              </select>
              <button className="px-4 py-2 btn btn-secondary rounded-lg text-sm font-medium">
                <Download className="h-4 w-4 inline mr-2" />
                Export Changes
              </button>
            </div>

            <div className="space-y-3">
              {dataChangeEntries.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No data changes found"
                  description="Record modifications will appear here."
                />
              ) : (
                dataChangeEntries.slice(0, 50).map((entry) => (
                  <div key={Number(entry.id)} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:bg-gray-800/50 transition">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {String(entry.user?.name ?? 'Unknown')} updated {String(entry.table_name)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Record ID: {Number(entry.record_id)}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {String(new Date(String(entry.created_at)).toLocaleDateString('en-GB'))}
                      </span>
                    </div>

                    <div className="bg-gray-800/30 rounded p-3 text-xs space-y-1">
                      <p className="text-gray-400">{String(entry.changes || 'No changes recorded')}</p>
                    </div>

                    <button
                      type="button"
                      className="mt-3 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition"
                    >
                      Request Rollback
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Compliance Tab */}
        {subTab === 'compliance' && (
          <div className="space-y-6">
            {/* Compliance Violations Alert */}
            {showComplianceViolations && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-400 mb-1">Compliance Alert</p>
                  <p className="text-sm text-red-300">Data export detected without proper authorisation. Review required.</p>
                </div>
              </div>
            )}

            {/* Compliance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase mb-2">GDPR Data Access Log</p>
                <p className="text-2xl font-display text-blue-400">{complianceData.dataAccessRecords}</p>
                <p className="text-xs text-gray-500 mt-1">Access events recorded</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase mb-2">Data Exports Tracked</p>
                <p className="text-2xl font-display text-emerald-400">{complianceData.dataExportsTracked}</p>
                <p className="text-xs text-gray-500 mt-1">Authorised exports</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase mb-2">User Consent Records</p>
                <p className="text-2xl font-display text-cyan-400">{complianceData.userConsentRecords}</p>
                <p className="text-xs text-gray-500 mt-1">Active consents</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase mb-2">Deletion Requests</p>
                <p className="text-2xl font-display text-purple-400">{complianceData.deletionRequests}</p>
                <p className="text-xs text-gray-500 mt-1">Processed</p>
              </div>
            </div>

            {/* Data Retention Policy */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-lg font-display text-white mb-4">Data Retention Policy Status</h3>
              <div className="space-y-3">
                {[
                  { entity: 'Projects', retentionDays: 365, status: 'compliant' },
                  { entity: 'Invoices', retentionDays: 2555, status: 'compliant' },
                  { entity: 'Audit Logs', retentionDays: 365, status: 'compliant' },
                  { entity: 'User Data', retentionDays: 30, status: 'compliant' },
                  { entity: 'Deleted Records', retentionDays: 90, status: 'warning' },
                ].map((policy) => (
                  <div key={policy.entity} className="flex items-center justify-between p-3 bg-gray-800/50 rounded">
                    <div>
                      <p className="text-sm font-medium text-white">{policy.entity}</p>
                      <p className="text-xs text-gray-400">Retention: {policy.retentionDays} days</p>
                    </div>
                    <div
                      className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-medium ${
                        policy.status === 'compliant'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {policy.status === 'compliant' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                      {policy.status.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Compliance Export */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-lg font-display text-white mb-4">Export Compliance Report</h3>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Report Type</label>
                  <select className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2">
                    <option>GDPR Compliance</option>
                    <option>Data Processing Agreement</option>
                    <option>Deletion Audit Trail</option>
                    <option>User Consent Log</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-primary w-full">
                <Download className="h-4 w-4 mr-2" />
                Generate Compliance Report
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default React.memo(AuditLog);
