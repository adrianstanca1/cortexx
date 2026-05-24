/**
 * Per-user LLM call quota — Phase 2.4 of docs/ROADMAP.md.
 *
 * Why: every `invokeLLM` call burns provider tokens and (depending on
 * pricing) real money. A compromised account or runaway loop should hit
 * a ceiling rather than rack up an unbounded bill.
 *
 * Independent from the (ip, email) login rate limiter:
 *   - login-rate-limit caps FAILED login attempts; key=(ip, email);
 *     window=15s; limit=5.
 *   - llm-quota caps SUCCESSFUL LLM calls; key=userId; window=1h; limit=100.
 *
 * Cleared automatically when the window rolls. Future: per-company
 * tier-based limits (free: 50/h, pro: 500/h, etc.) — drive from
 * companyFeatureFlags or company.plan.
 */

import { TRPCError } from "@trpc/server";

export const LLM_QUOTA = {
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 100,
  maxBuckets: 10_000,
} as const;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function bucketKey(userId: number | string): string {
  return `u:${userId}`;
}

function evictExpired(now: number): number {
  let removed = 0;
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) {
      buckets.delete(k);
      removed += 1;
    }
  }
  return removed;
}

function evictOldest(): void {
  let oldestKey: string | null = null;
  let oldestResetAt = Infinity;
  for (const [k, b] of buckets) {
    if (b.resetAt < oldestResetAt) {
      oldestResetAt = b.resetAt;
      oldestKey = k;
    }
  }
  if (oldestKey !== null) buckets.delete(oldestKey);
}

/**
 * Throw TOO_MANY_REQUESTS when the user has hit `LLM_QUOTA.limit` calls
 * within the current 1h window. Call this at the START of a procedure
 * that uses the LLM, before doing any other work.
 */
export function assertLlmQuotaAllowed(userId: number, now: number = Date.now()): void {
  const key = bucketKey(userId);
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) return; // fresh window — allowed
  if (bucket.count >= LLM_QUOTA.limit) {
    const retryMs = bucket.resetAt - now;
    const retryMin = Math.max(1, Math.ceil(retryMs / 60_000));
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `LLM call quota exceeded (${LLM_QUOTA.limit}/hour). Retry in ${retryMin} min.`,
    });
  }
}

/**
 * Increment the bucket after a successful LLM call. Pair with
 * assertLlmQuotaAllowed at call start. Two-step (assert + consume)
 * lets the procedure abort early without burning a quota slot.
 */
export function consumeLlmQuota(userId: number, now: number = Date.now()): void {
  const key = bucketKey(userId);
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    if (buckets.size >= LLM_QUOTA.maxBuckets) {
      const reclaimed = evictExpired(now);
      if (reclaimed === 0) evictOldest();
    }
    buckets.set(key, { count: 1, resetAt: now + LLM_QUOTA.windowMs });
    return;
  }
  bucket.count += 1;
}

/** Reset for tests. */
export function resetLlmQuota(): void {
  buckets.clear();
}

/** Inspector for tests / health endpoints. */
export function getLlmQuotaSize(): number {
  return buckets.size;
}
