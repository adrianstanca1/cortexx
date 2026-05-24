import React, { useEffect, useState } from 'react';
import { format, differenceInDays, isPast, isToday, isFuture } from 'date-fns';
import { API_BASE } from '../../lib/auth-storage';

interface Task {
  id: string;
  name: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startDate: string | null;
  dueDate: string | null;
  assignee?: { name: string };
}

interface Milestone {
  id: string;
  name: string;
  date: string;
  type: 'start' | 'end' | 'milestone';
}

interface ProjectTimelineProps {
  projectId: string;
  height?: number;
}

export default function ProjectTimeline({ projectId, height = 400 }: ProjectTimelineProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [tasksRes, statsRes] = await Promise.all([
          fetch(`${API_BASE}/tasks?projectId=${projectId}`, { credentials: 'include' }),
          fetch(`${API_BASE}/analytics?action=project-stats&projectId=${projectId}`, { credentials: 'include' }),
        ]);

        if (!tasksRes.ok || !statsRes.ok) throw new Error('Failed to fetch timeline data');

        const tasksData = await tasksRes.json();
        const statsData = await statsRes.json();

        setTasks(Array.isArray(tasksData) ? tasksData : []);

        if (statsData.startDate && statsData.endDate) {
          const projectMilestones: Milestone[] = [
            {
              id: 'start',
              name: 'Project Start',
              date: statsData.startDate,
              type: 'start',
            },
            {
              id: 'end',
              name: 'Project End',
              date: statsData.endDate,
              type: 'end',
            },
          ];

          const completedTasks = tasksData.filter((t: Task) => t.status === 'COMPLETED' && t.dueDate);
          const upcomingTasks = tasksData.filter((t: Task) => t.status !== 'COMPLETED' && t.dueDate && isFuture(new Date(t.dueDate)));

          completedTasks.slice(0, 3).forEach((task: Task) => {
            projectMilestones.push({
              id: `completed-${task.id}`,
              name: `${task.name} (Completed)`,
              date: task.dueDate!,
              type: 'milestone',
            });
          });

          upcomingTasks.slice(0, 2).forEach((task: Task) => {
            projectMilestones.push({
              id: `upcoming-${task.id}`,
              name: task.name,
              date: task.dueDate!,
              type: 'milestone',
            });
          });

          setMilestones(projectMilestones);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="animate-pulse text-gray-500">Loading timeline...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center text-red-500" style={{ height }}>
        {error}
      </div>
    );
  }

  const today = new Date();
  const activeTasks = tasks.filter((t) => t.status === 'IN_PROGRESS');
  const pendingTasks = tasks.filter((t) => t.status === 'PENDING');
  const tasksWithDates = tasks.filter((t) => t.startDate && t.dueDate);

  return (
    <div className="space-y-6" style={{ height }}>
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span>In Progress ({activeTasks.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gray-400" />
            <span>Pending ({pendingTasks.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>Completed ({tasks.filter((t) => t.status === 'COMPLETED').length})</span>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          Today: {format(today, 'MMM d, yyyy')}
        </div>
      </div>

      <div className="overflow-auto" style={{ height: height - 80 }}>
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-200 rounded" />

          <div className="pl-6 space-y-4">
            {milestones.map((milestone) => {
              const milestoneDate = new Date(milestone.date);
              const isPastMilestone = isPast(milestoneDate);
              const isTodayMilestone = isToday(milestoneDate);

              return (
                <div key={milestone.id} className="relative">
                  <div
                    className={`absolute -left-3 w-5 h-5 rounded-full border-2 ${
                      milestone.type === 'start'
                        ? 'bg-green-500 border-green-600'
                        : milestone.type === 'end'
                        ? 'bg-red-500 border-red-600'
                        : isTodayMilestone
                        ? 'bg-blue-500 border-blue-600'
                        : isPastMilestone
                        ? 'bg-gray-400 border-gray-500'
                        : 'bg-white border-gray-300'
                    }`}
                  />
                  <div className="ml-4 pb-4 border-l-2 border-gray-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{milestone.name}</span>
                      {isTodayMilestone && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Today</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {format(milestoneDate, 'MMM d, yyyy')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {tasksWithDates.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Active Tasks</h4>
              <div className="space-y-3">
                {tasksWithDates.slice(0, 10).map((task) => {
                  const startDate = new Date(task.startDate!);
                  const dueDate = new Date(task.dueDate!);
                  const totalDays = differenceInDays(dueDate, startDate);
                  const daysElapsed = differenceInDays(today, startDate);
                  const progress = totalDays > 0 ? Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100)) : 0;

                  return (
                    <div key={task.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            task.status === 'COMPLETED' ? 'bg-green-500' :
                            task.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-gray-400'
                          }`} />
                          <span className="font-medium text-sm text-gray-900">{task.name}</span>
                        </div>
                        <span className="text-xs text-gray-600">
                          {task.assignee?.name || 'Unassigned'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>{format(startDate, 'MMM d')}</span>
                        <span>-</span>
                        <span>{format(dueDate, 'MMM d')}</span>
                        {task.status === 'IN_PROGRESS' && (
                          <span className="ml-auto text-blue-600">{progress.toFixed(0)}%</span>
                        )}
                      </div>
                      {task.status === 'IN_PROGRESS' && (
                        <div className="mt-2 h-1.5 bg-gray-300 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
