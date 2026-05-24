import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  AlertTriangle,
  Flag,
  CheckCircle,
  ChevronRight,
  RefreshCw,
  Search,
  Timer,
  Target,
} from 'lucide-react';

/**
 * DeadlinesWidget
 *
 * Displays upcoming deadlines with days remaining,
 * priority indicators, and quick navigation.
 *
 * @param props - Component props
 * @returns JSX element displaying deadlines
 *
 * @example
 * ```tsx
 * <DeadlinesWidget
 *   projectId="proj-123"
 *   onDeadlineClick={(deadline) => handleNavigate(deadline)}
 * />
 * ```
 */

export type DeadlineType =
  | 'milestone'
  | 'task'
  | 'submission'
  | 'inspection'
  | 'payment'
  | 'permit'
  | 'review'
  | 'meeting';

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type DeadlineStatus = 'upcoming' | 'due_soon' | 'overdue' | 'completed';
export type DeadlinesSize = 'small' | 'medium' | 'large';

export interface Deadline {
  id: string;
  title: string;
  type: DeadlineType;
  priority: Priority;
  status: DeadlineStatus;
  dueDate: string;
  projectId?: string;
  project?: string;
  assignee?: string;
  description?: string;
  completedDate?: string;
}

export interface DeadlinesData {
  total: number;
  upcoming: number;
  dueSoon: number;
  overdue: number;
  completed: number;
  deadlines: Deadline[];
}

export interface DeadlinesWidgetProps {
  /** Optional project ID to filter deadlines */
  projectId?: string;
  /** Click handler for deadline items */
  onDeadlineClick?: (deadline: Deadline) => void;
  /** Size variant */
  size?: DeadlinesSize;
  /** Show search */
  showSearch?: boolean;
  /** Show filter controls */
  showFilter?: boolean;
  /** Show by type sections */
  showByType?: boolean;
  /** Show overdue section prominently */
  highlightOverdue?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Custom className */
  className?: string;
}

