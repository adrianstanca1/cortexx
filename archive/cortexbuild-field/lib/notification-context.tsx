/**
 * NotificationContext — Global notification state provider
 * Wraps useNotifications and exposes it to all screens
 */
import React, { createContext, useContext, type ReactNode } from 'react';
import { useNotifications } from './use-notifications';
export type { AppNotification, NotificationCategory } from './use-notifications';

type NotificationContextType = ReturnType<typeof useNotifications>;

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const notifications = useNotifications();
  return (
    <NotificationContext.Provider value={notifications}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext(): NotificationContextType {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotificationContext must be used within NotificationProvider');
  return ctx;
}
