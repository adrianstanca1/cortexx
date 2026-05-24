/**
 * Push notification dispatch via the Expo Push API.
 *
 * The pipeline:
 *   1. Filter userIds by per-event push preferences (the gate).
 *   2. Look up active push tokens for the surviving user IDs.
 *   3. POST them to https://exp.host/--/api/v2/push/send (Expo's free
 *      relay to APNs/FCM/web push).
 *   4. Mark tokens that the relay reports as DeviceNotRegistered as
 *      inactive, so we don't keep retrying dead devices.
 *
 * The Expo Push API requires no auth — Expo identifies the project from
 * the token itself. See https://docs.expo.dev/push-notifications/sending-notifications/
 *
 * All failures are non-fatal: we log and return a result object. DB
 * lookup failures (pool timeout, transient errors) must never reject —
 * the caller's mutation may already have committed (e.g. defect status).
 */
import { eq, inArray } from "drizzle-orm";
import { pushTokens as dbPushTokens, users as dbUsers, type PushToken } from "../../drizzle/schema";
import {
  isEventEnabled,
  type NotificationEventType,
  type UserPushPreferences,
} from "../../shared/notification-events";
import { getDb } from "../db";
import { isPushGateInBurst, recordPushError } from "./push-error-counter";
import { readCachedPrefs, writeCachedPrefs } from "./push-prefs-cache";
import { log } from "./logger";

/**
 * Resolve the fail mode for the preference gate when the DB is
 * unreachable. Default 'open': preserves the original "missed
 * assignments aren't recoverable" rule. 'closed' and 'auto' exist
 * for incidents where over-notification is the worse outcome
 * (e.g. someone explicitly muted a noisy event and the DB has been
 * down for hours — opt them back in by accident and the user
 * experience is "the mute setting is broken"). 'auto' uses the
 * burst counter for gate.read so a single transient blip still
 * fails open.
 */
function resolveFailMode(): "open" | "closed" | "auto" {
  const raw = process.env.PUSH_GATE_FAIL_MODE;
  if (raw === "closed" || raw === "auto") return raw;
  return "open";
}

/**
 * Fall back to last-known cached preferences when the DB read failed.
 * For users we have a cache hit on, honour their actual recent
 * preferences (and count an explicit mute as muted, not as a fail
 * artefact). For users we don't have cached, apply the configured
 * fail mode (open/closed/auto). Always returns degraded:true since
 * the source of truth (DB) was unavailable.
 */
async function fallbackThroughCache(
  userIds: number[],
  eventType: NotificationEventType,
): Promise<{ allowed: number[]; muted: number; degraded: boolean }> {
  const cached = await readCachedPrefs(userIds);
  const uncached = userIds.filter(id => !cached.has(id));

  // Apply fail mode for users with no cache hit.
  const mode = resolveFailMode();
  const failClosed = mode === "closed" || (mode === "auto" && isPushGateInBurst());

  const allowed: number[] = [];
  let muted = 0;
  for (const id of userIds) {
    const prefs = cached.get(id);
    if (prefs !== undefined) {
      if (isEventEnabled(prefs, eventType)) allowed.push(id);
      else muted++;
    } else {
      // No cache → fail mode applies. fail-open puts the user back
      // in `allowed`; fail-closed drops them silently (no muted++,
      // since this isn't an explicit mute).
      if (!failClosed) allowed.push(id);
    }
  }
  // Degraded is always true on this path — the DB was the source of
  // truth and we couldn't reach it. The cache hit just gives us a
  // better answer than fail-mode alone, but it's still stale data.
  void uncached; // (unused, retained for future structured logging)
  return { allowed, muted, degraded: true };
}

export interface PushPayload {
  title: string;
  body: string;
  /**
   * Optional structured data delivered alongside the notification —
   * the mobile client uses this for deep-link routing (e.g.
   * `{ deepLink: '/defects/42' }`).
   */
  data?: Record<string, unknown>;
}

