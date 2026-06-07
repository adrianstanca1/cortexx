/**
 * Singleton Redis client for shared state across pm2 cluster workers.
 *
 * Returns `null` when REDIS_URL is unset — callers fall back to local
 * in-memory state so dev / fresh-clone setups keep working without a
 * Redis instance. In production, deploy-vps.yml installs redis-server
 * and exports REDIS_URL=redis://127.0.0.1:6379 so cluster workers
 * share the same rate-limit + cache state.
 */
import Redis from 'ioredis'

declare global {

  var __cortexxRedis: Redis | null | undefined
}

export function getRedis(): Redis | null {
  if (globalThis.__cortexxRedis !== undefined) return globalThis.__cortexxRedis
  const url = process.env.REDIS_URL
  if (!url) {
    globalThis.__cortexxRedis = null
    return null
  }
  const client = new Redis(url, {
    // Fail fast in dev so a stale REDIS_URL doesn't hang the request loop
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    enableAutoPipelining: true,
    lazyConnect: false,
  })
  client.on('error', (err) => {
    // Don't crash the process on transient Redis blips; callers fall back
    // to in-memory state when the client is in 'reconnecting' state.
    console.error('[redis]', err.message)
  })
  globalThis.__cortexxRedis = client
  return client
}

/** True iff a connected Redis client is available. */
export function hasRedis(): boolean {
  const c = getRedis()
  return c !== null && c.status === 'ready'
}
