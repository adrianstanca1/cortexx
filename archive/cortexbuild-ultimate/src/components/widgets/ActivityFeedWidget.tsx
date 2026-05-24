import React, { useState, useMemo } from 'react';
import {
  User,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  MessageSquare,
  Upload,
  Edit3,
  MoreHorizontal,
  Filter,
  RefreshCw,
} from 'lucide-react';

/**
 * ActivityFeedWidget
 *
 * Displays recent activity stream with user avatars, action type icons,
 * relative timestamps, and filter functionality.
 *
 * @param props - Component props
 * @returns JSX element displaying activity feed
 *
 * @example
 * ```tsx
 * <ActivityFeedWidget
 *   projectId="proj-123"
 *   limit={10}
 *   onActivityClick={(activity) => handleNavigate(activity)}
 * />
 * ```
 */

export type ActivityType =
  | 'comment'
  | 'update'
  | 'alert'
  | 'complete'
  | 'create'
  | 'upload'
  | 'edit';

export type ActivitySize = 'small' | 'medium' | 'large';

export interface Activity {
  id: string;
  type: ActivityType;
  userId: string;
  userName: string;
  userAvatar?: string;
  action: string;
  target: string;
  targetUrl?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityFeedWidgetProps {
  /** Optional project ID to filter activities */
  projectId?: string;
  /** Maximum number of activities to display */
  limit?: number;
  /** Filter by activity type */
  filterType?: ActivityType | 'all';
  /** Click handler for activity items */
  onActivityClick?: (activity: Activity) => void;
  /** Size variant */
  size?: ActivitySize;
  /** Show filter controls */
  showFilter?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Custom className */
  className?: string;
}

const activityIcons: Record<ActivityType, React.ReactNode> = {
  comment: <MessageSquare className="w-4 h-4" />,
  update: <Edit3 className="w-4 h-4" />,
  alert: <AlertTriangle className="w-4 h-4" />,
  complete: <CheckCircle className="w-4 h-4" />,
  create: <Clock className="w-4 h-4" />,
  upload: <Upload className="w-4 h-4" />,
  edit: <FileText className="w-4 h-4" />,
};

const activityColors: Record<ActivityType, string> = {
  comment: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  update: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  alert: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  complete: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  create: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  upload: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  edit: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const sizeClasses: Record<ActivitySize, {
  padding: string;
  avatarSize: string;
  textSize: string;
  iconSize: string;
}> = {
  small: {
    padding: 'p-3',
    avatarSize: 'w-7 h-7',
    textSize: 'text-xs',
    iconSize: 'w-3 h-3',
  },
  medium: {
    padding: 'p-4',
    avatarSize: 'w-8 h-8',
    textSize: 'text-sm',
    iconSize: 'w-4 h-4',
  },
  large: {
    padding: 'p-5',
    avatarSize: 'w-10 h-10',
    textSize: 'text-base',
    iconSize: 'w-5 h-5',
  },
};

/**
 * ActivityItem Component
 */
function ActivityItem({
  activity,
  size,
  onClick,
}: {
  activity: Activity;
  size: ActivitySize;
  onClick?: () => void;
}) {
  const sizes = sizeClasses[size];

  const getTimeAgo = (timestamp: string): string => {
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
  };

  return (
    <div
      className={`flex gap-3 ${sizes.padding} rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {activity.userAvatar ? (
          <img
            src={activity.userAvatar}
            alt={activity.userName}
            className={`${sizes.avatarSize} rounded-full object-cover ring-2 ring-white dark:ring-gray-700`}
          />
        ) : (
          <div
            className={`${sizes.avatarSize} rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-medium text-xs ring-2 ring-white dark:ring-gray-700`}
          >
            {activity.userName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`${sizes.textSize} text-gray-900 dark:text-gray-100 leading-relaxed`}>
          <span className="font-semibold">{activity.userName}</span>{' '}
          <span className="text-gray-500 dark:text-gray-400">{activity.action}</span>{' '}
          <span className="font-medium text-primary hover:underline">{activity.target}</span>
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {getTimeAgo(activity.timestamp)}
        </p>
      </div>

      {/* Type Icon */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${activityColors[activity.type]}`}
      >
        {activityIcons[activity.type]}
      </div>
    </div>
  );
}

/**
 * ActivityFeedWidget Component
 */
export function ActivityFeedWidget({
  projectId,
  limit = 10,
  filterType = 'all',
  onActivityClick,
  size = 'medium',
  showFilter = true,
  isLoading = false,
  onRefresh,
  className = '',
}: ActivityFeedWidgetProps) {
  const [selectedFilter, setSelectedFilter] = useState<ActivityType | 'all'>(filterType);

  // Mock data - replace with actual API call
  const [activities] = useState<Activity[]>([
    {
      id: '1',
      type: 'create',
      userId: 'user1',
      userName: 'Sarah Chen',
      userAvatar: '/avatars/sarah.jpg',
      action: 'created',
      target: 'new project milestone',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    {
      id: '2',
      type: 'complete',
      userId: 'user2',
      userName: 'James Miller',
      action: 'completed',
      target: 'safety inspection report',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: '3',
      type: 'alert',
      userId: 'system',
      userName: 'System',
      action: 'alerted',
      target: 'budget variance exceeded 10%',
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
    {
      id: '4',
      type: 'update',
      userId: 'user3',
      userName: 'Patricia Watson',
      action: 'updated',
      target: 'project timeline',
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
    {
      id: '5',
      type: 'comment',
      userId: 'user4',
      userName: 'Michael Brown',
      action: 'commented on',
      target: 'RFI-2024-001',
      timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    },
    {
      id: '6',
      type: 'upload',
      userId: 'user5',
      userName: 'Emma Wilson',
      action: 'uploaded',
      target: 'site photos batch #42',
      timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    },
    {
      id: '7',
      type: 'edit',
      userId: 'user6',
      userName: 'David Lee',
      action: 'edited',
      target: 'method statement v3',
      timestamp: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    },
  ]);

  const filteredActivities = useMemo(() => {
    let filtered = activities;
    if (selectedFilter !== 'all') {
      filtered = filtered.filter((a) => a.type === selectedFilter);
    }
    if (projectId) {
      filtered = filtered.filter((a) => a.metadata?.projectId === projectId);
    }
    return filtered.slice(0, limit);
  }, [activities, selectedFilter, projectId, limit]);

  const activityTypes: Array<{ value: ActivityType | 'all'; label: string }> = [
    { value: 'all', label: 'All Activity' },
    { value: 'create', label: 'Created' },
    { value: 'update', label: 'Updated' },
    { value: 'complete', label: 'Completed' },
    { value: 'comment', label: 'Comments' },
    { value: 'alert', label: 'Alerts' },
    { value: 'upload', label: 'Uploads' },
    { value: 'edit', label: 'Edits' },
  ];

  const sizes = sizeClasses[size];

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Recent Activity
        </h3>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          {showFilter && (
            <div className="relative">
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value as ActivityType | 'all')}
                className="appearance-none pl-8 pr-8 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary cursor-pointer"
              >
                {activityTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <Filter className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <MoreHorizontal className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Activity List */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[500px] overflow-y-auto">
        {filteredActivities.length > 0 ? (
          filteredActivities.map((activity) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              size={size}
              onClick={() => onActivityClick?.(activity)}
            />
          ))
        ) : (
          <div className={`${sizes.padding} text-center text-gray-500 dark:text-gray-400`}>
            <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className={sizeClasses[size].textSize}>No activity to display</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivityFeedWidget;
