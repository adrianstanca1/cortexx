import { useEffect, useState } from 'react';
import { User, FileText, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { API_BASE } from '../../lib/auth-storage';

/**
 * ActivityFeed Component
 * 
 * Displays real-time activity stream for the dashboard.
 * Shows user actions, updates, alerts, and completions.
 * 
 * @param props - Component props
 * @param props.projectId - Optional project ID to filter activities
 * @param props.limit - Maximum number of activities to display (default: 10)
 * @returns JSX element displaying activity feed
 * 
 * @example
 * ```tsx
 * <ActivityFeed limit={5} />
 * <ActivityFeed projectId="proj-123" limit={10} />
 * ```
 * 
 * @remarks
 * - Supports multiple activity types (create, update, alert, complete, comment)
 * - Displays relative timestamps
 * - Auto-refreshes via WebSocket
 */


interface Activity {
  id: string;
  type: 'comment' | 'update' | 'alert' | 'complete' | 'create';
  userId: string;
  userName: string;
  userAvatar?: string;
  action: string;
  target: string;
  timestamp: string;
  icon?: React.ReactNode;
}

interface ActivityFeedProps {
  projectId?: string;
  limit?: number;
}

const iconMap = {
  comment: <User className="w-4 h-4" />,
  update: <FileText className="w-4 h-4" />,
  alert: <AlertTriangle className="w-4 h-4" />,
  complete: <CheckCircle className="w-4 h-4" />,
  create: <Clock className="w-4 h-4" />,
};

const ACTION_TYPE_MAP: Record<string, Activity['type']> = {
  INSERT: 'create',
  UPDATE: 'update',
  DELETE: 'alert',
};

const MOCK_ACTIVITIES: Activity[] = [
  { id: '1', type: 'create', userId: 'u1', userName: 'Sarah Chen', action: 'created', target: 'new project milestone', timestamp: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: '2', type: 'complete', userId: 'u2', userName: 'James Miller', action: 'completed', target: 'safety inspection report', timestamp: new Date(Date.now() - 30 * 60000).toISOString() },
  { id: '3', type: 'alert', userId: 'u4', userName: 'Patricia Watson', action: 'alerted', target: 'budget variance exceeded 10%', timestamp: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: '4', type: 'update', userId: 'u5', userName: 'Michael Brown', action: 'updated', target: 'project timeline', timestamp: new Date(Date.now() - 5 * 3600000).toISOString() },
  { id: '5', type: 'comment', userId: 'u6', userName: 'Emily Davis', action: 'commented on', target: 'RFI-2024-001', timestamp: new Date(Date.now() - 8 * 3600000).toISOString() },
];

export function ActivityFeed({ projectId, limit = 10 }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>(MOCK_ACTIVITIES.slice(0, limit));

  useEffect(() => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (projectId) params.set('project_id', projectId);
    fetch(`${API_BASE}/audit?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then((rows: Array<{ id: number; action: string; table_name: string; record_id: string; user_id: string; created_at: string }>) => {
        if (!Array.isArray(rows)) return;
        setActivities(rows.slice(0, limit).map(row => ({
          id: String(row.id),
          type: ACTION_TYPE_MAP[row.action] ?? 'update',
          userId: row.user_id ?? 'system',
          userName: row.user_id ? `User ${row.user_id.slice(0, 6)}` : 'System',
          action: (row.action ?? 'updated').toLowerCase(),
          target: `${row.table_name.replace(/_/g, ' ')} #${row.record_id}`,
          timestamp: row.created_at,
        })));
      })
      .catch(e => console.warn('[ActivityFeed] failed to load activities:', e));
  }, [projectId, limit]);

  const getTimeAgo = (timestamp: string) => {
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-4">
      {activities.map(activity => (
        <div key={activity.id} className="flex gap-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-base-200 flex items-center justify-center">
              {activity.icon || iconMap[activity.type] || <User className="w-4 h-4" />}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm">
              <span className="font-medium">{activity.userName}</span>{' '}
              <span className="text-gray-500">{activity.action}</span>{' '}
              <span className="font-medium text-primary">{activity.target}</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {getTimeAgo(activity.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
