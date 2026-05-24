import React from 'react';

interface TableProps {
  data: Record<string, unknown>[];
  columns: Array<{
    key: string;
    title: string;
    render?: (value: unknown, row: Record<string, unknown>, index: number) => React.ReactNode;
    className?: string;
  }>;
  striped?: boolean;
  hover?: boolean;
  pinRows?: boolean;
  pinCols?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onRowClick?: (row: Record<string, unknown>, index: number) => void;
  emptyMessage?: string;
}

export const Table: React.FC<TableProps> = ({
  data,
  columns,
  striped = true,
  hover = true,
  pinRows = false,
  pinCols = false,
  size = 'md',
  className = '',
  onRowClick,
  emptyMessage = 'No data available',
}) => {
  const classes = [
    'table',
    striped ? 'table-zebra' : '',
    hover ? 'hover' : '',
    pinRows ? 'table-pin-rows' : '',
    pinCols ? 'table-pin-cols' : '',
    className,
  ].filter(Boolean).join(' ');

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-base-content/50">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="cb-table-scroll touch-pan-x">
      <table className={classes}>
        <thead>
          <tr className={size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg' : ''}>
            {columns.map((column) => (
              <th key={column.key} className={column.className}>
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={onRowClick ? 'cursor-pointer hover:bg-base-300' : ''}
              onClick={() => onRowClick?.(row, rowIndex)}
            >
              {columns.map((column) => (
                <td key={column.key} className={column.className}>
                  {column.render
                    ? column.render(row[column.key], row, rowIndex)
                    : String(row[column.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
