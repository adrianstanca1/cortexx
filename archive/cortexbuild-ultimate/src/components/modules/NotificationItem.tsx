/**
 * NotificationItem Component
 * Displays notifications with multi-tab UI for list, detail, snooze, templates, and preferences
 */

import React, { useState } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  FileText,
  Calendar,
  MessageSquare,
  Users,
  Shield,
  Clock,
  Check,
  X,
  Archive,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Reply,
  User,
  PauseCircle,
  Paperclip,
  Edit,
  Copy,
  Send,
  BarChart3,
  Settings,
  Link as LinkIcon,
  Share2,
  Trash2,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import type { Notification } from '@/types/notification';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  onSnooze?: (id: string, until: Date) => void;
  onNavigate?: (url: string) => void;
  onQuickReply?: (notificationId: string, message: string) => void;
  onQuickApprove?: (notificationId: string, approved: boolean) => void;
  isCompact?: boolean;
}

interface SnoozeItem {
  id: string;
  notificationTitle: string;
  snoozeUntil: Date;
  projectName?: string;
}

interface ResponseTemplate {
  id: string;
  name: string;
  content: string;
  usageCount: number;
}

interface NotificationPreference {
  source: string;
  muted: boolean;
  frequency: 'immediate' | 'daily' | 'weekly';
}

// Icon mapping by notification type
const TYPE_ICONS: Record<Notification['type'], React.ElementType> = {
  project_update: FileText,
  task_assignment: CheckCircle,
  rfi_response: MessageSquare,
  safety_incident: Shield,
  document_upload: FileText,
  meeting_reminder: Calendar,
  team_mention: Users,
  system_alert: Bell,
  approval_request: CheckCircle,
  deadline_warning: Clock,
  budget_alert: AlertTriangle,
  change_order: FileText,
  inspection_scheduled: Calendar,
  material_delivery: Truck,
  timesheet_approval: Clock,
  subcontractor_update: Users,
};

// Truck icon for material delivery
function Truck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

// Icon mapping by severity
const SEVERITY_ICONS: Record<Notification['severity'], React.ElementType> = {
  critical: AlertTriangle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
};

// Color mapping by severity
const SEVERITY_COLORS: Record<Notification['severity'], string> = {
  critical: 'text-red-500 bg-red-500/10 border-red-500/30',
  error: 'text-red-500 bg-red-500/10 border-red-500/30',
  warning: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
  info: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  success: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
};

