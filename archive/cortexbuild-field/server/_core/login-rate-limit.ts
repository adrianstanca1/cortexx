import type { Request } from "express";
import { TRPCError } from "@trpc/server";

/**
 * In-process rate limiter for `auth.login` **failed** attempts only.
 *
 * Buckets are keyed by `${ip}|${email}` (email lower-cased). Successful
 * logins clear the bucket so typos do not burn the user's quota.
 *
 * The underlying counter logic uses the same sliding-window + eviction
 * strategy as the original `consumeLoginAttempt` design (bounded Map size).
 */

export const LOGIN_RATE_LIMIT = {
  windowMs: 15_000,
  limit: 5,
  maxBuckets: 10_000,
} as const;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function bucketKey(ip: string, email: string): string {
  return `${ip}|${email.toLowerCase()}`;
}

function evictExpired(now: number): number {
  let removed = 0;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) {
      buckets.delete(key);
      removed += 1;
    }
  }
  return removed;
}

function evictOldest(): void {
  let oldestKey: string | null = null;
  let oldestResetAt = Infinity;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < oldestResetAt) {
      oldestResetAt = bucket.resetAt;
      oldestKey = key;
    }
  }
  if (oldestKey !== null) buckets.delete(oldestKey);
}

export type LoginRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

/**
 * Client IP for login throttling: first `x-forwarded-for` hop, then
 * `req.ip`, then `socket.remoteAddress`.
 */
export function getClientIpForLoginRateLimit(req: Pick<Request, "headers" | "ip" | "socket">): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    return xf.split(",")[0]?.trim() || "unknown";
  }
  if (Array.isArray(xf) && xf[0]) {
    return String(xf[0]).split(",")[0]?.trim() || "unknown";
  }
  if (typeof req.ip === "string" && req.ip.length > 0) return req.ip;
  const ra = req.socket?.remoteAddress;
  return typeof ra === "string" && ra.length > 0 ? ra : "unknown";
}

/**
 * Increment the failure counter for (ip, email). Used only after a failed
 * password / unknown user — same semantics as the historical
 * `consumeLoginAttempt` helper, including eviction when the store is full.
 */
export function consumeLoginAttempt(ip: string, email: string, now: number = Date.now()): LoginRateLimitResult {
  const key = bucketKey(ip, email);
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    if (buckets.size >= LOGIN_RATE_LIMIT.maxBuckets) {
      const reclaimed = evictExpired(now);
      if (reclaimed === 0) evictOldest();
    }
    buckets.set(key, { count: 1, resetAt: now + LOGIN_RATE_LIMIT.windowMs });
    return { allowed: true };
  }

  if (bucket.count >= LOGIN_RATE_LIMIT.limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true };
}

function peekBlocked(ip: string, emailNorm: string, now: number = Date.now()): boolean {
  const key = bucketKey(ip, emailNorm);
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) return false;
  return bucket.count >= LOGIN_RATE_LIMIT.limit;
}

/** Start of auth.login — block if this (ip, email) already exhausted failures. */
export function assertLoginAttemptsAllowed(
  req: Pick<Request, "headers" | "ip" | "socket">,
  emailNorm: string,
): void {
  const ip = getClientIpForLoginRateLimit(req);
  if (peekBlocked(ip, emailNorm)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many login attempts. Please try again shortly.",
    });
  }
}

/** After a failed verify — increment; throws TOO_MANY_REQUESTS if this was the cap-breaking failure. */
export function recordFailedLoginAttempt(
  req: Pick<Request, "headers" | "ip" | "socket">,
  emailNorm: string,
): void {
  const ip = getClientIpForLoginRateLimit(req);
  const decision = consumeLoginAttempt(ip, emailNorm);
  if (!decision.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many login attempts. Please try again shortly.",
    });
  }
}

/** Successful login clears the failure streak. */
export function clearLoginAttemptBucket(
  req: Pick<Request, "headers" | "ip" | "socket">,
  emailNorm: string,
): void {
  buckets.delete(bucketKey(getClientIpForLoginRateLimit(req), emailNorm));
}

/** @deprecated alias for tests that predated `resetLoginRateLimit`. */
export function resetLoginRateLimitsForTests(): void {
  buckets.clear();
}

export function resetLoginRateLimit(): void {
  buckets.clear();
}

export function getLoginRateLimitSize(): number {
  return buckets.size;
}
