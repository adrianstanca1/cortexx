import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertLlmQuotaAllowed,
  consumeLlmQuota,
  resetLlmQuota,
  getLlmQuotaSize,
  LLM_QUOTA,
} from "../../server/_core/llm-quota";

beforeEach(() => resetLlmQuota());
afterEach(() => resetLlmQuota());

describe("llm-quota", () => {
  it("first call: assert allows + consume creates bucket", () => {
    assertLlmQuotaAllowed(42);
    consumeLlmQuota(42);
    expect(getLlmQuotaSize()).toBe(1);
  });

  it("up to LLM_QUOTA.limit calls allowed; the (limit+1)-th throws TOO_MANY_REQUESTS", () => {
    for (let i = 0; i < LLM_QUOTA.limit; i++) {
      assertLlmQuotaAllowed(7);
      consumeLlmQuota(7);
    }
    expect(() => assertLlmQuotaAllowed(7)).toThrow(/quota exceeded/i);
  });

  it("buckets are keyed by userId — user 1's quota does not affect user 2", () => {
    for (let i = 0; i < LLM_QUOTA.limit; i++) {
      consumeLlmQuota(1);
    }
    expect(() => assertLlmQuotaAllowed(1)).toThrow(/quota exceeded/i);
    // User 2 still fresh
    expect(() => assertLlmQuotaAllowed(2)).not.toThrow();
  });

  it("window rolls — once resetAt passes, the user is fresh again", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < LLM_QUOTA.limit; i++) {
      consumeLlmQuota(99, t0);
    }
    expect(() => assertLlmQuotaAllowed(99, t0)).toThrow();
    // 1ms past resetAt: window rolls
    expect(() => assertLlmQuotaAllowed(99, t0 + LLM_QUOTA.windowMs + 1)).not.toThrow();
  });

  it("evicts oldest bucket when maxBuckets is reached (no unbounded memory growth)", () => {
    // Fill to maxBuckets, then add one more — size stays bounded.
    for (let i = 0; i < LLM_QUOTA.maxBuckets; i++) {
      consumeLlmQuota(i);
    }
    expect(getLlmQuotaSize()).toBe(LLM_QUOTA.maxBuckets);
    consumeLlmQuota(99999);
    expect(getLlmQuotaSize()).toBeLessThanOrEqual(LLM_QUOTA.maxBuckets);
  });
});
