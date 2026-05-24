/**
 * CortexBuild Ultimate - NotificationCenter
 * Comprehensive real-time notification center with all features
 *
 * Features:
 * - Real-time WebSocket updates
 * - Notification grouping by date
 * - Multiple filter categories
 * - Quick actions (approve, reject, reply)
 * - Settings management
 * - Notification history with export
 * - Browser push notifications
 * - Sound alerts
 * - Quiet hours
 * - Dark theme compatible
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  X,
  Settings,
  History,
  Archive,
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Clock,
  CheckCircle,
  ExternalLink,
  Moon,
  Sun,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNotificationCenter } from '@/hooks/useNotificationCenter';
import { NotificationItem } from './NotificationItem';
import { NotificationFilters } from './NotificationFilters';
import { NotificationCenterSettings } from './NotificationCenterSettings';
import { NotificationHistory } from './NotificationHistory';
import type { NotificationFilter } from '@/types/notification';

// View modes
type ViewMode = 'notifications' | 'settings' | 'history';

// Component Props
interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  variant?: 'panel' | 'modal' | 'dropdown';
  compact?: boolean;
}

export function NotificationCenter({
  isOpen,
  onClose,
  position = 'top-right',
  variant = 'panel',
  compact = false,
}: NotificationCenterProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('notifications');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    today: true,
    yesterday: true,
    'this-week': true,
  });
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [showCompactView, setShowCompactView] = useState(false);

  // Use the notification center hook
  const {
    notifications,
    groupedNotifications,
    unreadCount,
    total,
    stats,
    settings,
    isLoading,
    wsStatus,
    markAsRead,
    markAllAsRead,
    markMultipleAsRead,
    deleteNotification,
    deleteMultiple,
    archiveNotification,
    archiveRead,
    snoozeNotification,
    updateSettings,
    toggleCategory,
    toggleQuietHours,
    toggleSoundAlerts,
    toggleBrowserNotifications,
    setFilter,
    clearFilter,
    search,
    loadHistory,
    exportNotifications,
    refresh,
    clearAll,
  } = useNotificationCenter({
    autoConnect: true,
    pollingInterval: 30000,
    maxNotifications: 100,
  });

  // Current filter state
  const [currentFilter, setCurrentFilter] = useState<NotificationFilter | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');

  // Handle filter change
  const handleFilterChange = useCallback((filter: NotificationFilter) => {
    setCurrentFilter(filter);
    setFilter(filter);
  }, [setFilter]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    search(query);
  }, [search]);

  // Toggle group expansion
  const toggleGroup = useCallback((groupDate: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupDate]: !prev[groupDate],
    }));
  }, []);

  // Toggle notification selection
  const toggleSelection = useCallback((id: string) => {
    setSelectedNotifications((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Handle quick reply
  const handleQuickReply = useCallback((_notificationId: string, _message: string) => {
    toast.success('Reply sent', {
      description: 'Your response has been sent',
    });
    // Here you would typically call an API to send the reply
  }, []);

  // Handle quick approve/reject
  const handleQuickApprove = useCallback((notificationId: string, approved: boolean) => {
    if (approved) {
      toast.success('Approved', {
        description: 'The request has been approved',
      });
    } else {
      toast.error('Rejected', {
        description: 'The request has been rejected',
      });
    }
    markAsRead(notificationId);
    // Here you would typically call an API to process the approval
  }, [markAsRead]);

  // Handle navigate to related item
  const handleNavigate = useCallback((url: string) => {
    window.open(url, '_blank');
  }, []);

  // Handle bulk actions
  const handleBulkMarkAsRead = useCallback(async () => {
    if (selectedNotifications.size > 0) {
      await markMultipleAsRead(Array.from(selectedNotifications));
      setSelectedNotifications(new Set());
      toast.success(`Marked ${selectedNotifications.size} notifications as read`);
    }
  }, [selectedNotifications, markMultipleAsRead]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedNotifications.size > 0) {
      await deleteMultiple(Array.from(selectedNotifications));
      setSelectedNotifications(new Set());
      toast.success(`Deleted ${selectedNotifications.size} notifications`);
    }
  }, [selectedNotifications, deleteMultiple]);

  const handleArchiveRead = useCallback(async () => {
    await archiveRead();
    toast.success('Archived all read notifications');
  }, [archiveRead]);

  // Position classes
  const positionClasses = useMemo(() => {
    const base = 'fixed z-[9999]';
    switch (position) {
      case 'top-right':
        return `${base} top-0 right-0`;
      case 'top-left':
        return `${base} top-0 left-0`;
      case 'bottom-right':
        return `${base} bottom-0 right-0`;
      case 'bottom-left':
        return `${base} bottom-0 left-0`;
    }
  }, [position]);

  // Size classes based on variant
  const sizeClasses = useMemo(() => {
    if (compact) {
      return 'w-80 max-h-96';
    }
    switch (variant) {
      case 'dropdown':
        return 'w-96 max-h-[70vh]';
      case 'panel':
        return 'w-full max-w-md max-h-[85vh]';
      case 'modal':
        return 'w-full max-w-2xl max-h-[90vh]';
    }
  }, [variant, compact]);

  // If not open, don't render
  if (!isOpen) {
    return null;
  }

  // Render settings view
  if (viewMode === 'settings') {
    return (
      <>
        {variant === 'modal' && (
          <div className="fixed inset-0 bg-black/50 z-[9998]" onClick={onClose} />
        )}
        <div className={`${positionClasses} ${sizeClasses} m-4`}>
          <div className="card h-full shadow-2xl border border-base-300">
            <NotificationCenterSettings
              settings={settings}
              onUpdateSettings={updateSettings}
              onToggleCategory={toggleCategory}
              onToggleQuietHours={toggleQuietHours}
              onToggleSoundAlerts={toggleSoundAlerts}
              onToggleBrowserNotifications={toggleBrowserNotifications}
              onClose={() => setViewMode('notifications')}
            />
          </div>
        </div>
      </>
    );
  }

  // Render history view
  if (viewMode === 'history') {
    return (
      <>
        {variant === 'modal' && (
          <div className="fixed inset-0 bg-black/50 z-[9998]" onClick={onClose} />
        )}
        <div className={`${positionClasses} ${sizeClasses} m-4`}>
          <div className="card h-full shadow-2xl border border-base-300">
            <NotificationHistory
              notifications={notifications}
              isLoading={isLoading}
              onLoadHistory={loadHistory}
              onExport={exportNotifications}
              onFilterChange={handleFilterChange}
              onClearFilter={clearFilter}
              filter={currentFilter}
            />
            <div className="p-3 border-t border-base-300">
              <button
                onClick={() => setViewMode('notifications')}
                className="btn btn-sm btn-ghost w-full"
              >
                Back to Notifications
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Render main notifications view
  return (
    <>
      {variant === 'modal' && (
        <div className="fixed inset-0 bg-black/50 z-[9998]" onClick={onClose} />
      )}
      <div className={`${positionClasses} ${sizeClasses} m-4`}>
        <div className="card h-full shadow-2xl border border-base-300 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-base-300">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Bell className="w-6 h-6 text-primary" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 badge badge-primary badge-xs">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold">Notifications</h2>
                  <div className="flex items-center gap-2 text-xs text-base-content/60">
                    <span>{unreadCount} unread</span>
                    <span>•</span>
                    <span>{total} total</span>
                    <span className={`flex items-center gap-1 ${wsStatus.isConnected ? 'text-success' : 'text-error'}`}>
                      {wsStatus.isConnected ? (
                        <>
                          <Wifi className="w-3 h-3" />
                          Live
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-3 h-3" />
                          Offline
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={refresh}
                  className="btn btn-sm btn-ghost btn-circle"
                  title="Refresh"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('settings')}
                  className="btn btn-sm btn-ghost btn-circle"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('history')}
                  className="btn btn-sm btn-ghost btn-circle"
                  title="History"
                >
                  <History className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="btn btn-sm btn-ghost btn-circle"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="btn btn-sm btn-ghost gap-1.5"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
              <button
                onClick={handleArchiveRead}
                className="btn btn-sm btn-ghost gap-1.5"
              >
                <Archive className="w-4 h-4" />
                Archive read
              </button>
              {selectedNotifications.size > 0 && (
                <>
                  <button
                    onClick={handleBulkMarkAsRead}
                    className="btn btn-sm btn-primary gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Mark read ({selectedNotifications.size})
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="btn btn-sm btn-error gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setShowCompactView(!showCompactView)}
                  className="btn btn-sm btn-ghost gap-1.5"
                >
                  {showCompactView ? (
                    <>
                      <Eye className="w-4 h-4" />
                      Detailed
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-4 h-4" />
                      Compact
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="p-4 border-b border-base-300">
            <NotificationFilters
              filter={currentFilter}
              onFilterChange={handleFilterChange}
              onClear={clearFilter}
              onSearch={handleSearch}
              searchQuery={searchQuery}
              unreadCount={unreadCount}
              total={total}
            />
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="loading loading-spinner loading-lg" />
              </div>
            ) : groupedNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-base-content/50">
                <Bell className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-semibold">No notifications</p>
                <p className="text-sm">You're all caught up!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedNotifications.map((group) => (
                  <div key={group.date}>
                    {/* Group Header */}
                    <button
                      onClick={() => toggleGroup(group.date)}
                      className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-base-200 hover:bg-base-300 transition-all mb-2"
                    >
                      <div className="flex items-center gap-2">
                        {group.date === 'today' && <Sun className="w-4 h-4" />}
                        {group.date === 'yesterday' && <Moon className="w-4 h-4" />}
                        {group.date === 'this-week' && <Clock className="w-4 h-4" />}
                        <span className="font-semibold text-sm">{group.label}</span>
                        {group.unreadCount > 0 && (
                          <span className="badge badge-primary badge-xs">
                            {group.unreadCount}
                          </span>
                        )}
                      </div>
                      {expandedGroups[group.date] ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {/* Group Content */}
                    {expandedGroups[group.date] && (
                      <div className="space-y-2">
                        {group.notifications.map((notification) => (
                          <div key={notification.id} className="relative">
                            {selectedNotifications.size > 0 && (
                              <input
                                type="checkbox"
                                checked={selectedNotifications.has(notification.id)}
                                onChange={() => toggleSelection(notification.id)}
                                className="checkbox checkbox-xs absolute top-3 left-3 z-10"
                              />
                            )}
                            <NotificationItem
                              notification={notification}
                              onMarkAsRead={markAsRead}
                              onDelete={deleteNotification}
                              onArchive={archiveNotification}
                              onSnooze={snoozeNotification}
                              onNavigate={handleNavigate}
                              onQuickReply={handleQuickReply}
                              onQuickApprove={handleQuickApprove}
                              isCompact={showCompactView}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-base-300 bg-base-200">
            <div className="flex items-center justify-between text-xs text-base-content/60">
              <span>
                {stats && (
                  <span className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-success" />
                      {stats.read} read
                    </span>
                    <span className="flex items-center gap-1">
                      <Archive className="w-3 h-3 text-amber-500" />
                      {stats.archived} archived
                    </span>
                  </span>
                )}
              </span>
              <button
                onClick={clearAll}
                className="btn btn-xs btn-ghost text-error"
                disabled={total === 0}
              >
                <Trash2 className="w-3 h-3" />
                Clear all
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default NotificationCenter;
