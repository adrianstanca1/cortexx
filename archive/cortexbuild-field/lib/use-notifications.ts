/**
 * useNotifications — Push notification registration and local alert delivery
 * Handles: safety incidents, permit expirations, defect assignments, AI alerts
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpc } from '@/lib/trpc';

type NotificationsModule = typeof import('expo-notifications');
type DeviceModule = typeof import('expo-device');
type NotificationSubscription = { remove: () => void };

export type NotificationCategory =
  | 'safety'
  | 'permit'
  | 'defect'
  | 'timesheet'
  | 'ai'
  | 'system'
  | 'checkin';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

const NOTIFICATIONS_KEY = '@cortexbuild:notifications';
const TOKEN_KEY = '@cortexbuild:push_token';

let notificationsModulePromise: Promise<NotificationsModule> | null = null;
let deviceModulePromise: Promise<DeviceModule> | null = null;
let notificationHandlerConfigured = false;

async function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return null;
  notificationsModulePromise ??= import('expo-notifications').then(mod => {
    if (!notificationHandlerConfigured) {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      notificationHandlerConfigured = true;
    }
    return mod;
  });
  return notificationsModulePromise;
}

async function getDeviceModule(): Promise<DeviceModule | null> {
  if (Platform.OS === 'web') return null;
  deviceModulePromise ??= import('expo-device');
  return deviceModulePromise;
}

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const notificationListener = useRef<NotificationSubscription | null>(null);
  const responseListener = useRef<NotificationSubscription | null>(null);
  const registerTokenMutation = trpc.pushTokens.register.useMutation();

  useEffect(() => {
    loadStoredNotifications();
    registerForPushNotifications();
    if (Platform.OS !== 'web') {
      setupListeners();
    }
    schedulePermitExpiryChecks();

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
    // Mount-only side effect: register for push, attach listeners,
    // schedule reminders. The closure refs (`*.current`) are stable;
    // listing the helper functions would re-run setup every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStoredNotifications = async () => {
    try {
      const raw = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      if (raw) setNotifications(JSON.parse(raw));
    } catch { /* ignore */ }
  };

  const saveNotifications = async (updated: AppNotification[]) => {
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated.slice(0, 100)));
    } catch { /* ignore */ }
  };

  const registerForPushNotifications = async () => {
    if (Platform.OS === 'web') {
      setPermissionGranted(true);
      return;
    }

    const [Notifications, Device] = await Promise.all([
      getNotificationsModule(),
      getDeviceModule(),
    ]);
    if (!Notifications || !Device) {
      setPermissionGranted(false);
      return;
    }

    if (!Device.isDevice) {
      // Simulator — still allow local notifications
      setPermissionGranted(true);
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      setPermissionGranted(false);
      return;
    }

    setPermissionGranted(true);

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'cortexbuild-field',
      });
      setExpoPushToken(tokenData.data);
      await AsyncStorage.setItem(TOKEN_KEY, tokenData.data);
      // Register token with backend for server-side push delivery. Owner is
      // derived from the session on the server (ctx.user.id) — passing a
      // client-provided userId would be both redundant and a forging vector.
      const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
      registerTokenMutation.mutate({ token: tokenData.data, platform });
    } catch {
      // Token registration may fail in dev — that's fine for local notifications
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('safety', {
        name: 'Safety Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#EF4444',
        sound: 'default',
      });
      await Notifications.setNotificationChannelAsync('permits', {
        name: 'Permit Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#F97316',
        sound: 'default',
      });
      await Notifications.setNotificationChannelAsync('defects', {
        name: 'Defect Assignments',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#F59E0B',
        sound: 'default',
      });
      await Notifications.setNotificationChannelAsync('general', {
        name: 'General',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }
  };

  const setupListeners = async () => {
    const Notifications = await getNotificationsModule();
    if (!Notifications) return;

    // Notification received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const appNotif: AppNotification = {
        id: notification.request.identifier,
        category: (notification.request.content.data?.category as NotificationCategory) ?? 'system',
        title: notification.request.content.title ?? 'CortexBuild',
        body: notification.request.content.body ?? '',
        data: notification.request.content.data as Record<string, unknown>,
        read: false,
        createdAt: new Date().toISOString(),
        priority: (notification.request.content.data?.priority as AppNotification['priority']) ?? 'normal',
      };
      addNotification(appNotif);
    });

    // User tapped a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const id = response.notification.request.identifier;
      markRead(id);
    });
  };

  const addNotification = useCallback((notif: AppNotification) => {
    setNotifications(prev => {
      const updated = [notif, ...prev].slice(0, 100);
      saveNotifications(updated);
      return updated;
    });
  }, []);

  // ── Schedule a local push notification ────────────────────────────────────
  const scheduleLocalNotification = useCallback(async (
    title: string,
    body: string,
    category: NotificationCategory,
    priority: AppNotification['priority'] = 'normal',
    delaySeconds = 0,
    data?: Record<string, unknown>
  ) => {
    if (Platform.OS === 'web') {
      const id = `web_${Date.now()}`;
      addNotification({
        id,
        category,
        title,
        body,
        data,
        read: false,
        createdAt: new Date().toISOString(),
        priority,
      });
      return id;
    }

    const Notifications = await getNotificationsModule();
    if (!Notifications) return null;

    const channelMap: Record<NotificationCategory, string> = {
      safety: 'safety',
      permit: 'permits',
      defect: 'defects',
      timesheet: 'general',
      ai: 'general',
      system: 'general',
      checkin: 'general',
    };

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { category, priority, ...data },
          sound: priority === 'critical' || priority === 'high' ? 'default' : undefined,
          ...(Platform.OS === 'android' && { channelId: channelMap[category] }),
        },
        trigger: delaySeconds > 0
          ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySeconds }
          : null,
      });

      // Also add to in-app notification list
      const appNotif: AppNotification = {
        id,
        category,
        title,
        body,
        data,
        read: false,
        createdAt: new Date().toISOString(),
        priority,
      };
      addNotification(appNotif);
      return id;
    } catch {
      return null;
    }
  }, [addNotification]);

  // ── Domain-specific notification helpers ──────────────────────────────────
  const notifySafetyIncident = useCallback((incidentTitle: string, severity: string, location: string) => {
    const isCritical = severity === 'critical' || severity === 'high';
    return scheduleLocalNotification(
      isCritical ? `🚨 ${severity.toUpperCase()} Safety Incident` : '⚠️ Safety Incident Reported',
      `${incidentTitle} at ${location}. Immediate action required.`,
      'safety',
      isCritical ? 'critical' : 'high',
      0,
      { incidentTitle, severity, location }
    );
  }, [scheduleLocalNotification]);

  const notifyPermitExpiry = useCallback((permitTitle: string, expiresIn: string) => {
    return scheduleLocalNotification(
      '📋 Permit Expiring Soon',
      `"${permitTitle}" expires in ${expiresIn}. Renew before work continues.`,
      'permit',
      'high',
      0,
      { permitTitle, expiresIn }
    );
  }, [scheduleLocalNotification]);

  const notifyDefectAssigned = useCallback((defectTitle: string, assignedBy: string, priority: string) => {
    return scheduleLocalNotification(
      '🔧 Defect Assigned to You',
      `${assignedBy} assigned: "${defectTitle}" (${priority} priority)`,
      'defect',
      priority === 'critical' ? 'critical' : 'normal',
      0,
      { defectTitle, assignedBy, priority }
    );
  }, [scheduleLocalNotification]);

  const notifyCheckIn = useCallback((projectName: string, gpsVerified: boolean) => {
    return scheduleLocalNotification(
      gpsVerified ? '✅ Site Check-In Confirmed' : '⚠️ Check-In Recorded (Unverified)',
      `Checked in to ${projectName}. ${gpsVerified ? 'GPS location verified.' : 'GPS could not verify site location.'}`,
      'checkin',
      'normal',
      0,
      { projectName, gpsVerified }
    );
  }, [scheduleLocalNotification]);

  const notifyAIAlert = useCallback((title: string, message: string) => {
    return scheduleLocalNotification(
      `🤖 AI Alert: ${title}`,
      message,
      'ai',
      'normal',
      0
    );
  }, [scheduleLocalNotification]);

  // ── Schedule permit expiry checks (runs on app start) ─────────────────────
  const schedulePermitExpiryChecks = async () => {
    const Notifications = await getNotificationsModule();
    if (!Notifications) return;

    // In production this would check real permit data from backend
    // For now we schedule a demo reminder
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch { /* ignore */ }
  };

  // ── Read / unread management ───────────────────────────────────────────────
  const markRead = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    expoPushToken,
    permissionGranted,
    notifications,
    unreadCount,
    scheduleLocalNotification,
    notifySafetyIncident,
    notifyPermitExpiry,
    notifyDefectAssigned,
    notifyCheckIn,
    notifyAIAlert,
    markRead,
    markAllRead,
    clearAll,
  };
}
