import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPut, apiDelete } from '@/lib/api';
import { validateNotification } from '@/lib/validateNotification';
import { buildWebSocketUrl } from '@/lib/wsUrl';

export interface Notification {
  id: string | number;
  type:
    | 'notification'
    | 'alert'
    | 'dashboard_update'
    | 'collaboration'
    | 'system'
    | string;
  title: string;
  message?: string;
  description: string;
  read: boolean;
  link?: string;
  createdAt?: string;
  timestamp: string;
  severity: 'info' | 'success' | 'warning' | 'error' | 'critical';
  data?: Record<string, unknown>;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  total: number;
}

interface UnreadCountResponse {
  unreadCount: number;
}

export interface UseNotificationsOptions {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}

export interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  total: number;
  isLoading: boolean;
  loading: boolean;
  error: Error | null;
  isConnected: boolean;
  markAsRead: (id: string | number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (id: string | number) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
}

export interface UseUnreadCountResult {
  unreadCount: number;
  loading: boolean;
  error: Error | null;
}

// Hook for fetching notifications with full compatibility
export function useNotifications(
  authTokenOrOptions?: string | null | UseNotificationsOptions
): UseNotificationsResult {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine if input is authToken (string | null) or options object
  const isLegacyMode = typeof authTokenOrOptions === 'string' || authTokenOrOptions === null;
  const authToken = isLegacyMode ? (authTokenOrOptions as string | null) : null;
  const options = !isLegacyMode && authTokenOrOptions
    ? (authTokenOrOptions as UseNotificationsOptions)
    : {};

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch notifications from API with caching
  const fetchNotificationsData = useCallback(async () => {
    setLoading(true);
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (options.page) params.set('page', String(options.page));
      if (options.pageSize) params.set('pageSize', String(options.pageSize));
      if (options.unreadOnly) params.set('unreadOnly', 'true');

      const result = await apiGet<NotificationsResponse>(
        `/notifications${params.toString() ? `?${params.toString()}` : ''}`
      );
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch notifications'));
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  }, [options.page, options.pageSize, options.unreadOnly]);

  // Connect to WebSocket for real-time updates (legacy mode with authToken)
  const connectWebSocket = useCallback(() => {
    if (!isLegacyMode || !authToken) return;

    try {
      const wsUrl = buildWebSocketUrl('/ws');

      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
      };

      ws.current.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          if (raw.type && raw.payload) {
            const notification: Notification = {
              id: `${raw.type}-${Date.now()}`,
              type: raw.type,
              title: raw.payload.title || raw.event || 'Notification',
              description:
                raw.payload.description ||
                raw.payload.message ||
                'No description',
              severity:
                (raw.payload.severity as 'info' | 'success' | 'warning' | 'error' | 'critical' | undefined) ||
                'info',
              timestamp: raw.payload.timestamp || new Date().toISOString(),
              read: false,
              link: raw.payload.link,
              data: raw.payload,
            };
            setNotifications((prev) => [notification, ...prev]);
            setUnreadCount((prev) => prev + 1);
            setTotal((prev) => prev + 1);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket notification:', err);
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        ws.current?.close();
      };
    } catch (err) {
      console.error('Failed to connect to WebSocket:', err);
    }
  }, [isLegacyMode, authToken]);

  // Initialize
  useEffect(() => {
    if (isLegacyMode) {
      // Legacy mode: use WebSocket
      fetchNotificationsData();
      connectWebSocket();

      // Auto-refresh every 60 seconds
      const interval = setInterval(() => {
        // ⚡ Bolt: Skip redundant HTTP polling if WebSocket is already connected and receiving real-time updates
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          return;
        }
        fetchNotificationsData();
      }, 1000 * 60);

      return () => {
        clearInterval(interval);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        if (ws.current) {
          ws.current.onclose = null; // Prevent reconnect after unmount
          ws.current.close();
          ws.current = null;
        }
      };
    } else {
      // New mode: fetch API data
      fetchNotificationsData();

      // Auto-refresh every 60 seconds
      const interval = setInterval(fetchNotificationsData, 1000 * 60);

      return () => clearInterval(interval);
    }
  }, [isLegacyMode, fetchNotificationsData, connectWebSocket]);

  // Action functions
  const markAsRead = useCallback(async (id: string | number) => {
    try {
      await apiPut(`/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await apiPut('/notifications/read-all', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, []);

  const dismissNotification = useCallback(async (id: string | number) => {
    try {
      await apiDelete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  }, []);

  const clearAll = useCallback(async () => {
    try {
      // Delete all notifications individually (or batch delete if API supports)
      const ids = notifications.map((n) => n.id);
      await Promise.all(ids.map((id) => apiDelete(`/notifications/${id}`)));
      setNotifications([]);
      setUnreadCount(0);
      setTotal(0);
    } catch (err) {
      console.error('Failed to clear all:', err);
    }
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    total,
    loading,
    isLoading,
    error,
    isConnected,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
    refresh: fetchNotificationsData,
  };
}

// Hook for fetching unread count
export function useUnreadCount(): UseUnreadCountResult {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiGet<UnreadCountResponse>(
          '/notifications/unread-count'
        );
        setUnreadCount(result.unreadCount);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('Failed to fetch unread count')
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Auto-refresh unread count every 60 seconds
    const interval = setInterval(fetchData, 1000 * 60);
    return () => clearInterval(interval);
  }, []);

  return { unreadCount, loading, error };
}

// Hook for realtime notifications via WebSocket
interface UseRealtimeNotificationsResult {
  isConnected: boolean;
}

export function useRealtimeNotifications(
  enabled: boolean = true
): UseRealtimeNotificationsResult {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const enabledRef = useRef(enabled);

  // Sync enabled state to ref (avoids accessing ref during render)
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const connect = useCallback(() => {
    if (!enabledRef.current) return;

    try {
      const wsUrl = buildWebSocketUrl('/ws');

      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setIsConnected(true);
      };

      socket.onclose = () => {
        setIsConnected(false);
        // Reconnect after 5 seconds (check if still enabled)
        setTimeout(() => {
          if (enabledRef.current && socketRef.current === null) {
            // Re-create WebSocket connection directly
            try {
              const wsUrl = buildWebSocketUrl('/ws');
              const newSocket = new WebSocket(wsUrl);
              newSocket.onopen = () => setIsConnected(true);
              newSocket.onclose = () => setIsConnected(false);
              newSocket.onmessage = (event) => {
                try {
                  const raw = JSON.parse(event.data);
                  const notification = validateNotification(raw);
                  if (!notification) return;
                  window.dispatchEvent(new CustomEvent('notification', { detail: notification }));
                } catch (err) {
                  console.error('Failed to parse WebSocket notification:', err);
                }
              };
              newSocket.onerror = () => newSocket.close();
              socketRef.current = newSocket;
            } catch (err) {
              console.error('Failed to reconnect WebSocket:', err);
            }
          }
        }, 5000);
      };

      socket.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          const notification = validateNotification(raw);
          if (!notification) return; // Drop invalid notifications silently
          // Dispatch custom event that components can listen to
          window.dispatchEvent(
            new CustomEvent('notification', { detail: notification })
          );
        } catch (err) {
          console.error('Failed to parse WebSocket notification:', err);
        }
      };

      socket.onerror = () => {
        socket.close();
      };

      socketRef.current = socket;
    } catch (err) {
      console.error('Failed to connect to WebSocket:', err);
    }
  }, []);  

  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.onclose = null; // Prevent reconnect after unmount
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect]);

  return { isConnected };
}

// CRUD functions that return promises
export async function markNotificationAsRead(id: string): Promise<void> {
  await apiPut(`/notifications/${id}/read`, {});
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await apiPut('/notifications/read-all', {});
}

export async function deleteNotification(id: string): Promise<void> {
  await apiDelete(`/notifications/${id}`);
}

export async function fetchNotifications(
  options: UseNotificationsOptions = {}
): Promise<NotificationsResponse> {
  const params = new URLSearchParams();
  if (options.page) params.set('page', String(options.page));
  if (options.pageSize) params.set('pageSize', String(options.pageSize));
  if (options.unreadOnly) params.set('unreadOnly', 'true');

  return apiGet<NotificationsResponse>(
    `/notifications${params.toString() ? `?${params.toString()}` : ''}`
  );
}
