// @vitest-environment happy-dom
/**
 * Component-level test for the SyncQueueProvider's runtime behaviour —
 * the React effects, NetInfo subscription wiring, and AsyncStorage
 * persistence that the pure-helper tests in tests/sync-queue.test.ts
 * intentionally don't exercise.
 *
 * This is the proof-of-concept test for the RN component testing
 * infrastructure: vitest + happy-dom + react-native-web alias. If this
 * passes locally and in CI, the same pattern can be used to test
 * any screen that doesn't reach into native-only APIs.
 *
 * Strategy: render a tiny consumer component inside the provider,
 * mock `@react-native-async-storage/async-storage` and NetInfo,
 * then drive lifecycle events and assert on the consumer's output.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import * as React from "react";
import { Text, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SyncQueueProvider, useSyncQueue, STORAGE_KEY } from "@/lib/sync-queue";

// SyncQueueProvider now uses useAuth() (to clear the queue on user
// transitions), and useAuth() calls useQueryClient() so it can drop
// cached tRPC results on logout. Both of those require a
// QueryClientProvider in the tree — this wrapper supplies one.
function TestRoot({ children }: { children: React.ReactNode }) {
  // A fresh QueryClient per render so cached state from one test
  // can't bleed into the next.
  const [client] = React.useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// In-memory AsyncStorage stub. Persists across renders within a test
// (so we can assert what the provider writes to disk) but resets between
// tests via the beforeEach hook.
const asyncStorageStore: Record<string, string> = {};
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => asyncStorageStore[k] ?? null),
    setItem: vi.fn(async (k: string, v: string) => { asyncStorageStore[k] = v; }),
    removeItem: vi.fn(async (k: string) => { delete asyncStorageStore[k]; }),
  },
}));

// NetInfo is the trickier mock — the provider both calls `.fetch()` once
// on mount AND subscribes to changes. We capture the listener so we can
// drive offline/online transitions from the test body.
const netInfoState = { isConnected: true, isInternetReachable: true };
let netInfoListener: ((state: typeof netInfoState) => void) | null = null;
vi.mock("@react-native-community/netinfo", () => ({
  default: {
    fetch: vi.fn(async () => netInfoState),
    addEventListener: vi.fn((listener: (state: typeof netInfoState) => void) => {
      netInfoListener = listener;
      return () => { netInfoListener = null; };
    }),
  },
}));

// Don't actually try to call the API server. happy-dom sets Platform.OS to
// "web", so useAuth() hits the cookie-session path and calls getMe() — stub
// it (and the auth helpers useAuth awaits) so we avoid real fetch + noisy
// Vitest "incomplete mock" errors on clearUserInfo / setUserInfo.
vi.mock("@/constants/oauth", () => ({ getApiBaseUrl: () => "https://api.test" }));
// SyncQueueProvider reads `useAuth()` now that it lives behind AuthProvider
// (contexts/auth-context.tsx). Tests don't mount the provider, so mock the
// context module directly. Returning a stable unauthenticated user keeps the
// test focused on sync-queue behaviour, not auth flow.
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    error: null,
    isAuthenticated: false,
    refresh: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/_core/api", () => ({
  getMe: vi.fn(async () => null),
  logout: vi.fn(async () => {}),
}));
vi.mock("@/lib/_core/auth", () => ({
  getSessionToken: vi.fn(async () => null),
  getUserInfo: vi.fn(async () => null),
  setUserInfo: vi.fn(async () => {}),
  clearUserInfo: vi.fn(async () => {}),
  removeSessionToken: vi.fn(async () => {}),
}));

beforeEach(() => {
  Object.keys(asyncStorageStore).forEach(k => delete asyncStorageStore[k]);
  netInfoState.isConnected = true;
  netInfoState.isInternetReachable = true;
  netInfoListener = null;
});

afterEach(() => {
  // Vitest doesn't auto-call testing-library's cleanup the way Jest
  // does (it only auto-cleans when configured with `globals: true`).
  // Without this, mounted React trees leak into the next test and DOM
  // queries match elements from previous renders.
  cleanup();
  vi.clearAllMocks();
});

/**
 * A tiny component that renders the queue's status + pendingCount
 * into the DOM with sentinel-prefixed text so the test can locate them
 * via screen.getByText. We avoid testID/data-testid because RN-Web's
 * <Text> renders nested DOM elements that all carry the same
 * data-testid attribute, and getByTestId would match multiple — using
 * unique text content with getByText is simpler and unambiguous.
 */
function QueueStatusReadout() {
  const { status, pendingCount } = useSyncQueue();
  return (
    <View>
      <Text>{`STATUS:${status}`}</Text>
      <Text>{`PENDING:${pendingCount}`}</Text>
    </View>
  );
}

describe("SyncQueueProvider — component-level behaviour", () => {
  it("starts with status='online' and pendingCount=0 (nothing in storage)", async () => {
    await act(async () => {
      render(
        <TestRoot>
          <SyncQueueProvider>
            <QueueStatusReadout />
          </SyncQueueProvider>
        </TestRoot>,
      );
    });

    expect(screen.getByText("STATUS:online")).toBeInTheDocument();
    expect(screen.getByText("PENDING:0")).toBeInTheDocument();
  });

  it("loads a previously-persisted queue from AsyncStorage on mount", async () => {
    // Pre-seed storage with one queued mutation.
    asyncStorageStore[STORAGE_KEY] = JSON.stringify([
      { id: "m1", type: "defects.create", payload: { title: "x" }, createdAt: "2026-05-03", retries: 0 },
    ]);

    await act(async () => {
      render(
        <TestRoot>
          <SyncQueueProvider>
            <QueueStatusReadout />
          </SyncQueueProvider>
        </TestRoot>,
      );
    });

    // Effect timing: getItem is async, so the queue is hydrated after
    // the first paint. waitFor lets us assert once it lands.
    await vi.waitFor(() => {
      expect(screen.getByText("PENDING:1")).toBeInTheDocument();
    });
  });

  it("flips status to 'offline' when NetInfo reports no connection", async () => {
    await act(async () => {
      render(
        <TestRoot>
          <SyncQueueProvider>
            <QueueStatusReadout />
          </SyncQueueProvider>
        </TestRoot>,
      );
    });

    expect(screen.getByText("STATUS:online")).toBeInTheDocument();

    // Drive an offline event through the captured listener.
    await act(async () => {
      netInfoListener?.({ isConnected: false, isInternetReachable: false });
    });

    expect(screen.getByText("STATUS:offline")).toBeInTheDocument();
  });
});
