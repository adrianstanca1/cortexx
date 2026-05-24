/* eslint-disable import/first -- vi.mock(...) declarations must precede
   the import they replace; the mocks stub @/lib/trpc, @/lib/company-context
   and @/hooks/use-auth so the hook can run without the real provider tree. */
/**
 * Tracer test for the `useLiveData.ts` hooks.
 *
 * The hooks here all wrap `companyScopedProcedure` queries with a
 * `companyId: currentCompany?.id ?? 1` fallback. That fallback means
 * `enabled` derived purely from `currentCompany` would always be truthy
 * (because `CompanyProvider` seeds a mock company), so a `!!user` gate
 * is required to prevent the queries firing on signed-out screens. They
 * are AuthGate-protected today, but the structural anti-pattern is the
 * one that bit `useSyncConflicts` (commit a69c6e7) — these tests pin the
 * belt-and-braces gate so a future code-move above AuthGate doesn't
 * silently regress.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockListUseQuery = vi.fn();
const mockDefectsUseQuery = vi.fn();
const mockIncidentsUseQuery = vi.fn();
const mockHistoryUseQuery = vi.fn();
const mockUseCompany = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('@/lib/trpc', () => ({
  trpc: {
    projects:  { list:    { useQuery: (input: unknown, opts: unknown) => mockListUseQuery(input, opts) } },
    defects:   { list:    { useQuery: (input: unknown, opts: unknown) => mockDefectsUseQuery(input, opts) } },
    incidents: { list:    { useQuery: (input: unknown, opts: unknown) => mockIncidentsUseQuery(input, opts) } },
    checkins:  { history: { useQuery: (input: unknown, opts: unknown) => mockHistoryUseQuery(input, opts) } },
  },
}));

vi.mock('@/lib/company-context', () => ({
  useCompany: () => mockUseCompany(),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/lib/live-data-mappers', () => ({
  mapProjectRows:  (rows: unknown) => rows ?? [],
  mapDefectRows:   (rows: unknown) => rows ?? [],
  mapIncidentRows: (rows: unknown) => rows ?? [],
}));

import {
  useLiveProjects,
  useLiveDefects,
  useLiveIncidents,
  useLiveCheckInHistory,
} from '@/lib/use-live-data';

const stubReturn = { data: undefined, isLoading: false, isError: false, refetch: vi.fn(), error: null };

describe('use-live-data — !!user gate (defence in depth)', () => {
  beforeEach(() => {
    mockListUseQuery.mockReset().mockReturnValue(stubReturn);
    mockDefectsUseQuery.mockReset().mockReturnValue(stubReturn);
    mockIncidentsUseQuery.mockReset().mockReturnValue(stubReturn);
    mockHistoryUseQuery.mockReset().mockReturnValue(stubReturn);
    mockUseCompany.mockReset().mockReturnValue({ currentCompany: { id: 7 } });
    mockUseAuth.mockReset().mockReturnValue({ user: { id: 1 } });
  });

  // The hooks call `useMemo` after the mocked `useQuery`, which throws
  // outside a React render. We don't need the return value — only that
  // the gate was passed correctly to `trpc.X.list.useQuery`. Wrap each
  // call in a try/catch so the post-`useQuery` `useMemo` failure
  // doesn't mask the assertion below.
  const callIgnoringMemo = (fn: () => void) => {
    try { fn(); } catch { /* useMemo crashes outside render — irrelevant here */ }
  };

  it('useLiveProjects is enabled when signed in', () => {
    callIgnoringMemo(() => useLiveProjects());
    expect(mockListUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 7 }),
      expect.objectContaining({ enabled: true }),
    );
  });

  it('useLiveProjects is disabled when signed out (even with mock-company fallback)', () => {
    mockUseAuth.mockReturnValue({ user: null });
    callIgnoringMemo(() => useLiveProjects());
    expect(mockListUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false }),
    );
  });

  it('useLiveDefects is disabled when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    callIgnoringMemo(() => useLiveDefects());
    expect(mockDefectsUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false }),
    );
  });

  it('useLiveIncidents is disabled when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    callIgnoringMemo(() => useLiveIncidents());
    expect(mockIncidentsUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false }),
    );
  });

  it('useLiveCheckInHistory is disabled when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    callIgnoringMemo(() => useLiveCheckInHistory());
    expect(mockHistoryUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false }),
    );
  });
});
