/**
 * useOptimizedData Hook Tests
 *
 * Tests for the data optimization hooks with pagination,
 * load more functionality, and virtual scrolling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOptimizedData, useVirtualScroll } from '../hooks/useOptimizedData';

describe('useOptimizedData', () => {
  const mockData = [
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
    { id: '3', name: 'Item 3' },
    { id: '4', name: 'Item 4' },
    { id: '5', name: 'Item 5' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty data when loading', () => {
    const { result } = renderHook(() =>
      useOptimizedData({ data: [], isLoading: true })
    );

    expect(result.current.data).toEqual([]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.isFullyLoaded).toBe(false);
  });

  it('loads initial page of data when not loading', () => {
    const { result } = renderHook(() =>
      useOptimizedData({ data: mockData, isLoading: false, pageSize: 3 })
    );

    // Should load first page (3 items)
    expect(result.current.data).toHaveLength(3);
    expect(result.current.loaded).toBe(3);
    expect(result.current.total).toBe(5);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.isFullyLoaded).toBe(false);
  });

  it('loads all data when pageSize exceeds data length', () => {
    const { result } = renderHook(() =>
      useOptimizedData({ data: mockData, isLoading: false, pageSize: 10 })
    );

    expect(result.current.data).toHaveLength(5);
    expect(result.current.loaded).toBe(5);
    expect(result.current.total).toBe(5);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.isFullyLoaded).toBe(true);
  });

  it('loads more data when loadMore is called', () => {
    const { result } = renderHook(() =>
      useOptimizedData({ data: mockData, isLoading: false, pageSize: 2 })
    );

    // Initial load: 2 items
    expect(result.current.data).toHaveLength(2);
    expect(result.current.loaded).toBe(2);

    // Load more
    act(() => {
      result.current.loadMore();
    });

    // Should now have 4 items (2 pages)
    expect(result.current.data).toHaveLength(4);
    expect(result.current.loaded).toBe(4);
    expect(result.current.hasMore).toBe(true);
  });

  it('sets hasMore to false when all data is loaded', () => {
    const { result } = renderHook(() =>
      useOptimizedData({ data: mockData, isLoading: false, pageSize: 2 })
    );

    // Initial: 2 items
    expect(result.current.data).toHaveLength(2);

    // Load more (4 items)
    act(() => {
      result.current.loadMore();
    });
    expect(result.current.data).toHaveLength(4);

    // Load more (5 items - all data)
    act(() => {
      result.current.loadMore();
    });

    expect(result.current.data).toHaveLength(5);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.isFullyLoaded).toBe(true);
  });

  it('resets page when data changes', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useOptimizedData({ data, isLoading: false, pageSize: 2 }),
      { initialProps: { data: mockData } }
    );

    // Load more on initial data
    act(() => {
      result.current.loadMore();
    });
    expect(result.current.loaded).toBe(4);

    // Change data
    const newData = [{ id: 'new1', name: 'New Item 1' }];
    rerender({ data: newData });

    // Should reset to first page with new data
    expect(result.current.data).toHaveLength(1);
    expect(result.current.loaded).toBe(1);
    expect(result.current.total).toBe(1);
  });
});

describe('useVirtualScroll', () => {
  const largeDataSet = Array.from({ length: 100 }, (_, i) => ({
    id: String(i + 1),
    name: `Item ${i + 1}`,
  }));

  it('returns visible items based on scroll position', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({ data: largeDataSet, itemHeight: 50, containerHeight: 600 })
    );

    // Initial render (scrollTop = 0)
    expect(result.current.visibleData.length).toBeGreaterThan(0);
    expect(result.current.visibleData[0]).toEqual({ id: '1', name: 'Item 1' });
  });

  it('calculates correct total height', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({ data: largeDataSet, itemHeight: 50 })
    );

    // 100 items * 50px = 5000px total height
    expect(result.current.totalHeight).toBe(5000);
  });

  it('updates visible items on scroll', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({ data: largeDataSet, itemHeight: 50, containerHeight: 600 })
    );

    // Simulate scroll event
    act(() => {
      result.current.onScroll({
        currentTarget: { scrollTop: 500 } as HTMLDivElement,
      } as React.UIEvent<HTMLDivElement>);
    });

    // Should show items around index 10 (500 / 50)
    expect(result.current.offsetY).toBeGreaterThan(0);
  });

  it('handles empty data set', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({ data: [], itemHeight: 50 })
    );

    expect(result.current.visibleData).toHaveLength(0);
    expect(result.current.totalHeight).toBe(0);
    expect(result.current.offsetY).toBe(0);
  });

  it('calculates correct visible count based on container height', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({ data: largeDataSet, itemHeight: 50, containerHeight: 300 })
    );

    // Should show fewer items in smaller container
    expect(result.current.visibleData.length).toBeLessThan(
      renderHook(() =>
        useVirtualScroll({ data: largeDataSet, itemHeight: 50, containerHeight: 600 })
      ).result.current.visibleData.length
    );
  });
});
