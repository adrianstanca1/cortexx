import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { exportData } from '../components/ui/DataImportExport';

describe('exportData', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn((_blob: Blob) => 'blob:test') as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('calls toast.error when data is empty', async () => {
    const { toast } = await import('sonner');
    exportData({ filename: 'test', format: 'csv', data: [] });
    expect(toast.error).toHaveBeenCalled();
  });

  it('creates object URL when data is provided', async () => {
    const data = [{ id: 1, name: 'Project A' }];
    exportData({ filename: 'test', format: 'csv', data });
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('creates object URL for JSON format', async () => {
    const data = [{ id: 1, name: 'Project A' }];
    exportData({ filename: 'test', format: 'json', data });
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});
