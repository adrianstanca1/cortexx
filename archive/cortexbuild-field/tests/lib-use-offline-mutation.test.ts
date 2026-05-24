// @vitest-environment happy-dom
/* eslint-disable import/first -- vi.mock(...) declarations must precede
   the import they replace; the mocks stub useSyncQueue so the hook can
   run without the real provider tree. */
/**
 * Unit tests for `lib/use-offline-mutation.ts`.
 *
 * The wrapper is a thin React hook around a tRPC mutation: on transport
 * failure (or when the SyncQueue already knows we're offline) it pushes the
 * payload into the offline queue and resolves with `{ queued: true, type }`
 * instead of throwing — that's the contract the field-side UI relies on so
 * a worker tapping "Submit" on a dodgy 4G connection doesn't lose their
 * input.
 *
 * Strategy: stub `useSyncQueue` so we control `status` per-test and can
 * assert on `enqueue` calls. Mount the hook with `renderHook` from
 * @testing-library/react (already used by the sync-queue component test).
 * The mutation argument is a plain object that satisfies the
 * `MinimalMutation` shape.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, cleanup, act } from "@testing-library/react";

// ─── Mock @/lib/sync-queue ────────────────────────────────────────────────────
// We only need useSyncQueue; the real provider drags in NetInfo +
// AsyncStorage + useAuth which require their own mock chain. A factory-style
// mock keeps each test in control of `status` and `enqueue`.
const mockEnqueue = vi.fn(async (_type: string, _payload: unknown) => {});
let mockStatus: "online" | "offline" | "syncing" | "error" = "online";

vi.mock("@/lib/sync-queue", () => ({
  useSyncQueue: () => ({
    status: mockStatus,
    enqueue: mockEnqueue,
    queue: [],
    pendingCount: 0,
    lastSyncedAt: null,
    clearQueue: vi.fn(),
    replayNow: vi.fn(),
  }),
}));

// Import AFTER vi.mock so the hook picks up the stubbed module.
import { useOfflineMutation, isQueued, type OfflineResult } from "@/lib/use-offline-mutation";

beforeEach(() => {
  mockEnqueue.mockClear();
  mockStatus = "online";
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Build a fake tRPC mutation matching the MinimalMutation interface. */
function makeMutation<I = unknown, O = unknown>(opts: {
  resolved?: O;
  rejected?: unknown;
  isPending?: boolean;
  isError?: boolean;
  error?: unknown;
} = {}) {
  const mutateAsync = vi.fn(async (_input: I) => {
    if (opts.rejected !== undefined) throw opts.rejected;
    return opts.resolved as O;
  });
  const reset = vi.fn();
  return {
    mutateAsync,
    isPending: opts.isPending ?? false,
    isError: opts.isError ?? false,
    error: opts.error,
    reset,
  };
}

