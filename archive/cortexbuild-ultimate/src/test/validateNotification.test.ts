import { describe, it, expect } from 'vitest';
import {
  validateNotification,
  validateNotificationsResponse,
  validateNotificationSettings,
  safeValidateNotification,
} from '../lib/validateNotification';

describe('validateNotification', () => {
  it('validates a complete notification object', () => {
    const validNotification = {
      id: 'notif-1',
      type: 'project_update' as const,
      category: 'projects' as const,
      severity: 'info' as const,
      status: 'unread' as const,
      title: 'Project Updated',
      message: 'A new update is available',
      createdAt: '2026-04-02T10:00:00Z',
    };

    const result = validateNotification(validNotification);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('notif-1');
  });

  it('returns null for invalid notification', () => {
    const invalidNotification = {
      id: 'notif-1',
      // Missing required fields
    };

    const result = validateNotification(invalidNotification);
    expect(result).toBeNull();
  });

  it('validates notification with all optional fields', () => {
    const fullNotification = {
      id: 'notif-2',
      type: 'safety_incident' as const,
      category: 'safety' as const,
      severity: 'critical' as const,
      status: 'unread' as const,
      title: 'Safety Incident',
      message: 'Incident reported on site',
      description: 'Detailed description here',
      relatedItem: {
        type: 'project' as const,
        id: 'proj-123',
        title: 'Project Alpha',
        url: 'https://example.com/projects/proj-123',
      },
      actions: [
        {
          type: 'navigate' as const,
          label: 'View Details',
          url: 'https://example.com/projects/proj-123',
        },
      ],
      fromUser: {
        id: 'user-1',
        name: 'John Doe',
        role: 'admin' as const,
      },
      createdAt: '2026-04-02T10:00:00Z',
      readAt: '2026-04-02T11:00:00Z',
      metadata: {
        projectId: 'proj-123',
        priority: 'high' as const,
      },
    };

    const result = validateNotification(fullNotification);
    expect(result).not.toBeNull();
    expect(result?.relatedItem?.type).toBe('project');
    expect(result?.actions?.length).toBe(1);
  });

  it('rejects notification with invalid severity', () => {
    const invalidNotification = {
      id: 'notif-1',
      type: 'project_update' as const,
      category: 'projects' as const,
      severity: 'invalid-severity',
      status: 'unread' as const,
      title: 'Test',
      message: 'Test message',
      createdAt: '2026-04-02T10:00:00Z',
    };

    const result = validateNotification(invalidNotification);
    expect(result).toBeNull();
  });

  it('rejects notification with invalid URL in relatedItem', () => {
    const invalidNotification = {
      id: 'notif-1',
      type: 'project_update' as const,
      category: 'projects' as const,
      severity: 'info' as const,
      status: 'unread' as const,
      title: 'Test',
      message: 'Test message',
      createdAt: '2026-04-02T10:00:00Z',
      relatedItem: {
        type: 'project' as const,
        id: 'proj-123',
        title: 'Project',
        url: 'not-a-valid-url',
      },
    };

    const result = validateNotification(invalidNotification);
    expect(result).toBeNull();
  });
});

describe('validateNotificationsResponse', () => {
  it('validates a complete API response', () => {
    const validResponse = {
      notifications: [
        {
          id: 'notif-1',
          type: 'project_update' as const,
          category: 'projects' as const,
          severity: 'info' as const,
          status: 'unread' as const,
          title: 'Update',
          message: 'Message',
          createdAt: '2026-04-02T10:00:00Z',
        },
      ],
      unreadCount: 1,
      total: 1,
      hasMore: false,
    };

    const result = validateNotificationsResponse(validResponse);
    expect(result).not.toBeNull();
    expect(result?.notifications.length).toBe(1);
    expect(result?.unreadCount).toBe(1);
  });

  it('rejects response with invalid notification', () => {
    const invalidResponse = {
      notifications: [
        {
          id: 'notif-1',
          // Missing required fields
        },
      ],
      unreadCount: 1,
      total: 1,
      hasMore: false,
    };

    const result = validateNotificationsResponse(invalidResponse);
    expect(result).toBeNull();
  });

  it('rejects response with invalid unreadCount', () => {
    const invalidResponse = {
      notifications: [],
      unreadCount: -1,
      total: 0,
      hasMore: false,
    };

    const result = validateNotificationsResponse(invalidResponse);
    expect(result).toBeNull();
  });
});

