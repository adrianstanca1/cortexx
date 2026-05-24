import { useEffect, useState, useCallback } from 'react';

interface UseOptimizedDataOptions<T> {
  data: T[];
  isLoading: boolean;
  pageSize?: number;
}

export function useOptimizedData<T>({ data, isLoading, pageSize = 50 }: UseOptimizedDataOptions<T>) {
  const [visibleData, setVisibleData] = useState<T[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isLoading && data.length > 0) {
      setVisibleData(data.slice(0, pageSize));
      setPage(1);
    }
  }, [data, isLoading, pageSize]);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    const nextData = data.slice(0, nextPage * pageSize);
    setVisibleData(nextData);
    setPage(nextPage);
  }, [page, pageSize, data]);

  const hasMore = visibleData.length < data.length;
  const isFullyLoaded = !isLoading && visibleData.length === data.length;

  return {
    data: visibleData,
    loadMore,
    hasMore,
    isFullyLoaded,
    total: data.length,
    loaded: visibleData.length,
  };
}

// Virtual scrolling for large lists
export function useVirtualScroll<T>({ data, itemHeight = 50, containerHeight = 600 }: {
  data: T[];
  itemHeight?: number;
  containerHeight?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleCount = Math.ceil(containerHeight / itemHeight) + 2;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 1);
  const endIndex = Math.min(data.length, startIndex + visibleCount);
  
  const visibleData = data.slice(startIndex, endIndex);
  const totalHeight = data.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  return {
    visibleData,
    totalHeight,
    offsetY,
    onScroll: (e: React.UIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop),
  };
}
