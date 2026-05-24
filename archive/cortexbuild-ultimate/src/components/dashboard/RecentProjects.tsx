import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useProjects } from '../../hooks/useData';
import type { Row } from '../../services/api';

const statusColors: Record<string, string> = {
  PLANNING: 'bg-purple-100 text-purple-800',
  ACTIVE: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  ON_HOLD: 'bg-orange-100 text-orange-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export function RecentProjects() {
  const { data: projectsRaw, isLoading } = useProjects.useList();
  const projects = (projectsRaw ?? []) as Row[];

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const recentProjects = projects.slice(0, 5);

  if (recentProjects.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Projects</h3>
        <p className="text-gray-500 text-sm">No projects yet. Create your first project to get started.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Projects</h3>
        <a
          href="/dashboard/projects"
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          View all
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      <div className="space-y-3">
        {recentProjects.map((project) => {
          const id = String(project.id ?? '');
          const name = String(project.name ?? 'Untitled');
          const status = String(project.status ?? 'PLANNING');
          const client = String(project.client ?? project.company ?? '');
          const description =
            project.description !== undefined && project.description !== null
              ? String(project.description)
              : '';
          const budgetRaw = project.budget;
          const budget = typeof budgetRaw === 'number' ? budgetRaw : budgetRaw !== null && budgetRaw !== undefined ? Number(budgetRaw) : 0;
          const updatedAtRaw = project.updatedAt;
          const updatedAt =
            typeof updatedAtRaw === 'string' || typeof updatedAtRaw === 'number'
              ? new Date(updatedAtRaw)
              : new Date();

          return (
            <a
              key={id}
              href={`/dashboard/projects/${id}`}
              className="block p-4 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{name}</h4>
                    {client ? (
                      <p className="text-xs text-gray-500 mt-0.5">{client}</p>
                    ) : null}
                    {description ? (
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                        {description}
                      </p>
                    ) : null}
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
                        {status.replace('_', ' ')}
                      </span>
                      {budget > 0 && (
                        <span className="text-xs text-gray-500">
                          Budget: ${budget.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {formatDistanceToNow(updatedAt, { addSuffix: true })}
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
