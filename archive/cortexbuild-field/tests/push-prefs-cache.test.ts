/**
 * Tests for the Redis-backed pushPreferences cache (FU-20). Uses a
 * stub Redis client (installed via `_setClientForTests`) so we can
 * assert on call shape without spinning up a real Redis instance.
 *
 * The cache is a graceful-degradation layer, not a perf cache, so
 * the contracts that matter are:
 *   1. Without REDIS_URL the module is a no-op (every call resolves
 *      to empty/undefined; no crashes).
 *   2. mget returns hits-only Map; misses don't poison the result.
 *   3. Malformed cache entries are dropped (not surfaced as garbage).
 *   4. SET pipeline + DEL fire with the expected keys / TTL.
 *   5. Redis errors trip the circuit breaker — subsequent calls in
 *      the cooldown skip Redis entirely.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readCachedPrefs,
  writeCachedPrefs,
  invalidateCachedPrefs,
  _resetPushPrefsCacheForTests,
  _setClientForTests,
} from "../server/_core/push-prefs-cache";

interface StubRedis {
  mget: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  pipeline: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
}

function makeStubRedis(opts: {
  mgetResult?: (string | null)[];
  mgetError?: Error;
  delError?: Error;
  pipelineExecError?: Error;
} = {}): { stub: StubRedis; pipelineSetCalls: [string, string, string, number][]; pipelineExecCalls: number } {
  const pipelineSetCalls: [string, string, string, number][] = [];
  let pipelineExecCalls = 0;

  const pipeline = () => ({
    set: (key: string, value: string, mode: string, ttl: number) => {
      pipelineSetCalls.push([key, value, mode, ttl]);
      return undefined;
    },
    exec: async () => {
      pipelineExecCalls += 1;
      if (opts.pipelineExecError) throw opts.pipelineExecError;
      return [];
    },
  });

  const stub: StubRedis = {
    mget: vi.fn(async (_keys: string[]) => {
      if (opts.mgetError) throw opts.mgetError;
      return opts.mgetResult ?? [];
    }),
    del: vi.fn(async (_key: string) => {
      if (opts.delError) throw opts.delError;
      return 1;
    }),
    pipeline: vi.fn(pipeline),
    on: vi.fn(),
    quit: vi.fn(async () => "OK"),
  };

  return { stub, pipelineSetCalls, get pipelineExecCalls() { return pipelineExecCalls; } } as any;
}

beforeEach(async () => {
  await _resetPushPrefsCacheForTests();
});

afterEach(async () => {
  await _resetPushPrefsCacheForTests();
  vi.clearAllMocks();
});

describe("readCachedPrefs", () => {
  it("returns an empty Map when no client is configured (REDIS_URL missing)", async () => {
    const original = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    try {
      const result = await readCachedPrefs([1, 2, 3]);
      expect(result.size).toBe(0);
    } finally {
      if (original) process.env.REDIS_URL = original;
    }
  });

  it("returns a hits-only Map; misses are absent (not present-with-null)", async () => {
    const { stub } = makeStubRedis({
      mgetResult: [
        JSON.stringify({ defect_assigned: false }),
        null,
        JSON.stringify({}),
      ],
    });
    _setClientForTests(stub as any);

    const result = await readCachedPrefs([1, 2, 3]);
    expect(result.size).toBe(2);
    expect(result.get(1)).toEqual({ defect_assigned: false });
    expect(result.has(2)).toBe(false); // miss → absent
    expect(result.get(3)).toEqual({});
  });

  it("drops malformed JSON entries silently (treated as miss)", async () => {
    const { stub } = makeStubRedis({
      mgetResult: ["not-json", JSON.stringify({ defect_assigned: false })],
    });
    _setClientForTests(stub as any);
    const result = await readCachedPrefs([1, 2]);
    expect(result.has(1)).toBe(false);
    expect(result.get(2)).toEqual({ defect_assigned: false });
  });

  it("trips the circuit breaker on mget error; next call skips Redis", async () => {
    const { stub } = makeStubRedis({ mgetError: new Error("ECONNREFUSED") });
    _setClientForTests(stub as any);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // First call: hits Redis, fails, trips breaker.
    const r1 = await readCachedPrefs([1]);
    expect(r1.size).toBe(0);
    expect(stub.mget).toHaveBeenCalledTimes(1);

    // Second call: breaker open, skips Redis entirely.
    const r2 = await readCachedPrefs([1, 2]);
    expect(r2.size).toBe(0);
    expect(stub.mget).toHaveBeenCalledTimes(1); // not called again

    warnSpy.mockRestore();
  });

  it("returns empty for an empty userIds array (no Redis call)", async () => {
    const { stub } = makeStubRedis({});
    _setClientForTests(stub as any);
    const result = await readCachedPrefs([]);
    expect(result.size).toBe(0);
    expect(stub.mget).not.toHaveBeenCalled();
  });
});

describe("writeCachedPrefs", () => {
  it("issues a pipeline SET per entry with EX TTL", async () => {
    const made = makeStubRedis({});
    _setClientForTests(made.stub as any);

    await writeCachedPrefs([
      { userId: 1, prefs: { defect_assigned: false } },
      { userId: 2, prefs: {} },
    ]);

    expect(made.pipelineSetCalls).toHaveLength(2);
    expect(made.pipelineSetCalls[0][0]).toBe("push-prefs:1");
    expect(JSON.parse(made.pipelineSetCalls[0][1])).toEqual({ defect_assigned: false });
    expect(made.pipelineSetCalls[0][2]).toBe("EX");
    expect(typeof made.pipelineSetCalls[0][3]).toBe("number");
    expect(made.pipelineSetCalls[0][3]).toBeGreaterThan(0);
  });

  it("is a no-op for an empty entries array (no Redis call)", async () => {
    const made = makeStubRedis({});
    _setClientForTests(made.stub as any);
    await writeCachedPrefs([]);
    expect(made.stub.pipeline).not.toHaveBeenCalled();
  });

  it("trips the circuit breaker on pipeline.exec failure", async () => {
    const made = makeStubRedis({ pipelineExecError: new Error("WRITE_FAIL") });
    _setClientForTests(made.stub as any);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await writeCachedPrefs([{ userId: 1, prefs: {} }]);
    // Next call should skip Redis.
    await writeCachedPrefs([{ userId: 2, prefs: {} }]);
    expect(made.stub.pipeline).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

describe("invalidateCachedPrefs", () => {
  it("issues DEL with the prefixed key", async () => {
    const made = makeStubRedis({});
    _setClientForTests(made.stub as any);
    await invalidateCachedPrefs(42);
    expect(made.stub.del).toHaveBeenCalledWith("push-prefs:42");
  });

  it("swallows DEL errors and trips the circuit breaker", async () => {
    const made = makeStubRedis({ delError: new Error("DEL_FAIL") });
    _setClientForTests(made.stub as any);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await invalidateCachedPrefs(7);
    // Next call (within the breaker window) skips Redis entirely.
    await invalidateCachedPrefs(8);
    expect(made.stub.del).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});
