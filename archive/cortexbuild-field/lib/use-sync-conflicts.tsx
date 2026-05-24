import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';
import { useAuth } from '@/contexts/auth-context';

/**
 * Live view of unresolved conflicts for the current user inside the
 * current company. Drives the global banner count and per-row badges.
 *
 * Gated on BOTH `user` and `currentCompany?.id`. The user gate is
 * load-bearing: `CompanyProvider` seeds `currentCompany` with a mock
 * default so signed-out screens have something to render, which means
 * `currentCompany?.id` is truthy pre-auth. Without `!!user`, the query
 * fires on /welcome → 401 → `installAuthErrorHandler` → `queryClient.clear()`
 * → query re-mounts → 401 → loop. Tab screens default a missing companyId
 * to 1 so generic UI keeps rendering, but conflicts are tenant-keyed user
 * data — showing parked rows during the auth race (or post-logout window
 * before unmount) would be a cross-tenant leak.
 *
 * After a resolve mutation, callers invalidate `conflicts.list` directly.
 * The 60s default staleTime is fine for the banner.
 */
export function useSyncConflicts() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const enabled = !!user && !!currentCompany?.id;

  const query = trpc.conflicts.list.useQuery(
    { companyId: currentCompany?.id ?? 0, resolved: false },
    { enabled, refetchOnWindowFocus: true },
  );

  const conflicts = query.data ?? [];
  return {
    conflicts,
    count: conflicts.length,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
