import React, { useMemo } from 'react';
import { Calendar, User, ChevronRight } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETE' | 'BLOCKED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dueDate?: string;
  assignee?: { name: string; avatarUrl?: string };
}

interface TaskListProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onViewAll?: () => void;
}

const statusColors: Record<string, string> = {
  TODO: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  REVIEW: 'bg-yellow-100 text-yellow-800',
  COMPLETE: 'bg-green-100 text-green-800',
  BLOCKED: 'bg-red-100 text-red-800',
};

const priorityColors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-yellow-100 text-yellow-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-lg shadow border border-gray-200">{children}</div>;
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold text-gray-900">{children}</h3>;
}

function CardContent({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-4">{children}</div>;
}

function Button({ children, onClick, className = '' }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

function Badge({ children, variant = 'secondary' }: { children: React.ReactNode; variant?: string }) {
  let classes = 'bg-gray-100 text-gray-800';
  if (variant && statusColors[variant]) {
    classes = statusColors[variant];
  } else if (variant && priorityColors[variant]) {
    classes = priorityColors[variant];
  }
  return <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${classes}`}>{children}</span>;
}

export function TaskList({ tasks, onTaskClick, onViewAll }: TaskListProps) {
  const groupedTasks = useMemo(() => {
    const groups: Record<Task['status'], Task[]> = {
      TODO: [],
      IN_PROGRESS: [],
      REVIEW: [],
      COMPLETE: [],
      BLOCKED: [],
    };
    tasks.forEach((task) => groups[task.status].push(task));
    return groups;
  }, [tasks]);

  const statusOrder: Task['status'][] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETE', 'BLOCKED'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks</CardTitle>
        {onViewAll && (
          <Button onClick={onViewAll}>
            View All <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {statusOrder.map((status) => {
            const statusTasks = groupedTasks[status];
            if (statusTasks.length === 0) return null;
            return (
              <div key={status}>
                <div className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                  {status.replace('_', ' ')}
                  <Badge variant={status}>{statusTasks.length}</Badge>
                </div>
                <div className="space-y-2">
                  {statusTasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => onTaskClick?.(task)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate text-gray-900">{task.title}</div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          {task.assignee && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {task.assignee.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={task.priority}>{task.priority}</Badge>
                        <Badge variant={task.status}>{task.status.replace('_', ' ')}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {tasks.length === 0 && (
            <p className="text-center text-gray-500 py-8">No tasks found</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
