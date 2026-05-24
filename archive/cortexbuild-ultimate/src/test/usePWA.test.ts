import { describe, it, expect } from 'vitest';

describe('usePWA', () => {
  it('exports usePWA as a function', async () => {
    const { usePWA } = await import('../hooks/usePWA');
    expect(typeof usePWA).toBe('function');
  });

  it('exports registerServiceWorker as a function', async () => {
    const { registerServiceWorker } = await import('../hooks/usePWA');
    expect(typeof registerServiceWorker).toBe('function');
  });
});