export interface PushResult {
  /** Number of tokens we POSTed to Expo. */
  attempted: number;
  /** Number Expo accepted (status === 'ok'). */
  accepted: number;
  /** Number Expo refused (status === 'error'). Includes DeviceNotRegistered. */
  rejected: number;
  /** Tokens marked inactive due to DeviceNotRegistered. */
  deactivated: number;
  /** Number of users dropped by the per-event preference gate. */
  muted: number;
  /**
   * True iff the preference gate failed open during this call —
   * `filterByPreferences` couldn't read users.pushPreferences (DB
   * unreachable, transient pool failure, query error) and allowed
   * everyone through to avoid silently dropping assignment pushes.
   * Callers and tests can branch on this to surface degraded state
   * without changing the fail-open behaviour itself.
   */
  degraded: boolean;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoResponse {
  data?: ExpoTicket | ExpoTicket[];
  errors?: { code: string; message: string }[];
}

function isExpoToken(token: string): boolean {
  // ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx] or ExpoPushToken[...]
  return /^Expo(?:nent)?PushToken\[[^\]]+\]$/.test(token);
}

/**
 * Drop user IDs whose pushPreferences disable this event type.
 * Reads users.pushPreferences in one query; never throws.
 *
 * Failure mode is fail-open by design: a missed assignment push
 * isn't recoverable (the user never learns they were assigned), but
 * over-notifying a muted user during a transient pool blip is. So a
 * DB read failure here is logged and treated as "everyone allowed".
 */
async function filterByPreferences(
  userIds: number[],
  eventType: NotificationEventType,
): Promise<{ allowed: number[]; muted: number; degraded: boolean }> {
  if (userIds.length === 0) return { allowed: [], muted: 0, degraded: false };
  const db = await getDb();
  // null-DB and SELECT-error are fail paths. Before applying the
  // fail mode, try the Redis-backed last-known-prefs cache (FU-20)
  // so a sustained DB outage can still honour explicit mutes for
  // users we recently read. Cache is best-effort and degrades to
  // the previous fail-mode behaviour silently.
  if (!db) return await fallbackThroughCache(userIds, eventType);

  let rows: { id: number; pushPreferences: UserPushPreferences | null }[];
  try {
    rows = await db.select({
      id: dbUsers.id,
      pushPreferences: dbUsers.pushPreferences,
    }).from(dbUsers).where(inArray(dbUsers.id, userIds));
  } catch (error) {
    log.warn("[Push] Failed to read pushPreferences; allowing all:", error);
    recordPushError({ key: "gate.read", message: String(error) });
    return await fallbackThroughCache(userIds, eventType);
  }

  // Happy path: refresh the cache with what we just read. Best-effort
  // (writeCachedPrefs swallows its own errors); we don't await the
  // result on the critical path beyond the call itself, but ioredis
  // pipeline.exec is fast (sub-ms locally) so the overhead is fine.
  void writeCachedPrefs(rows.map(r => ({ userId: r.id, prefs: r.pushPreferences ?? {} })));

  // Index by id so users without a row (shouldn't happen, but be safe)
  // are treated as opt-out enabled.
  const prefsById = new Map(rows.map(r => [r.id, r.pushPreferences ?? {}]));
  const allowed: number[] = [];
  let muted = 0;
  for (const id of userIds) {
    const prefs = prefsById.get(id) ?? {};
    if (isEventEnabled(prefs, eventType)) {
      allowed.push(id);
    } else {
      muted++;
    }
  }
  return { allowed, muted, degraded: false };
}

/**
 * Send a push notification to every active token belonging to the given
 * user IDs, gated by per-event preferences. Returns a summary result;
 * never throws on DB or Expo failures (logs them and continues).
 */
