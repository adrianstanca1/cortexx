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
