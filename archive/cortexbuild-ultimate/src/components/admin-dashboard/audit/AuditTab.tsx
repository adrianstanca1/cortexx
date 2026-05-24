import { useState, useEffect } from 'react';
import { Search, Download } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';
import { apiFetch } from '../../../services/api';
import { fmtDateTime, type AuditEntry } from '../types';

interface AuditTabProps {
  entries?: AuditEntry[];
  loading?: boolean;
}

export default function AuditTab({ entries: propEntries = [], loading: propLoading = false }: AuditTabProps) {
  const [fetchedEntries, setFetchedEntries] = useState<AuditEntry[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const [filterTable, setFilterTable] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (propEntries.length > 0) { setFetchLoading(false); return; }
    apiFetch<AuditEntry[]>('/audit?limit=100')
      .then(data => setFetchedEntries(Array.isArray(data) ? data : []))
      .catch(e => console.warn('[AuditTab] failed to load:', e))
      .finally(() => setFetchLoading(false));
  }, [propEntries.length]);

  const entries = propEntries.length > 0 ? propEntries : fetchedEntries;
  const loading = propLoading || fetchLoading;

  const filteredEntries = entries.filter(entry => {
    if (filterAction !== 'all' && entry.action !== filterAction) return false;
    if (filterTable !== 'all' && entry.table_name !== filterTable) return false;
    if (searchQuery && !entry.table_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getActionColor = (action: string): string => {
    switch (action) {
      case 'create': return 'bg-emerald-500/20 text-emerald-400';
      case 'update': return 'bg-blue-500/20 text-blue-400';
      case 'delete': return 'bg-red-500/20 text-red-400';
      case 'view': return 'bg-cyan-500/20 text-cyan-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(10)].map((_, i) => <div key={i} className="h-16 bg-gray-800/50 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search audit logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="view">View</option>
        </select>
        <select
          value={filterTable}
          onChange={(e) => setFilterTable(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Tables</option>
          <option value="projects">Projects</option>
          <option value="users">Users</option>
          <option value="invoices">Invoices</option>
          <option value="safety_incidents">Safety</option>
        </select>
        <button className="btn btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="border border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-900 sticky top-0 z-10">
            <tr className="border-b border-gray-700">
              <th className="text-left p-3 text-xs font-medium text-gray-400 uppercase">Action</th>
              <th className="text-left p-3 text-xs font-medium text-gray-400 uppercase">User</th>
              <th className="text-left p-3 text-xs font-medium text-gray-400 uppercase">Table</th>
              <th className="text-left p-3 text-xs font-medium text-gray-400 uppercase">Record ID</th>
              <th className="text-left p-3 text-xs font-medium text-gray-400 uppercase">Timestamp</th>
              <th className="text-left p-3 text-xs font-medium text-gray-400 uppercase">IP Address</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center">
                  <EmptyState title="No audit entries found" description="Try adjusting your filters" />
                </td>
              </tr>
            ) : (
              filteredEntries.map(entry => (
                <tr key={entry.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="p-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getActionColor(entry.action)}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
                        {entry.user?.name?.charAt(0) || 'U'}
                      </div>
                      <span className="text-sm text-white">{entry.user?.name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-gray-300">{entry.table_name}</td>
                  <td className="p-3 text-sm text-gray-400 font-mono">{entry.record_id || '\u2014'}</td>
                  <td className="p-3 text-sm text-gray-400">{fmtDateTime(entry.created_at)}</td>
                  <td className="p-3 text-sm text-gray-500 font-mono">{entry.ip_address || '\u2014'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
