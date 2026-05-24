/* eslint-disable import/first -- vi.mock(...) declarations must precede
   the import they replace; the mocks stub @/lib/trpc and @/lib/company-context
   so the hook can run without the real provider tree. */
/**
 * Tests the `useSyncConflicts` hook's mapping behaviour:
 *
 *   - count is derived from data.length, with undefined data → 0
 *   - conflicts is data ?? [] (banner can iterate without a null check)
 *   - the underlying tRPC call passes the current companyId + resolved:false
 *   - the query is disabled when no company is loaded (auth race / logout window)
 *
 * The plan suggested renderHook + a TanStack-Query wrapper. For a 5-line
 * wrapper hook around `trpc.conflicts.list.useQuery`, mocking `@/lib/trpc`
 * directly keeps the seam at the layer this hook actually owns: the
 * mapping from query result to banner-friendly shape. The renderHook +
 * QueryClientProvider scaffold is appropriate for the banner component
 * test (Task 11) where actual React rendering matters.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockListUseQuery = vi.fn();
const mockUseCompany = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('@/lib/trpc', () => ({
  trpc: {
    conflicts: {
      list: {
        useQuery: (input: unknown, opts: unknown) => mockListUseQuery(input, opts),
      },
    },
  },
}));

vi.mock('@/lib/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

import { useSyncConflicts } from '@/lib/use-sync-conflicts';

const stubRefetch = vi.fn();

function setQuery(over: Partial<{ data: unknown; isLoading: boolean }> = {}) {
  mockListUseQuery.mockReturnValue({
    data: over.data,
    isLoading: over.isLoading ?? false,
    refetch: stubRefetch,
  });
}

describe('useSyncConflicts', () => {
  beforeEach(() => {
    mockListUseQuery.mockReset();
    mockUseCompany.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({ user: { id: 1 } });
    stubRefetch.mockReset();
  });

  it('returns count and rows from conflicts.list', () => {
    mockUseCompany.mockReturnValue({ currentCompany: { id: 7 } });
    setQuery({
      data: [
        { id: 1, tableName: 'rfis', rowId: 1, conflictFields: ['description'], mineValues: {}, theirsValues: {}, createdAt: 'T', resolvedAt: null },
        { id: 2, tableName: 'rfis', rowId: 2, conflictFields: ['status'],      mineValues: {}, theirsValues: {}, createdAt: 'T', resolvedAt: null },
      ],
    });

    const result = useSyncConflicts();

    expect(result.count).toBe(2);
    expect(result.conflicts).toHaveLength(2);
    expect(result.isLoading).toBe(false);
    expect(result.refetch).toBe(stubRefetch);
  });

  it('passes companyId and resolved:false to the tRPC call', () => {
    mockUseCompany.mockReturnValue({ currentCompany: { id: 42 } });
    setQuery({ data: [] });

    useSyncConflicts();

    expect(mockListUseQuery).toHaveBeenCalledWith(
      { companyId: 42, resolved: false },
      expect.objectContaining({ enabled: true }),
    );
  });

  it('returns count=0 and empty conflicts when none exist', () => {
    mockUseCompany.mockReturnValue({ currentCompany: { id: 7 } });
    setQuery({ data: [] });

    const result = useSyncConflicts();

    expect(result.count).toBe(0);
    expect(result.conflicts).toEqual([]);
  });

  it('treats undefined data as empty array (initial loading)', () => {
    mockUseCompany.mockReturnValue({ currentCompany: { id: 7 } });
    setQuery({ data: undefined, isLoading: true });

    const result = useSyncConflicts();

    expect(result.count).toBe(0);
    expect(result.conflicts).toEqual([]);
    expect(result.isLoading).toBe(true);
  });

  it('disables the query when no company is loaded (logout / auth race)', () => {
    // No currentCompany — tab screens fall back to companyId=1, but the
    // conflicts banner must NOT: showing parked conflicts for the wrong
    // tenant during the auth-race window would be a cross-tenant leak.
    mockUseCompany.mockReturnValue({ currentCompany: null });
    setQuery({ data: undefined });

    const result = useSyncConflicts();

    expect(mockListUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ resolved: false }),
      expect.objectContaining({ enabled: false }),
    );
    expect(result.count).toBe(0);
  });

  it('disables the query when signed out, even if CompanyProvider seeded a mock company', () => {
    // `CompanyProvider` initialises `currentCompany` with `MOCK_COMPANIES[0]`
    // (truthy id) so the public surface has something to render pre-auth.
    // Without an explicit `!!user` gate, this hook would re-fire
    // `conflicts.list` -> 401 -> `installAuthErrorHandler` -> `queryClient.clear()`
    // -> re-fire, an infinite loop observed on /welcome (~3 calls/sec) that
    // also fan-outs `getMe` across every `useAuth` listener.
    mockUseCompany.mockReturnValue({ currentCompany: { id: 1 } });
    mockUseAuth.mockReturnValue({ user: null });
    setQuery({ data: undefined });

    useSyncConflicts();

    expect(mockListUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ resolved: false }),
      expect.objectContaining({ enabled: false }),
    );
  });
});
