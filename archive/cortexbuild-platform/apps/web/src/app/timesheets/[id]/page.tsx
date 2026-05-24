'use client';

import { EntityDetail } from '@/components/EntityDetail';

export default function TimesheetDetailPage() {
  return (
    <EntityDetail
      config={{
        entityName: 'Timesheet',
        pluralName: 'Timesheets',
        apiPath: '/timesheets',
        backHref: '/timesheets',
        titleField: 'entryDate',
        pills: [
          { field: 'status', colors: {
            submitted: 'bg-blue-100 text-blue-700',
            approved: 'bg-green-100 text-green-700',
            rejected: 'bg-red-100 text-red-700',
            paid: 'bg-emerald-100 text-emerald-700',
          } },
        ],
        fields: [
          { key: 'entryDate', label: 'Entry date', type: 'date', required: true },
          { key: 'hoursWorked', label: 'Hours worked', type: 'number', required: true },
          { key: 'workDescription', label: 'Work description', type: 'textarea' },
          { key: 'status', label: 'Status', type: 'select',
            options: ['submitted','approved','rejected','paid'].map((v) => ({ value: v, label: v })) },
        ],
        longTextFields: [{ key: 'workDescription', label: 'Work description' }],
        metaFields: [
          { label: 'Project', render: (r) => r.projectName || r.project_name || '—' },
          { label: 'Hours', render: (r) => r.hoursWorked ?? '—' },
        ],
      }}
    />
  );
}
