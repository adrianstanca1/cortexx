/**
 * useLiveData — wraps tRPC queries with offline/mock fallback.
 *
 * When the server is reachable, returns live DB data.
 * When offline or the server is down, falls back to mock data transparently.
 *
 * Each hook gates `enabled` on `!!user`. Today every consumer
 * (`app/(tabs)/projects.tsx`, `app/safety.tsx`, `app/(tabs)/field.tsx`)
 * sits behind `AuthGate`, so signed-out traffic can't reach them. The
 * user gate is defence-in-depth so a future code-move above the gate
 * doesn't repeat the `useSyncConflicts` regression (commit `a69c6e7`):
 * `currentCompany?.id` is structurally weak because `CompanyProvider`
 * seeds a mock default, so a query gated on it alone would fire on
 * signed-out screens, hit 401, and feed the `installAuthErrorHandler`
 * clear-and-retry loop.
 */
import { trpc } from '@/lib/trpc';
import { useMemo } from 'react';
import { useCompany } from '@/lib/company-context';
import { useAuth } from '@/contexts/auth-context';
import { mapDefectRows, mapIncidentRows, mapProjectRows } from '@/lib/live-data-mappers';

// ─── Projects ────────────────────────────────────────────────────────────────

export function useLiveProjects() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const query = trpc.projects.list.useQuery(
    { companyId: currentCompany?.id ?? 1 },
    { retry: 1, staleTime: 30_000, enabled: !!user },
  );

  const data = useMemo(
    () => mapProjectRows(query.data, query.isError || query.data === undefined),
    [query.data, query.isError],
  );

  return {
    projects: data,
    isLoading: query.isLoading,
    isLive: !query.isError && query.data !== undefined,
    error: query.error,
    refetch: query.refetch,
  };
}

// ─── Defects ─────────────────────────────────────────────────────────────────

export function useLiveDefects(projectId?: number) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const query = trpc.defects.list.useQuery(
    { companyId: currentCompany?.id ?? 1, projectId },
    { retry: 1, staleTime: 30_000, enabled: !!user }
  );

  const data = useMemo(
    () => mapDefectRows(query.data, query.isError || query.data === undefined),
    [query.data, query.isError],
  );

  return {
    defects: data,
    isLoading: query.isLoading,
    isLive: !query.isError && query.data !== undefined,
    refetch: query.refetch,
  };
}

// ─── Incidents ────────────────────────────────────────────────────────────────

export function useLiveIncidents(projectId?: number) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const query = trpc.incidents.list.useQuery(
    { companyId: currentCompany?.id ?? 1, projectId },
    { retry: 1, staleTime: 30_000, enabled: !!user }
  );

  const data = useMemo(
    () => mapIncidentRows(query.data, query.isError || query.data === undefined),
    [query.data, query.isError],
  );

  return {
    incidents: data,
    isLoading: query.isLoading,
    isLive: !query.isError && query.data !== undefined,
    refetch: query.refetch,
  };
}

// ─── Check-In History ────────────────────────────────────────────────────────

export function useLiveCheckInHistory(projectId?: number) {
  const { user } = useAuth();
  const query = trpc.checkins.history.useQuery(
    { projectId, limit: 20 },
    { retry: 1, staleTime: 60_000, enabled: !!user }
  );

  return {
    history: query.data ?? [],
    isLoading: query.isLoading,
    isLive: !query.isError && query.data !== undefined,
    refetch: query.refetch,
  };
}
