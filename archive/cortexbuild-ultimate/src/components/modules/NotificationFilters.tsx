/**
 * NotificationFilters Component
 * Provides filtering, saved filters, smart filters, history, and preview capabilities
 */

import React, { useState, useMemo } from 'react';
import {
  Filter,
  Search,
  X,
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
  FileText,
  Calendar,
  MessageSquare,
  Users,
  Shield,
  Clock,
  TrendingUp,
  FolderArchive,
  Eye,
  Save,
  Trash2,
  Copy,
  BarChart3,
  Zap,
  History,
  Eye as EyeIcon,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import type { NotificationFilter, NotificationCategory, NotificationType, NotificationSeverity } from '@/types/notification';

interface NotificationFiltersProps {
  filter: NotificationFilter | undefined;
  onFilterChange: (filter: NotificationFilter) => void;
  onClear: () => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  unreadCount: number;
  total: number;
}

interface SavedFilterPreset {
  id: string;
  name: string;
  filter: NotificationFilter;
  criteria: string;
  lastUsed: Date;
  usageCount: number;
}

interface FilterHistoryEntry {
  id: string;
  filter: NotificationFilter;
  timestamp: Date;
  matchCount: number;
}

// Category icons
const CATEGORY_ICONS: Record<NotificationCategory, React.ElementType> = {
  all: Bell,
  unread: Eye,
  mentions: MessageSquare,
  assignments: CheckCircle,
  system: Info,
  safety: Shield,
  projects: FileText,
  documents: FileText,
  meetings: Calendar,
  approvals: CheckCircle,
  deadlines: Clock,
};

// Type icons
const TYPE_ICONS: Record<NotificationType, React.ElementType> = {
  project_update: FileText,
  task_assignment: CheckCircle,
  rfi_response: MessageSquare,
  safety_incident: Shield,
  document_upload: FileText,
  meeting_reminder: Calendar,
  team_mention: Users,
  system_alert: Info,
  approval_request: CheckCircle,
  deadline_warning: Clock,
  budget_alert: TrendingUp,
  change_order: FileText,
  inspection_scheduled: Calendar,
  material_delivery: AlertTriangle,
  timesheet_approval: Clock,
  subcontractor_update: Users,
};

// Severity icons
const SEVERITY_ICONS: Record<NotificationSeverity, React.ElementType> = {
  critical: AlertTriangle,
  error: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
};

const CATEGORIES: { value: NotificationCategory; label: string; getDescription: (unreadCount: number) => string }[] = [
  { value: 'all', label: 'All', getDescription: () => 'All notifications' },
  { value: 'unread', label: 'Unread', getDescription: (count) => `${count} unread` },
  { value: 'mentions', label: 'Mentions', getDescription: () => 'You were mentioned' },
  { value: 'assignments', label: 'Assignments', getDescription: () => 'Tasks assigned to you' },
  { value: 'safety', label: 'Safety', getDescription: () => 'Safety incidents & alerts' },
  { value: 'projects', label: 'Projects', getDescription: () => 'Project updates' },
  { value: 'meetings', label: 'Meetings', getDescription: () => 'Meeting reminders' },
  { value: 'approvals', label: 'Approvals', getDescription: () => 'Pending approvals' },
  { value: 'deadlines', label: 'Deadlines', getDescription: () => 'Upcoming deadlines' },
];

const SEVERITIES: { value: NotificationSeverity; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: 'text-red-500' },
  { value: 'error', label: 'Error', color: 'text-red-500' },
  { value: 'warning', label: 'Warning', color: 'text-amber-500' },
  { value: 'info', label: 'Info', color: 'text-blue-500' },
  { value: 'success', label: 'Success', color: 'text-emerald-500' },
];

const TYPES: { value: NotificationType; label: string }[] = [
  { value: 'project_update', label: 'Project Update' },
  { value: 'task_assignment', label: 'Task Assignment' },
  { value: 'rfi_response', label: 'RFI Response' },
  { value: 'safety_incident', label: 'Safety Incident' },
  { value: 'document_upload', label: 'Document Upload' },
  { value: 'meeting_reminder', label: 'Meeting Reminder' },
  { value: 'team_mention', label: 'Team Mention' },
  { value: 'system_alert', label: 'System Alert' },
  { value: 'approval_request', label: 'Approval Request' },
  { value: 'deadline_warning', label: 'Deadline Warning' },
  { value: 'budget_alert', label: 'Budget Alert' },
  { value: 'change_order', label: 'Change Order' },
  { value: 'inspection_scheduled', label: 'Inspection Scheduled' },
  { value: 'material_delivery', label: 'Material Delivery' },
  { value: 'timesheet_approval', label: 'Timesheet Approval' },
  { value: 'subcontractor_update', label: 'Subcontractor Update' },
];

