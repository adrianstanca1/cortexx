'use client';

import { EntityDetail } from '@/components/EntityDetail';

export default function InvoiceDetailPage() {
  return (
    <EntityDetail
      config={{
        entityName: 'Invoice',
        pluralName: 'Invoices',
        apiPath: '/invoices',
        backHref: '/invoices',
        titleField: 'invoiceNumber',
        pills: [
          { field: 'status', colors: {
            draft: 'bg-gray-100 text-gray-700',
            sent: 'bg-blue-100 text-blue-700',
            paid: 'bg-green-100 text-green-700',
            overdue: 'bg-red-100 text-red-700',
            cancelled: 'bg-gray-100 text-gray-700',
          } },
        ],
        fields: [
          { key: 'invoiceNumber', label: 'Invoice #', type: 'text', required: true },
          { key: 'supplier', label: 'Supplier', type: 'text' },
          { key: 'amount', label: 'Amount', type: 'number' },
          { key: 'status', label: 'Status', type: 'select',
            options: ['draft','sent','paid','overdue','cancelled'].map((v) => ({ value: v, label: v })) },
          { key: 'dueDate', label: 'Due date', type: 'date' },
          { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
        longTextFields: [{ key: 'notes', label: 'Notes' }],
        metaFields: [
          { label: 'Project', render: (r) => r.projectName || r.project_name || '—' },
          { label: 'Amount', render: (r) => r.amount != null ? `£${r.amount}` : '—' },
          { label: 'Due', render: (r) => r.dueDate || r.due_date || '—' },
        ],
      }}
    />
  );
}
