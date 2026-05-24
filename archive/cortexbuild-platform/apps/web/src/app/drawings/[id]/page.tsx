'use client';

import { EntityDetail } from '@/components/EntityDetail';

export default function DrawingDetailPage() {
  return (
    <EntityDetail
      config={{
        entityName: 'Drawing',
        pluralName: 'Drawings',
        apiPath: '/drawings',
        backHref: '/drawings',
        pills: [
          { field: 'status', colors: {
            current: 'bg-green-100 text-green-700',
            superseded: 'bg-amber-100 text-amber-700',
            archived: 'bg-gray-100 text-gray-700',
          } },
        ],
        fields: [
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'fileUrl', label: 'File URL', type: 'text' },
          { key: 'revision', label: 'Revision', type: 'text' },
          { key: 'status', label: 'Status', type: 'select',
            options: ['current','superseded','archived'].map((v) => ({ value: v, label: v })) },
          { key: 'description', label: 'Description', type: 'textarea' },
        ],
        longTextFields: [{ key: 'description', label: 'Description' }],
        metaFields: [
          { label: 'Revision', render: (r) => r.revision || '—' },
          { label: 'File', render: (r) => r.fileUrl ? (
            <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Open</a>
          ) : '—' },
        ],
      }}
    />
  );
}