describe("useOfflineMutation", () => {
  it("returns the mutation result on success and does not enqueue", async () => {
    const mutation = makeMutation({ resolved: { id: "abc-123" } });
    const { result } = renderHook(() => useOfflineMutation(mutation, "defects.create"));

    let outcome: OfflineResult<{ id: string }> | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync({ title: "leak" });
    });

    expect(outcome).toEqual({ id: "abc-123" });
    expect(mutation.mutateAsync).toHaveBeenCalledWith({ title: "leak" });
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(isQueued(outcome!)).toBe(false);
  });

  it("propagates non-network errors (e.g. UNAUTHORIZED) and does NOT enqueue", async () => {
    const operationalError = Object.assign(new Error("UNAUTHORIZED"), {
      data: { code: "UNAUTHORIZED" },
    });
    const mutation = makeMutation({ rejected: operationalError });
    const { result } = renderHook(() => useOfflineMutation(mutation, "defects.create"));

    await expect(
      act(async () => {
        await result.current.mutateAsync({ title: "x" });
      }),
    ).rejects.toThrow("UNAUTHORIZED");

    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("propagates a plain validation error (BAD_REQUEST) without queueing", async () => {
    const validationError = Object.assign(new Error("Field required"), {
      data: { code: "BAD_REQUEST" },
    });
    const mutation = makeMutation({ rejected: validationError });
    const { result } = renderHook(() => useOfflineMutation(mutation, "defects.create"));

    await expect(
      act(async () => {
        await result.current.mutateAsync({ title: "x" });
      }),
    ).rejects.toThrow("Field required");

    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("queues on a 'Failed to fetch' transport error and returns the sentinel", async () => {
    // tRPC v11 wraps the underlying transport error on .cause
    const networkError = Object.assign(new Error("TRPCClientError"), {
      cause: Object.assign(new TypeError("Failed to fetch"), { name: "TypeError" }),
    });
    const mutation = makeMutation({ rejected: networkError });
    const { result } = renderHook(() => useOfflineMutation(mutation, "defects.create"));

    let outcome: OfflineResult<unknown> | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync({ title: "leak" });
    });

    expect(outcome).toEqual({ queued: true, type: "defects.create" });
    expect(isQueued(outcome!)).toBe(true);
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledWith("defects.create", { title: "leak" });
  });

  it("queues on a React Native 'Network request failed' error", async () => {
    const rnNetErr = new Error("Network request failed");
    const mutation = makeMutation({ rejected: rnNetErr });
    const { result } = renderHook(() => useOfflineMutation(mutation, "checkIn"));

    let outcome: OfflineResult<unknown> | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync({ at: "2026-05-04" });
    });

    expect(outcome).toEqual({ queued: true, type: "checkIn" });
    expect(mockEnqueue).toHaveBeenCalledWith("checkIn", { at: "2026-05-04" });
  });

  it("queues on timeout / aborted style errors", async () => {
    // The wrapper's heuristic looks for the substring "timeout" or "aborted"
    // (lowercased). RN's fetch surfaces timeouts with the literal "timeout"
    // token, and AbortController surfaces "aborted" — exercise the former.
    const timeoutErr = new Error("Request failed: timeout exceeded");
    const mutation = makeMutation({ rejected: timeoutErr });
    const { result } = renderHook(() => useOfflineMutation(mutation, "dailyReports.submit"));

    await act(async () => {
      const out = await result.current.mutateAsync({ id: 1 });
      expect(isQueued(out)).toBe(true);
    });
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
  });

  it("fast-paths the network entirely when SyncQueue.status === 'offline'", async () => {
    mockStatus = "offline";
    const mutation = makeMutation({ resolved: { id: "should-not-be-called" } });
    const { result } = renderHook(() => useOfflineMutation(mutation, "defects.create"));

    let outcome: OfflineResult<unknown> | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync({ title: "saved offline" });
    });

    // The wrapper must NOT have hit the network — that's the whole point of
    // the fast path. Asserting mutateAsync was never called proves it.
    expect(mutation.mutateAsync).not.toHaveBeenCalled();
    expect(outcome).toEqual({ queued: true, type: "defects.create" });
    expect(mockEnqueue).toHaveBeenCalledWith("defects.create", { title: "saved offline" });
  });

  it("exposes pass-through reactive state (isPending / isError / error / reset)", () => {
    const sentinelErr = new Error("boom");
    const mutation = makeMutation({
      isPending: true,
      isError: true,
      error: sentinelErr,
    });
    const { result } = renderHook(() => useOfflineMutation(mutation, "defects.create"));

    expect(result.current.isPending).toBe(true);
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(sentinelErr);

    result.current.reset?.();
    expect(mutation.reset).toHaveBeenCalledTimes(1);
  });

  it("defaults isPending / isError to false when the underlying mutation omits them", () => {
    // The MinimalMutation interface marks these optional — exercise the
    // ?? false fallback so the UI never sees `undefined` for a boolean flag.
    const mutation = {
      mutateAsync: vi.fn(async () => "ok"),
    };
    const { result } = renderHook(() => useOfflineMutation(mutation, "noop"));

    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeUndefined();
  });
});

describe("isQueued", () => {
  it("returns true for the queued sentinel object", () => {
    expect(isQueued({ queued: true, type: "defects.create" })).toBe(true);
  });

  it("returns false for undefined", () => {
    // OfflineResult<undefined> can legitimately be undefined when the wrapped
    // mutation resolves with void — make sure that's NOT mistaken for queued.
    expect(isQueued(undefined as unknown as OfflineResult<undefined>)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isQueued(null as unknown as OfflineResult<null>)).toBe(false);
  });

  it("returns false for a regular result object lacking `queued: true`", () => {
    expect(isQueued({ id: "row-1" } as unknown as OfflineResult<{ id: string }>)).toBe(false);
    expect(isQueued({ queued: false } as unknown as OfflineResult<unknown>)).toBe(false);
  });

  it("returns false for primitive values", () => {
    expect(isQueued("ok" as unknown as OfflineResult<string>)).toBe(false);
    expect(isQueued(42 as unknown as OfflineResult<number>)).toBe(false);
    expect(isQueued(true as unknown as OfflineResult<boolean>)).toBe(false);
  });
});
