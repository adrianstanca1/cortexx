import { useState, useRef, useCallback, ReactNode } from 'react';

interface VirtualListProps<T> {
  items: T[];
  height: number;
  itemHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  className?: string;
}

export function VirtualList<T>({
  items,
  height,
  itemHeight,
  renderItem,
  overscan = 5,
  className = '',
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + height) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, i) => renderItem(item, startIndex + i))}
        </div>
      </div>
    </div>
  );
}

interface InfiniteScrollProps<_T> {
  fetchMore: () => Promise<void>;
  hasMore: boolean;
  loader: ReactNode;
  children: ReactNode;
  endMessage?: ReactNode;
  height?: string;
}

export function InfiniteScroll<_T>({
  fetchMore,
  hasMore,
  loader,
  children,
  endMessage,
  height = 'h-96',
}: InfiniteScrollProps<_T>) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLElement | null) => {
    if (loader === null) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchMore();
      }
    }, { threshold: 0.1 });
    
    if (node) observerRef.current.observe(node);
  }, [hasMore, fetchMore, loader]);

  return (
    <div className={height}>
      {children}
      <div ref={lastElementRef} className="flex justify-center py-4">
        {hasMore && loader}
      </div>
      {!hasMore && endMessage}
    </div>
  );
}

interface VirtualTableProps<T> {
  data: T[];
  columns: Array<{
    key: string;
    header: string;
    width?: string;
    render?: (item: T) => ReactNode;
  }>;
  rowHeight?: number;
  height?: number;
  className?: string;
  onRowClick?: (item: T) => void;
}

export function VirtualTable<T extends Record<string, unknown>>({
  data,
  columns,
  rowHeight = 48,
  height = 400,
  className = '',
  onRowClick,
}: VirtualTableProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const overscan = 5;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(
    data.length - 1,
    Math.ceil((scrollTop + height) / rowHeight) + overscan
  );

  const visibleRows = data.slice(startIndex, endIndex + 1);
  const totalHeight = data.length * rowHeight;
  const offsetY = startIndex * rowHeight;

  return (
    <div className={`border border-gray-700 rounded-lg overflow-hidden ${className}`}>
      <div style={{ height }} className="overflow-auto" ref={containerRef} onScroll={handleScroll}>
        <table className="w-full" style={{ minWidth: '100%' }}>
          <thead className="sticky top-0 z-10 bg-gray-900">
            <tr className="border-b border-gray-700">
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
            <tr style={{ height: offsetY }} />
            {visibleRows.map((row, i) => (
              <tr
                key={startIndex + i}
                className={`border-b border-gray-800/50 ${onRowClick ? 'cursor-pointer hover:bg-gray-800/50' : ''}`}
                style={{ height: rowHeight }}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map(col => (
                  <td key={col.key} className="p-3 text-sm text-gray-300">
                    {col.render ? col.render(row) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
            <tr style={{ height: totalHeight - (endIndex + 1) * rowHeight }} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
