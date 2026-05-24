import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

describe('useNetworkStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true });
  });
  afterEach(() => vi.restoreAllMocks());

  it('starts with current online state', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it('goes offline when offline event fires', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => window.dispatchEvent(new Event('offline')));
    expect(result.current.isOnline).toBe(false);
  });

  it('goes online when online event fires', () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { result } = renderHook(() => useNetworkStatus());
    act(() => window.dispatchEvent(new Event('online')));
    expect(result.current.isOnline).toBe(true);
  });
});
