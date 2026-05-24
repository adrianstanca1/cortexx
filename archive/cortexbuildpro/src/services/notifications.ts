// CortexBuild Pro — Notification Service
// Push notification handling (future: Expo Notifications)

import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import type { Notification } from "@/types";
import { generateId } from "@/utils/helpers";

export function sendLocalNotification(
  title: string,
  body?: string,
  type: Notification["type"] = "system",
  data?: Record<string, any>
): void {
  const userId = useAuthStore.getState().user?.id ?? "";
  if (!userId) {
    console.warn("[Notification] No user logged in, skipping local notification");
    return;
  }
  const notification: Notification = {
    id: generateId("notif"),
    userId,
    title,
    body,
    type,
    read: false,
    data,
    createdAt: new Date().toISOString(),
  };

  useNotificationStore.getState().addNotification(notification);
}

export function requestPushPermissions(): Promise<boolean> {
  // Future: expo-notifications.requestPermissionsAsync()
  return Promise.resolve(false);
}
