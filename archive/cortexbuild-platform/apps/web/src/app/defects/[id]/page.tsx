'use client';

import { EntityDetail } from '@/components/EntityDetail';

export default function DefectDetailPage() {
  return (
    <EntityDetail
      config={{
        entityName: 'Defect',
        pluralName: 'Defects',
        apiPath: '/defects',
        backHref: '/defects',
        pills: [
          { field: 'priority', colors: {
            low: 'bg-gray-100 text-gray-700',
            medium: 'bg-blue-100 text-blue-700',
            high: 'bg-amber-100 text-amber-700',
            critical: 'bg-red-100 text-red-700',
          } },
          { field: 'status', colors: {
            open: 'bg-red-100 text-red-700',
            'in-progress': 'bg-blue-100 text-blue-700',
            fixed: 'bg-purple-100 text-purple-700',
            verified: 'bg-emerald-100 text-emerald-700',
            closed: 'bg-gray-100 text-gray-700',
          } },
        ],
        fields: [
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'description', label: 'Description', type: 'textarea' },
          { key: 'location', label: 'Location', type: 'text' },
          { key: 'priority', label: 'Priority', type: 'select',
            options: ['low','medium','high','critical'].map((v) => ({ value: v, label: v })) },
          { key: 'status', label: 'Status', type: 'select',
            options: ['open','in-progress','fixed','verified','closed'].map((v) => ({ value: v, label: v })) },
        ],
        longTextFields: [{ key: 'description', label: 'Description' }],
        metaFields: [
          { label: 'Project', render: (r) => r.projectName || r.project_name || '—' },
          { label: 'Location', render: (r) => r.location || '—' },
        ],
      }}
    />
  );
}
