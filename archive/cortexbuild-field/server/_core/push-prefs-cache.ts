/**
 * Redis-backed cache for users.pushPreferences with one specific job:
 * graceful degradation when the primary DB read fails. The push gate
 * (server/_core/pushNotifications.ts filterByPreferences) writes
 * prefs to this cache on every successful DB read, then reads from
 * it as a fallback when the DB is unreachable.
 *
 * This is NOT a read-through performance cache. The DB read is the
 * source of truth on every gate call; the cache exists so a 30-min
 * Postgres outage doesn't degrade us all the way to fail-open
 * (FU-15) or fail-closed (FU-18). With a fresh cache hit we know
 * the user's actual recent preferences and can honour them.
 *
 * Failure handling:
 *   - REDIS_URL missing → cache silently disabled, every cache call
 *     is a no-op. No new dependency on Redis.
 *   - Redis unreachable / errors → trip a 60-second circuit breaker
 *     so subsequent gate calls don't pile up timeouts. The breaker
 *     resets automatically; no health-check coupling.
 *   - Malformed cache value (someone hand-wrote junk into Redis) →
 *     the entry is dropped, logged, treated as a cache miss.
 *
 * TTL is 1 hour by default — long enough to survive a typical
 * outage, short enough that a user's prefs propagate to other
 * devices/sessions without an explicit invalidation. Mutations
 * also call `invalidate(userId)` so changes are immediate; the
 * TTL is the safety net.
 */
import IORedis, { type Redis as RedisClient } from "ioredis";
import type { UserPushPreferences } from "../../shared/notification-events";
import { log } from "./logger";

const KEY_PREFIX = "push-prefs:";
const TTL_SECONDS = parseEnvInt(process.env.PUSH_PREFS_CACHE_TTL_SECONDS, 3600);
const CIRCUIT_OPEN_MS = parseEnvInt(process.env.PUSH_PREFS_CACHE_CIRCUIT_MS, 60_000);

function parseEnvInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

let client: RedisClient | null = null;
let circuitOpenUntil = 0;

function getClient(now: number = Date.now()): RedisClient | null {
  if (now < circuitOpenUntil) return null;
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  client = new IORedis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 1500,
    commandTimeout: 1500,
    enableOfflineQueue: false,
  });
  client.on("error", () => {
    // Per-call sites log + trip the breaker; this listener only
    // prevents unhandled-error crashes from ioredis reconnect spam.
  });
  return client;
}

function tripCircuit(now: number = Date.now()): void {
  circuitOpenUntil = now + CIRCUIT_OPEN_MS;
}

export async function readCachedPrefs(
  userIds: number[],
): Promise<Map<number, UserPushPreferences>> {
  const out = new Map<number, UserPushPreferences>();
  if (userIds.length === 0) return out;
  const c = getClient();
  if (!c) return out;
  try {
    const keys = userIds.map(id => `${KEY_PREFIX}${id}`);
    const values = await c.mget(keys);
    for (let i = 0; i < userIds.length; i++) {
      const raw = values[i];
      if (raw === null) continue;
      try {
        out.set(userIds[i], JSON.parse(raw) as UserPushPreferences);
      } catch {
        // Malformed entry — drop and treat as miss.
      }
    }
  } catch (error) {
    log.warn("[push-prefs-cache] mget failed:", error);
    tripCircuit();
  }
  return out;
}

export async function writeCachedPrefs(
  entries: { userId: number; prefs: UserPushPreferences }[],
): Promise<void> {
  if (entries.length === 0) return;
  const c = getClient();
  if (!c) return;
  try {
    const pipe = c.pipeline();
    for (const { userId, prefs } of entries) {
      pipe.set(
        `${KEY_PREFIX}${userId}`,
        JSON.stringify(prefs),
        "EX",
        TTL_SECONDS,
      );
    }
    await pipe.exec();
  } catch (error) {
    log.warn("[push-prefs-cache] pipeline set failed:", error);
    tripCircuit();
  }
}

/**
 * Invalidate a single user's cached preferences. Called from
 * pushTokens.updatePreference after a successful UPDATE so the next
 * gate read sees the change immediately rather than waiting up to
 * an hour for the TTL to expire.
 */
export async function invalidateCachedPrefs(userId: number): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    await c.del(`${KEY_PREFIX}${userId}`);
  } catch (error) {
    log.warn("[push-prefs-cache] del failed:", error);
    tripCircuit();
  }
}

export async function _resetPushPrefsCacheForTests(): Promise<void> {
  circuitOpenUntil = 0;
  if (client) {
    try {
      await client.quit();
    } catch {
      // ignore
    }
    client = null;
  }
}

export function _setClientForTests(stub: RedisClient | null): void {
  client = stub;
  circuitOpenUntil = 0;
}
