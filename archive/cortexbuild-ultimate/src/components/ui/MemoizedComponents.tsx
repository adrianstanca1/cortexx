import { memo, useMemo } from 'react';

interface DataTableProps {
  data: Record<string, unknown>[];
  columns: { key: string; label: string; render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode }[];
  onRowClick?: (row: Record<string, unknown>) => void;
}

export const MemoizedDataTable = memo(function MemoizedDataTable({ data, columns, onRowClick }: DataTableProps) {
  const renderedRows = useMemo(() => {
    return data.map((row, rowIndex) => (
      <tr 
        key={rowIndex} 
        onClick={() => onRowClick?.(row)}
        className="hover:bg-base-200 cursor-pointer"
      >
        {columns.map(col => (
          <td key={col.key} className="p-3">
            {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
          </td>
        ))}
      </tr>
    ));
  }, [data, columns, onRowClick]);

  return (
    <div className="cb-table-scroll touch-pan-x">
      <table className="table table-zebra w-full">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} className="p-3">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {renderedRows}
        </tbody>
      </table>
    </div>
  );
});

// Memoized KPI Card
interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  color?: string;
}

export const MemoizedKPICard = memo(function MemoizedKPICard({ title, value, change, icon, color: _color = 'primary' }: KPICardProps) {
  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <div className="card-body p-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {change !== undefined && (
              <p className={`text-xs mt-1 ${change >= 0 ? 'text-success' : 'text-error'}`}>
                {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
              </p>
            )}
          </div>
          {icon && <div className="text-amber-500">{icon}</div>}
        </div>
      </div>
    </div>
  );
});
