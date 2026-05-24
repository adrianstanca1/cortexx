/**
 * NotificationHistory Component
 * Displays archived notification history with search, filter, and export capabilities
 */

import React, { useState } from 'react';
import {
  History,
  Search,
  Download,
  Calendar,
  X,
  FileJson,
  FileSpreadsheet,
  FileText,
  Clock,
  Archive,
  CheckCircle,
  Bell,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { Notification, ExportOptions, NotificationFilter } from '@/types/notification';

interface NotificationHistoryProps {
  notifications: Notification[];
  isLoading: boolean;
  onLoadHistory: (page?: number) => Promise<void>;
  onExport: (options: ExportOptions) => Promise<Blob>;
  onFilterChange: (filter: NotificationFilter) => void;
  onClearFilter: () => void;
  filter?: NotificationFilter;
  totalPages?: number;
  currentPage?: number;
}

export function NotificationHistory({
  notifications,
  isLoading,
  onLoadHistory,
  onExport,
  onFilterChange,
  onClearFilter,
  filter,
  totalPages = 1,
  currentPage = 1,
}: NotificationHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'pdf'>('json');
  const [includeRead, setIncludeRead] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(true);

  const handleSearch = () => {
    onFilterChange({
      ...filter,
      searchQuery: searchQuery || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  };

  const handleExport = async () => {
    try {
      const blob = await onExport({
        format: exportFormat,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        includeRead,
        includeArchived,
      });

      // Download file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notifications-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setShowExportOptions(false);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const formatNotificationDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: Notification['status']) => {
    switch (status) {
      case 'read':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'unread':
        return <Bell className="w-4 h-4 text-blue-500" />;
      case 'archived':
        return <Archive className="w-4 h-4 text-amber-500" />;
      case 'snoozed':
        return <Clock className="w-4 h-4 text-purple-500" />;
    }
  };

  const getSeverityBadge = (severity: Notification['severity']) => {
    const colors = {
      critical: 'badge-error',
      error: 'badge-error',
      warning: 'badge-warning',
      info: 'badge-info',
      success: 'badge-success',
    };
    return colors[severity] || 'badge-ghost';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-base-300">
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-base-content" />
          <div>
            <h2 className="text-lg font-display">Notification History</h2>
            <p className="text-xs text-base-content/60">
              {notifications.length} notifications found
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowExportOptions(!showExportOptions)}
          className="btn btn-sm btn-primary gap-2"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Export Options */}
      {showExportOptions && (
        <div className="p-4 border-b border-base-300 bg-base-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Export Options</span>
            <button
              onClick={() => setShowExportOptions(false)}
              className="btn btn-sm btn-ghost btn-circle"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Format Selection */}
            <div>
              <label className="text-xs text-base-content/60 mb-1 block">Format</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setExportFormat('json')}
                  className={`btn btn-sm flex-1 gap-1.5 ${
                    exportFormat === 'json' ? 'btn-primary' : 'btn-ghost'
                  }`}
                >
                  <FileJson className="w-4 h-4" />
                  JSON
                </button>
                <button
                  onClick={() => setExportFormat('csv')}
                  className={`btn btn-sm flex-1 gap-1.5 ${
                    exportFormat === 'csv' ? 'btn-primary' : 'btn-ghost'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  CSV
                </button>
                <button
                  onClick={() => setExportFormat('pdf')}
                  className={`btn btn-sm flex-1 gap-1.5 ${
                    exportFormat === 'pdf' ? 'btn-primary' : 'btn-ghost'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  PDF
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeRead}
                  onChange={(e) => setIncludeRead(e.target.checked)}
                  className="checkbox checkbox-sm"
                />
                Include read
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="checkbox checkbox-sm"
                />
                Include archived
              </label>
            </div>
          </div>

          <button onClick={handleExport} className="btn btn-primary btn-sm w-full">
            <Download className="w-4 h-4" />
            Download Export
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="p-4 border-b border-base-300 space-y-3">
        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search history..."
              className="input input-bordered w-full pl-10"
            />
          </div>
          <button onClick={handleSearch} className="btn btn-primary">
            Search
          </button>
          {(searchQuery || dateFrom || dateTo) && (
            <button onClick={onClearFilter} className="btn btn-ghost">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-base-content/60 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
          </div>
          <div>
            <label className="text-xs text-base-content/60 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="loading loading-spinner loading-lg" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-base-content/50">
            <History className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-semibold">No notifications found</p>
            <p className="text-sm">Try adjusting your search or date range</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className="p-3 rounded-lg border border-base-300 bg-base-100 hover:bg-base-200 transition-all"
            >
              <div className="flex items-start gap-3">
                {/* Status Icon */}
                <div className="flex-shrink-0 mt-1">
                  {getStatusIcon(notification.status)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm truncate">
                          {notification.title}
                        </h4>
                        <span className={`badge badge-xs ${getSeverityBadge(notification.severity)}`}>
                          {notification.severity}
                        </span>
                        <span className="badge badge-xs badge-ghost">
                          {notification.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-base-content/70 mt-1">
                        {notification.message}
                      </p>
                      {notification.description && (
                        <p className="text-xs text-base-content/50 mt-1">
                          {notification.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-base-content/50">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatNotificationDate(notification.createdAt)}
                    </span>
                    {notification.readAt && (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Read: {formatNotificationDate(notification.readAt)}
                      </span>
                    )}
                    {notification.archivedAt && (
                      <span className="flex items-center gap-1">
                        <Archive className="w-3 h-3" />
                        Archived: {formatNotificationDate(notification.archivedAt)}
                      </span>
                    )}
                    {notification.metadata?.projectName && (
                      <span className="px-2 py-0.5 rounded bg-base-300">
                        {notification.metadata.projectName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-base-300 flex items-center justify-between">
          <button
            onClick={() => onLoadHistory(currentPage - 1)}
            disabled={currentPage <= 1}
            className="btn btn-sm btn-ghost gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-sm text-base-content/60">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => onLoadHistory(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="btn btn-sm btn-ghost gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default NotificationHistory;
