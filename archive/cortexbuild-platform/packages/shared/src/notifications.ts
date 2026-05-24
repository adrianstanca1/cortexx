import type { NotificationEvent, NotificationType } from './types';

export const NOTIFICATION_EVENTS: Record<string, { title: string; body: string; type: NotificationType }> = {
  task_assigned:           { title:'New task assigned',           body: 'You have been assigned a new task',         type: 'task' },
  task_completed:          { title:'Task completed',               body: 'A task has been completed',                  type: 'task' },
  task_overdue:            { title:'Task overdue',               body: 'A task is overdue',                          type: 'task' },
  incident_reported:       { title:'Safety incident reported',   body: 'A safety incident has been reported',      type: 'safety' },
  incident_critical:       { title:'Critical incident',          body: 'A critical safety incident requires action', type: 'safety' },
  inspection_failed:       { title:'Inspection failed',          body: 'An inspection has failed',                   type: 'safety' },
  inspection_due:          { title:'Inspection due',             body: 'An inspection is due soon',                  type: 'safety' },
  defect_assigned:         { title:'Defect assigned',            body: 'A defect has been assigned to you',          type: 'defect' },
  defect_resolved:         { title:'Defect resolved',              body: 'A defect has been resolved',                 type: 'defect' },
  rfi_response:            { title:'RFI response received',      body: 'You have received an RFI response',          type: 'project' },
  document_uploaded:       { title:'Document uploaded',          body: 'A new document has been uploaded',         type: 'project' },
  invoice_overdue:         { title:'Invoice overdue',              body: 'An invoice is overdue',                      type: 'project' },
  project_status_change:   { title:'Project status changed',      body: 'A project status has been updated',        type: 'project' },
  mention:                 { title:'You were mentioned',           body: 'Someone mentioned you in a comment',       type: 'mention' },
};

export function buildNotification(eventKey: string, params: Record<string,string> = {}): Partial<NotificationEvent> {
  const template = NOTIFICATION_EVENTS[eventKey];
  if (!template) return { title: 'Notification', body: '', type: 'general' };
  return {
    title: Object.entries(params).reduce((s, [k, v]) => s.replace(`{{${k}}}`, v), template.title),
    body:  Object.entries(params).reduce((s, [k, v]) => s.replace(`{{${k}}}`, v), template.body),
    type: template.type,
  };
}
