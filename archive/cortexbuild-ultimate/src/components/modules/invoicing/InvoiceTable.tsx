import { FileText, Edit2, Send, Trash2, CheckSquare, Square } from 'lucide-react';
import clsx from 'clsx';
import { BulkActionsBar } from '../../ui/BulkActions';
import { EmptyState } from '../../ui/EmptyState';

type Invoice = Record<string, unknown>;

type StatusConfig = Record<string, { label: string; color: string; bg: string }>;

type InvoiceTableProps = {
  invoices: Invoice[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onRowClick: (id: string) => void;
  onEdit: (inv: Invoice) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onBulkDelete: (ids: string[]) => void | Promise<void>;
  onClearSelection: () => void;
  isLoading: boolean;
  openCreate: () => void;
  fmt: (n: number) => string;
  statusConfig: StatusConfig;
};

export function InvoiceTable({
  invoices,
  selectedIds,
  onToggle,
  onRowClick,
  onEdit,
  onDelete,
  onStatusChange,
  onBulkDelete,
  onClearSelection,
  isLoading,
  openCreate,
  fmt,
  statusConfig,
}: InvoiceTableProps) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden mb-8">
      <div className="cb-table-scroll touch-pan-x">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Invoice #', 'Client', 'Project', 'Amount', 'VAT', 'CIS', 'Status', 'Due', 'Actions'].map(
                h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {invoices.map((inv: Invoice) => {
              const cfg = statusConfig[String(inv.status)] ?? statusConfig.draft;
              const invId = String(inv.id);
              const isSelected = selectedIds.has(invId);
              return (
                <tr
                  key={invId}
                  className={`hover:bg-gray-800/50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-900/20' : ''}`}
                  onClick={() => onRowClick(invId)}
                >
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <button type="button" onClick={() => onToggle(invId)}>
                      {isSelected ? (
                        <CheckSquare size={16} className="text-blue-400" />
                      ) : (
                        <Square size={16} className="text-gray-500" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-mono text-white font-medium whitespace-nowrap">
                        {String(inv.number)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{String(inv.client)}</td>
                  <td className="px-4 py-3 text-gray-400 max-w-[140px] truncate">
                    {String(inv.project ?? '—')}
                  </td>
                  <td className="px-4 py-3 text-white font-semibold whitespace-nowrap">
                    {fmt(Number(inv.amount))}
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmt(Number(inv.vat))}</td>
                  <td className="px-4 py-3 text-orange-400 whitespace-nowrap">
                    {Number(inv.cisDeduction ?? 0) > 0
                      ? `-${fmt(Number(inv.cisDeduction ?? 0))}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        'rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap',
                        cfg.bg,
                        cfg.color
                      )}
                    >
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {String(inv.dueDate ?? '—')}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onEdit(inv)}
                        className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-blue-400 hover:bg-gray-700"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {String(inv.status) === 'draft' && (
                        <button
                          onClick={() => onStatusChange(String(inv.id), 'sent')}
                          className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-green-400 hover:bg-gray-700"
                          title="Mark as Sent"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {String(inv.status) === 'sent' && (
                        <button
                          onClick={() => onStatusChange(String(inv.id), 'paid')}
                          className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-emerald-400 hover:bg-gray-700"
                          title="Mark as Paid"
                        >
                          <span className="text-xs font-bold">✓</span>
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(String(inv.id))}
                        className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-red-400 hover:bg-gray-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!isLoading && invoices.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No invoices found"
          description="Create your first invoice to get started."
          action={{ label: 'Create Invoice', onClick: openCreate }}
        />
      )}
      <BulkActionsBar
        selectedIds={Array.from(selectedIds)}
        actions={[
          {
            id: 'delete',
            label: 'Delete Selected',
            icon: Trash2,
            variant: 'danger',
            onClick: onBulkDelete,
            confirm: 'This action cannot be undone.',
          },
        ]}
        onClearSelection={onClearSelection}
      />
    </div>
  );
}
