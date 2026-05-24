'use client';

import { EntityDetail } from '@/components/EntityDetail';

export default function RfiDetailPage() {
  return (
    <EntityDetail
      config={{
        entityName: 'RFI',
        pluralName: 'RFIs',
        apiPath: '/rfi',
        backHref: '/rfi',
        titleField: 'subject',
        pills: [
          { field: 'status', colors: {
            submitted: 'bg-blue-100 text-blue-700',
            open: 'bg-amber-100 text-amber-700',
            answered: 'bg-green-100 text-green-700',
            approved: 'bg-emerald-100 text-emerald-700',
            rejected: 'bg-red-100 text-red-700',
            closed: 'bg-gray-100 text-gray-700',
          } },
        ],
        fields: [
          { key: 'subject', label: 'Subject', type: 'text', required: true },
          { key: 'question', label: 'Question', type: 'textarea', required: true },
          { key: 'response', label: 'Response', type: 'textarea' },
          { key: 'status', label: 'Status', type: 'select',
            options: ['submitted','open','answered','approved','rejected','closed'].map((v) => ({ value: v, label: v })) },
          { key: 'dueDate', label: 'Due date', type: 'date' },
        ],
        longTextFields: [
          { key: 'question', label: 'Question' },
          { key: 'response', label: 'Response' },
        ],
        metaFields: [
          { label: 'Project', render: (r) => r.projectName || r.project_name || '—' },
          { label: 'Due', render: (r) => r.dueDate || r.due_date || '—' },
        ],
      }}
    />
  );
}
