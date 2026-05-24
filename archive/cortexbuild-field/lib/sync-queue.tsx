/**
 * Offline-first Sync Queue
 *
 * Stores mutations locally in AsyncStorage when offline.
 * Auto-replays them against the backend when connectivity is restored.
 * Provides a global sync status indicator (banner + badge).
 *
 * Bug fixes (v1.9):
 * 1. isInternetReachable starts as null — treat null as "unknown / assume online"
 *    so the banner does NOT flash "offline" on cold start.
 * 2. replayQueue stale closure — use a ref to hold the latest replayQueue so the
 *    NetInfo listener always calls the current version.
 * 3. Initial network fetch — call NetInfo.fetch() on mount to get real state
 *    instead of waiting for the first change event.
 */
import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from '@/lib/_core/auth';
import { useAuth } from '@/contexts/auth-context';

// ─── Types ────────────────────────────────────────────────────────────────────
export type SyncStatus = 'online' | 'offline' | 'syncing' | 'error';

export interface QueuedMutation {
  id: string;
  type: string;           // e.g. 'checkIn', 'createDefect', 'submitReceipt'
  payload: unknown;
  createdAt: string;
  retries: number;
  lastError?: string;

  // Phase 3.7 — UPDATE-type mutations only. Captured at form-open by the
  // caller (e.g. app/rfi-detail.tsx) and forwarded inside `payload` so the
  // server-side procedure can run detectFieldConflicts. Stored at top level
  // so the replay loop can introspect it without parsing payload.
  baseSnapshot?: {
    rowId: number;
    updatedAt: string;
    originalValues: Record<string, unknown>;
  };

  // Set when a replay parked this mutation as a conflict. The UI uses it
  // to route the user from the conflict banner to the correct
  // app/conflicts/[id].tsx sheet.
  conflictId?: number;
}

interface SyncQueueState {
  status: SyncStatus;
  queue: QueuedMutation[];
  pendingCount: number;
  lastSyncedAt: string | null;
  enqueue: (type: string, payload: unknown) => Promise<void>;
  clearQueue: () => Promise<void>;
  replayNow: () => Promise<void>;
}

// Exported so vitest can assert directly on the exported function instead of
// a reimplementation. Same applies to the small banner helper below.
export const STORAGE_KEY = 'cortexbuild:sync_queue';
export const MAX_RETRIES = 5;
export const RETRY_DELAY_MS = 3000;

/**
 * Determine if the device is truly online.
 * isInternetReachable can be null (unknown) — treat null as online so we don't
 * incorrectly show the offline banner on cold start.
 */
