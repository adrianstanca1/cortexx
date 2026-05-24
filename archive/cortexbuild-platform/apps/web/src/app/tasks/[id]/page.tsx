'use client';

import { EntityDetail } from '@/components/EntityDetail';

export default function TaskDetailPage() {
  return (
    <EntityDetail
      config={{
        entityName: 'Task',
        pluralName: 'Tasks',
        apiPath: '/tasks',
        backHref: '/tasks',
        pills: [
          { field: 'priority', colors: {
            low: 'bg-gray-100 text-gray-700',
            medium: 'bg-blue-100 text-blue-700',
            high: 'bg-amber-100 text-amber-700',
            urgent: 'bg-red-100 text-red-700',
          } },
          { field: 'status', colors: {
            pending: 'bg-gray-100 text-gray-700',
            'in-progress': 'bg-blue-100 text-blue-700',
            completed: 'bg-green-100 text-green-700',
          } },
        ],
        fields: [
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'description', label: 'Description', type: 'textarea' },
          { key: 'priority', label: 'Priority', type: 'select',
            options: ['low','medium','high','urgent'].map((v) => ({ value: v, label: v })) },
          { key: 'status', label: 'Status', type: 'select',
            options: ['pending','in-progress','completed'].map((v) => ({ value: v, label: v })) },
          { key: 'dueDate', label: 'Due date', type: 'date' },
        ],
        longTextFields: [{ key: 'description', label: 'Description' }],
        metaFields: [
          { label: 'Project', render: (r) => r.projectName || r.project_name || '—' },
          { label: 'Due', render: (r) => r.dueDate || r.due_date || '—' },
          { label: 'Assignee', render: (r) => r.assigneeName || r.assignedToName || '—' },
        ],
      }}
    />
  );
}
