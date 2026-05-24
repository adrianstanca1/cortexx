import { Edit2, Trash2 } from 'lucide-react';
import clsx from 'clsx';

type Invoice = Record<string, unknown>;

type StatusConfig = Record<string, { label: string; color: string; bg: string }>;

type InvoiceDetailPanelProps = {
  invoice: Invoice;
  onClose: () => void;
  onEdit: (inv: Invoice) => void;
  onDelete: (id: string) => void;
  fmt: (n: number) => string;
  statusConfig: StatusConfig;
};

export function InvoiceDetailPanel({ invoice, onClose, onEdit, onDelete, fmt, statusConfig }: InvoiceDetailPanelProps) {
  const cfg = statusConfig[String(invoice.status)] ?? statusConfig.draft;

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-full max-w-md bg-gray-900 border-l border-gray-700 p-8 overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="space-y-6">
          {/* Company Header */}
          <div>
            <h1 className="text-2xl font-bold text-white">CortexBuild Ltd</h1>
            <p className="text-xs text-gray-400 mt-1">Building & Construction</p>
          </div>

          {/* Invoice Title & Number */}
          <div className="border-b border-gray-700 pb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Invoice</p>
            <p className="text-2xl font-bold text-emerald-400 font-mono">
              {String(invoice.number)}
            </p>
          </div>

          {/* Key Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-1">Issue Date</p>
              <p className="text-white font-medium">
                {String(invoice.issueDate ?? '—')}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Due Date</p>
              <p className="text-white font-medium">
                {String(invoice.dueDate ?? '—')}
              </p>
            </div>
          </div>

          {/* Client Info */}
          <div className="border-t border-b border-gray-700 py-4">
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Bill To</p>
            <p className="text-white font-medium">{String(invoice.client)}</p>
            {Boolean(invoice.project) && (
              <p className="text-sm text-gray-400 mt-1">Project: {String(invoice.project)}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Description</p>
            <p className="text-white">{String(invoice.description)}</p>
          </div>

          {/* Amounts */}
          <div className="space-y-2 bg-gray-800/30 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Subtotal</span>
              <span className="text-white font-medium">{fmt(Number(invoice.amount))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">VAT</span>
              <span className="text-white font-medium">{fmt(Number(invoice.vat))}</span>
            </div>
            {(() => {
              const cisValue = Number(invoice.cis_deduction ?? invoice.cisDeduction ?? 0);
              const safeCis = Number.isFinite(cisValue) ? cisValue : 0;
              return (<>
                {safeCis > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">CIS Deduction</span>
                    <span className="text-orange-400 font-medium">
                      -{fmt(safeCis)}
                    </span>
                  </div>
                )}
                <div className="border-t border-gray-700 pt-2 mt-2 flex justify-between">
                  <span className="text-white font-semibold">Total Due</span>
                  <span className="text-emerald-400 font-bold text-lg">
                    {fmt(
                      Number(invoice.amount) +
                        Number(invoice.vat) -
                        safeCis
                    )}
                  </span>
                </div>
              </>);
            })()}
          </div>

          {/* Status */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Status</p>
            <span className={clsx('rounded-full px-3 py-1 text-xs font-bold', cfg.bg, cfg.color)}>
              {cfg.label || 'Unknown'}
            </span>
          </div>

          {/* Payment Terms & Bank Details */}
          <div className="border-t border-gray-700 pt-4 space-y-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">Payment Terms</p>
              <p className="text-white text-sm">{String(invoice.paymentTerms ?? 'Net 30')}</p>
            </div>
            {Boolean(invoice.bankAccount) && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Bank Account</p>
                <p className="text-white text-sm font-mono">{String(invoice.bankAccount)}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-gray-700">
            <button
              onClick={() => onEdit(invoice)}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 flex items-center justify-center gap-1"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              onClick={() => onDelete(String(invoice.id))}
              className="rounded-xl bg-red-900/30 px-3 text-red-400 hover:bg-red-900/50 py-2.5"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full rounded-xl bg-gray-800 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-700 mt-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
