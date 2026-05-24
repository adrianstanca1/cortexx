import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, X, Settings, AtSign, AlertTriangle, Server } from 'lucide-react';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth-storage';

type TabFilter = 'all' | 'mentions' | 'alerts' | 'system';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'alert';
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  link?: string;
  actionLabel?: string;
  severity?: string;
}

interface NotificationCenterProps {
  onClose?: () => void;
}

export function NotificationCenter({ onClose }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch('/api/notifications?pageSize=50', {
        credentials: 'include',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('[NotificationCenter] Failed to fetch:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      const token = getToken();
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        credentials: 'include',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (_err) {
      toast.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = getToken();
      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        credentials: 'include',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('All notifications marked as read');
    } catch (_err) {
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const token = getToken();
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notification deleted');
    } catch (_err) {
      toast.error('Failed to delete notification');
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'mentions') return n.title.includes('@') || n.description.includes('@');
    if (activeTab === 'alerts') return n.type === 'alert' || n.type === 'warning' || n.severity === 'critical';
    if (activeTab === 'system') return n.type === 'info' || n.type === 'success';
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const typeColors = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    alert: 'bg-red-600',
  };

  const tabs: { id: TabFilter; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All', icon: <Bell className="w-4 h-4" /> },
    { id: 'mentions', label: 'Mentions', icon: <AtSign className="w-4 h-4" /> },
    { id: 'alerts', label: 'Alerts', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'system', label: 'System', icon: <Server className="w-4 h-4" /> },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Notification center"
    >
      <div
        className="bg-base-100 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-base-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-content text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold">Notifications</h2>
              <p className="text-xs text-gray-500">{unreadCount} unread</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={markAllAsRead}
              className="btn btn-sm btn-ghost gap-1"
              aria-label="Mark all notifications as read"
              disabled={unreadCount === 0}
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="btn btn-sm btn-ghost btn-circle"
                aria-label="Close notification center"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="p-3 border-b border-base-300 flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`btn btn-sm gap-1 ${activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
          <div className="flex-1" />
          <button className="btn btn-sm btn-ghost" aria-label="Notification settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" role="list" aria-label="Notifications list">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">
              <span className="loading loading-spinner loading-md" />
              <p className="mt-2">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>No notifications</p>
            </div>
          ) : (
            filteredNotifications.map(notification => (
              <div
                key={notification.id}
                role="listitem"
                className={`p-4 border-b border-base-300 hover:bg-base-200 transition-colors ${!notification.read ? 'bg-primary/5' : ''}`}
              >
                <div className="flex gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${typeColors[notification.type]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className={`font-semibold ${!notification.read ? 'text-primary' : ''}`}>
                            {notification.title}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{notification.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-gray-400">
                            {new Date(notification.timestamp).toLocaleString()}
                          </span>
                          {!notification.read && (
                            <span className="text-xs bg-primary text-primary-content px-2 py-0.5 rounded-full">
                              New
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {notification.link && (
                          <a
                            href={notification.link}
                            className="btn btn-sm btn-primary"
                            onClick={e => e.stopPropagation()}
                          >
                            {notification.actionLabel || 'View'}
                          </a>
                        )}
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="btn btn-sm btn-ghost"
                            aria-label="Mark as read"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="btn btn-sm btn-ghost btn-circle"
                          aria-label="Delete"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-base-300 text-xs text-gray-500 text-center">
          {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''} displayed
        </div>
      </div>
    </div>
  );
}