describe('validateNotificationSettings', () => {
  it('validates complete settings object', () => {
    const validSettings = {
      emailNotifications: true,
      pushNotifications: true,
      soundAlerts: true,
      browserNotifications: false,
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '07:00',
        timezone: 'Europe/London',
      },
      digestFrequency: 'daily' as const,
      categoryPreferences: {
        project_update: true,
        task_assignment: true,
        rfi_response: true,
        safety_incident: true,
        document_upload: true,
        meeting_reminder: true,
        team_mention: true,
        system_alert: true,
        approval_request: true,
        deadline_warning: true,
        budget_alert: true,
        change_order: true,
        inspection_scheduled: true,
        material_delivery: true,
        timesheet_approval: true,
        subcontractor_update: true,
      },
    };

    const result = validateNotificationSettings(validSettings);
    expect(result).not.toBeNull();
    expect(result?.emailNotifications).toBe(true);
  });

  it('rejects settings with invalid quietHours time format', () => {
    const invalidSettings = {
      emailNotifications: true,
      pushNotifications: true,
      soundAlerts: true,
      browserNotifications: false,
      quietHours: {
        enabled: false,
        startTime: '10pm', // Invalid format
        endTime: '07:00',
        timezone: 'Europe/London',
      },
      digestFrequency: 'daily' as const,
      categoryPreferences: {
        project_update: true,
        task_assignment: true,
        rfi_response: true,
        safety_incident: true,
        document_upload: true,
        meeting_reminder: true,
        team_mention: true,
        system_alert: true,
        approval_request: true,
        deadline_warning: true,
        budget_alert: true,
        change_order: true,
        inspection_scheduled: true,
        material_delivery: true,
        timesheet_approval: true,
        subcontractor_update: true,
      },
    };

    const result = validateNotificationSettings(invalidSettings);
    expect(result).toBeNull();
  });

  it('rejects settings with invalid digestFrequency', () => {
    const invalidSettings = {
      emailNotifications: true,
      pushNotifications: true,
      soundAlerts: true,
      browserNotifications: false,
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '07:00',
        timezone: 'Europe/London',
      },
      digestFrequency: 'invalid',
      categoryPreferences: {
        project_update: true,
        task_assignment: true,
        rfi_response: true,
        safety_incident: true,
        document_upload: true,
        meeting_reminder: true,
        team_mention: true,
        system_alert: true,
        approval_request: true,
        deadline_warning: true,
        budget_alert: true,
        change_order: true,
        inspection_scheduled: true,
        material_delivery: true,
        timesheet_approval: true,
        subcontractor_update: true,
      },
    };

    const result = validateNotificationSettings(invalidSettings);
    expect(result).toBeNull();
  });
});

describe('safeValidateNotification', () => {
  it('returns validated notification for valid input', () => {
    const validNotification = {
      id: 'notif-1',
      type: 'project_update' as const,
      category: 'projects' as const,
      severity: 'info' as const,
      status: 'unread' as const,
      title: 'Test',
      message: 'Test message',
      createdAt: '2026-04-02T10:00:00Z',
    };

    const result = safeValidateNotification(validNotification);
    expect(result).not.toBeNull();
  });

  it('returns partial notification with defaults in non-strict mode', () => {
    const partialNotification = {
      id: 'notif-1',
      title: 'Test',
      // Missing other required fields
    };

    const result = safeValidateNotification(partialNotification, { strict: false });
    expect(result).not.toBeNull();
    expect(result?.type).toBe('system_alert'); // Default value
    expect(result?.severity).toBe('info'); // Default value
  });

  it('returns null for invalid input in strict mode', () => {
    const partialNotification = {
      id: 'notif-1',
      title: 'Test',
      // Missing other required fields
    };

    const result = safeValidateNotification(partialNotification, { strict: true });
    expect(result).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(safeValidateNotification(null)).toBeNull();
    expect(safeValidateNotification('string')).toBeNull();
    expect(safeValidateNotification(123)).toBeNull();
  });

  it('returns partial notification with defaults for wrong-type inputs', () => {
    const wrongTypeInput = {
      id: 123, // should be string
      title: 'Test',
      severity: 'invalid', // should be valid enum
    };

    const result = safeValidateNotification(wrongTypeInput, { strict: false });
    expect(result).not.toBeNull();
    // Zod validation fails for wrong types, so safeValidate falls back to defaults
    // Since id=123 is provided (even if wrong type), it's used as-is in fallback
    expect(result?.title).toBe('Test');
    expect(result?.type).toBe('system_alert'); // Default value
  });
});
