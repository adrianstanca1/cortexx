import { z } from 'zod';
import {
  notificationSchema,
  notificationsResponseSchema,
  notificationSettingsSchema,
} from './validations';
import type {
  Notification,
  NotificationsResponse,
  NotificationSettings,
} from '@/types/notification';

/**
 * Runtime validation utilities for notification data
 * Use these to validate API responses before using the data
 */

export class ValidationError extends Error {
  constructor(
    public field: string,
    public expected: string,
    public actual: unknown
  ) {
    super(`Validation failed for ${field}: expected ${expected}, got ${JSON.stringify(actual)}`);
    this.name = 'ValidationError';
  }
}

/**
 * Validate a single notification object
 * @param data - Raw notification data from API
 * @returns Validated notification or null if invalid
 */
export function validateNotification(data: unknown): Notification | null {
  try {
    return notificationSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Notification validation failed:', error.issues);
      return null;
    }
    throw error;
  }
}

/**
 * Validate notifications API response
 * @param data - Raw API response data
 * @returns Validated response or null if invalid
 */
export function validateNotificationsResponse(data: unknown): NotificationsResponse | null {
  try {
    return notificationsResponseSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Notifications response validation failed:', error.issues);
      return null;
    }
    throw error;
  }
}

/**
 * Validate notification settings
 * @param data - Raw settings data
 * @returns Validated settings or null if invalid
 */
export function validateNotificationSettings(data: unknown): NotificationSettings | null {
  try {
    return notificationSettingsSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Notification settings validation failed:', error.issues);
      return null;
    }
    throw error;
  }
}

/**
 * Validate and transform API response with fallback defaults
 * @param data - Raw API response
 * @param options - Validation options
 * @returns Validated data with defaults applied for missing optional fields
 */
export function safeValidateNotification(
  data: unknown,
  options?: { strict?: boolean }
): Notification | null {
  const strict = options?.strict ?? false;

  if (!data || typeof data !== 'object') {
    return null;
  }

  const result = notificationSchema.safeParse(data);

  if (!result.success) {
    if (strict) {
      console.error('Strict notification validation failed:', result.error.issues);
      return null;
    }

    // Try to extract what we can with partial validation
    const partial = data as Partial<Notification>;
    return {
      id: partial.id || `unknown-${Date.now()}`,
      type: partial.type || 'system_alert',
      category: partial.category || 'all',
      severity: partial.severity || 'info',
      status: partial.status || 'unread',
      title: partial.title || 'Notification',
      message: partial.message || '',
      createdAt: partial.createdAt || new Date().toISOString(),
      description: partial.description,
      relatedItem: partial.relatedItem,
      actions: partial.actions,
      fromUser: partial.fromUser,
      readAt: partial.readAt,
      archivedAt: partial.archivedAt,
      snoozedUntil: partial.snoozedUntil,
      metadata: partial.metadata,
    } as Notification;
  }

  return result.data;
}
