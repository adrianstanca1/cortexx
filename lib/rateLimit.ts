/**
 * Sliding-window rate limiter, per-key (user id, IP, …).
 *
 * Backed by Redis when REDIS_URL is set so pm2 cluster workers share
 * state; falls back to an in-process Map otherwise. Per-worker fallback
 * is fine for dev and for the bounded "stop one runaway script" use
 * case — production deploys set REDIS_URL.
 *
 * The Redis impl uses ZADD/ZREMRANGEBYSCORE/ZCARD in a pipeline so a
 * single round-trip both records the hit and counts the live ones in
 * the window.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from './redis'

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterMs: number
}

const buckets = new Map<string, number[]>()

function rateLimitInMemory(key: string, max: number, windowMs: number, now: number): RateLimitResult {
  const cutoff = now - windowMs
  const hits = (buckets.get(key) || []).filter(t => t > cutoff)
  if (hits.length >= max) {
    const retryAfterMs = Math.max(0, hits[0] + windowMs - now)
    buckets.set(key, hits)
    return { ok: false, remaining: 0, retryAfterMs }
  }
  hits.push(now)
  buckets.set(key, hits)
  if (buckets.size > 1000) {
    buckets.forEach((v, k) => {
      const live = v.filter((t: number) => t > cutoff)
      if (live.length === 0) buckets.delete(k)
      else buckets.set(k, live)
    })
  }
  return { ok: true, remaining: max - hits.length, retryAfterMs: 0 }
}

async function rateLimitRedis(key: string, max: number, windowMs: number, now: number): Promise<RateLimitResult> {
  const redis = getRedis()
  if (!redis || redis.status !== 'ready') {
    return rateLimitInMemory(key, max, windowMs, now)
  }
  const k = `rl:${key}`
  const cutoff = now - windowMs
  try {
    const pipe = redis.pipeline()
    pipe.zremrangebyscore(k, 0, cutoff)
    pipe.zadd(k, now, `${now}-${Math.random()}`)
    pipe.zcard(k)
    pipe.pexpire(k, windowMs)
    const results = await pipe.exec()
    if (!results) return rateLimitInMemory(key, max, windowMs, now)
    const count = Number(results[2]?.[1] ?? 0)
    if (count > max) {
      const oldest = await redis.zrange(k, 0, 0, 'WITHSCORES')
      const oldestTs = Number(oldest[1] ?? now)
      const retryAfterMs = Math.max(0, oldestTs + windowMs - now)
      return { ok: false, remaining: 0, retryAfterMs }
    }
    return { ok: true, remaining: Math.max(0, max - count), retryAfterMs: 0 }
  } catch {
    return rateLimitInMemory(key, max, windowMs, now)
  }
}

export async function rateLimit(
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
): Promise<RateLimitResult> {
  const redis = getRedis()
  if (redis && redis.status === 'ready') {
    return rateLimitRedis(key, max, windowMs, now)
  }
  return rateLimitInMemory(key, max, windowMs, now)
}

export function _resetRateLimitForTests() {
  buckets.clear()
}

export const RATE_PROFILES = {
  write: { max: 60, windowMs: 60_000 },
  auth: { max: 5, windowMs: 60_000 },
  llm: { max: 20, windowMs: 60_000 },
  read: { max: 240, windowMs: 60_000 },
} as const

export type RateProfile = keyof typeof RATE_PROFILES

export function rateLimitKey(req: NextRequest, userId?: string | null): string {
  if (userId) return `u:${userId}`
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  return `ip:${ip}`
}

/**
 *   const limited = await enforceRateLimit(req, 'write', userId)
 *   if (limited) return limited
 */
export async function enforceRateLimit(
  req: NextRequest,
  profile: RateProfile,
  userId?: string | null,
): Promise<NextResponse | null> {
  const { max, windowMs } = RATE_PROFILES[profile]
  const key = `${profile}:${rateLimitKey(req, userId)}`
  const result = await rateLimit(key, max, windowMs)
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
