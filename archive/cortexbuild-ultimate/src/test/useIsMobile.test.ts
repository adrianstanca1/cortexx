import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '../hooks/useIsMobile';

describe('useIsMobile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  it('should return true if initial width is less than default breakpoint (768px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375 });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('should return false if initial width is greater than or equal to default breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024 });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('should respect a custom breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', { value: 900 });

    // With 900px width and 1000px breakpoint, it should be mobile
    const { result: mobileResult } = renderHook(() => useIsMobile(1000));
    expect(mobileResult.current).toBe(true);

    // With 900px width and 800px breakpoint, it should not be mobile
    const { result: desktopResult } = renderHook(() => useIsMobile(800));
    expect(desktopResult.current).toBe(false);
  });

  it('should update reactive state when window is resized', () => {
    let changeHandler: (e: MediaQueryListEvent) => void = () => {};

    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: query.includes('767px') && window.innerWidth < 768,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((type, handler) => {
        if (type === 'change') changeHandler = handler;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, 'innerWidth', { value: 1024 });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    // Simulate resize to mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 375 });
      changeHandler({ matches: true } as MediaQueryListEvent);
    });

    expect(result.current).toBe(true);

    // Simulate resize back to desktop
    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 1024 });
      changeHandler({ matches: false } as MediaQueryListEvent);
    });

    expect(result.current).toBe(false);
  });

  it('should cleanup event listener on unmount', () => {
    const removeEventListenerSpy = vi.fn();

    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: removeEventListenerSpy,
      dispatchEvent: vi.fn(),
    }));

    const { unmount } = renderHook(() => useIsMobile());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should recalculate isMobile when breakpoint prop changes', () => {
    Object.defineProperty(window, 'innerWidth', { value: 900 });

    const { result, rerender } = renderHook(
      ({ breakpoint }) => useIsMobile(breakpoint),
      { initialProps: { breakpoint: 800 } }
    );
    expect(result.current).toBe(false);

    rerender({ breakpoint: 1000 });
    expect(result.current).toBe(true);
  });
});
