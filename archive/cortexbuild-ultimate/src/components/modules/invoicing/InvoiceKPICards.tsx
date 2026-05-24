import { clsx } from 'clsx';

type KPICardsProps = {
  totals: { sent: number; paid: number; overdue: number; draft: number };
  filter: string;
  onFilterChange: (f: string) => void;
  fmt: (n: number) => string;
};

export function InvoiceKPICards({ totals, filter, onFilterChange, fmt }: KPICardsProps) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {[
        { key: 'sent', label: 'Outstanding', val: totals.sent, cls: 'text-blue-400', border: 'border-blue-800/50' },
        { key: 'paid', label: 'Collected', val: totals.paid, cls: 'text-green-400', border: 'border-green-800/50' },
        { key: 'overdue', label: 'Overdue', val: totals.overdue, cls: 'text-red-400', border: 'border-red-800/50' },
        { key: 'draft', label: 'Draft', val: totals.draft, cls: 'text-gray-400', border: 'border-gray-700' },
      ].map(({ key, label, val, cls, border }) => (
        <button
          key={key}
          onClick={() => onFilterChange(filter === key ? 'all' : key)}
          className={clsx(
            'rounded-2xl border bg-gray-900 p-4 text-left hover:opacity-90 transition-all',
            border,
            filter === key && 'ring-2 ring-orange-500/30'
          )}
        >
          <p className="text-xs text-gray-400">{label}</p>
          <p className={clsx('text-xl font-bold mt-1', cls)}>{fmt(val)}</p>
        </button>
      ))}
    </div>
  );
}
