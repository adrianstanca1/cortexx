'use client';

import { EntityDetail } from '@/components/EntityDetail';

export default function DailyReportDetailPage() {
  return (
    <EntityDetail
      config={{
        entityName: 'Daily report',
        pluralName: 'Daily reports',
        apiPath: '/daily-reports',
        backHref: '/daily-reports',
        titleField: 'reportDate',
        pills: [
          { field: 'status', colors: {
            draft: 'bg-gray-100 text-gray-700',
            submitted: 'bg-blue-100 text-blue-700',
            approved: 'bg-green-100 text-green-700',
          } },
        ],
        fields: [
          { key: 'reportDate', label: 'Report date', type: 'date', required: true },
          { key: 'weather', label: 'Weather', type: 'text' },
          { key: 'workersOnSite', label: 'Workers on site', type: 'number' },
          { key: 'workCompleted', label: 'Work completed', type: 'textarea' },
          { key: 'issuesDelays', label: 'Issues / delays', type: 'textarea' },
          { key: 'status', label: 'Status', type: 'select',
            options: ['draft','submitted','approved'].map((v) => ({ value: v, label: v })) },
        ],
        longTextFields: [
          { key: 'workCompleted', label: 'Work completed' },
          { key: 'issuesDelays', label: 'Issues / delays' },
        ],
        metaFields: [
          { label: 'Project', render: (r) => r.projectName || r.project_name || '—' },
          { label: 'Workers', render: (r) => r.workersOnSite ?? '—' },
        ],
      }}
    />
  );
}
