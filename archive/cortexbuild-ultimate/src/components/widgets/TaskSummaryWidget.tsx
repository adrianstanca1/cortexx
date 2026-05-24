import React, { useState } from 'react';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  Calendar,
  Flag,
  MoreHorizontal,
  ChevronRight,
  RefreshCw,
  Filter,
} from 'lucide-react';

/**
 * TaskSummaryWidget
 *
 * Displays task counts by status, overdue tasks highlight,
 * quick add task button, and due date indicators.
 *
 * @param props - Component props
 * @returns JSX element displaying task summary
 *
 * @example
 * ```tsx
 * <TaskSummaryWidget
 *   projectId="proj-123"
 *   onTaskClick={(task) => handleNavigate(task)}
 *   onAddTask={() => setShowAddModal(true)}
 * />
 * ```
 */

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type TaskSummarySize = 'small' | 'medium' | 'large';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string;
  assignee?: {
    name: string;
    avatar?: string;
  };
  projectId?: string;
}

export interface TaskSummaryWidgetProps {
  /** Optional project ID to filter tasks */
  projectId?: string;
  /** Click handler for task items */
  onTaskClick?: (task: Task) => void;
  /** Quick add task handler */
  onAddTask?: () => void;
  /** Size variant */
  size?: TaskSummarySize;
  /** Show overdue tasks section */
  showOverdue?: boolean;
  /** Show due soon tasks section */
  showDueSoon?: boolean;
  /** Show filter controls */
  showFilter?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Custom className */
  className?: string;
}

const statusConfig: Record<TaskStatus, {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}> = {
  todo: {
    label: 'To Do',
    icon: <Clock className="w-4 h-4" />,
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-700',
  },
  in_progress: {
    label: 'In Progress',
    icon: <Clock className="w-4 h-4" />,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
  },
  review: {
    label: 'In Review',
    icon: <AlertCircle className="w-4 h-4" />,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  done: {
    label: 'Done',
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
  },
  blocked: {
    label: 'Blocked',
    icon: <AlertCircle className="w-4 h-4" />,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
  },
};

const priorityConfig: Record<Priority, {
  label: string;
  color: string;
  icon: React.ReactNode;
}> = {
  low: {
    label: 'Low',
    color: 'text-gray-500',
    icon: <Flag className="w-3 h-3" />,
  },
  medium: {
    label: 'Medium',
    color: 'text-blue-500',
    icon: <Flag className="w-3 h-3" />,
  },
  high: {
    label: 'High',
    color: 'text-orange-500',
    icon: <Flag className="w-3 h-3 fill-current" />,
  },
  critical: {
    label: 'Critical',
    color: 'text-red-500',
    icon: <Flag className="w-3 h-3 fill-current" />,
  },
};

const sizeClasses: Record<TaskSummarySize, {
  padding: string;
  textSize: string;
  labelSize: string;
  countSize: string;
  itemPadding: string;
}> = {
  small: {
    padding: 'p-3',
    textSize: 'text-xs',
    labelSize: 'text-xs',
    countSize: 'text-lg',
    itemPadding: 'p-2',
  },
  medium: {
    padding: 'p-4',
    textSize: 'text-sm',
    labelSize: 'text-sm',
    countSize: 'text-2xl',
    itemPadding: 'p-2.5',
  },
  large: {
    padding: 'p-5',
    textSize: 'text-base',
    labelSize: 'text-base',
    countSize: 'text-3xl',
    itemPadding: 'p-3',
  },
};

/**
 * StatusCard Component
 */
function StatusCard({
  status,
  count,
  total,
  onClick,
  size,
}: {
  status: TaskStatus;
  count: number;
  total: number;
  onClick?: () => void;
  size: TaskSummarySize;
}) {
  const config = statusConfig[status];
  const sizes = sizeClasses[size];

  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div
      className={`${sizes.itemPadding} rounded-lg ${config.bg} cursor-pointer hover:opacity-80 transition-opacity`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={config.color}>{config.icon}</span>
        <span className={`${sizes.labelSize} font-medium ${config.color}`}>{config.label}</span>
      </div>
      <div className={`${sizes.countSize} font-bold text-gray-900 dark:text-white`}>{count}</div>
      <div className={`${sizes.textSize} text-gray-500 dark:text-gray-400`}>
        {percentage.toFixed(0)}% of total
      </div>
    </div>
  );
}

/**
 * TaskItem Component
 */
function TaskItem({
  task,
  size,
  onClick,
}: {
  task: Task;
  size: TaskSummarySize;
  onClick?: () => void;
}) {
  const sizes = sizeClasses[size];
  const priority = priorityConfig[task.priority];

  const getDueDateStatus = (dueDate?: string): { label: string; color: string } => {
    if (!dueDate) return { label: 'No due date', color: 'text-gray-400' };

    const due = new Date(dueDate);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, color: 'text-red-600' };
    if (diffDays === 0) return { label: 'Due today', color: 'text-orange-600' };
    if (diffDays <= 3) return { label: `${diffDays}d left`, color: 'text-yellow-600' };
    return { label: due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), color: 'text-gray-500' };
  };

  const dueDateStatus = getDueDateStatus(task.dueDate);

  return (
    <div
      className={`${sizes.itemPadding} rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors flex items-center gap-3`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      {/* Priority */}
      <span className={priority.color} title={priority.label}>
        {priority.icon}
      </span>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <p className={`${sizes.textSize} font-medium text-gray-900 dark:text-white truncate`}>
          {task.title}
        </p>
        {task.assignee && (
          <p className={`${sizes.labelSize} text-gray-500 dark:text-gray-400`}>
            {task.assignee.name}
          </p>
        )}
      </div>

      {/* Due Date */}
      <div className="flex items-center gap-1">
        <Calendar className={`w-3 h-3 ${dueDateStatus.color}`} />
        <span className={`${sizes.labelSize} ${dueDateStatus.color}`}>{dueDateStatus.label}</span>
      </div>

      <ChevronRight className="w-4 h-4 text-gray-400" />
    </div>
  );
}