export function isNetworkOnline(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean {
  if (!state.isConnected) return false;
  // null means the reachability check hasn't completed yet — assume online
  if (state.isInternetReachable === null) return true;
  return state.isInternetReachable;
}

export function shouldShowSyncBanner(status: SyncStatus, pendingCount: number): boolean {
  return status !== 'online' && pendingCount > 0;
}

/**
 * Outcome of a single replay attempt.
 *
 *  - 'success'    — server accepted the mutation; drop from queue.
 *  - 'transient'  — network or 5xx; bump retries, drop after MAX_RETRIES.
 *  - 'auth'       — 401/403; HOLD without bumping retries. The user's
 *                   session has expired and we can't replay until they
 *                   re-login. Items in this state must NOT count
 *                   against MAX_RETRIES, otherwise a worker who stays
 *                   offline overnight (their JWT expires while queued
 *                   items wait) loses their data.
 *  - 'permanent'  — 4xx (other than auth): validation, FORBIDDEN,
 *                   BAD_REQUEST. Retrying will never succeed, so drop
 *                   to avoid infinite retries. The original mutation
 *                   call already showed the user an error; this is
 *                   just stale queue cleanup.
 */
export type ReplayOutcome = 'success' | 'transient' | 'auth' | 'permanent' | 'conflict' | 'row_deleted';

/**
 * Pure helper exported so the replay decision tree can be tested without
 * mounting the React provider. Maps an HTTP response (or thrown error)
 * to a ReplayOutcome.
 *
 * The optional `body` argument lets the classifier inspect the dispatcher's
 * tRPC-unwrapped response (the `data` object inside the tRPC envelope) for
 * procedure-level conflict / row_deleted status. Only used on 2xx responses
 * — error statuses are classified by HTTP code alone.
 */
export function classifyReplayResponse(
  status: number | null,
  body?: { result?: { status?: 'success' | 'conflict' | 'row_deleted' } },
): ReplayOutcome {
  if (status === null) return 'transient'; // fetch threw — network failure
  if (status === 401 || status === 403) return 'auth';
  if (status >= 200 && status < 300) {
    const procStatus = body?.result?.status;
    if (procStatus === 'conflict') return 'conflict';
    if (procStatus === 'row_deleted') return 'row_deleted';
    return 'success';
  }
  if (status >= 400 && status < 500) return 'permanent'; // validation, BAD_REQUEST, etc.
  return 'transient'; // 5xx, 0, anything else
}

/**
 * Build the request envelope sent to /api/trpc/sync.replay. Pulled out as a
 * pure helper so the URL/body shape can be regression-tested without a full
 * RN provider mount.
 */
export function buildSyncReplayRequest(
  apiBaseUrl: string,
  mutation: { type: string; payload: unknown },
): { url: string; body: string } {
  const cleanBase = apiBaseUrl.replace(/\/$/, '');
  return {
    url: `${cleanBase}/api/trpc/sync.replay`,
    body: JSON.stringify({ json: { type: mutation.type, payload: mutation.payload } }),
  };
}

/**
 * Result envelope from `executeMutation`. Exported for testing
 * `decideReplayAction` (below) without needing to mount the React provider
 * or stub global fetch.
 */
export type ExecuteResult =
  | { outcome: 'success' | 'transient' | 'auth' | 'permanent' | 'row_deleted' }
  | { outcome: 'conflict'; conflictId: number; fields: string[] };

/**
 * Decide what to do with one mutation given the result of its replay
 * attempt. Pure — exported so the switch logic in `replayQueue` can be
 * tested without a full React-provider mock.
 *
 *   drop        → mutation is removed from the queue (success, permanent, row_deleted)
 *   park        → mutation stays in the queue, possibly with mutated fields
 *                 (auth, conflict, transient)
 *   halt=true   → caller must stop processing the rest of the queue this round
 *                 (only auth — every other queued mutation will fail the same way)
 *   retryDelay  → caller should sleep RETRY_DELAY_MS before the next item
 *                 (only transient — to avoid hammering a failing endpoint)
 */
export type ReplayAction =
  | { kind: 'drop' }
  | { kind: 'park'; mutation: QueuedMutation; halt: boolean; retryDelay: boolean };

export function decideReplayAction(mutation: QueuedMutation, result: ExecuteResult): ReplayAction {
  switch (result.outcome) {
    case 'success':
    case 'permanent':
    case 'row_deleted':
      return { kind: 'drop' };
    case 'auth':
      return {
        kind: 'park',
        mutation: { ...mutation, lastError: 'Session expired — waiting for re-login' },
        halt: true,
        retryDelay: false,
      };
    case 'conflict':
      return {
        kind: 'park',
        mutation: { ...mutation, conflictId: result.conflictId, lastError: 'Awaiting resolution' },
        halt: false,
        retryDelay: false,
      };
    case 'transient':
    default:
      return {
        kind: 'park',
        mutation: { ...mutation, retries: mutation.retries + 1, lastError: 'Network error' },
        halt: false,
        retryDelay: true,
      };
  }
}

/**
 * When replay stops early on auth, unprocessed tail items are re-queued.
 * Must apply the same MAX_RETRIES drop rule as the top of the replay loop;
 * otherwise items with retries >= MAX_RETRIES that sit *after* the
 * auth-failed mutation would never hit the loop's drop-check and would
 * persist forever while auth keeps failing.
 */
export function tailForRequeueAfterAuthAbort(
  parsed: QueuedMutation[],
  afterIndex: number,
): QueuedMutation[] {
  const out: QueuedMutation[] = [];
  for (let i = afterIndex + 1; i < parsed.length; i += 1) {
    if (parsed[i].retries < MAX_RETRIES) out.push(parsed[i]);
  }
  return out;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const SyncQueueContext = createContext<SyncQueueState>({
  status: 'online',
  queue: [],
  pendingCount: 0,
  lastSyncedAt: null,
  enqueue: async () => {},
  clearQueue: async () => {},
  replayNow: async () => {},
});

export function useSyncQueue() {
  return useContext(SyncQueueContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function SyncQueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  // Start as 'online' — we'll update after the initial NetInfo fetch
  const [status, setStatus] = useState<SyncStatus>('online');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const isOnlineRef = useRef(true);
  const replayingRef = useRef(false);
  // Track which user owns the current queue. We don't replay another user's
  // mutations under a different session — see the user-transition effect below.
  const previousUserIdRef = useRef<number | null>(null);
  const { user } = useAuth();

  // Keep a ref to the latest replayQueue so the NetInfo listener never goes stale
  const replayQueueRef = useRef<() => Promise<void>>(async () => {});

  // Load persisted queue on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as QueuedMutation[];
          if (parsed.length > 0) setQueue(parsed);
        } catch {
          // ignore corrupt data
        }
      }
    });
  }, []);

  // Persist queue on every change
  const persistQueue = useCallback(async (q: QueuedMutation[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(q));
  }, []);

  // Execute a single mutation against the backend, returning a classified
  // outcome plus any payload the replay loop needs (conflictId for the
  // 'conflict' branch). The ExecuteResult type is exported at module scope
  // so decideReplayAction can be unit-tested without mounting the provider.
  const executeMutation = async (mutation: QueuedMutation): Promise<ExecuteResult> => {
    try {
      const token = await Auth.getSessionToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const { url, body } = buildSyncReplayRequest(getApiBaseUrl(), mutation);
      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body,
      });
      // tRPC envelopes the response as { result: { data: ... } }. Pull the
      // inner data so classifyReplayResponse and the conflict-extractor see
      // the dispatcher's own envelope (which itself has `.result` for
      // procedure return). Keep the chain optional — non-tRPC errors return
      // shapes the wrapper hasn't wrapped.
      let parsed: any;
      try { parsed = await response.json(); } catch { parsed = undefined; }
      const inner = parsed?.result?.data ?? parsed;
      const outcome = classifyReplayResponse(response.status, inner);
      if (outcome === 'conflict') {
        const procResult = inner?.result;
        const conflictId = typeof procResult?.conflictId === 'number' ? procResult.conflictId : -1;
        const fields = Array.isArray(procResult?.fields) ? procResult.fields as string[] : [];
        return { outcome: 'conflict', conflictId, fields };
      }
      return { outcome } as ExecuteResult;
    } catch {
      return { outcome: classifyReplayResponse(null) } as ExecuteResult;
    }
  };

  // Replay all queued mutations — defined before the NetInfo effect so the ref is set
  const replayQueue = useCallback(async () => {
    if (replayingRef.current || !isOnlineRef.current) return;
    const currentQueue = await AsyncStorage.getItem(STORAGE_KEY);
    if (!currentQueue) return;
    let parsed: QueuedMutation[];
    try {
      parsed = JSON.parse(currentQueue) as QueuedMutation[];
    } catch {
      return;
    }
    if (parsed.length === 0) return;

    replayingRef.current = true;
    setStatus('syncing');

    const remaining: QueuedMutation[] = [];
    let sawAuthFailure = false;
    for (let i = 0; i < parsed.length; i += 1) {
      const mutation = parsed[i];
      if (mutation.retries >= MAX_RETRIES) {
        // Drop after max retries — don't keep forever. (Auth failures
        // never increment retries, so this drop only catches genuinely
        // transient items that have failed too many times.)
        continue;
      }
      const result = await executeMutation(mutation);
      const action = decideReplayAction(mutation, result);
      if (action.kind === 'park') {
        remaining.push(action.mutation);
        if (action.halt) sawAuthFailure = true;
        if (action.retryDelay) await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }
      // If we hit auth, stop trying the rest of the queue this round —
      // they'll all fail the same way and we don't want to spam the API
      // with 401s. A subsequent replay (post-login) will pick them up.
      if (sawAuthFailure) {
        remaining.push(...tailForRequeueAfterAuthAbort(parsed, i));
        break;
      }
    }

    setQueue(remaining);
    await persistQueue(remaining);
    setLastSyncedAt(new Date().toISOString());
    setStatus(remaining.length > 0 ? 'error' : 'online');
    replayingRef.current = false;
  }, [persistQueue]);

  // Keep the ref up to date whenever replayQueue changes
  useEffect(() => {
    replayQueueRef.current = replayQueue;
  }, [replayQueue]);

  // Network monitoring — use the ref so the listener always calls the latest version
  useEffect(() => {
    // Fetch current state immediately on mount (don't wait for a change event)
    NetInfo.fetch().then((state: NetInfoState) => {
      const online = isNetworkOnline(state);
      isOnlineRef.current = online;
      setStatus(online ? 'online' : 'offline');
      if (online) {
        // Small delay to let the app fully mount before replaying
        setTimeout(() => replayQueueRef.current(), 1000);
      }
    });

    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      const online = isNetworkOnline(state);
      const wasOffline = !isOnlineRef.current;
      isOnlineRef.current = online;

      if (online) {
        setStatus('online');
        if (wasOffline) {
          // Coming back online — replay after a short delay for connection to stabilise
          setTimeout(() => replayQueueRef.current(), 1500);
        }
      } else {
        setStatus('offline');
      }
    });

    return () => unsub();
  }, []); // empty deps — we use refs, so this is safe

  // Enqueue a mutation
  const enqueue = useCallback(async (type: string, payload: unknown) => {
    const mutation: QueuedMutation = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
      createdAt: new Date().toISOString(),
      retries: 0,
    };
    setQueue(prev => {
      const next = [...prev, mutation];
      persistQueue(next);
      return next;
    });
  }, [persistQueue]);

  const clearQueue = useCallback(async () => {
    setQueue([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  // Drop the queue when the signed-in user changes (logout, account switch).
  // Without this, mutations user A queued while offline would replay under
  // user B's session next time someone signs in on this device — wrong
  // attribution at best, cross-tenant data at worst (companyScopedProcedure
  // would 403 most of them, but same-company same-procedure cases succeed).
  //
  // Triggers: only on TRANSITION from a known user to a different (or null)
  // user — not on the initial loading→user-resolved hydration. We track
  // `previousUserIdRef` so the very first effect run after mount (when the
  // ref is still null) doesn't wipe a queue persisted across app restarts.
  useEffect(() => {
    const currentId = user?.id ?? null;
    const previousId = previousUserIdRef.current;
    previousUserIdRef.current = currentId;
    if (previousId !== null && currentId !== previousId) {
      clearQueue().catch(err => {
        console.error('[SyncQueue] failed to clear on user transition:', err);
      });
    }
  }, [user, clearQueue]);

  const replayNow = useCallback(async () => {
    await replayQueue();
  }, [replayQueue]);

  return (
    <SyncQueueContext.Provider value={{
      status,
      queue,
      pendingCount: queue.length,
      lastSyncedAt,
      enqueue,
      clearQueue,
      replayNow,
    }}>
      {children}
    </SyncQueueContext.Provider>
  );
}
