/**
 * CortexBuild Ultimate - useNotificationCenter Hook
 * Comprehensive hook for managing real-time notifications with WebSocket support
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiGet, apiPut, apiPost, apiDelete } from '@/lib/api';
import { eventBus } from '@/lib/eventBus';
import { buildWebSocketUrl } from '@/lib/wsUrl';
import {
  validateNotification,
  validateNotificationsResponse,
  validateNotificationSettings,
} from '@/lib/validateNotification';
import type {
  Notification,
  NotificationSettings,
  NotificationFilter,
  NotificationQuery,
  NotificationsResponse,
  UnreadCountResponse,
  NotificationStats,
  WebSocketConnectionStatus,
  NotificationGroup,
  ExportOptions,
} from '@/types/notification';
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/types/notification';

// Default settings
const DEFAULT_SETTINGS: NotificationSettings = DEFAULT_NOTIFICATION_SETTINGS;

// Hook options
export interface UseNotificationCenterOptions {
  autoConnect?: boolean;
  pollingInterval?: number;
  maxNotifications?: number;
}

// Hook result
export interface UseNotificationCenterResult {
  // State
  notifications: Notification[];
  groupedNotifications: NotificationGroup[];
  unreadCount: number;
  total: number;
  stats: NotificationStats | null;
  settings: NotificationSettings;
  
  // Loading & Error states
  isLoading: boolean;
  isConnecting: boolean;
  error: Error | null;
  
  // WebSocket status
  wsStatus: WebSocketConnectionStatus;
  
  // Actions
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markMultipleAsRead: (ids: string[]) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteMultiple: (ids: string[]) => Promise<void>;
  archiveNotification: (id: string) => Promise<void>;
  archiveRead: () => Promise<void>;
  snoozeNotification: (id: string, until: Date) => Promise<void>;
  unsnoozeNotification: (id: string) => Promise<void>;

  // Settings
  updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
  toggleCategory: (category: string) => void;
  toggleQuietHours: () => void;
  toggleSoundAlerts: () => void;
  toggleBrowserNotifications: () => Promise<void>;
  
  // Filtering & Search
  setFilter: (filter: NotificationFilter) => void;
  clearFilter: () => void;
  search: (query: string) => void;
  
  // History
  loadHistory: (page?: number) => Promise<void>;
  exportNotifications: (options: ExportOptions) => Promise<Blob>;
  
  // Utility
  refresh: () => Promise<void>;
  clearAll: () => Promise<void>;
  requestBrowserPermission: () => Promise<boolean>;
}

// Sound notification
const playNotificationSound = () => {
  try {
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Fallback beep using Web Audio API
      const ctx = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext })['webkitAudioContext'])();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
      // SECURITY FIX: Close AudioContext to prevent memory leak
      oscillator.onended = () => {
        ctx.close().catch(console.error);
      };
    });
  } catch {
    // Silent fail if audio not supported
  }
};

// Show browser notification
const showBrowserNotification = (notification: Notification) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('CortexBuild', {
      body: `${notification.title}: ${notification.message}`,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: notification.id,
      requireInteraction: notification.severity === 'critical' || notification.severity === 'error',
    });
  }
};

// Group notifications by date
const groupByDate = (notifications: Notification[]): NotificationGroup[] => {
  const groups: Map<string, NotificationGroup> = new Map();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  notifications.forEach((notification) => {
    const date = new Date(notification.createdAt);
    let label: string;
    let dateKey: string;

    if (date >= today) {
      label = 'Today';
      dateKey = 'today';
    } else if (date >= yesterday) {
      label = 'Yesterday';
      dateKey = 'yesterday';
    } else if (date >= weekAgo) {
      label = 'This Week';
      dateKey = 'this-week';
    } else {
      label = date.toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'short', 
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
      });
      dateKey = date.toISOString().split('T')[0];
    }

    if (!groups.has(dateKey)) {
      groups.set(dateKey, {
        label,
        date: dateKey,
        notifications: [],
        unreadCount: 0,
      });
    }

    const group = groups.get(dateKey)!;
    group.notifications.push(notification);
    if (notification.status === 'unread') {
      group.unreadCount++;
    }
  });

  // Sort groups by date (newest first)
  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    const order = ['today', 'yesterday', 'this-week'];
    const aIndex = order.indexOf(a.date);
    const bIndex = order.indexOf(b.date);
    
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    
    return b.date.localeCompare(a.date);
  });

  return sortedGroups;
};

// Calculate stats from notifications
const calculateStats = (
  notifications: Notification[],
  unreadCount: number
): NotificationStats => {
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  notifications.forEach((n) => {
    byType[n.type] = (byType[n.type] || 0) + 1;
    bySeverity[n.severity] = (bySeverity[n.severity] || 0) + 1;
    byCategory[n.category] = (byCategory[n.category] || 0) + 1;
  });

  return {
    total: notifications.length,
    unread: unreadCount,
    read: notifications.filter((n) => n.status === 'read').length,
    archived: notifications.filter((n) => n.status === 'archived').length,
    snoozed: notifications.filter((n) => n.status === 'snoozed').length,
    byType: byType as Record<Notification['type'], number>,
    bySeverity: bySeverity as Record<Notification['severity'], number>,
    byCategory: byCategory as Record<Notification['category'], number>,
  };
};

export function useNotificationCenter(
  options: UseNotificationCenterOptions = {}
): UseNotificationCenterResult {
  const {
    autoConnect = true,
    pollingInterval = 60000, // 1 minute
    maxNotifications = 100,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const settingsRef = useRef<NotificationSettings>(DEFAULT_SETTINGS);
  const abortControllerRef = useRef<AbortController | null>(null);

  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [wsStatus, setWsStatus] = useState<WebSocketConnectionStatus>({
    isConnected: false,
    reconnecting: false,
    reconnectAttempt: 0,
  });
  const [currentFilter, setCurrentFilter] = useState<NotificationFilter | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (query?: NotificationQuery, signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (query?.page) params.set('page', String(query.page));
      if (query?.pageSize) params.set('pageSize', String(query.pageSize));
      if (query?.filter?.category) params.set('category', query.filter.category);
      if (query?.filter?.type) params.set('type', query.filter.type);
      if (query?.filter?.severity) params.set('severity', query.filter.severity);
      if (query?.filter?.status) params.set('status', query.filter.status);
      if (query?.filter?.projectId) params.set('projectId', query.filter.projectId);
      if (query?.filter?.dateFrom) params.set('dateFrom', query.filter.dateFrom);
      if (query?.filter?.dateTo) params.set('dateTo', query.filter.dateTo);
      if (query?.searchQuery) params.set('q', query.searchQuery);
      if (query?.sortBy) params.set('sortBy', query.sortBy);
      if (query?.sortOrder) params.set('sortOrder', query.sortOrder);

      const rawResult = await apiGet<unknown>(
        `/notifications${params.toString() ? `?${params.toString()}` : ''}`,
        { signal }
      );

      if (signal?.aborted) return;

      const result = validateNotificationsResponse(rawResult);

      if (!result) {
        console.warn('API returned invalid notifications response, using empty list');
        setNotifications([]);
        setUnreadCount(0);
        setTotal(0);
        return;
      }

      // Validate individual notifications
      const validNotifications = result.notifications
        .map(n => validateNotification(n))
        .filter((n): n is Notification => n !== null);

      setNotifications(validNotifications);
      setUnreadCount(result.unreadCount);
      setTotal(result.total);
      setStats(calculateStats(validNotifications, result.unreadCount));
    } catch (err) {
      if (signal?.aborted) return;
      const error = err instanceof Error ? err : new Error('Failed to fetch notifications');
      setError(error);
      console.error('Failed to fetch notifications:', error);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await apiGet<UnreadCountResponse>('/notifications/unread-count', { signal });
      if (signal?.aborted) return;
      setUnreadCount(result.unreadCount);
    } catch (err) {
      if (signal?.aborted) return;
      console.error('Failed to fetch unread count:', err);
    }
  }, []);

  // Fetch settings
  const fetchSettings = useCallback(async (signal?: AbortSignal) => {
    try {
      const rawResult = await apiGet<unknown>('/notifications/settings', { signal });
      if (signal?.aborted) return;
      const result = validateNotificationSettings(rawResult);

      if (!result) {
        console.warn('API returned invalid notification settings, using defaults');
        setSettings(DEFAULT_SETTINGS);
        settingsRef.current = DEFAULT_SETTINGS;
        return;
      }

      setSettings(result);
      settingsRef.current = result;
    } catch (err) {
      if (signal?.aborted) return;
      console.error('Failed to fetch notification settings:', err);
      // Use defaults if fetch fails
      setSettings(DEFAULT_SETTINGS);
      settingsRef.current = DEFAULT_SETTINGS;
    }
  }, []);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    setIsConnecting(true);
    setWsStatus((prev) => ({ ...prev, reconnecting: true, reconnectAttempt: reconnectAttemptRef.current + 1 }));

    try {
      const wsUrl = buildWebSocketUrl('/ws');

      const ws = new WebSocket(wsUrl);
      let wasEverOpen = false;

      ws.onopen = () => {
        wasEverOpen = true;
        setIsConnecting(false);
        setWsStatus({
          isConnected: true,
          reconnecting: false,
          reconnectAttempt: 0,
        });
        reconnectAttemptRef.current = 0;
        eventBus.emit('ws:connect', undefined);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'notification' && message.payload) {
            // Build notification object for validation
            const rawNotification = {
              id: message.payload.id || `notif-${Date.now()}`,
              type: message.event || message.payload.type || 'system_alert',
              category: message.payload.category || 'all',
              severity: message.payload.severity || 'info',
              status: 'unread' as const,
              title: message.payload.title || 'Notification',
              message: message.payload.message || message.payload.description || '',
              description: message.payload.description,
              relatedItem: message.payload.relatedItem,
              actions: message.payload.actions,
              fromUser: message.payload.fromUser,
              createdAt: message.timestamp || new Date().toISOString(),
              metadata: message.payload.metadata,
            };

            // Validate the notification before using it
            const notification = validateNotification(rawNotification);

            if (!notification) {
              console.warn('Received invalid WebSocket notification, skipping');
              return;
            }

            // Add to notifications list
            setNotifications((prev) => {
              const updated = [notification, ...prev].slice(0, maxNotifications);
              return updated;
            });

            // Update unread count
            setUnreadCount((prev) => prev + 1);
            setTotal((prev) => prev + 1);

            // Play sound if enabled
            if (settingsRef.current.soundAlerts && settingsRef.current.emailNotifications) {
              playNotificationSound();
            }

            // Show browser notification if enabled
            if (settingsRef.current.browserNotifications) {
              showBrowserNotification(notification);
            }

            // Emit event for other components
            eventBus.emit('ws:message', {
              type: notification.type,
              table: notification.metadata?.projectId ? 'notifications' : undefined,
              action: 'insert',
              id: notification.id,
            });
          }
        } catch (err) {
          console.error('Failed to parse WebSocket notification:', err);
        }
      };

      ws.onclose = (event) => {
        setWsStatus((prev) => ({ ...prev, isConnected: false }));
        eventBus.emit('ws:disconnect', undefined);

        // If connection was never opened (code 1006 = abnormal closure),
        // the server may have rejected the upgrade because WS is disabled.
        // Try to detect this by checking if it was never open, and if so
        // check with a lightweight API call before deciding to reconnect.
        if (!wasEverOpen && event.code === 1006) {
          // Server rejected the WS upgrade — likely FEATURE_WEBSOCKET is disabled.
          // Stop reconnecting after a few attempts; set a disabled-like status.
          if (reconnectAttemptRef.current >= 3) {
            console.warn('[WS] Server rejected WebSocket upgrade multiple times — likely disabled. Stopping reconnect.');
            setWsStatus({ isConnected: false, reconnecting: false, reconnectAttempt: 0, error: 'WebSocket is disabled on the server' });
            return;
          }
        }

        // Reconnect with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptRef.current++;
          connectWebSocket();
        }, delay);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to connect to WebSocket:', err);
      setIsConnecting(false);
      setWsStatus((prev) => ({
        ...prev,
        reconnecting: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      }));
    }
  }, [maxNotifications]);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnecting(false);
    reconnectAttemptRef.current = 0;
    setWsStatus({
      isConnected: false,
      reconnecting: false,
      reconnectAttempt: 0,
    });
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      await apiPut(`/notifications/${id}/read`, {});
      
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, status: 'read' as const, readAt: new Date().toISOString() } : n
        )
      );
      
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await apiPut('/notifications/read-all', {});
      
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, status: 'read' as const, readAt: new Date().toISOString() }))
      );
      
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, []);

  // Mark multiple as read
  const markMultipleAsRead = useCallback(async (ids: string[]) => {
    try {
      await apiPost('/notifications/mark-read-bulk', { ids });
      
      setNotifications((prev) =>
        prev.map((n) =>
          ids.includes(n.id) ? { ...n, status: 'read' as const, readAt: new Date().toISOString() } : n
        )
      );
      
      setUnreadCount((prev) => Math.max(0, prev - ids.length));
    } catch (err) {
      console.error('Failed to mark multiple as read:', err);
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (id: string) => {
    try {
      await apiDelete(`/notifications/${id}`);
      
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  }, []);

  // Delete multiple notifications
  const deleteMultiple = useCallback(async (ids: string[]) => {
    try {
      await apiPost('/notifications/delete-bulk', { ids });
      
      setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
      setTotal((prev) => Math.max(0, prev - ids.length));
    } catch (err) {
      console.error('Failed to delete multiple notifications:', err);
    }
  }, []);

  // Archive notification
  const archiveNotification = useCallback(async (id: string) => {
    try {
      await apiPut(`/notifications/${id}/archive`, {});

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, status: 'archived' as const, archivedAt: new Date().toISOString() } : n
        )
      );

      setUnreadCount((prev) => {
        // We don't need to check notifications array - just decrement if it was unread
        return prev > 0 ? prev - 1 : prev;
      });
    } catch (err) {
      console.error('Failed to archive notification:', err);
    }
  }, []);

  // Archive all read notifications
  const archiveRead = useCallback(async () => {
    try {
      await apiPost('/notifications/archive-read', {});

      setNotifications((prev) =>
        prev.map((n) =>
          n.status === 'read' ? { ...n, status: 'archived' as const, archivedAt: new Date().toISOString() } : n
        )
      );
      
      // Reset unread count since we're archiving all read notifications
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to archive read notifications:', err);
    }
  }, []);

  // Snooze notification
  const snoozeNotification = useCallback(async (id: string, until: Date) => {
    try {
      await apiPut(`/notifications/${id}/snooze`, { until: until.toISOString() });

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, status: 'snoozed' as const, snoozedUntil: until.toISOString() } : n
        )
      );

      setUnreadCount((prev) => {
        return prev > 0 ? prev - 1 : prev;
      });
    } catch (err) {
      console.error('Failed to snooze notification:', err);
    }
  }, []);

  // Unsnooze notification
  const unsnoozeNotification = useCallback(async (id: string) => {
    try {
      await apiPut(`/notifications/${id}/unsnooze`, {});
      
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, status: 'unread' as const, snoozedUntil: undefined } : n
        )
      );
      
      setUnreadCount((prev) => prev + 1);
    } catch (err) {
      console.error('Failed to unsnooze notification:', err);
    }
  }, []);

  // Update settings
  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
    try {
      const updated = { ...settings, ...newSettings };
      await apiPut('/notifications/settings', updated);
      
      setSettings(updated);
      settingsRef.current = updated;
    } catch (err) {
      console.error('Failed to update notification settings:', err);
    }
  }, [settings]);

  // Toggle category preference
  const toggleCategory = useCallback((category: string) => {
    setSettings((prev) => {
      const categoryKey = category as keyof import('@/types/notification').CategoryPreferences;
      const updated = {
        ...prev,
        categoryPreferences: {
          ...prev.categoryPreferences,
          [categoryKey]: !prev.categoryPreferences[categoryKey as keyof typeof prev.categoryPreferences],
        },
      };
      settingsRef.current = updated;
      apiPut('/notifications/settings', updated).catch(console.error);
      return updated;
    });
  }, []);

  // Toggle quiet hours
  const toggleQuietHours = useCallback(() => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        quietHours: {
          ...prev.quietHours,
          enabled: !prev.quietHours.enabled,
        },
      };
      settingsRef.current = updated;
      apiPut('/notifications/settings', updated).catch(console.error);
      return updated;
    });
  }, []);

  // Toggle sound alerts
  const toggleSoundAlerts = useCallback(() => {
    setSettings((prev) => {
      const updated = { ...prev, soundAlerts: !prev.soundAlerts };
      settingsRef.current = updated;
      apiPut('/notifications/settings', updated).catch(console.error);
      return updated;
    });
  }, []);

  // Request browser notification permission
  const requestBrowserPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('Notification permission denied');
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, []);

  // Toggle browser notifications
  const toggleBrowserNotifications = useCallback(async () => {
    if (settings.browserNotifications) {
      await updateSettings({ browserNotifications: false });
    } else {
      const granted = await requestBrowserPermission();
      if (granted) {
        await updateSettings({ browserNotifications: true });
      }
    }
  }, [settings.browserNotifications, requestBrowserPermission, updateSettings]);

  // Set filter
  const setFilter = useCallback((filter: NotificationFilter) => {
    setCurrentFilter(filter);
    fetchNotifications({ page: 1, pageSize: 50, filter });
  }, [fetchNotifications]);

  // Clear filter
  const clearFilter = useCallback(() => {
    setCurrentFilter(undefined);
    setSearchQuery('');
    fetchNotifications({ page: 1, pageSize: 50 });
  }, [fetchNotifications]);

  // Search notifications
  const search = useCallback((query: string) => {
    setSearchQuery(query);
    fetchNotifications({ 
      page: 1, 
      pageSize: 50, 
      filter: currentFilter,
      searchQuery: query || undefined 
    });
  }, [fetchNotifications, currentFilter]);

  // Load history (archived notifications)
  const loadHistory = useCallback(async (page = 1, signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      const result = await apiGet<NotificationsResponse>(
        `/notifications/history?page=${page}&pageSize=50&status=archived`,
        { signal }
      );
      if (signal?.aborted) return;
      setNotifications(result.notifications);
      setTotal(result.total);
    } catch (err) {
      if (signal?.aborted) return;
      console.error('Failed to load notification history:', err);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  // Export notifications
  const exportNotifications = useCallback(async (options: ExportOptions): Promise<Blob> => {
    try {
      const response = await apiPost<Blob>('/notifications/export', options);
      return response as unknown as Blob;
    } catch (err) {
      console.error('Failed to export notifications:', err);
      throw new Error('Export failed');
    }
  }, []);

  // Refresh notifications
  const refresh = useCallback(async () => {
    await fetchNotifications({ page: 1, pageSize: maxNotifications, filter: currentFilter, searchQuery });
    await fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount, maxNotifications, currentFilter, searchQuery]);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    try {
      await apiDelete('/notifications/all');
      setNotifications([]);
      setUnreadCount(0);
      setTotal(0);
    } catch (err) {
      console.error('Failed to clear all notifications:', err);
    }
  }, []);

  // Grouped notifications
  const groupedNotifications = useMemo(() => {
    return groupByDate(notifications);
  }, [notifications]);

  // Initialize
  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    fetchNotifications({ page: 1, pageSize: maxNotifications }, controller.signal);
    fetchSettings(controller.signal);

    // Auto-connect WebSocket
    if (autoConnect) {
      connectWebSocket();
    }

    // Poll for updates
    const pollInterval = setInterval(() => {
      // ⚡ Bolt Performance Optimization:
      // Redundant HTTP Polling with WebSockets
      // If the WebSocket is successfully connected, it receives real-time updates.
      // We skip the HTTP polling to prevent unnecessary network requests and React re-renders.
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        return;
      }
      fetchUnreadCount(controller.signal);
    }, pollingInterval);

    // SECURITY FIX: Proper cleanup of all resources
    return () => {
      controller.abort();
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      clearInterval(pollInterval);
      disconnectWebSocket();

      // Clear any pending timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [
    autoConnect,
    connectWebSocket,
    disconnectWebSocket,
    fetchNotifications,
    fetchSettings,
    fetchUnreadCount,
    maxNotifications,
    pollingInterval,
  ]);

  return {
    // State
    notifications,
    groupedNotifications,
    unreadCount,
    total,
    stats,
    settings,
    
    // Loading & Error states
    isLoading,
    isConnecting,
    error,
    
    // WebSocket status
    wsStatus,
    
    // Actions
    markAsRead,
    markAllAsRead,
    markMultipleAsRead,
    deleteNotification,
    deleteMultiple,
    archiveNotification,
    archiveRead,
    snoozeNotification,
    unsnoozeNotification,
    
    // Settings
    updateSettings,
    toggleCategory,
    toggleQuietHours,
    toggleSoundAlerts,
    toggleBrowserNotifications,
    
    // Filtering & Search
    setFilter,
    clearFilter,
    search,
    
    // History
    loadHistory,
    exportNotifications,
    
    // Utility
    refresh,
    clearAll,
    requestBrowserPermission,
  };
}

export default useNotificationCenter;
