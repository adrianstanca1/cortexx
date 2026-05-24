import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { PreferenceRow } from './PreferenceRow';
import { ChannelHeader } from './ChannelHeader';
import { API_BASE } from '../../lib/auth-storage';

export interface NotificationPreference {
  type: string;
  label: string;
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreference[] = [
  { type: 'safety_alerts',    label: 'Safety Alerts',      email: true,  push: true,  sms: true,  inApp: true },
  { type: 'project_updates',  label: 'Project Updates',    email: true,  push: true,  sms: false, inApp: true },
  { type: 'budget_alerts',    label: 'Budget Alerts',      email: true,  push: true,  sms: false, inApp: true },
  { type: 'task_assignments', label: 'Task Assignments',   email: false, push: true,  sms: false, inApp: true },
  { type: 'document_changes', label: 'Document Changes',   email: false, push: false, sms: false, inApp: true },
  { type: 'meeting_reminders',label: 'Meeting Reminders',  email: true,  push: true,  sms: true,  inApp: true },
];

export function NotificationPreferences({ onClose }: { onClose?: () => void }) {
  const [preferences, setPreferences] = useState<NotificationPreference[]>(DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/auth/preferences`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then((data: NotificationPreference[] | null) => {
        if (Array.isArray(data) && data.length > 0) setPreferences(data);
      })
      .catch(e => console.warn('[NotificationPreferences] failed to load:', e));
  }, []);

  const updatePreference = (type: string, channel: keyof Omit<NotificationPreference, 'type' | 'label'>, value: boolean) => {
    setPreferences(prev =>
      prev.map(p => (p.type === type ? { ...p, [channel]: value } : p))
    );
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/auth/preferences`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Notification preferences saved');
      onClose?.();
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Notification preferences"
    >
      <div
        className="bg-base-100 rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-base-300 flex items-center justify-between">
          <h2 className="text-lg font-bold">Notification Preferences</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="btn btn-sm btn-ghost btn-circle"
              aria-label="Close preferences"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Preferences Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Notification Type</th>
                <ChannelHeader channel="push" label="Push" />
                <ChannelHeader channel="email" label="Email" />
                <ChannelHeader channel="sms" label="SMS" />
                <ChannelHeader channel="inApp" label="In-App" />
              </tr>
            </thead>
            <tbody>
              {preferences.map(pref => (
                <PreferenceRow
                  key={pref.type}
                  preference={pref}
                  updatePreference={updatePreference}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-base-300 flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button
            onClick={savePreferences}
            className="btn btn-primary"
            aria-label="Save notification preferences"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
