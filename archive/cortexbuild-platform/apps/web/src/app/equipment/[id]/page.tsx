'use client';

import { EntityDetail } from '@/components/EntityDetail';

export default function EquipmentDetailPage() {
  return (
    <EntityDetail
      config={{
        entityName: 'Equipment',
        pluralName: 'Equipment',
        apiPath: '/equipment',
        backHref: '/equipment',
        titleField: 'name',
        pills: [
          { field: 'status', colors: {
            available: 'bg-green-100 text-green-700',
            'in-use': 'bg-blue-100 text-blue-700',
            maintenance: 'bg-amber-100 text-amber-700',
            'out-of-service': 'bg-red-100 text-red-700',
          } },
        ],
        fields: [
          { key: 'name', label: 'Name', type: 'text', required: true },
          { key: 'type', label: 'Type', type: 'text' },
          { key: 'status', label: 'Status', type: 'select',
            options: ['available','in-use','maintenance','out-of-service'].map((v) => ({ value: v, label: v })) },
          { key: 'location', label: 'Location', type: 'text' },
          { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
        longTextFields: [{ key: 'notes', label: 'Notes' }],
        metaFields: [
          { label: 'Type', render: (r) => r.type || '—' },
          { label: 'Location', render: (r) => r.location || '—' },
        ],
      }}
    />
  );
}