export async function sendPushToUsers(
  userIds: number[],
  eventType: NotificationEventType,
  payload: PushPayload,
  // Injected for tests.
  fetchImpl: typeof fetch = fetch,
): Promise<PushResult> {
  const result: PushResult = { attempted: 0, accepted: 0, rejected: 0, deactivated: 0, muted: 0, degraded: false };
  if (userIds.length === 0) return result;

  const { allowed, muted, degraded } = await filterByPreferences(userIds, eventType);
  result.muted = muted;
  result.degraded = degraded;
  if (allowed.length === 0) return result;

  const db = await getDb();
  if (!db) {
    log.warn("[Push] Database unavailable; cannot look up push tokens");
    return result;
  }

  let tokens: PushToken[];
  try {
    tokens = await db.select().from(dbPushTokens)
      .where(inArray(dbPushTokens.userId, allowed));
  } catch (error) {
    log.warn("[Push] Failed to look up push tokens:", error);
    recordPushError({ key: "tokens.lookup", message: String(error) });
    return result;
  }

  // Filter to (a) active tokens and (b) syntactically valid Expo tokens —
  // bad tokens make Expo reject the whole batch.
  const activeValid = tokens.filter(t => t.active && isExpoToken(t.token));
  if (activeValid.length === 0) return result;

  result.attempted = activeValid.length;

  const messages = activeValid.map(t => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: "default" as const,
  }));

  // Three failure modes share the broad "rejected = attempted" outcome
  // but want distinct log severity so ops can tell them apart:
  //   - network/transport: fetch threw or returned non-2xx
  //   - protocol: response wasn't valid JSON or didn't match Expo's shape
  //   - upstream: Expo returned per-ticket errors (handled below per-ticket)
  // Without the split, a future Expo schema change reads as "we
  // rejected the batch" indistinguishable from real network failures.
  let response: Response;
  try {
    response = await fetchImpl(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "accept-encoding": "gzip, deflate",
        "content-type": "application/json",
      },
      body: JSON.stringify(messages),
    });
  } catch (error) {
    log.warn("[Push] Network/transport error calling Expo Push API:", error);
    recordPushError({ key: "expo.network", message: String(error) });
    result.rejected = result.attempted;
    return result;
  }

  if (!response.ok) {
    log.warn(`[Push] Expo returned HTTP ${response.status}`);
    recordPushError({ key: "expo.http", message: `HTTP ${response.status}` });
    result.rejected = result.attempted;
    return result;
  }

  let json: ExpoResponse;
  try {
    json = (await response.json()) as ExpoResponse;
  } catch (error) {
    // Distinct from a network failure — Expo answered, but the body
    // wasn't JSON. Most likely cause: Expo's API contract changed and
    // we should investigate before silently treating these as rejected.
    log.error("[Push] Expo response was not valid JSON:", error);
    recordPushError({ key: "expo.protocol", message: String(error) });
    result.rejected = result.attempted;
    return result;
  }

  const tickets = Array.isArray(json.data) ? json.data : json.data ? [json.data] : [];

  // Map each ticket back to its token so we can deactivate dead ones.
  const tokensToDeactivate: number[] = [];
  tickets.forEach((ticket, idx) => {
    if (ticket.status === "ok") {
      result.accepted++;
    } else {
      result.rejected++;
      if (ticket.details?.error === "DeviceNotRegistered") {
        tokensToDeactivate.push(activeValid[idx].id);
      }
    }
  });

  if (tokensToDeactivate.length > 0) {
    try {
      await db.update(dbPushTokens)
        .set({ active: false, updatedAt: new Date() })
        .where(inArray(dbPushTokens.id, tokensToDeactivate));
      result.deactivated = tokensToDeactivate.length;
    } catch (error) {
      // console.error rather than warn — leaving dead tokens active
      // means every future send keeps hitting them and risks rate
      // limits. This is worth surfacing more loudly than a transient.
      log.error("[Push] Failed to deactivate dead push tokens:", error);
      recordPushError({ key: "tokens.deactivate", message: String(error) });
    }
  }

  return result;
}

/**
 * Convenience: notify the user whose `name` matches an `assignedTo`
 * string on a defect/permit/RFI/etc. Resolves the name to user IDs and
 * forwards to `sendPushToUsers` (which applies the preference gate).
 *
 * If no exact-name match exists (e.g. "Site team" or a free-text
 * placeholder), this is a no-op — we never guess.
 */
export async function sendPushToUserByName(
  displayName: string,
  eventType: NotificationEventType,
  payload: PushPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<PushResult> {
  const empty: PushResult = { attempted: 0, accepted: 0, rejected: 0, deactivated: 0, muted: 0, degraded: false };
  const trimmed = displayName.trim();
  if (!trimmed) return empty;

  const db = await getDb();
  if (!db) return empty;

  let matches: { id: number }[];
  try {
    matches = await db.select({ id: dbUsers.id }).from(dbUsers).where(eq(dbUsers.name, trimmed));
  } catch (error) {
    log.warn("[Push] Failed to resolve user by display name:", error);
    return empty;
  }
  if (matches.length === 0) {
    // Surface stale assignments: a defect/RFI/permit assigned to a
    // renamed user, "Site team", or a typo will silently never push.
    // The warn lets ops grep find these without surprising the caller
    // (it stays a no-op — no exception, empty PushResult).
    log.warn(`[Push] sendPushToUserByName: no user matched displayName=${JSON.stringify(trimmed)}`);
    return empty;
  }

  return sendPushToUsers(matches.map(u => u.id), eventType, payload, fetchImpl);
}
