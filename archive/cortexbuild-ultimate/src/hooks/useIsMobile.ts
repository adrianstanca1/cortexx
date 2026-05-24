import { useState, useEffect } from 'react';

/**
 * Returns true when the viewport width is below `breakpoint` (default 768px).
 * Updates reactively on window resize via matchMedia.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    // Guard against environments where window.matchMedia is not available (e.g., jsdom)
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
      if (mq) {
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        setIsMobile(window.innerWidth < breakpoint);
        mq.addEventListener('change', handler);
        cleanup = () => mq.removeEventListener('change', handler);
      }
    }
    // If matchMedia is not available, we still set the initial state but don't add listeners
    setIsMobile(typeof window !== 'undefined' ? window.innerWidth < breakpoint : false);
    return cleanup;
  }, [breakpoint]);

  return isMobile;
}
