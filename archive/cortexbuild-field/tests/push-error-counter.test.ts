/**
 * Tests for the push-error burst counter — the in-process bucket that
 * fires notifyOwner exactly once per cooldown window when a key
 * crosses the threshold.
 *
 * Three contracts:
 *   1. Below threshold → no notify.
 *   2. At threshold → exactly one notify; further calls within
 *      COOLDOWN_MS DON'T re-notify.
 *   3. Independent keys count independently.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const notifyOwnerMock = vi.fn(async () => undefined);
vi.mock("../server/_core/notification", () => ({
  notifyOwner: notifyOwnerMock,
}));

// The module reads thresholds from process.env at module-eval time.
// Set deterministic values BEFORE the dynamic import below.
process.env.PUSH_ERROR_THRESHOLD = "3";
process.env.PUSH_ERROR_WINDOW_MS = "60000";  // 1 minute
process.env.PUSH_ERROR_COOLDOWN_MS = "300000"; // 5 minutes

const { recordPushError, _resetPushErrorCountersForTests, getPushErrorMetricsSnapshot } = await import(
  "../server/_core/push-error-counter"
);

beforeEach(() => {
  _resetPushErrorCountersForTests();
  notifyOwnerMock.mockClear();
});

afterEach(() => vi.clearAllMocks());

// Microtask drain — notifyOwner is fire-and-forget (`.catch(...)`),
// so awaiting nothing isn't enough; we need the catch handler to run.
async function drain(): Promise<void> {
  await new Promise(r => setImmediate(r));
}

describe("recordPushError", () => {
  it("does NOT notify below the threshold", async () => {
    const t0 = 1_000_000;
    recordPushError({ key: "gate.read", message: "boom" }, t0);
    recordPushError({ key: "gate.read", message: "boom" }, t0 + 1);
    await drain();
    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });

  it("notifies exactly once when the threshold is crossed", async () => {
    const t0 = 1_000_000;
    recordPushError({ key: "gate.read", message: "boom" }, t0);
    recordPushError({ key: "gate.read", message: "boom" }, t0 + 1);
    recordPushError({ key: "gate.read", message: "latest!" }, t0 + 2);
    await drain();
    expect(notifyOwnerMock).toHaveBeenCalledTimes(1);
    const arg = (notifyOwnerMock.mock.calls[0] as unknown as [{ title: string; content: string }])[0];
    expect(arg.title).toContain("burst alert: gate.read");
    expect(arg.content).toContain("latest!");
  });

  it("does NOT re-notify within the cooldown window", async () => {
    const t0 = 1_000_000;
    // Trip the threshold.
    for (let i = 0; i < 3; i++) recordPushError({ key: "gate.read", message: "boom" }, t0 + i);
    // Many more inside the 5-minute cooldown — must stay silent.
    for (let i = 0; i < 50; i++) {
      recordPushError({ key: "gate.read", message: "boom" }, t0 + 100 + i);
    }
    await drain();
    expect(notifyOwnerMock).toHaveBeenCalledTimes(1);
  });

  it("re-notifies AFTER the cooldown expires", async () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) recordPushError({ key: "gate.read", message: "boom" }, t0 + i);
    await drain();
    expect(notifyOwnerMock).toHaveBeenCalledTimes(1);

    // Past cooldown (5 min) AND past window (1 min): the bucket has
    // shed prior timestamps and re-tripping requires another full
    // threshold count.
    const tLater = t0 + 6 * 60_000;
    for (let i = 0; i < 3; i++) recordPushError({ key: "gate.read", message: "again" }, tLater + i);
    await drain();
    expect(notifyOwnerMock).toHaveBeenCalledTimes(2);
  });

  it("counts each key independently", async () => {
    const t0 = 1_000_000;
    // gate.read: 2 (below threshold) — no notify.
    recordPushError({ key: "gate.read", message: "a" }, t0);
    recordPushError({ key: "gate.read", message: "a" }, t0 + 1);
    // expo.network: 3 (at threshold) — one notify.
    for (let i = 0; i < 3; i++) recordPushError({ key: "expo.network", message: "b" }, t0 + 10 + i);
    await drain();
    expect(notifyOwnerMock).toHaveBeenCalledTimes(1);
    const arg = (notifyOwnerMock.mock.calls[0] as unknown as [{ title: string }])[0];
    expect(arg.title).toContain("expo.network");
  });

  it("ages out timestamps older than WINDOW_MS so a slow drip never trips", async () => {
    const t0 = 1_000_000;
    // 2 errors a long time ago — should age out before the next two.
    recordPushError({ key: "gate.read", message: "old" }, t0);
    recordPushError({ key: "gate.read", message: "old" }, t0 + 1);
    // 2 errors way past WINDOW_MS = 60_000ms.
    const tLater = t0 + 70_000;
    recordPushError({ key: "gate.read", message: "new" }, tLater);
    recordPushError({ key: "gate.read", message: "new" }, tLater + 1);
    await drain();
    // Total 4 logged events, but only 2 fall inside the rolling window
    // at any single recordPushError call → never reaches threshold=3.
    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });
});

describe("getPushErrorMetricsSnapshot", () => {
  it("returns config + per-key buckets with sliding-window counts", async () => {
    const t0 = 1_000_000;
    recordPushError({ key: "gate.read", message: "a" }, t0);
    recordPushError({ key: "gate.read", message: "a" }, t0 + 1);
    recordPushError({ key: "expo.network", message: "b" }, t0 + 2);

    const snap = getPushErrorMetricsSnapshot(t0 + 3);
    expect(snap.config).toEqual({
      windowMs: 60_000,
      threshold: 3,
      cooldownMs: 300_000,
    });
    const gate = snap.buckets.find(b => b.key === "gate.read");
    const expo = snap.buckets.find(b => b.key === "expo.network");
    expect(gate).toMatchObject({ recentCount: 2, lastNotifiedAt: null, inCooldown: false });
    expect(expo).toMatchObject({ recentCount: 1, lastNotifiedAt: null, inCooldown: false });
  });

  it("flags inCooldown=true after the threshold trips, then false past cooldown", async () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) recordPushError({ key: "gate.read", message: "x" }, t0 + i);
    const snapDuring = getPushErrorMetricsSnapshot(t0 + 100);
    expect(snapDuring.buckets[0]).toMatchObject({ inCooldown: true });
    expect(snapDuring.buckets[0].lastNotifiedAt).toBeGreaterThan(0);

    const snapAfter = getPushErrorMetricsSnapshot(t0 + 6 * 60_000);
    expect(snapAfter.buckets[0]).toMatchObject({ inCooldown: false });
  });

  it("snapshot is read-only — calling it doesn't add to the bucket counts", async () => {
    const t0 = 1_000_000;
    recordPushError({ key: "gate.read", message: "x" }, t0);
    const before = getPushErrorMetricsSnapshot(t0 + 1).buckets[0].recentCount;
    getPushErrorMetricsSnapshot(t0 + 2);
    getPushErrorMetricsSnapshot(t0 + 3);
    const after = getPushErrorMetricsSnapshot(t0 + 4).buckets[0].recentCount;
    expect(after).toBe(before);
  });
});
