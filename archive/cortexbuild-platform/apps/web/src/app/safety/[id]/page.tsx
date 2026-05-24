'use client';

import { EntityDetail } from '@/components/EntityDetail';

export default function SafetyIncidentDetailPage() {
  return (
    <EntityDetail
      config={{
        entityName: 'Safety incident',
        pluralName: 'Safety',
        apiPath: '/safety',
        backHref: '/safety',
        pills: [
          { field: 'severity', colors: {
            minor: 'bg-blue-100 text-blue-700',
            moderate: 'bg-amber-100 text-amber-700',
            major: 'bg-orange-100 text-orange-700',
            critical: 'bg-red-100 text-red-700',
            'near-miss': 'bg-purple-100 text-purple-700',
          } },
          { field: 'status', colors: {
            open: 'bg-red-100 text-red-700',
            investigating: 'bg-amber-100 text-amber-700',
            resolved: 'bg-green-100 text-green-700',
            closed: 'bg-gray-100 text-gray-700',
          } },
        ],
        fields: [
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'description', label: 'Description', type: 'textarea' },
          { key: 'severity', label: 'Severity', type: 'select',
            options: ['minor','moderate','major','critical','near-miss'].map((v) => ({ value: v, label: v })) },
          { key: 'status', label: 'Status', type: 'select',
            options: ['open','investigating','resolved','closed'].map((v) => ({ value: v, label: v })) },
          { key: 'location', label: 'Location', type: 'text' },
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
