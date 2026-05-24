import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkSelection } from '../components/ui/BulkActions';

const TEST_ITEMS = [
  { id: '1', name: 'Item 1' },
  { id: '2', name: 'Item 2' },
  { id: '3', name: 'Item 3' },
];

describe('useBulkSelection', () => {
  it('starts with no items selected', () => {
    const { result } = renderHook(() => useBulkSelection());
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('toggles individual items', () => {
    const { result } = renderHook(() => useBulkSelection());
    
    act(() => {
      result.current.toggle('1');
    });
    expect(result.current.isSelected('1')).toBe(true);
    expect(result.current.isSelected('2')).toBe(false);
    
    act(() => {
      result.current.toggle('2');
    });
    expect(result.current.isSelected('1')).toBe(true);
    expect(result.current.isSelected('2')).toBe(true);
  });

  it('untoggles selected items', () => {
    const { result } = renderHook(() => useBulkSelection());
    
    act(() => {
      result.current.toggle('1');
    });
    expect(result.current.isSelected('1')).toBe(true);
    
    act(() => {
      result.current.toggle('1');
    });
    expect(result.current.isSelected('1')).toBe(false);
  });

  it('clears all selections', () => {
    const { result } = renderHook(() => useBulkSelection());
    
    act(() => {
      result.current.toggle('1');
      result.current.toggle('2');
      result.current.toggle('3');
    });
    expect(result.current.selectedIds.size).toBe(3);
    
    act(() => {
      result.current.clearSelection();
    });
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('selects all items', () => {
    const { result } = renderHook(() => useBulkSelection());
    
    act(() => {
      result.current.selectAll(TEST_ITEMS.map(i => i.id));
    });
    expect(result.current.selectedIds.size).toBe(3);
  });

  it('toggles all off when all are selected', () => {
    const { result } = renderHook(() => useBulkSelection());
    
    act(() => {
      result.current.selectAll(['1', '2', '3']);
    });
    expect(result.current.selectedIds.size).toBe(3);
    
    act(() => {
      result.current.toggleAll();
    });
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('reports isAllSelected correctly', () => {
    const { result } = renderHook(() => useBulkSelection());
    
    expect(result.current.isAllSelected(3)).toBe(false);
    
    act(() => {
      result.current.selectAll(['1', '2', '3']);
    });
    expect(result.current.isAllSelected(3)).toBe(true);
    
    act(() => {
      result.current.toggle('3');
    });
    expect(result.current.isAllSelected(3)).toBe(false);
  });
});