const typeConfig: Record<DeadlineType, {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}> = {
  milestone: {
    label: 'Milestone',
    icon: <Target className="w-4 h-4" />,
    color: 'text-purple-600',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
  },
  task: {
    label: 'Task',
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'text-blue-600',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
  },
  submission: {
    label: 'Submission',
    icon: <FileText className="w-4 h-4" />,
    color: 'text-green-600',
    bg: 'bg-green-100 dark:bg-green-900/30',
  },
  inspection: {
    label: 'Inspection',
    icon: <ClipboardList className="w-4 h-4" />,
    color: 'text-orange-600',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
  },
  payment: {
    label: 'Payment',
    icon: <DollarSign className="w-4 h-4" />,
    color: 'text-emerald-600',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  permit: {
    label: 'Permit',
    icon: <FileCheck className="w-4 h-4" />,
    color: 'text-teal-600',
    bg: 'bg-teal-100 dark:bg-teal-900/30',
  },
  review: {
    label: 'Review',
    icon: <Eye className="w-4 h-4" />,
    color: 'text-indigo-600',
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
  meeting: {
    label: 'Meeting',
    icon: <Users className="w-4 h-4" />,
    color: 'text-pink-600',
    bg: 'bg-pink-100 dark:bg-pink-900/30',
  },
};

const priorityConfig: Record<Priority, {
  label: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
}> = {
  low: {
    label: 'Low',
    color: 'text-gray-600',
    bg: 'bg-gray-100 dark:bg-gray-700',
    icon: <Flag className="w-3 h-3" />,
  },
  medium: {
    label: 'Medium',
    color: 'text-blue-600',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    icon: <Flag className="w-3 h-3" />,
  },
  high: {
    label: 'High',
    color: 'text-orange-600',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    icon: <Flag className="w-3 h-3 fill-current" />,
  },
  critical: {
    label: 'Critical',
    color: 'text-red-600',
    bg: 'bg-red-100 dark:bg-red-900/30',
    icon: <AlertTriangle className="w-3 h-3 fill-current" />,
  },
};

const _statusConfig: Record<DeadlineStatus, {
  label: string;
  color: string;
  bg: string;
}> = {
  upcoming: {
    label: 'Upcoming',
    color: 'text-blue-600',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
  },
  due_soon: {
    label: 'Due Soon',
    color: 'text-yellow-600',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  overdue: {
    label: 'Overdue',
    color: 'text-red-600',
    bg: 'bg-red-100 dark:bg-red-900/30',
  },
  completed: {
    label: 'Completed',
    color: 'text-green-600',
    bg: 'bg-green-100 dark:bg-green-900/30',
  },
};

const sizeClasses: Record<DeadlinesSize, {
  padding: string;
  textSize: string;
  labelSize: string;
  valueSize: string;
  itemPadding: string;
  iconSize: string;
}> = {
  small: {
    padding: 'p-3',
    textSize: 'text-xs',
    labelSize: 'text-xs',
    valueSize: 'text-lg',
    itemPadding: 'p-2',
    iconSize: 'w-4 h-4',
  },
  medium: {
    padding: 'p-4',
    textSize: 'text-sm',
    labelSize: 'text-sm',
    valueSize: 'text-2xl',
    itemPadding: 'p-2.5',
    iconSize: 'w-5 h-5',
  },
  large: {
    padding: 'p-5',
    textSize: 'text-base',
    labelSize: 'text-base',
    valueSize: 'text-3xl',
    itemPadding: 'p-3',
    iconSize: 'w-6 h-6',
  },
};

// Import icons that were used but not imported
import { FileText, ClipboardList, DollarSign, FileCheck, Eye, Users } from 'lucide-react';

/**
 * DaysRemaining Component
 */
function DaysRemaining({ dueDate, status, size }: { dueDate: string; status: DeadlineStatus; size: DeadlinesSize }) {
  const sizes = sizeClasses[size];

  const getDaysInfo = (): { days: number; label: string; color: string } => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (status === 'completed') {
      return { days: 0, label: 'Completed', color: 'text-green-600' };
    }
    if (diffDays < 0) {
      return { days: Math.abs(diffDays), label: `${Math.abs(diffDays)}d overdue`, color: 'text-red-600' };
    }
    if (diffDays === 0) {
      return { days: 0, label: 'Due today', color: 'text-orange-600' };
    }
    if (diffDays === 1) {
      return { days: 1, label: 'Tomorrow', color: 'text-yellow-600' };
    }
    if (diffDays <= 7) {
      return { days: diffDays, label: `${diffDays}d left`, color: 'text-yellow-600' };
    }
    return { days: diffDays, label: `${diffDays}d`, color: 'text-gray-500' };
  };

  const info = getDaysInfo();

  return (
    <div className={`text-right ${info.color}`}>
      <div className={`${sizes.textSize} font-semibold`}>{info.label}</div>
      {status !== 'completed' && (
        <div className={`${sizes.labelSize} text-gray-400`}>
          {new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </div>
      )}
    </div>
  );
}

/**
 * PriorityBadge Component
 */
function PriorityBadge({ priority, size: _size }: { priority: Priority; size: DeadlinesSize }) {
  const config = priorityConfig[priority];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

/**
 * DeadlineItem Component
 */
function DeadlineItem({
  deadline,
  size,
  onClick,
}: {
  deadline: Deadline;
  size: DeadlinesSize;
  onClick?: () => void;
}) {
  const sizes = sizeClasses[size];
  const type = typeConfig[deadline.type];

  return (
    <div
      className={`${sizes.itemPadding} rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors border-l-4 ${
        deadline.status === 'overdue'
          ? 'border-red-500'
          : deadline.status === 'due_soon'
          ? 'border-yellow-500'
          : 'border-transparent'
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="flex items-center gap-3">
        {/* Type Icon */}
        <div className={`p-2 rounded-lg ${type.bg}`}>
          {React.cloneElement(type.icon as React.ReactElement<{ className?: string }>, { className: `${sizes.iconSize} ${type.color}` })}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`${sizes.textSize} font-medium text-gray-900 dark:text-white truncate`}>
              {deadline.title}
            </p>
            <PriorityBadge priority={deadline.priority} size={size} />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`${sizes.labelSize} text-gray-500 dark:text-gray-400`}>
              {type.label}
            </span>
            {deadline.project && (
              <>
                <span className={`${sizes.labelSize} text-gray-400`}>•</span>
                <span className={`${sizes.labelSize} text-gray-500 dark:text-gray-400 truncate`}>
                  {deadline.project}
                </span>
              </>
            )}
            {deadline.assignee && (
              <>
                <span className={`${sizes.labelSize} text-gray-400`}>•</span>
                <span className={`${sizes.labelSize} text-gray-500 dark:text-gray-400`}>
                  {deadline.assignee}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Days Remaining */}
        <DaysRemaining dueDate={deadline.dueDate} status={deadline.status} size={size} />

        {/* Arrow */}
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>
    </div>
  );
}

/**
 * DeadlinesWidget Component
 */
export function DeadlinesWidget({
  projectId,
  onDeadlineClick,
  size = 'medium',
  showSearch = true,
  showFilter = true,
  showByType = true,
  highlightOverdue = true,
  isLoading = false,
  onRefresh,
  className = '',
}: DeadlinesWidgetProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [filterType, setFilterType] = useState<DeadlineType | 'all'>('all');
  const sizes = sizeClasses[size];

  // Mock data - replace with actual API call
  const [deadlinesData] = useState<DeadlinesData>({
    total: 28,
    upcoming: 15,
    dueSoon: 8,
    overdue: 5,
    completed: 12,
    deadlines: [
      {
        id: '1',
        title: 'Submit Building Control Application',
        type: 'submission',
        priority: 'critical',
        status: 'overdue',
        dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        project: 'Block A Development',
        assignee: 'Sarah Chen',
      },
      {
        id: '2',
        title: 'Phase 2 Completion Milestone',
        type: 'milestone',
        priority: 'critical',
        status: 'due_soon',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
        project: 'North Wing',
        assignee: 'John Smith',
      },
      {
        id: '3',
        title: 'Weekly Safety Inspection',
        type: 'inspection',
        priority: 'high',
        status: 'due_soon',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1).toISOString(),
        project: 'Main Site',
        assignee: 'Mike Johnson',
      },
      {
        id: '4',
        title: 'Q4 Payment Application',
        type: 'payment',
        priority: 'high',
        status: 'upcoming',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
        project: 'Tower Block',
        assignee: 'Emma Wilson',
      },
      {
        id: '5',
        title: 'RAMS Review Meeting',
        type: 'meeting',
        priority: 'medium',
        status: 'upcoming',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        project: 'Block B',
        assignee: 'David Lee',
      },
      {
        id: '6',
        title: 'Foundation Inspection',
        type: 'inspection',
        priority: 'high',
        status: 'completed',
        dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
        completedDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
        project: 'North Wing',
        assignee: 'Patricia Watson',
      },
      {
        id: '7',
        title: 'Permit Renewal - Crane Operation',
        type: 'permit',
        priority: 'critical',
        status: 'overdue',
        dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
        project: 'Main Site',
      },
      {
        id: '8',
        title: 'Design Review Submission',
        type: 'review',
        priority: 'medium',
        status: 'upcoming',
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(),
        project: 'Block A Development',
        assignee: 'Sarah Chen',
      },
    ],
  });

  const overdueDeadlines = deadlinesData.deadlines.filter((d) => d.status === 'overdue');
  const dueSoonDeadlines = deadlinesData.deadlines.filter((d) => d.status === 'due_soon');
  const upcomingDeadlines = deadlinesData.deadlines.filter((d) => d.status === 'upcoming');

  const filteredDeadlines = deadlinesData.deadlines.filter((deadline) => {
    const matchesSearch = deadline.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deadline.project?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = filterPriority === 'all' || deadline.priority === filterPriority;
    const matchesType = filterType === 'all' || deadline.type === filterType;
    const matchesProject = !projectId || deadline.projectId === projectId;
    return matchesSearch && matchesPriority && matchesType && matchesProject;
  });

  const stats = [
    { label: 'Total', value: deadlinesData.total, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Upcoming', value: deadlinesData.upcoming, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
    { label: 'Due Soon', value: deadlinesData.dueSoon, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
    { label: 'Overdue', value: deadlinesData.overdue, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
  ];

  if (isLoading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}
      >
        <div className={`${sizes.padding} space-y-3 animate-pulse`}>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className={`${sizes.padding} border-b border-gray-100 dark:border-gray-700`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`${sizes.textSize} font-semibold text-gray-900 dark:text-white flex items-center gap-2`}>
            <Timer className="w-5 h-5 text-orange-600" />
            Deadlines
          </h3>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {stats.map((stat) => (
            <div key={stat.label} className={`${stat.bg} rounded-lg p-2 text-center`}>
              <div className={`${sizes.valueSize} font-bold ${stat.color}`}>{stat.value}</div>
              <div className={`${sizes.labelSize} text-gray-600 dark:text-gray-400`}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Search & Filters */}
        {(showSearch || showFilter) && (
          <div className="flex gap-2">
            {showSearch && (
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search deadlines..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 ${sizes.textSize} bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary`}
                />
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            )}
            {showFilter && (
              <>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value as Priority | 'all')}
                  className={`px-3 py-2 ${sizes.textSize} bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary cursor-pointer`}
                >
                  <option value="all">All Priority</option>
                  {Object.keys(priorityConfig).map((priority) => (
                    <option key={priority} value={priority}>
                      {priorityConfig[priority as Priority].label}
                    </option>
                  ))}
                </select>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as DeadlineType | 'all')}
                  className={`px-3 py-2 ${sizes.textSize} bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary cursor-pointer`}
                >
                  <option value="all">All Types</option>
                  {Object.keys(typeConfig).map((type) => (
                    <option key={type} value={type}>
                      {typeConfig[type as DeadlineType].label}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`${sizes.padding} space-y-4 max-h-[600px] overflow-y-auto`}>
        {/* Overdue Deadlines - Highlighted */}
        {highlightOverdue && overdueDeadlines.length > 0 && (
          <div>
            <h4 className={`${sizes.labelSize} font-semibold text-red-600 mb-3 flex items-center gap-2`}>
              <AlertTriangle className="w-4 h-4" />
              Overdue ({overdueDeadlines.length})
            </h4>
            <div className="space-y-2">
              {overdueDeadlines.map((deadline) => (
                <DeadlineItem
                  key={deadline.id}
                  deadline={deadline}
                  size={size}
                  onClick={() => onDeadlineClick?.(deadline)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Due Soon */}
        {showByType && dueSoonDeadlines.length > 0 && (
          <div>
            <h4 className={`${sizes.labelSize} font-semibold text-yellow-600 mb-3 flex items-center gap-2`}>
              <Clock className="w-4 h-4" />
              Due Soon ({dueSoonDeadlines.length})
            </h4>
            <div className="space-y-2">
              {dueSoonDeadlines.map((deadline) => (
                <DeadlineItem
                  key={deadline.id}
                  deadline={deadline}
                  size={size}
                  onClick={() => onDeadlineClick?.(deadline)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming */}
        {showByType && upcomingDeadlines.length > 0 && (
          <div>
            <h4 className={`${sizes.labelSize} font-semibold text-blue-600 mb-3 flex items-center gap-2`}>
              <Calendar className="w-4 h-4" />
              Upcoming ({upcomingDeadlines.length})
            </h4>
            <div className="space-y-2">
              {upcomingDeadlines.slice(0, 5).map((deadline) => (
                <DeadlineItem
                  key={deadline.id}
                  deadline={deadline}
                  size={size}
                  onClick={() => onDeadlineClick?.(deadline)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Filtered Deadlines */}
        {!showByType && filteredDeadlines.length > 0 && (
          <div>
            <h4 className={`${sizes.labelSize} font-semibold text-gray-700 dark:text-gray-300 mb-3`}>
              All Deadlines ({filteredDeadlines.length})
            </h4>
            <div className="space-y-2">
              {filteredDeadlines.slice(0, 10).map((deadline) => (
                <DeadlineItem
                  key={deadline.id}
                  deadline={deadline}
                  size={size}
                  onClick={() => onDeadlineClick?.(deadline)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredDeadlines.length === 0 && (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className={`${sizes.textSize} text-gray-500 dark:text-gray-400`}>
              No deadlines found
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DeadlinesWidget;