/**
 * TaskSummaryWidget Component
 */
export function TaskSummaryWidget({
  projectId: _projectId,
  onTaskClick,
  onAddTask,
  size = 'medium',
  showOverdue = true,
  showDueSoon = true,
  showFilter = true,
  isLoading = false,
  onRefresh,
  className = '',
}: TaskSummaryWidgetProps) {
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const sizes = sizeClasses[size];

  // Mock data - replace with actual API call
  const [tasks] = useState<Task[]>([
    {
      id: '1',
      title: 'Complete safety inspection',
      status: 'in_progress',
      priority: 'high',
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
      assignee: { name: 'John Smith' },
    },
    {
      id: '2',
      title: 'Review RFI-2024-042',
      status: 'todo',
      priority: 'critical',
      dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
      assignee: { name: 'Sarah Chen' },
    },
    {
      id: '3',
      title: 'Update project timeline',
      status: 'review',
      priority: 'medium',
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
      assignee: { name: 'Mike Johnson' },
    },
    {
      id: '4',
      title: 'Submit weekly report',
      status: 'blocked',
      priority: 'high',
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1).toISOString(),
    },
    {
      id: '5',
      title: 'Order materials for Phase 2',
      status: 'done',
      priority: 'medium',
      dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      assignee: { name: 'Emma Wilson' },
    },
  ]);

  const taskStats = {
    todo: tasks.filter((t) => t.status === 'todo').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    review: tasks.filter((t) => t.status === 'review').length,
    done: tasks.filter((t) => t.status === 'done').length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
  };

  const totalTasks = tasks.length;

  const overdueTasks = tasks.filter((t) => {
    if (!t.dueDate || t.status === 'done') return false;
    return new Date(t.dueDate) < new Date();
  });

  const dueSoonTasks = tasks.filter((t) => {
    if (!t.dueDate || t.status === 'done') return false;
    const due = new Date(t.dueDate);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 3;
  });

  const filteredTasks = tasks.filter((t) => filterStatus === 'all' || t.status === filterStatus);

  if (isLoading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}
      >
        <div className={`${sizes.padding} space-y-3 animate-pulse`}>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
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
      <div className={`${sizes.padding} border-b border-gray-100 dark:border-gray-700 flex items-center justify-between`}>
        <h3 className={`${sizes.textSize} font-semibold text-gray-900 dark:text-white`}>
          Task Summary
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
          {onAddTask && (
            <button
              onClick={onAddTask}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          )}
          {showFilter && (
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as TaskStatus | 'all')}
                className="appearance-none pl-8 pr-8 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">In Review</option>
                <option value="done">Done</option>
                <option value="blocked">Blocked</option>
              </select>
              <Filter className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <MoreHorizontal className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`${sizes.padding} space-y-4`}>
        {/* Status Cards */}
        <div className="grid grid-cols-5 gap-2">
          {(Object.keys(statusConfig) as TaskStatus[]).map((status) => (
            <StatusCard
              key={status}
              status={status}
              count={taskStats[status]}
              total={totalTasks}
              size={size}
              onClick={() => setFilterStatus(status)}
            />
          ))}
        </div>

        {/* Overdue Tasks */}
        {showOverdue && overdueTasks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className={`${sizes.labelSize} font-medium text-red-600 flex items-center gap-1`}>
                <AlertCircle className="w-4 h-4" />
                Overdue ({overdueTasks.length})
              </h4>
            </div>
            <div className="space-y-1">
              {overdueTasks.slice(0, 3).map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  size={size}
                  onClick={() => onTaskClick?.(task)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Due Soon Tasks */}
        {showDueSoon && dueSoonTasks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className={`${sizes.labelSize} font-medium text-yellow-600 flex items-center gap-1`}>
                <Clock className="w-4 h-4" />
                Due Soon ({dueSoonTasks.length})
              </h4>
            </div>
            <div className="space-y-1">
              {dueSoonTasks.slice(0, 3).map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  size={size}
                  onClick={() => onTaskClick?.(task)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Tasks (filtered) */}
        {filteredTasks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className={`${sizes.labelSize} font-medium text-gray-700 dark:text-gray-300`}>
                {filterStatus === 'all' ? 'All Tasks' : statusConfig[filterStatus].label} (
                {filteredTasks.length})
              </h4>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {filteredTasks.slice(0, 5).map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  size={size}
                  onClick={() => onTaskClick?.(task)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TaskSummaryWidget;
