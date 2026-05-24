import { describe, it, expect } from 'vitest';
import {
  rfiSchema,
  changeOrderSchema,
  dailyReportSchema,
  safetyReportSchema,
  notificationQuietHoursSchema,
  notificationCategoryPreferencesSchema,
  notificationSchema
} from '../lib/validations';

describe('Validations', () => {
  describe('rfiSchema', () => {
    it('should validate a complete RFI payload', () => {
      const payload = {
        number: 'RFI-001',
        subject: 'Ceiling Height',
        question: 'What is the exact ceiling height in the lobby?',
        context: 'Need this for the chandelier installation',
        priority: 'high',
        status: 'open',
        dueDate: '2023-12-01T12:00:00Z'
      };
      const result = rfiSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should assign default values for optional/default fields', () => {
      const payload = {
        number: 'RFI-002',
        subject: 'Floor material',
        question: 'Is it hardwood or laminate?'
      };
      const result = rfiSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe('medium');
        expect(result.data.status).toBe('open');
      }
    });

    it('should fail if required fields are missing', () => {
      const payload = {
        subject: 'Missing number and question'
      };
      const result = rfiSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe('changeOrderSchema', () => {
    it('should validate a complete Change Order payload', () => {
      const payload = {
        number: 'CO-001',
        title: 'Add Extra Outlets',
        description: 'Adding 4 more power outlets in the kitchen',
        proposedChangeAmount: 1500,
        status: 'pending',
        category: 'scope',
        justification: 'Requested by owner',
        scheduleImpactDays: 2,
        budgetImpactAmount: 1500
      };
      const result = changeOrderSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should fail if proposedChangeAmount is negative', () => {
      const payload = {
        number: 'CO-002',
        title: 'Negative Amount',
        proposedChangeAmount: -500,
        justification: 'Refund'
      };
      const result = changeOrderSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.message === 'Amount must be non-negative')).toBe(true);
      }
    });

    it('should set default values correctly', () => {
      const payload = {
        number: 'CO-003',
        title: 'Defaults',
        proposedChangeAmount: 0,
        justification: 'Testing defaults'
      };
      const result = changeOrderSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('pending');
        expect(result.data.category).toBe('scope');
      }
    });
  });

  describe('dailyReportSchema', () => {
    it('should validate a complete Daily Report payload', () => {
      const payload = {
        date: '2023-11-15T08:00:00Z',
        projectId: 'proj-123',
        weather: 'Sunny',
        temperature: '75F',
        humidity: '40%',
        workforce: [{ trade: 'Carpenter', count: 5, hours: 40 }],
        equipment: [{ name: 'Excavator', hours: 8, status: 'operational' }],
        materials: [{ name: 'Lumber', quantity: '100', unit: 'boards', delivered: true }],
        progress: [{ description: 'Framing completed', percentComplete: 100 }],
        issues: [{ type: 'delay', description: 'Rain delay', impact: 'low' }],
        notes: 'Good progress today'
      };
      const result = dailyReportSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should validate with minimal fields and assign empty arrays for defaults', () => {
      const payload = {
        date: '2023-11-15T08:00:00Z',
        projectId: 'proj-123'
      };
      const result = dailyReportSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.workforce).toEqual([]);
        expect(result.data.equipment).toEqual([]);
        expect(result.data.materials).toEqual([]);
        expect(result.data.progress).toEqual([]);
        expect(result.data.issues).toEqual([]);
      }
    });

    it('should fail if nested array elements have invalid data', () => {
      const payload = {
        date: '2023-11-15T08:00:00Z',
        projectId: 'proj-123',
        workforce: [{ trade: 'Plumber', count: -1, hours: 8 }] // count must be non-negative
      };
      const result = dailyReportSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('safetyReportSchema', () => {
    it('should validate a complete Safety Report payload', () => {
      const payload = {
        title: 'Slip and Fall',
        description: 'Worker slipped on wet floor',
        type: 'incident',
        date: '2023-10-10T14:30:00Z',
        projectId: 'proj-456',
        location: 'Lobby',
        severity: 'minor',
        status: 'resolved',
        witnesses: ['John Doe', 'Jane Smith'],
        estimatedCost: 500,
        scheduleImpact: 0
      };
      const result = safetyReportSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should fail if missing required fields', () => {
      const payload = {
        title: 'Missing stuff'
        // missing description, type, date, projectId
      };
      const result = safetyReportSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('Notification Schemas', () => {
    it('notificationQuietHoursSchema validates correct time formats', () => {
      const valid = notificationQuietHoursSchema.safeParse({
        enabled: true,
        startTime: '22:00',
        endTime: '06:00',
        timezone: 'America/New_York'
      });
      expect(valid.success).toBe(true);

      const invalid = notificationQuietHoursSchema.safeParse({
        enabled: true,
        startTime: '10 PM', // invalid format
        endTime: '06:00',
        timezone: 'America/New_York'
      });
      expect(invalid.success).toBe(false);
    });

    it('notificationCategoryPreferencesSchema validates correct booleans', () => {
      const valid = notificationCategoryPreferencesSchema.safeParse({
        project_update: true,
        task_assignment: false,
        rfi_response: true,
        safety_incident: true,
        document_upload: false,
        meeting_reminder: true,
        team_mention: true,
        system_alert: false,
        approval_request: true,
        deadline_warning: true,
        budget_alert: false,
        change_order: true,
        inspection_scheduled: false,
        material_delivery: true,
        timesheet_approval: false,
        subcontractor_update: true
      });
      expect(valid.success).toBe(true);
    });

    it('notificationSchema validates a complete notification', () => {
      const payload = {
        id: 'notif-001',
        type: 'project_update',
        category: 'projects',
        severity: 'info',
        status: 'unread',
        title: 'Project Started',
        message: 'The new building project has officially started.',
        createdAt: '2023-11-01T09:00:00Z',
        metadata: {
          projectId: 'p-123',
          projectName: 'Downtown Highrise'
        }
      };
      const result = notificationSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });
});