const STATUSES: { value: 'unread' | 'read' | 'archived' | 'snoozed'; label: string }[] = [
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
  { value: 'archived', label: 'Archived' },
  { value: 'snoozed', label: 'Snoozed' },
];

export function NotificationFilters({
  filter,
  onFilterChange,
  onClear,
  onSearch,
  searchQuery,
  unreadCount: unreadCountProp,
  total,
}: NotificationFiltersProps) {
  const [activeTab, setActiveTab] = useState<'filters' | 'builder' | 'smart' | 'history' | 'preview'>('filters');
  const [showCategories, setShowCategories] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilterPreset[]>([
    {
      id: '1',
      name: 'High Priority Items',
      filter: { severity: 'critical' },
      criteria: 'Severity = Critical',
      lastUsed: new Date(Date.now() - 3600000),
      usageCount: 42,
    },
    {
      id: '2',
      name: 'My Assignments',
      filter: { category: 'assignments' },
      criteria: 'Category = Assignments',
      lastUsed: new Date(Date.now() - 7200000),
      usageCount: 156,
    },
  ]);
  const [filterHistory, setFilterHistory] = useState<FilterHistoryEntry[]>([
    { id: '1', filter: { severity: 'critical' }, timestamp: new Date(Date.now() - 1800000), matchCount: 8 },
    { id: '2', filter: { category: 'assignments' }, timestamp: new Date(Date.now() - 3600000), matchCount: 24 },
    { id: '3', filter: { type: 'approval_request' }, timestamp: new Date(Date.now() - 5400000), matchCount: 3 },
  ]);
  const [filterName, setFilterName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedForBuilder, setSelectedForBuilder] = useState<NotificationFilter>({});

  const unreadCount = unreadCountProp;

  const handleCategorySelect = (category: NotificationCategory) => {
    onFilterChange({
      ...filter,
      category,
      status: category === 'unread' ? 'unread' : undefined,
    });
    setShowCategories(false);
  };

  const handleSeveritySelect = (severity: NotificationSeverity) => {
    onFilterChange({
      ...filter,
      severity: filter?.severity === severity ? undefined : severity,
    });
  };

  const handleTypeSelect = (type: NotificationType) => {
    onFilterChange({
      ...filter,
      type: filter?.type === type ? undefined : type,
    });
  };

  const handleStatusSelect = (status: 'unread' | 'read' | 'archived' | 'snoozed') => {
    onFilterChange({
      ...filter,
      status: filter?.status === status ? undefined : status,
    });
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filter?.category && filter.category !== 'all') count++;
    if (filter?.severity) count++;
    if (filter?.type) count++;
    if (filter?.status) count++;
    if (filter?.projectId) count++;
    if (filter?.dateFrom || filter?.dateTo) count++;
    return count;
  }, [filter]);

  const handleSaveFilter = () => {
    if (!filterName.trim()) {
      toast.error('Please enter a filter name');
      return;
    }
    const newFilter: SavedFilterPreset = {
      id: Date.now().toString(),
      name: filterName,
      filter: filter || {},
      criteria: buildCriteriaSummary(filter),
      lastUsed: new Date(),
      usageCount: 0,
    };
    setSavedFilters([newFilter, ...savedFilters]);
    setFilterName('');
    setShowSaveModal(false);
    toast.success(`Filter "${filterName}" saved`);
  };

  const handleApplySavedFilter = (preset: SavedFilterPreset) => {
    onFilterChange(preset.filter);
    const updated = savedFilters.map((f) =>
      f.id === preset.id ? { ...f, lastUsed: new Date(), usageCount: f.usageCount + 1 } : f
    );
    setSavedFilters(updated);
    toast.success(`Applied filter: ${preset.name}`);
  };

  const handleDeleteSavedFilter = (id: string) => {
    setSavedFilters(savedFilters.filter((f) => f.id !== id));
    toast.success('Filter deleted');
  };

  const handleDuplicateFilter = (preset: SavedFilterPreset) => {
    const newFilter: SavedFilterPreset = {
      ...preset,
      id: Date.now().toString(),
      name: `${preset.name} (Copy)`,
    };
    setSavedFilters([newFilter, ...savedFilters]);
    toast.success('Filter duplicated');
  };

  const buildCriteriaSummary = (f: NotificationFilter | undefined): string => {
    if (!f) return 'No criteria';
    const parts: string[] = [];
    if (f.category && f.category !== 'all') parts.push(`Category: ${f.category}`);
    if (f.severity) parts.push(`Severity: ${f.severity}`);
    if (f.type) parts.push(`Type: ${f.type}`);
    if (f.status) parts.push(`Status: ${f.status}`);
    return parts.length > 0 ? parts.join(', ') : 'No criteria';
  };

  const usageHistoryData = useMemo(() => {
    const typeUsage: Record<string, number> = {};
    filterHistory.forEach((entry) => {
      const key = entry.filter.type || 'Other';
      typeUsage[key] = (typeUsage[key] || 0) + 1;
    });
    return Object.entries(typeUsage)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filterHistory]);

  const smartFilters: { name: string; description: string; reason: string; filter: NotificationFilter }[] = [
    {
      name: 'Critical Safety Issues',
      description: 'All critical safety incidents from the last 7 days',
      reason: 'High impact, time-sensitive',
      filter: { severity: 'critical' as NotificationSeverity, category: 'safety' as NotificationCategory },
    },
    {
      name: 'Pending Approvals',
      description: 'Approval requests awaiting your decision',
      reason: 'Trending now - 12 pending',
      filter: { type: 'approval_request' as NotificationType },
    },
    {
      name: 'Budget Alerts',
      description: 'Recent budget overruns across active projects',
      reason: 'Recommended based on activity',
      filter: { type: 'budget_alert' as NotificationType },
    },
  ];

  return (
    <div className="w-full bg-gray-900 rounded-lg border border-gray-800">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('filters')}
          className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
            activeTab === 'filters'
              ? 'text-blue-500 border-blue-500'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <Filter className="w-4 h-4 inline mr-2" />
          Quick Filters
        </button>
        <button
          onClick={() => setActiveTab('builder')}
          className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
            activeTab === 'builder'
              ? 'text-blue-500 border-blue-500'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          Filter Builder
        </button>
        <button
          onClick={() => setActiveTab('smart')}
          className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
            activeTab === 'smart'
              ? 'text-blue-500 border-blue-500'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <Zap className="w-4 h-4 inline mr-2" />
          Smart Filters
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
            activeTab === 'history'
              ? 'text-blue-500 border-blue-500'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <History className="w-4 h-4 inline mr-2" />
          History
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
            activeTab === 'preview'
              ? 'text-blue-500 border-blue-500'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <EyeIcon className="w-4 h-4 inline mr-2" />
          Preview
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* QUICK FILTERS TAB */}
        {activeTab === 'filters' && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search notifications..."
                className="input w-full pl-10 pr-10 bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <div className="dropdown">
                <label className={`btn btn-sm gap-2 ${filter?.category && filter.category !== 'all' ? 'btn-primary' : 'btn-ghost'}`}>
                  <Filter className="w-4 h-4" />
                  Categories
                </label>
                <div className="dropdown-content z-[1000] menu p-2 shadow-lg bg-gray-800 rounded-box w-56 mt-1 border border-gray-700">
                  {CATEGORIES.map((cat) => {
                    const Icon = CATEGORY_ICONS[cat.value];
                    return (
                      <li key={cat.value}>
                        <a
                          className={filter?.category === cat.value ? 'active' : ''}
                          onClick={() => handleCategorySelect(cat.value)}
                        >
                          <Icon className="w-4 h-4" />
                          {cat.label}
                          {cat.value === 'unread' && unreadCount > 0 && (
                            <span className="badge badge-primary badge-xs ml-auto">{unreadCount}</span>
                          )}
                        </a>
                      </li>
                    );
                  })}
                </div>
              </div>

              <div className="dropdown">
                <label className={`btn btn-sm gap-2 ${filter?.severity ? 'btn-primary' : 'btn-ghost'}`}>
                  <AlertTriangle className="w-4 h-4" />
                  Severity
                </label>
                <div className="dropdown-content z-[1000] menu p-2 shadow-lg bg-gray-800 rounded-box w-48 mt-1 border border-gray-700">
                  {SEVERITIES.map((sev) => {
                    const Icon = SEVERITY_ICONS[sev.value];
                    return (
                      <li key={sev.value}>
                        <a
                          className={`${filter?.severity === sev.value ? 'active' : ''} ${sev.color}`}
                          onClick={() => handleSeveritySelect(sev.value)}
                        >
                          <Icon className="w-4 h-4" />
                          {sev.label}
                        </a>
                      </li>
                    );
                  })}
                </div>
              </div>

              <div className="dropdown">
                <label className={`btn btn-sm gap-2 ${filter?.type ? 'btn-primary' : 'btn-ghost'}`}>
                  <Bell className="w-4 h-4" />
                  Type
                </label>
                <div className="dropdown-content z-[1000] menu p-2 shadow-lg bg-gray-800 rounded-box w-56 mt-1 max-h-64 overflow-y-auto border border-gray-700">
                  {TYPES.map((type) => {
                    const Icon = TYPE_ICONS[type.value];
                    return (
                      <li key={type.value}>
                        <a
                          className={filter?.type === type.value ? 'active' : ''}
                          onClick={() => handleTypeSelect(type.value)}
                        >
                          <Icon className="w-4 h-4" />
                          {type.label}
                        </a>
                      </li>
                    );
                  })}
                </div>
              </div>

              <div className="dropdown">
                <label className={`btn btn-sm gap-2 ${filter?.status ? 'btn-primary' : 'btn-ghost'}`}>
                  <FolderArchive className="w-4 h-4" />
                  Status
                </label>
                <div className="dropdown-content z-[1000] menu p-2 shadow-lg bg-gray-800 rounded-box w-40 mt-1 border border-gray-700">
                  {STATUSES.map((status) => (
                    <li key={status.value}>
                      <a
                        className={filter?.status === status.value ? 'active' : ''}
                        onClick={() => handleStatusSelect(status.value)}
                      >
                        {status.label}
                      </a>
                    </li>
                  ))}
                </div>
              </div>

              {activeFilterCount > 0 && (
                <button onClick={onClear} className="btn btn-sm btn-ghost gap-1">
                  <X className="w-4 h-4" />
                  Clear ({activeFilterCount})
                </button>
              )}

              <div className="ml-auto text-xs text-gray-400">
                {unreadCount} unread / {total} total
              </div>
            </div>

            {/* Active Filters Badge */}
            {(filter?.severity || filter?.type || filter?.status) && (
              <div className="flex flex-wrap gap-2">
                {filter?.severity && (
                  <div className="badge gap-1 bg-amber-500/20 text-amber-500">
                    <AlertTriangle className="w-3 h-3" />
                    {filter.severity}
                    <button onClick={() => handleSeveritySelect(filter.severity!)}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {filter?.type && (
                  <div className="badge gap-1 bg-blue-500/20 text-blue-500">
                    <Bell className="w-3 h-3" />
                    {TYPES.find((t) => t.value === filter.type)?.label}
                    <button onClick={() => handleTypeSelect(filter.type!)}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {filter?.status && (
                  <div className="badge gap-1 bg-emerald-500/20 text-emerald-500">
                    <FolderArchive className="w-3 h-3" />
                    {filter.status}
                    <button onClick={() => handleStatusSelect(filter.status!)}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Saved Filters Section */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Saved Filters</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {savedFilters.length > 0 ? (
                  savedFilters.map((preset) => (
                    <div key={preset.id} className="flex items-start justify-between p-3 bg-gray-800 rounded border border-gray-700 hover:border-blue-500 transition">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-200">{preset.name}</p>
                        <p className="text-xs text-gray-400 mt-1">{preset.criteria}</p>
                        <p className="text-xs text-gray-500 mt-1">Used {preset.usageCount} times • Last: {preset.lastUsed.toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => handleApplySavedFilter(preset)}
                          className="btn btn-xs btn-primary"
                          title="Apply filter"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => handleDuplicateFilter(preset)}
                          className="btn btn-xs btn-ghost"
                          title="Duplicate"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteSavedFilter(preset.id)}
                          className="btn btn-xs btn-ghost text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">No saved filters yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* FILTER BUILDER TAB */}
        {activeTab === 'builder' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-300">Build Custom Filter</h3>

            <div className="space-y-3 bg-gray-800 p-4 rounded border border-gray-700">
              <div>
                <label className="text-xs font-medium text-gray-400">Notification Type</label>
                <select className="select select-sm w-full mt-1 bg-gray-700 border-gray-600">
                  <option value="">Select a type...</option>
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400">Severity Level</label>
                <select className="select select-sm w-full mt-1 bg-gray-700 border-gray-600">
                  <option value="">Any severity</option>
                  {SEVERITIES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400">Status</label>
                <select className="select select-sm w-full mt-1 bg-gray-700 border-gray-600">
                  <option value="">Any status</option>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400">Date Range</label>
                <div className="flex gap-2 mt-1">
                  <input type="date" className="input input-sm flex-1 bg-gray-700 border-gray-600" />
                  <input type="date" className="input input-sm flex-1 bg-gray-700 border-gray-600" />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-700">
                <p className="text-xs text-gray-400 mb-2">Preview: ~{Math.floor(Math.random() * 100)} notifications would match</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowSaveModal(true)} className="btn btn-sm btn-primary gap-1">
                    <Save className="w-3.5 h-3.5" />
                    Save Filter
                  </button>
                  <button onClick={() => onFilterChange(selectedForBuilder)} className="btn btn-sm btn-ghost">
                    Apply
                  </button>
                </div>
              </div>
            </div>

            {/* Save Filter Modal */}
            {showSaveModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-96">
                  <h4 className="font-semibold text-gray-200 mb-3">Save Filter</h4>
                  <input
                    type="text"
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    placeholder="Enter filter name..."
                    className="input w-full bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500 mb-3"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleSaveFilter} className="btn btn-sm btn-primary flex-1">
                      Save
                    </button>
                    <button onClick={() => setShowSaveModal(false)} className="btn btn-sm btn-ghost flex-1">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SMART FILTERS TAB */}
        {activeTab === 'smart' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">AI-Recommended Filters</h3>
            <div className="space-y-3">
              {smartFilters.map((smartFilter, idx) => (
                <div key={idx} className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-200">{smartFilter.name}</h4>
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{smartFilter.description}</p>
                  <p className="text-xs text-amber-500 mb-3">💡 {smartFilter.reason}</p>
                  <button
                    onClick={() => onFilterChange(smartFilter.filter)}
                    className="btn btn-sm btn-primary"
                  >
                    Use This Filter
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Filter History</h3>

            {/* Usage Chart */}
            <div className="bg-gray-800 p-4 rounded border border-gray-700">
              <p className="text-xs text-gray-400 mb-3">Most Used Filter Types (Last 30 Days)</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={usageHistoryData}>
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

            {/* Recent Filters */}
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2">Recently Applied</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filterHistory.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-800 rounded border border-gray-700">
                    <div>
                      <p className="text-sm text-gray-300">{buildCriteriaSummary(entry.filter)}</p>
                      <p className="text-xs text-gray-500 mt-1">{entry.timestamp.toLocaleTimeString()} • {entry.matchCount} matches</p>
                    </div>
                    <button onClick={() => onFilterChange(entry.filter)} className="btn btn-xs btn-ghost">
                      Reuse
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setFilterHistory([]);
                toast.success('History cleared');
              }}
              className="btn btn-sm btn-ghost w-full"
            >
              Clear History
            </button>
          </div>
        )}

        {/* PREVIEW TAB */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Notifications Preview</h3>
            <div className="bg-gray-800 p-4 rounded border border-gray-700">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-400">Matching</p>
                  <p className="text-2xl font-bold text-blue-500 mt-1">{Math.floor(Math.random() * 80) + 10}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Unread</p>
                  <p className="text-2xl font-bold text-amber-500 mt-1">{unreadCount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="text-2xl font-bold text-emerald-500 mt-1">{total}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-2">Current Filter Criteria:</p>
              <p className="text-sm text-gray-300 p-3 bg-gray-900 rounded border border-gray-700">
                {buildCriteriaSummary(filter)}
              </p>
            </div>

            {/* Sample Notifications */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400">Sample Matching Notifications</p>
              {[
                { title: 'Critical Safety Alert', type: 'safety_incident', severity: 'critical', time: '5m ago' },
                { title: 'Approval Needed: Budget Variance', type: 'budget_alert', severity: 'warning', time: '2h ago' },
                { title: 'RFI Response Received', type: 'rfi_response', severity: 'info', time: '4h ago' },
              ].map((notif, idx) => (
                <div key={idx} className="p-3 bg-gray-800 rounded border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-200">{notif.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{notif.type} • {notif.time}</p>
                    </div>
                    <span className={`badge ${
                      notif.severity === 'critical' ? 'bg-red-500/20 text-red-500' :
                      notif.severity === 'warning' ? 'bg-amber-500/20 text-amber-500' :
                      'bg-blue-500/20 text-blue-500'
                    }`}>
                      {notif.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default NotificationFilters;
