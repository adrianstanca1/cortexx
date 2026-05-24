/**
 * useOfflineMutation — wrap a tRPC mutation so it survives network outages.
 *
 * Usage:
 *
 *   const create = useOfflineMutation(
 *     trpc.defects.create.useMutation(),
 *     'defects.create',
 *   );
 *   await create.mutateAsync({ companyId, projectId, ... });
 *
 * Behaviour:
 *  - If the underlying mutation succeeds → returns the result.
 *  - If it fails with a network error AND the SyncQueueProvider reports
 *    `status !== 'online'` (or the error looks transport-level), the
 *    payload is enqueued and the helper resolves with `{ queued: true }`
 *    so the caller can keep its UI flow.
 *  - Other errors (validation, FORBIDDEN, etc.) re-throw so the caller
 *    can show them — those aren't recoverable by retrying offline.
 *
 * The queued mutation is replayed by `sync-queue.tsx` against
 * `/api/trpc/sync.replay`, which the server dispatcher routes back to the
 * same procedure once connectivity returns.
 *
 * Important: only types that are in the server's REPLAYABLE_TYPES allow-list
 * (see server/routers/index.ts) can be queued. Calling this with a non-replayable
 * type works while online but the replay will return BAD_REQUEST and the
 * queue will eventually drop the item — so don't enable offline mode for
 * anything that isn't on the server allow-list.
 */
import { useSyncQueue } from '@/lib/sync-queue';

interface MinimalMutation<TInput, TOutput> {
  mutateAsync: (input: TInput) => Promise<TOutput>;
  // React Query's mutation object also exposes these reactive state flags;
  // we pass them through so the original API surface is preserved for
  // callers that read e.g. `mutation.isPending` for spinner gating.
  isPending?: boolean;
  isError?: boolean;
  error?: unknown;
  reset?: () => void;
}

export type OfflineResult<T> = T | { queued: true; type: string };

export function isQueued<T>(result: OfflineResult<T>): result is { queued: true; type: string } {
  return typeof result === 'object' && result !== null && (result as any).queued === true;
}

/**
 * Heuristic for "this is a network/transport failure rather than a
 * server-rejected request". tRPC client throws TRPCClientError; for
 * actual network failures (offline, DNS fail, server unreachable),
 * `error.cause` is a TypeError("Failed to fetch") or similar.
 */
function looksLikeNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as any;
  // tRPC v11 puts the original error on .cause
  const causeMessage = e?.cause?.message ?? '';
  const message = e?.message ?? '';
  const combined = `${causeMessage} ${message}`.toLowerCase();
  return (
    combined.includes('failed to fetch') ||
    combined.includes('network request failed') ||
    combined.includes('networkerror') ||
    combined.includes('aborted') ||
    combined.includes('timeout') ||
    e?.cause?.name === 'TypeError'
  );
}

export function useOfflineMutation<TInput, TOutput>(
  mutation: MinimalMutation<TInput, TOutput>,
  type: string,
) {
  const { status, enqueue } = useSyncQueue();

  return {
    /**
     * Try the mutation; on network failure, queue it and resolve with
     * `{ queued: true }` so the UI flow continues.
     */
    async mutateAsync(input: TInput): Promise<OfflineResult<TOutput>> {
      // Fast-path: if the queue says we're offline, skip the doomed network
      // attempt entirely. Saves a 30s timeout on flaky cellular.
      if (status === 'offline') {
        await enqueue(type, input);
        return { queued: true, type };
      }

      try {
        return await mutation.mutateAsync(input);
      } catch (err) {
        if (looksLikeNetworkError(err)) {
          await enqueue(type, input);
          return { queued: true, type };
        }
        throw err;
      }
    },
    /** Pass-through reactive state so UI can gate spinners / error banners. */
    get isPending() { return mutation.isPending ?? false; },
    get isError() { return mutation.isError ?? false; },
    get error() { return mutation.error; },
    reset: mutation.reset,
  };
}
