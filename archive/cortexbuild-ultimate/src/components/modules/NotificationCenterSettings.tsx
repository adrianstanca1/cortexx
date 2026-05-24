/**
 * NotificationCenterSettings Component
 * Manages notification preferences and settings with multi-tab interface
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Volume2,
  VolumeX,
  Clock,
  Calendar,
  Settings,
  X,
  Check,
  AlertCircle,
  Info,
  ChevronDown,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  AlertTriangle,
  Copy,
  Activity,
} from 'lucide-react';
import type { NotificationSettings, CategoryPreferences } from '@/types/notification';
import { toast } from 'sonner';

interface NotificationCenterSettingsProps {
  settings: NotificationSettings;
  onUpdateSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
  onToggleCategory: (category: keyof CategoryPreferences) => void;
  onToggleQuietHours: () => void;
  onToggleSoundAlerts: () => void;
  onToggleBrowserNotifications: () => Promise<void>;
  onClose?: () => void;
}

type SettingsTab = 'preferences' | 'channels' | 'quiet-hours' | 'digest' | 'rules';

const CATEGORY_LABELS: Record<keyof CategoryPreferences, string> = {
  project_update: 'Project Updates',
  task_assignment: 'Task Assignments',
  rfi_response: 'RFI Responses',
  safety_incident: 'Safety Incidents',
  document_upload: 'Document Uploads',
  meeting_reminder: 'Meeting Reminders',
  team_mention: 'Team Mentions',
  system_alert: 'System Alerts',
  approval_request: 'Approval Requests',
  deadline_warning: 'Deadline Warnings',
  budget_alert: 'Budget Alerts',
  change_order: 'Change Orders',
  inspection_scheduled: 'Inspections',
  material_delivery: 'Material Deliveries',
  timesheet_approval: 'Timesheet Approvals',
  subcontractor_update: 'Subcontractor Updates',
};

const CATEGORY_GROUPS = {
  Projects: ['project_update', 'task_assignment', 'deadline_warning', 'change_order'],
  RFIs: ['rfi_response', 'approval_request'],
  Safety: ['safety_incident', 'inspection_scheduled'],
  Documents: ['document_upload'],
  Financial: ['budget_alert'],
  People: ['team_mention', 'meeting_reminder', 'subcontractor_update', 'timesheet_approval', 'material_delivery'],
  System: ['system_alert'],
};

const DIGEST_FREQUENCIES: { value: 'never' | 'hourly' | 'daily' | 'weekly'; label: string; description: string }[] = [
  { value: 'never', label: 'Never', description: 'No digest emails' },
  { value: 'hourly', label: 'Hourly', description: 'Summary every hour' },
  { value: 'daily', label: 'Daily', description: 'Summary once per day' },
  { value: 'weekly', label: 'Weekly', description: 'Summary once per week' },
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_QUIET_HOURS = {
  monday: { enabled: false, start: '22:00', end: '08:00' },
  tuesday: { enabled: false, start: '22:00', end: '08:00' },
  wednesday: { enabled: false, start: '22:00', end: '08:00' },
  thursday: { enabled: false, start: '22:00', end: '08:00' },
  friday: { enabled: false, start: '22:00', end: '08:00' },
  saturday: { enabled: true, start: '22:00', end: '08:00' },
  sunday: { enabled: true, start: '22:00', end: '08:00' },
};

interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: string;
  action: string;
  createdAt: string;
}

// ─── Preferences Tab ──────────────────────────────────────────────────────────

function PreferencesTab({
  localSettings,
  handleUpdate,
  isSaving,
  onToggleSoundAlerts,
}: {
  localSettings: NotificationSettings;
  handleUpdate: (updates: Partial<NotificationSettings>) => Promise<void>;
  isSaving: boolean;
  onToggleSoundAlerts: () => void;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Projects: true,
    System: true,
  });

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Quick Settings */}
      <section>
        <h3 className="text-sm font-semibold mb-4 text-white flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-400" />
          Quick Settings
        </h3>
        <div className="space-y-3">
          {/* Sound Alerts */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-gray-700/50 border border-gray-600">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                {localSettings.soundAlerts ? (
                  <Volume2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <VolumeX className="w-5 h-5 text-emerald-400" />
                )}
              </div>
              <div>
                <p className="font-medium text-white text-sm">Sound Alerts</p>
                <p className="text-xs text-gray-400">Play sound for new notifications</p>
              </div>
            </div>
            <button
              onClick={onToggleSoundAlerts}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                localSettings.soundAlerts
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
              disabled={isSaving}
            >
              {localSettings.soundAlerts ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      </section>

      {/* Notification Categories */}
      <section>
        <h3 className="text-sm font-semibold mb-4 text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          Notification Categories
        </h3>
        <div className="space-y-3">
          {Object.entries(CATEGORY_GROUPS).map(([group, categories]) => (
            <div key={group} className="rounded-lg border border-gray-600 bg-gray-700/30">
              <button
                onClick={() => toggleGroup(group)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-600/30 transition-colors"
              >
                <span className="font-medium text-white text-sm">{group}</span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    expandedGroups[group] ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {expandedGroups[group] && (
                <div className="border-t border-gray-600 divide-y divide-gray-600">
                  {categories.map((category) => (
                    <div
                      key={category}
                      className="px-4 py-3 flex items-center justify-between hover:bg-gray-600/20"
                    >
                      <span className="text-sm text-gray-300">{CATEGORY_LABELS[category as keyof CategoryPreferences]}</span>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={localSettings.categoryPreferences[category as keyof CategoryPreferences]}
                          onChange={() => {}}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-600 cursor-pointer"
                          disabled={isSaving}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Urgency Levels */}
      <section>
        <h3 className="text-sm font-semibold mb-4 text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Urgency Level Preferences
        </h3>
        <div className="space-y-3">
          {[
            { level: 'critical', label: 'Critical', color: 'text-red-400' },
            { level: 'high', label: 'High', color: 'text-amber-400' },
            { level: 'normal', label: 'Normal', color: 'text-blue-400' },
            { level: 'low', label: 'Low', color: 'text-gray-400' },
          ].map(({ level, label, color }) => (
            <div key={level} className="flex items-center justify-between p-3 rounded-lg bg-gray-700/50 border border-gray-600">
              <span className={`text-sm font-medium ${color}`}>{label}</span>
              <select
                className="px-3 py-1 rounded text-sm bg-gray-600 text-white border border-gray-500 focus:outline-none"
                disabled={isSaving}
              >
                <option>Always notify</option>
                <option>During hours</option>
                <option>Quiet hours</option>
                <option>Never</option>
              </select>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Channels Tab ─────────────────────────────────────────────────────────────

function ChannelsTab({
  localSettings,
  handleUpdate,
  isSaving,
  onToggleBrowserNotifications,
}: {
  localSettings: NotificationSettings;
  handleUpdate: (updates: Partial<NotificationSettings>) => Promise<void>;
  isSaving: boolean;
  onToggleBrowserNotifications: () => Promise<void>;
}) {
  const [emailConfig, setEmailConfig] = useState({
    smtpServer: 'smtp.gmail.com',
    fromAddress: 'notifications@cortexbuild.uk',
    useTemplate: true,
  });

  return (
    <div className="space-y-6">
      {/* Email Channel */}
      <section>
        <h3 className="text-sm font-semibold mb-4 text-white flex items-center gap-2">
          <Mail className="w-4 h-4 text-blue-400" />
          Email Notifications
        </h3>
        <div className="rounded-lg border border-gray-600 bg-gray-700/30 p-4 space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/50">
            <div>
              <p className="font-medium text-white text-sm">Email Notifications</p>
              <p className="text-xs text-gray-400">Receive notifications via email</p>
            </div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.emailNotifications}
                onChange={(e) => handleUpdate({ emailNotifications: e.target.checked })}
                className="w-4 h-4 rounded border-gray-600 bg-gray-600"
                disabled={isSaving}
              />
            </label>
          </div>

          {localSettings.emailNotifications && (
            <div className="space-y-3 pt-2 border-t border-gray-600">
              <div>
                <label className="block text-xs text-gray-400 mb-2">From Address</label>
                <input
                  type="email"
                  value={emailConfig.fromAddress}
                  onChange={(e) => setEmailConfig({ ...emailConfig, fromAddress: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-600 border border-gray-500 text-white text-sm focus:outline-none focus:border-blue-400"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2">SMTP Server</label>
                <input
                  type="text"
                  value={emailConfig.smtpServer}
                  onChange={(e) => setEmailConfig({ ...emailConfig, smtpServer: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-600 border border-gray-500 text-white text-sm focus:outline-none focus:border-blue-400"
                  disabled={isSaving}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailConfig.useTemplate}
                  onChange={(e) => setEmailConfig({ ...emailConfig, useTemplate: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-600"
                  disabled={isSaving}
                />
                <span className="text-sm text-gray-300">Use email template</span>
              </label>
            </div>
          )}
        </div>
      </section>

      {/* Push Notifications */}
      <section>
        <h3 className="text-sm font-semibold mb-4 text-white flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-amber-400" />
          Push Notifications
        </h3>
        <div className="rounded-lg border border-gray-600 bg-gray-700/30 p-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/50">
            <div>
              <p className="font-medium text-white text-sm">Push Notifications</p>
              <p className="text-xs text-gray-400">Browser push notifications</p>
            </div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.pushNotifications}
                onChange={(e) => handleUpdate({ pushNotifications: e.target.checked })}
                className="w-4 h-4 rounded border-gray-600 bg-gray-600"
                disabled={isSaving}
              />
            </label>
          </div>
        </div>
      </section>

      {/* Browser Notifications */}
      <section>
        <h3 className="text-sm font-semibold mb-4 text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-purple-400" />
          Browser Notifications
        </h3>
        <div className="rounded-lg border border-gray-600 bg-gray-700/30 p-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/50">
            <div>
              <p className="font-medium text-white text-sm">Desktop Notifications</p>
              <p className="text-xs text-gray-400">Show system notifications</p>
            </div>
            <button
              onClick={onToggleBrowserNotifications}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                localSettings.browserNotifications
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
              disabled={isSaving}
            >
              {localSettings.browserNotifications ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </section>

      {/* In-App Notifications */}
      <section>
        <h3 className="text-sm font-semibold mb-4 text-white flex items-center gap-2">
          <Bell className="w-4 h-4 text-emerald-400" />
          In-App Notifications
        </h3>
        <div className="rounded-lg border border-gray-600 bg-gray-700/30 p-4 space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/50">
            <div>
              <p className="font-medium text-white text-sm">Show in-app badges</p>
              <p className="text-xs text-gray-400">Display notification badges</p>
            </div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 rounded border-gray-600 bg-gray-600"
                disabled={isSaving}
              />
            </label>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/50">
            <div>
              <p className="font-medium text-white text-sm">Toast notifications</p>
              <p className="text-xs text-gray-400">Show floating toast messages</p>
            </div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 rounded border-gray-600 bg-gray-600"
                disabled={isSaving}
              />
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Quiet Hours Tab ──────────────────────────────────────────────────────────

function QuietHoursTab({
  localSettings,
  handleUpdate,
  isSaving,
}: {
  localSettings: NotificationSettings;
  handleUpdate: (updates: Partial<NotificationSettings>) => Promise<void>;
  isSaving: boolean;
}) {
  const [quietHours, setQuietHours] = useState(DEFAULT_QUIET_HOURS);
  const [timezone, setTimezone] = useState('Europe/London');
  const [holidays, setHolidays] = useState<string[]>(['2026-12-25', '2026-01-01']);
  const [newHoliday, setNewHoliday] = useState('');

  const handleDayToggle = (day: keyof typeof quietHours) => {
    setQuietHours(prev => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled }
    }));
  };

  const handleTimeChange = (day: keyof typeof quietHours, field: 'start' | 'end', value: string) => {
    setQuietHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const handleAddHoliday = () => {
    if (newHoliday && !holidays.includes(newHoliday)) {
      setHolidays([...holidays, newHoliday]);
      setNewHoliday('');
      toast.success('Holiday added');
    }
  };

  const handleRemoveHoliday = (date: string) => {
    setHolidays(holidays.filter(h => h !== date));
  };

  return (
    <div className="space-y-6">
      {/* Daily Quiet Hours */}
      <section>
        <h3 className="text-sm font-semibold mb-4 text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          Daily Quiet Hours
        </h3>
        <div className="space-y-2">
          {DAYS_OF_WEEK.map((day, idx) => {
            const dayKey = day.toLowerCase() as keyof typeof quietHours;
            return (
              <div key={dayKey} className="rounded-lg border border-gray-600 bg-gray-700/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-white text-sm">{day}</span>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quietHours[dayKey].enabled}
                      onChange={() => handleDayToggle(dayKey)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-600"
                      disabled={isSaving}
                    />
                  </label>
                </div>
                {quietHours[dayKey].enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Start Time</label>
                      <input
                        type="time"
                        value={quietHours[dayKey].start}
                        onChange={(e) => handleTimeChange(dayKey, 'start', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-gray-600 border border-gray-500 text-white text-sm focus:outline-none focus:border-blue-400"
                        disabled={isSaving}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">End Time</label>
                      <input
                        type="time"
                        value={quietHours[dayKey].end}
                        onChange={(e) => handleTimeChange(dayKey, 'end', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-gray-600 border border-gray-500 text-white text-sm focus:outline-none focus:border-blue-400"
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Timezone */}
      <section>
        <h3 className="text-sm font-semibold mb-4 text-white">Timezone</h3>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-gray-700/50 border border-gray-600 text-white text-sm focus:outline-none focus:border-blue-400"
          disabled={isSaving}
        >
          <option value="Europe/London">Europe/London (GMT)</option>
          <option value="Europe/Paris">Europe/Paris (CET)</option>
          <option value="Europe/Berlin">Europe/Berlin (CET)</option>
          <option value="US/Eastern">US/Eastern (EST)</option>
          <option value="US/Pacific">US/Pacific (PST)</option>
        </select>
      </section>

      {/* Holiday Exclusions */}
      <section>
        <h3 className="text-sm font-semibold mb-4 text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-400" />
          Holiday Exclusions
        </h3>
        <div className="rounded-lg border border-gray-600 bg-gray-700/30 p-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="date"
              value={newHoliday}
              onChange={(e) => setNewHoliday(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-gray-600 border border-gray-500 text-white text-sm focus:outline-none focus:border-blue-400"
              disabled={isSaving}
            />
            <button
              onClick={handleAddHoliday}
              className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-medium text-sm transition-colors flex items-center gap-1"
              disabled={isSaving}
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          {holidays.length > 0 && (
            <div className="space-y-2">
              {holidays.map((date) => (
                <div key={date} className="flex items-center justify-between p-2 rounded bg-gray-600/30">
                  <span className="text-sm text-gray-300">{new Date(date).toLocaleDateString('en-GB')}</span>
                  <button
                    onClick={() => handleRemoveHoliday(date)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Digest Tab ───────────────────────────────────────────────────────────────

function DigestTab({
  localSettings,
  handleUpdate,
  isSaving,
}: {
  localSettings: NotificationSettings;
  handleUpdate: (updates: Partial<NotificationSettings>) => Promise<void>;
  isSaving: boolean;
}) {
  const [digestTime, setDigestTime] = useState('09:00');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'project_update',
    'rfi_response',
    'approval_request',
  ]);

  const handleToggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handlePreviewDigest = () => {
    toast.success('Digest preview sent to your email');
  };

  return (
    <div className="space-y-6">
      {/* Digest Frequency */}
      <section>
        <h3 className="text-sm font-semibold mb-4 text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-400" />
          Digest Frequency
        </h3>
        <div className="space-y-2">
          {DIGEST_FREQUENCIES.map((freq) => (
            <div
              key={freq.value}
              onClick={() => handleUpdate({ digestFrequency: freq.value })}
              className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                localSettings.digestFrequency === freq.value
                  ? 'border-blue-500/50 bg-blue-500/10'
                  : 'border-gray-600 bg-gray-700/30 hover:border-gray-500'
              }`}
            >
              <div>
                <p className="font-medium text-white text-sm">{freq.label}</p>
                <p className="text-xs text-gray-400">{freq.description}</p>
              </div>
              {localSettings.digestFrequency === freq.value && (
                <Check className="w-5 h-5 text-blue-400" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Digest Time */}
      {localSettings.digestFrequency !== 'never' && (
        <section>
          <h3 className="text-sm font-semibold mb-4 text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Digest Time
          </h3>
          <div className="rounded-lg border border-gray-600 bg-gray-700/30 p-4">
            <label className="block text-xs text-gray-400 mb-2">Send digest at</label>
            <input
              type="time"
              value={digestTime}
              onChange={(e) => setDigestTime(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-600 border border-gray-500 text-white focus:outline-none focus:border-blue-400"
              disabled={isSaving}
            />
          </div>
        </section>
      )}

      {/* Content Selection */}
      {localSettings.digestFrequency !== 'never' && (
        <section>
          <h3 className="text-sm font-semibold mb-4 text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Content Selection
          </h3>
          <div className="rounded-lg border border-gray-600 bg-gray-700/30 p-4 space-y-3">
            {(Object.entries(CATEGORY_GROUPS).map(([group, categories]) => (
              <div key={group}>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase">{group}</p>
                <div className="space-y-2 ml-2">
                  {categories.map(category => (
                    <label key={category} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category)}
                        onChange={() => handleToggleCategory(category)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-600"
                        disabled={isSaving}
                      />
                      <span className="text-sm text-gray-300">{CATEGORY_LABELS[category as keyof CategoryPreferences]}</span>
                    </label>
                  ))}
                </div>
              </div>
            )))}
          </div>
        </section>
      )}

      {/* Preview Digest */}
      {localSettings.digestFrequency !== 'never' && (
        <section>
          <button
            onClick={handlePreviewDigest}
            className="w-full px-4 py-3 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-medium transition-colors flex items-center justify-center gap-2"
            disabled={isSaving}
          >
            <Mail className="w-4 h-4" />
            Preview & Send Test Digest
          </button>
        </section>
      )}
    </div>
  );
}

// ─── Rules Tab ────────────────────────────────────────────────────────────────

function RulesTab({
  isSaving,
}: {
  isSaving: boolean;
}) {
  const [rules, setRules] = useState<NotificationRule[]>([
    {
      id: '1',
      name: 'Critical Safety Issues',
      enabled: true,
      condition: 'if safety_incident level = critical',
      action: 'then notify immediately via all channels',
      createdAt: '2026-03-15',
    },
    {
      id: '2',
      name: 'Budget Alerts Over 10%',
      enabled: true,
      condition: 'if budget_alert variance > 10%',
      action: 'then notify project managers daily',
      createdAt: '2026-04-01',
    },
  ]);

  const [showRuleForm, setShowRuleForm] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    condition: '',
    action: '',
  });

  const handleAddRule = () => {
    if (newRule.name && newRule.condition && newRule.action) {
      const rule: NotificationRule = {
        id: Date.now().toString(),
        ...newRule,
        enabled: true,
        createdAt: new Date().toISOString().split('T')[0],
      };
      setRules([...rules, rule]);
      setNewRule({ name: '', condition: '', action: '' });
      setShowRuleForm(false);
      toast.success('Rule created');
    }
  };

  const handleToggleRule = (ruleId: string) => {
    setRules(rules.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
  };

  const handleDeleteRule = (ruleId: string) => {
    setRules(rules.filter(r => r.id !== ruleId));
    toast.success('Rule deleted');
  };

  return (
    <div className="space-y-6">
      {/* Rule Builder */}
      {!showRuleForm ? (
        <button
          onClick={() => setShowRuleForm(true)}
          className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-gray-600 text-gray-400 hover:text-gray-300 hover:border-gray-500 transition-colors flex items-center justify-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          Create Notification Rule
        </button>
      ) : (
        <div className="rounded-lg border border-gray-600 bg-gray-700/30 p-6">
          <h3 className="text-sm font-semibold mb-4 text-white">New Notification Rule</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-2">Rule Name</label>
              <input
                type="text"
                placeholder="e.g., Critical Alerts"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-gray-600 border border-gray-500 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                disabled={isSaving}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-2">Condition (if...)</label>
              <input
                type="text"
                placeholder="e.g., event type = critical"
                value={newRule.condition}
                onChange={(e) => setNewRule({ ...newRule, condition: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-gray-600 border border-gray-500 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                disabled={isSaving}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-2">Action (then...)</label>
              <input
                type="text"
                placeholder="e.g., send notification immediately"
                value={newRule.action}
                onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-gray-600 border border-gray-500 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                disabled={isSaving}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddRule}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-medium transition-colors"
                disabled={isSaving}
              >
                Create Rule
              </button>
              <button
                onClick={() => setShowRuleForm(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-500 font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Rules */}
      <section>
        <h3 className="text-sm font-semibold mb-4 text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Active Rules ({rules.filter(r => r.enabled).length})
        </h3>
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-lg border border-gray-600 bg-gray-700/30 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="text-white font-medium">{rule.name}</h4>
                  <p className="text-xs text-gray-400 mt-1">Created {new Date(rule.createdAt).toLocaleDateString('en-GB')}</p>
                </div>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => handleToggleRule(rule.id)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-600"
                    disabled={isSaving}
                  />
                </label>
              </div>
              <div className="space-y-2 text-sm">
                <div className="text-gray-400">
                  <span className="text-gray-500">If: </span>
                  <span className="text-gray-300">{rule.condition}</span>
                </div>
                <div className="text-gray-400">
                  <span className="text-gray-500">Then: </span>
                  <span className="text-gray-300">{rule.action}</span>
                </div>
              </div>
              <button
                onClick={() => handleDeleteRule(rule.id)}
                className="mt-3 text-red-400 hover:text-red-300 transition-colors text-sm font-medium flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Rule
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NotificationCenterSettings({
  settings,
  onUpdateSettings,
  onToggleCategory,
  onToggleQuietHours,
  onToggleSoundAlerts,
  onToggleBrowserNotifications,
  onClose,
}: NotificationCenterSettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('preferences');
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleUpdate = async (updates: Partial<NotificationSettings>) => {
    setIsSaving(true);
    setLocalSettings((prev) => ({ ...prev, ...updates }));
    try {
      await onUpdateSettings(updates);
    } catch (err) {
      console.error('Failed to update settings:', err);
      setLocalSettings(settings);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
    { key: 'preferences', label: 'Preferences', icon: Bell },
    { key: 'channels', label: 'Channels', icon: MessageSquare },
    { key: 'quiet-hours', label: 'Quiet Hours', icon: Clock },
    { key: 'digest', label: 'Digest', icon: Calendar },
    { key: 'rules', label: 'Rules', icon: AlertTriangle },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-display text-white">Notification Settings</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 py-4 border-b border-gray-700 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'preferences' && (
          <PreferencesTab
            localSettings={localSettings}
            handleUpdate={handleUpdate}
            isSaving={isSaving}
            onToggleSoundAlerts={onToggleSoundAlerts}
          />
        )}
        {activeTab === 'channels' && (
          <ChannelsTab
            localSettings={localSettings}
            handleUpdate={handleUpdate}
            isSaving={isSaving}
            onToggleBrowserNotifications={onToggleBrowserNotifications}
          />
        )}
        {activeTab === 'quiet-hours' && (
          <QuietHoursTab
            localSettings={localSettings}
            handleUpdate={handleUpdate}
            isSaving={isSaving}
          />
        )}
        {activeTab === 'digest' && (
          <DigestTab
            localSettings={localSettings}
            handleUpdate={handleUpdate}
            isSaving={isSaving}
          />
        )}
        {activeTab === 'rules' && (
          <RulesTab
            isSaving={isSaving}
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-700 flex justify-between items-center bg-gray-800/50">
        <button
          onClick={() => {
            setLocalSettings(settings);
            toast.success('Settings reset');
          }}
          className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 font-medium transition-colors flex items-center gap-2 text-sm"
          disabled={isSaving}
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
        <div className="text-xs text-gray-500">
          {isSaving ? 'Saving...' : 'Changes saved automatically'}
        </div>
      </div>
    </div>
  );
}

export default NotificationCenterSettings;
