import { useState, useCallback } from 'react';
import { CheckSquare, Square, X } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';

export interface BulkAction {
  id: string;
  label: string;
  icon: React.ElementType;
  variant?: 'default' | 'danger' | 'primary';
  onClick: (selectedIds: string[]) => void | Promise<void>;
  confirm?: string;
  disabled?: boolean;
}

interface BulkActionsBarProps {
  selectedIds: string[];
  actions: BulkAction[];
  onClearSelection: () => void;
  className?: string;
}

export function BulkActionsBar({ selectedIds, actions, onClearSelection, className }: BulkActionsBarProps) {
  if (selectedIds.length === 0) return null;

  return (
    <div className={clsx(
      'fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 p-4 z-40 shadow-2xl',
      'flex items-center justify-between animate-slide-up',
      className
    )}>
      <div className="flex items-center gap-4">
        <span className="px-3 py-1.5 bg-blue-600 text-white rounded-full text-sm font-medium">
          {selectedIds.length} selected
        </span>
        <button
          onClick={onClearSelection}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        {actions.map(action => (
          <BulkActionButton
            key={action.id}
            action={action}
            selectedIds={selectedIds}
          />
        ))}
      </div>
    </div>
  );
}

function BulkActionButton({ action, selectedIds }: { action: BulkAction; selectedIds: string[] }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (action.confirm && !window.confirm(action.confirm)) {
      return;
    }
    setLoading(true);
    try {
      await action.onClick(selectedIds);
    } catch {
      toast.error('Action failed');
    } finally {
      setLoading(false);
    }
  };

  const variantClasses = {
    default: 'bg-gray-700 hover:bg-gray-600 text-white',
    danger: 'bg-red-600 hover:bg-red-500 text-white',
    primary: 'bg-blue-600 hover:bg-blue-500 text-white',
  };

  const Icon = action.icon;

  return (
    <button
      onClick={handleClick}
      disabled={loading || action.disabled}
      className={clsx(
        'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all',
        variantClasses[action.variant || 'default'],
        (loading || action.disabled) && 'opacity-50 cursor-not-allowed'
      )}
    >
      <Icon className={clsx('h-4 w-4', loading && 'animate-spin')} />
      {action.label}
    </button>
  );
}

interface BulkSelectableRowProps {
  id: string;
  isSelected: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function BulkSelectableRow({ id, isSelected, onToggle, children, className }: BulkSelectableRowProps) {
  return (
    <div
      className={clsx(
        'flex items-center border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer',
        isSelected && 'bg-blue-900/20',
        className
      )}
      onClick={() => onToggle(id)}
    >
      <div className="w-12 flex items-center justify-center shrink-0">
        {isSelected ? (
          <CheckSquare className="h-5 w-5 text-blue-500" />
        ) : (
          <Square className="h-5 w-5 text-gray-600 hover:text-gray-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

interface BulkSelectableTableProps<T> {
  data: T[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  getId: (item: T) => string;
  columns: Array<{
    key: string;
    header: string;
    width?: string;
    render?: (item: T) => React.ReactNode;
  }>;
  rowHeight?: number;
}

export function BulkSelectableTable<T>({
  data,
  selectedIds,
  onToggle,
  onToggleAll,
  getId,
  columns,
  rowHeight = 56,
}: BulkSelectableTableProps<T>) {
  const allSelected = data.length > 0 && data.every(item => selectedIds.has(getId(item)));

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-900 sticky top-0 z-10">
          <tr className="border-b border-gray-700">
            <th className="w-12 p-3">
              <button
                onClick={onToggleAll}
                className="flex items-center justify-center"
              >
                {allSelected ? (
                  <CheckSquare className="h-5 w-5 text-blue-500" />
                ) : (
                  <Square className="h-5 w-5 text-gray-600 hover:text-gray-400" />
                )}
              </button>
            </th>
            {columns.map(col => (
              <th
                key={col.key}
                className="text-left p-3 text-xs font-medium text-gray-400 uppercase"
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(item => {
            const id = getId(item);
            const isSelected = selectedIds.has(id);
            return (
              <tr
                key={id}
                onClick={() => onToggle(id)}
                className={clsx(
                  'border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors',
                  isSelected && 'bg-blue-900/20'
                )}
                style={{ height: rowHeight }}
              >
                <td className="p-3">
                  <div className="flex items-center justify-center">
                    {isSelected ? (
                      <CheckSquare className="h-5 w-5 text-blue-500" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-600 hover:text-gray-400" />
                    )}
                  </div>
                </td>
                {columns.map(col => (
                  <td key={col.key} className="p-3 text-sm text-gray-300">
                    {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface useBulkSelectionReturn {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toggleAll: () => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  isAllSelected: (totalItems: number) => boolean;
}

export function useBulkSelection(): useBulkSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size > 0) {
        return new Set();
      }
      return prev;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected = useCallback((totalItems: number) => {
    return totalItems > 0 && selectedIds.size === totalItems;
  }, [selectedIds]);

  return {
    selectedIds,
    isSelected,
    toggle,
    toggleAll,
    selectAll,
    clearSelection,
    isAllSelected,
  };
}
