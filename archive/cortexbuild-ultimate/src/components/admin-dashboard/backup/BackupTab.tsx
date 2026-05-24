import { useState } from 'react';
import { Database, Download, Upload, Cloud, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { backupApi } from '../../../services/api';
import { CardSkeleton } from '../../ui/Skeleton';

interface BackupTabProps {
  loading: boolean;
}

export default function BackupTab({ loading }: BackupTabProps) {
  const [exporting, setExporting] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('json');

  const handleExport = async (table?: string) => {
    setExporting(true);
    try {
      if (table) {
        const data = await backupApi.exportTable(table, exportFormat);
        const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], {
          type: exportFormat === 'json' ? 'application/json' : 'text/csv',
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${table}_${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
        link.click();
        URL.revokeObjectURL(link.href);
        toast.success(`Exported ${table}`);
      } else {
        const data = await backupApi.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `full_backup_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
        toast.success('Full backup exported');
      }
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleBackup = async () => {
    setBackupRunning(true);
    try {
      const data = await backupApi.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `cortexbuild_backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success('Backup downloaded successfully');
    } catch {
      toast.error('Backup failed');
    } finally {
      setBackupRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <Database className="w-6 h-6 text-blue-400" />
            <h3 className="font-bold text-white">Database Backup</h3>
          </div>
          <p className="text-sm text-gray-400 mb-4">Create a full backup of all database tables</p>
          <button onClick={handleBackup} disabled={backupRunning} className="btn btn-primary w-full">
            {backupRunning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Cloud className="w-4 h-4 mr-2" />}
            {backupRunning ? 'Creating Backup...' : 'Create Backup'}
          </button>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <Download className="w-6 h-6 text-green-400" />
            <h3 className="font-bold text-white">Export All Data</h3>
          </div>
          <p className="text-sm text-gray-400 mb-4">Download complete system data as JSON</p>
          <button onClick={() => handleExport()} disabled={exporting} className="btn btn-primary w-full">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            {exporting ? 'Exporting...' : 'Export All'}
          </button>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <Upload className="w-6 h-6 text-purple-400" />
            <h3 className="font-bold text-white">Import Data</h3>
          </div>
          <p className="text-sm text-gray-400 mb-4">Restore data from backup file</p>
          <button className="btn btn-secondary w-full">
            <Upload className="w-4 h-4 mr-2" />
            Import
          </button>
        </div>
      </div>

      {/* Table Exports */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Export Tables</h3>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            'users', 'projects', 'invoices', 'safety_incidents', 'rfis', 'team_members',
            'companies', 'documents', 'change_orders', 'timesheets', 'meetings', 'audit_log',
          ].map(table => (
            <button
              key={table}
              onClick={() => handleExport(table)}
              disabled={exporting}
              className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors group"
            >
              <span className="text-sm text-gray-300 capitalize">{table.replace(/_/g, ' ')}</span>
              <Download className="w-4 h-4 text-gray-600 group-hover:text-blue-400 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Scheduled Backups */}
      <div className="card p-5">
        <h3 className="text-lg font-bold text-white mb-4">Scheduled Backups</h3>
        <div className="space-y-3">
          {[
            { name: 'Daily Backup', schedule: '0 2 * * *', lastRun: '2 hours ago', nextRun: 'in 22 hours', enabled: true },
            { name: 'Weekly Full Backup', schedule: '0 3 * * 0', lastRun: '3 days ago', nextRun: 'in 4 days', enabled: true },
            { name: 'Monthly Archive', schedule: '0 4 1 * *', lastRun: '1 month ago', nextRun: 'in 29 days', enabled: false },
          ].map((backup, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${backup.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                <div>
                  <p className="font-medium text-white">{backup.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{backup.schedule}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Last run</p>
                  <p className="text-sm text-white">{backup.lastRun}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Next run</p>
                  <p className="text-sm text-white">{backup.nextRun}</p>
                </div>
                <button className={clsx(
                  'relative w-12 h-6 rounded-full transition-colors',
                  backup.enabled ? 'bg-blue-500' : 'bg-gray-700'
                )}>
                  <div className={clsx(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                    backup.enabled ? 'left-7' : 'left-1'
                  )} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