// Format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
};

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onArchive,
  onSnooze,
  onNavigate,
  onQuickReply,
  onQuickApprove,
  isCompact = false,
}: NotificationItemProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'detail' | 'snooze' | 'templates' | 'prefs'>('detail');
  const [showReply, setShowReply] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ResponseTemplate | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Sample data
  const [snoozedNotifications, setSnoozedNotifications] = useState<SnoozeItem[]>([
    {
      id: '1',
      notificationTitle: 'Critical Safety Alert',
      snoozeUntil: new Date(Date.now() + 3600000),
      projectName: 'Pinnacle Tower Redevelopment',
    },
    {
      id: '2',
      notificationTitle: 'Budget Variance Review',
      snoozeUntil: new Date(Date.now() + 86400000),
      projectName: 'City Centre Office Complex',
    },
  ]);

  const [responseTemplates, setResponseTemplates] = useState<ResponseTemplate[]>([
    {
      id: '1',
      name: 'Acknowledged',
      content: 'Thank you for the notification. I have acknowledged and will address this promptly.',
      usageCount: 12,
    },
    {
      id: '2',
      name: 'Forwarding to Team',
      content: 'Forwarding this to the relevant team member for action.',
      usageCount: 8,
    },
    {
      id: '3',
      name: 'More Info Needed',
      content: 'I need more information before proceeding. Can you provide additional details?',
      usageCount: 5,
    },
  ]);

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreference[]>([
    { source: 'Safety Incidents', muted: false, frequency: 'immediate' },
    { source: 'Budget Alerts', muted: false, frequency: 'daily' },
    { source: 'Project Updates', muted: false, frequency: 'daily' },
    { source: 'Team Mentions', muted: false, frequency: 'immediate' },
    { source: 'System Alerts', muted: false, frequency: 'weekly' },
  ]);

  const [blockedSources, setBlockedSources] = useState<string[]>(['Low Priority Notifications']);

  const isUnread = notification.status === 'unread';
  const TypeIcon = TYPE_ICONS[notification.type] || Bell;
  const SeverityIcon = SEVERITY_ICONS[notification.severity];
  const severityColor = SEVERITY_COLORS[notification.severity];

  const handleMarkAsRead = () => {
    if (isUnread) {
      onMarkAsRead(notification.id);
    }
  };

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (notification.relatedItem?.url) {
      onNavigate?.(notification.relatedItem.url);
    }
  };

  const handleQuickReply = () => {
    if (replyMessage.trim() && onQuickReply) {
      onQuickReply(notification.id, replyMessage);
      setReplyMessage('');
      setShowReply(false);
    }
  };

  const handleQuickApprove = (approved: boolean) => {
    onQuickApprove?.(notification.id, approved);
  };

  const handleSnooze = (hours: number) => {
    const until = new Date();
    until.setHours(until.getHours() + hours);
    onSnooze?.(notification.id, until);
    setShowSnoozeOptions(false);
    toast.success(`Snoozed until ${until.toLocaleTimeString('en-GB')}`);
  };

  const handleUnsnoozeDateChange = (id: string, newDate: Date) => {
    setSnoozedNotifications(
      snoozedNotifications.map((item) =>
        item.id === id ? { ...item, snoozeUntil: newDate } : item
      )
    );
  };

  const handleRemoveSnooze = (id: string) => {
    setSnoozedNotifications(snoozedNotifications.filter((item) => item.id !== id));
    toast.success('Snoozed notification unsnoozed');
  };

  const handleUseTemplate = (template: ResponseTemplate) => {
    setReplyMessage(template.content);
    setSelectedTemplate(template);
  };

  const handleSaveTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateContent.trim()) {
      toast.error('Please fill in template name and content');
      return;
    }
    const newTemplate: ResponseTemplate = {
      id: Date.now().toString(),
      name: newTemplateName,
      content: newTemplateContent,
      usageCount: 0,
    };
    setResponseTemplates([newTemplate, ...responseTemplates]);
    setNewTemplateName('');
    setNewTemplateContent('');
    setShowTemplateModal(false);
    toast.success('Template saved');
  };

  const handleDeleteTemplate = (id: string) => {
    setResponseTemplates(responseTemplates.filter((t) => t.id !== id));
    toast.success('Template deleted');
  };

  const handleToggleMute = (source: string) => {
    setNotificationPrefs(
      notificationPrefs.map((p) =>
        p.source === source ? { ...p, muted: !p.muted } : p
      )
    );
  };

  const handleChangeFrequency = (source: string, frequency: 'immediate' | 'daily' | 'weekly') => {
    setNotificationPrefs(
      notificationPrefs.map((p) =>
        p.source === source ? { ...p, frequency } : p
      )
    );
  };

  const handleBlockSource = (source: string) => {
    if (!blockedSources.includes(source)) {
      setBlockedSources([...blockedSources, source]);
      toast.success(`Blocked notifications from ${source}`);
    }
  };

  const handleUnblockSource = (source: string) => {
    setBlockedSources(blockedSources.filter((s) => s !== source));
    toast.success(`Unblocked notifications from ${source}`);
  };

  const frequencyData = [
    { name: 'Immediate', count: 5 },
    { name: 'Daily', count: 3 },
    { name: 'Weekly', count: 2 },
  ];

  if (isCompact) {
    return (
      <div
        className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:bg-gray-800 ${
          isUnread ? 'bg-gray-800 border-blue-500/30' : 'border-gray-700'
        }`}
        onClick={handleMarkAsRead}
      >
        <div className={`p-2 rounded-lg ${severityColor}`}>
          <TypeIcon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${isUnread ? 'text-blue-500' : 'text-gray-200'}`}>
                {notification.title}
              </p>
              <p className="text-xs text-gray-400 truncate">{notification.message}</p>
            </div>
            <span className="text-xs text-gray-500 flex-shrink-0">
              {formatRelativeTime(notification.createdAt)}
            </span>
          </div>

          {notification.fromUser && (
            <div className="flex items-center gap-1.5 mt-1.5">
              {notification.fromUser.avatar ? (
                <img
                  src={notification.fromUser.avatar}
                  alt={notification.fromUser.name}
                  className="w-4 h-4 rounded-full"
                />
              ) : (
                <User className="w-4 h-4" />
              )}
              <span className="text-xs text-gray-500">{notification.fromUser.name}</span>
            </div>
          )}
        </div>

        {isUnread && (
          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
        )}
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-900 rounded-lg border border-gray-800">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
            activeTab === 'list'
              ? 'text-blue-500 border-blue-500'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          List
        </button>
        <button
          onClick={() => setActiveTab('detail')}
          className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
            activeTab === 'detail'
              ? 'text-blue-500 border-blue-500'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Detail
        </button>
        <button
          onClick={() => setActiveTab('snooze')}
          className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
            activeTab === 'snooze'
              ? 'text-blue-500 border-blue-500'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <PauseCircle className="w-4 h-4 inline mr-2" />
          Snoozed ({snoozedNotifications.length})
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
            activeTab === 'templates'
              ? 'text-blue-500 border-blue-500'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <MessageSquare className="w-4 h-4 inline mr-2" />
          Templates
        </button>
        <button
          onClick={() => setActiveTab('prefs')}
          className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
            activeTab === 'prefs'
              ? 'text-blue-500 border-blue-500'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          Preferences
        </button>
      </div>

      <div className="p-4">
        {/* LIST TAB */}
        {activeTab === 'list' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-800">
              <h3 className="font-semibold text-gray-200">Notifications</h3>
              <label className="flex items-center gap-2 text-xs text-gray-400 ml-auto">
                <input type="checkbox" className="checkbox checkbox-sm" />
                Group by Project
              </label>
            </div>

            {/* Sample Notification List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {[
                {
                  title: notification.title,
                  message: notification.message,
                  severity: notification.severity,
                  time: formatRelativeTime(notification.createdAt),
                  unread: true,
                  project: 'Pinnacle Tower',
                },
                {
                  title: 'RFI #2847 Response Received',
                  message: 'Structural assessment feedback from main contractor',
                  severity: 'info' as const,
                  time: '2h ago',
                  unread: false,
                  project: 'City Centre Office',
                },
                {
                  title: 'Budget Variance Alert',
                  message: 'Labour costs exceeded by 8% on North Wing',
                  severity: 'warning' as const,
                  time: '4h ago',
                  unread: false,
                  project: 'Pinnacle Tower',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded border transition ${
                    item.unread
                      ? 'bg-gray-800 border-blue-500/30'
                      : 'bg-gray-800/50 border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-start gap-2 flex-1">
                      <div
                        className={`p-1.5 rounded ${
                          item.severity === 'critical'
                            ? 'bg-red-500/20 text-red-500'
                            : item.severity === 'warning'
                            ? 'bg-amber-500/20 text-amber-500'
                            : 'bg-blue-500/20 text-blue-500'
                        }`}
                      >
                        <Bell className="w-3 h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-200">{item.title}</p>
                        <p className="text-xs text-gray-400">{item.message}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{item.time}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-6">
                    <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">{item.project}</span>
                    <div className="flex gap-1 ml-auto">
                      <button className="btn btn-xs btn-ghost" title="Mark read">
                        <Check className="w-3 h-3" />
                      </button>
                      <button className="btn btn-xs btn-ghost" title="Snooze">
                        <PauseCircle className="w-3 h-3" />
                      </button>
                      <button className="btn btn-xs btn-ghost" title="Dismiss">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DETAIL TAB */}
        {activeTab === 'detail' && (
          <div className="space-y-4">
            {/* Icon & Header */}
            <div className="flex items-start gap-3">
              <div className={`p-3 rounded-xl ${severityColor}`}>
                <SeverityIcon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={`font-bold text-lg ${isUnread ? 'text-blue-500' : 'text-gray-200'}`}>
                    {notification.title}
                  </h3>
                  {isUnread && <span className="badge badge-primary badge-sm">New</span>}
                </div>
                <p className="text-sm text-gray-400">{notification.message}</p>
              </div>
              <span className="text-xs text-gray-500">{formatRelativeTime(notification.createdAt)}</span>
            </div>

            {/* Description */}
            {notification.description && (
              <div className="p-3 bg-gray-800 rounded border border-gray-700">
                <p className="text-sm text-gray-300">{notification.description}</p>
              </div>
            )}

            {/* From User */}
            {notification.fromUser && (
              <div className="flex items-center gap-3 p-3 bg-gray-800 rounded border border-gray-700">
                {notification.fromUser.avatar ? (
                  <img
                    src={notification.fromUser.avatar}
                    alt={notification.fromUser.name}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-500" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-200">{notification.fromUser.name}</p>
                  {notification.fromUser.role && (
                    <p className="text-xs text-gray-500">{notification.fromUser.role.replace('_', ' ')}</p>
                  )}
                </div>
              </div>
            )}

            {/* Related Item Card */}
            {notification.relatedItem && (
              <div className="p-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded">
                <p className="text-xs text-gray-400 mb-2">Related Item</p>
                <p className="text-sm font-medium text-gray-200">{notification.relatedItem.title}</p>
                <p className="text-xs text-gray-400 mt-1">Type: {notification.relatedItem.type}</p>
                {notification.relatedItem.url && (
                  <button onClick={handleNavigate} className="btn btn-sm btn-primary mt-2 gap-1">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open
                  </button>
                )}
              </div>
            )}

            {/* Metadata */}
            {notification.metadata && (
              <div className="grid grid-cols-2 gap-2">
                {notification.metadata.projectName && (
                  <div className="p-3 bg-gray-800 rounded">
                    <p className="text-xs text-gray-500">Project</p>
                    <p className="text-sm font-medium text-gray-200 mt-1">{notification.metadata.projectName}</p>
                  </div>
                )}
                {notification.metadata.priority && (
                  <div className="p-3 bg-gray-800 rounded">
                    <p className="text-xs text-gray-500">Priority</p>
                    <p className={`text-sm font-medium mt-1 ${
                      notification.metadata.priority === 'critical'
                        ? 'text-red-500'
                        : notification.metadata.priority === 'high'
                        ? 'text-amber-500'
                        : 'text-blue-500'
                    }`}>
                      {notification.metadata.priority}
                    </p>
                  </div>
                )}
                {notification.metadata.dueDate && (
                  <div className="p-3 bg-gray-800 rounded">
                    <p className="text-xs text-gray-500">Due Date</p>
                    <p className="text-sm font-medium text-gray-200 mt-1">
                      {new Date(notification.metadata.dueDate).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                )}
                {notification.metadata.attachmentCount !== undefined && (
                  <div className="p-3 bg-gray-800 rounded">
                    <p className="text-xs text-gray-500">Attachments</p>
                    <p className="text-sm font-medium text-gray-200 mt-1">{notification.metadata.attachmentCount}</p>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-800">
              {notification.type === 'approval_request' && (
                <>
                  <button onClick={() => handleQuickApprove(true)} className="btn btn-sm btn-success gap-1">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button onClick={() => handleQuickApprove(false)} className="btn btn-sm btn-error gap-1">
                    <ThumbsDown className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </>
              )}
              {onQuickReply && !showReply && (
                <button onClick={() => setShowReply(true)} className="btn btn-sm btn-primary gap-1">
                  <Reply className="w-3.5 h-3.5" />
                  Reply
                </button>
              )}
              {onSnooze && isUnread && (
                <button onClick={() => setShowSnoozeOptions(true)} className="btn btn-sm btn-ghost gap-1">
                  <PauseCircle className="w-3.5 h-3.5" />
                  Snooze
                </button>
              )}
              {isUnread && (
                <button onClick={handleMarkAsRead} className="btn btn-sm btn-ghost gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Mark Read
                </button>
              )}
              {onArchive && (
                <button onClick={() => onArchive(notification.id)} className="btn btn-sm btn-ghost gap-1">
                  <Archive className="w-3.5 h-3.5" />
                  Archive
                </button>
              )}
              <button onClick={() => onDelete(notification.id)} className="btn btn-sm btn-ghost gap-1 ml-auto">
                <X className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>

            {/* Reply Input */}
            {showReply && (
              <div className="space-y-2 pt-3 border-t border-gray-800">
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your reply..."
                  className="textarea w-full bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500 text-sm"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button onClick={handleQuickReply} className="btn btn-sm btn-primary" disabled={!replyMessage.trim()}>
                    <Send className="w-3.5 h-3.5" />
                    Send
                  </button>
                  <button onClick={() => setShowReply(false)} className="btn btn-sm btn-ghost">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Snooze Options */}
            {showSnoozeOptions && (
              <div className="flex gap-2 pt-3 border-t border-gray-800">
                {[1, 4, 24, 168].map((hours) => (
                  <button key={hours} onClick={() => handleSnooze(hours)} className="btn btn-sm btn-ghost">
                    {hours === 1 ? '1h' : hours === 4 ? '4h' : hours === 24 ? '1d' : '1w'}
                  </button>
                ))}
                <button onClick={() => setShowSnoozeOptions(false)} className="btn btn-sm btn-ghost ml-auto">
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* SNOOZE MANAGER TAB */}
        {activeTab === 'snooze' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-200">Snoozed Notifications</h3>
            {snoozedNotifications.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {snoozedNotifications.map((item) => (
                  <div key={item.id} className="p-4 bg-gray-800 border border-gray-700 rounded">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-200">{item.notificationTitle}</p>
                        {item.projectName && (
                          <p className="text-xs text-gray-400 mt-1">{item.projectName}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveSnooze(item.id)}
                        className="btn btn-xs btn-ghost text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <input
                        type="datetime-local"
                        value={item.snoozeUntil.toISOString().slice(0, 16)}
                        onChange={(e) => handleUnsnoozeDateChange(item.id, new Date(e.target.value))}
                        className="input input-sm input-bordered bg-gray-700 border-gray-600 text-gray-200 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No snoozed notifications</p>
            )}
          </div>
        )}

        {/* TEMPLATES TAB */}
        {activeTab === 'templates' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-200">Response Templates</h3>
              <button
                onClick={() => setShowTemplateModal(true)}
                className="btn btn-sm btn-primary gap-1"
              >
                <Edit className="w-3.5 h-3.5" />
                New
              </button>
            </div>

            {/* Template Modal */}
            {showTemplateModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-2xl">
                  <h4 className="font-semibold text-gray-200 mb-3">Create Template</h4>
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="text-xs font-medium text-gray-400">Name</label>
                      <input
                        type="text"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        placeholder="e.g., Quick Approval"
                        className="input w-full bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500 mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-400">Content</label>
                      <textarea
                        value={newTemplateContent}
                        onChange={(e) => setNewTemplateContent(e.target.value)}
                        placeholder="Template text..."
                        className="textarea w-full bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500 mt-1"
                        rows={4}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSaveTemplate} className="btn btn-sm btn-primary flex-1">
                      Save
                    </button>
                    <button onClick={() => setShowTemplateModal(false)} className="btn btn-sm btn-ghost flex-1">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Templates List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {responseTemplates.map((template) => (
                <div key={template.id} className="p-4 bg-gray-800 border border-gray-700 rounded">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-200">{template.name}</p>
                      <p className="text-sm text-gray-400 mt-1">{template.content}</p>
                      <p className="text-xs text-gray-500 mt-2">Used {template.usageCount} times</p>
                    </div>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="btn btn-xs btn-ghost text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleUseTemplate(template)}
                    className="btn btn-xs btn-primary gap-1 w-full mt-2"
                  >
                    <Copy className="w-3 h-3" />
                    Use Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PREFERENCES TAB */}
        {activeTab === 'prefs' && (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-200 mb-3">Notification Frequency</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {notificationPrefs.map((pref) => (
                  <div key={pref.source} className="flex items-center justify-between p-3 bg-gray-800 rounded border border-gray-700">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-200">{pref.source}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pref.muted}
                            onChange={() => handleToggleMute(pref.source)}
                            className="checkbox checkbox-sm"
                          />
                          Muted
                        </label>
                      </div>
                    </div>
                    <select
                      value={pref.frequency}
                      onChange={(e) => handleChangeFrequency(pref.source, e.target.value as 'immediate' | 'daily' | 'weekly')}
                      className="select select-sm bg-gray-700 border-gray-600 text-gray-200"
                    >
                      <option value="immediate">Immediate</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Frequency Chart */}
            <div className="bg-gray-800 p-4 rounded border border-gray-700">
              <p className="text-xs text-gray-400 mb-3">Notification Preferences Overview</p>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={frequencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#e5e7eb',
                    }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Block List */}
            <div>
              <h4 className="font-semibold text-gray-200 mb-3">Blocked Sources</h4>
              <div className="space-y-2">
                {blockedSources.length > 0 ? (
                  blockedSources.map((source) => (
                    <div key={source} className="flex items-center justify-between p-2 bg-red-500/10 border border-red-500/30 rounded text-sm">
                      <span className="text-gray-200">{source}</span>
                      <button
                        onClick={() => handleUnblockSource(source)}
                        className="text-red-500 hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">No blocked sources</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default NotificationItem;
