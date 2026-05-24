/**
 * Tiny in-process sliding-window rate limiter. Per-key (user id, IP, …).
 *
 * Not durable, not cross-instance — sufficient for a single-VPS deployment
 * to stop one client from monopolising a slow local resource (e.g. Ollama).
 * Swap for Redis if you ever go multi-node.
 */

const buckets = new Map<string, number[]>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterMs: number
}

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): RateLimitResult {
  const cutoff = now - windowMs
  const hits = (buckets.get(key) || []).filter(t => t > cutoff)
  if (hits.length >= max) {
    const retryAfterMs = Math.max(0, hits[0] + windowMs - now)
    buckets.set(key, hits)
    return { ok: false, remaining: 0, retryAfterMs }
  }
  hits.push(now)
  buckets.set(key, hits)
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (buckets.size > 1000) {
    buckets.forEach((v, k) => {
      const live = v.filter((t: number) => t > cutoff)
      if (live.length === 0) buckets.delete(k)
      else buckets.set(k, live)
    })
  }
  return { ok: true, remaining: max - hits.length, retryAfterMs: 0 }
}

export function _resetRateLimitForTests() {
  buckets.clear()
}

import { NextRequest, NextResponse } from 'next/server'

/**
 * Pre-built limit profiles for the common call patterns. Centralised so
 * tweaking a category (e.g. tightening auth) is a one-line change.
 */
export const RATE_PROFILES = {
  // 60 writes / minute / actor — generous for normal use, blocks runaway scripts
  write: { max: 60, windowMs: 60_000 },
  // 5 attempts / minute — auth, password resets, push subscribe; brute-force defence
  auth: { max: 5, windowMs: 60_000 },
  // 20 / minute / user — LLM endpoints (existing /api/ask profile)
  llm: { max: 20, windowMs: 60_000 },
  // 240 / minute — read-only list endpoints, mostly to catch infinite-loop scripts
  read: { max: 240, windowMs: 60_000 },
} as const

export type RateProfile = keyof typeof RATE_PROFILES

/**
 * Extract a stable rate-limit key from a request — userId when present,
 * else the client IP. Falls back to a constant so an unknown caller still
 * gets limited (rather than escaping).
 */
export function rateLimitKey(req: NextRequest, userId?: string | null): string {
  if (userId) return `u:${userId}`
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  return `ip:${ip}`
}

/**
 * One-shot rate-limit check + 429 response. Returns the NextResponse to
 * return on limit-exceeded, or null when the request can proceed.
 *
 *   const limited = enforceRateLimit(req, 'write', userId)
 *   if (limited) return limited
 */
export function enforceRateLimit(
  req: NextRequest,
  profile: RateProfile,
  userId?: string | null,
): NextResponse | null {
  const { max, windowMs } = RATE_PROFILES[profile]
  const key = `${profile}:${rateLimitKey(req, userId)}`
  const result = rateLimit(key, max, windowMs)
  if (result.ok) return null
  const retryAfter = Math.ceil(result.retryAfterMs / 1000)
  return NextResponse.json(
    { error: 'Too many requests', retryAfter },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(max),
        'X-RateLimit-Remaining': '0',
      },
    },
  )
}
