/**
 * Burst-rate counter for push-pipeline errors.
 *
 * The push pipeline (server/_core/pushNotifications.ts) logs every
 * failure as console.warn/error so it lands in pm2 logs, but those
 * are ops-invisible — nobody reads them until a customer complains.
 * This module sits behind those log sites: it counts occurrences in
 * a rolling window per error key, and when the threshold trips it
 * fires `notifyOwner` exactly once per cooldown window so an
 * extended outage produces a single owner alert rather than silence
 * (or, worse, a flood that gets ignored).
 *
 * Why in-process and not a metrics provider:
 *   - The codebase already has notifyOwner; this lets the alert
 *     chain reuse the existing path (audit log, owner email).
 *   - One process per VPS instance — losing a few counts on restart
 *     is acceptable for a "burst trigger" that already has a 5-min
 *     window. A real metrics provider (Sentry, Datadog) is the right
 *     long-term answer; this is the smallest thing that closes the
 *     ops-blind-spot today.
 *
 * Tunable via env so a future incident can dial sensitivity without
 * a deploy if necessary; defaults below were chosen to fire on a
 * sustained outage but tolerate single-digit blips.
 */
import { notifyOwner } from './notification';
import { log } from "./logger";

interface Bucket {
  timestamps: number[];
  lastNotified: number | null;
}

const WINDOW_MS = parseEnvInt(process.env.PUSH_ERROR_WINDOW_MS, 5 * 60 * 1000);
const THRESHOLD = parseEnvInt(process.env.PUSH_ERROR_THRESHOLD, 10);
const COOLDOWN_MS = parseEnvInt(process.env.PUSH_ERROR_COOLDOWN_MS, 30 * 60 * 1000);

function parseEnvInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const buckets = new Map<string, Bucket>();

export interface PushErrorRecord {
  /** Stable identifier — e.g. 'gate.read', 'tokens.lookup', 'expo.network'. */
  key: string;
  /** A short summary string used as the latest-message in the alert body. */
  message: string;
}

/**
 * Record one occurrence of a push-pipeline error. Fires notifyOwner
 * (best-effort, never throws) when the rolling-window count crosses
 * THRESHOLD, then enters cooldown so the same bucket can't re-alert
 * for COOLDOWN_MS.
 *
 * `now` is injected for testability — callers don't pass it.
 */
export function recordPushError(rec: PushErrorRecord, now: number = Date.now()): void {
  let bucket = buckets.get(rec.key);
  if (!bucket) {
    bucket = { timestamps: [], lastNotified: null };
    buckets.set(rec.key, bucket);
  }
  // Drop timestamps that have aged out of the window.
  bucket.timestamps = bucket.timestamps.filter(t => now - t < WINDOW_MS);
  bucket.timestamps.push(now);

  if (bucket.timestamps.length < THRESHOLD) return;

  // In cooldown — already alerted recently. Keep counting (so the
  // window-rollover logic stays correct) but suppress the notify.
  if (bucket.lastNotified !== null && now - bucket.lastNotified < COOLDOWN_MS) return;

  bucket.lastNotified = now;
  // notifyOwner is async + best-effort; we don't await and we
  // swallow its rejection so a notification failure can't bubble
  // back to the push pipeline that called us.
  notifyOwner({
    title: `[Push] burst alert: ${rec.key}`,
    content: `${bucket.timestamps.length} errors in ${Math.round(WINDOW_MS / 60_000)} minutes. Latest: ${rec.message}`,
  }).catch(error => {
    log.warn('[push-error-counter] notifyOwner failed:', error);
  });
}

/**
 * True when the gate-read bucket has alerted recently (within
 * COOLDOWN_MS of its lastNotified). The 'auto' fail mode uses this
 * to flip from fail-open to fail-closed during a sustained outage:
 * the first few errors fail open (preserving normal behaviour for
 * blips), but once the threshold + alert have fired we assume the
 * outage is real and start failing closed until cooldown expires.
 *
 * The signal is gate-specific by design — token-lookup or Expo
 * failures don't compromise the preference gate's correctness, so
 * they should not flip the mode. Only the gate.read bucket, which
 * IS the failure mode that makes fail-open dangerous (we'd send to
 * muted users), drives the auto switch.
 */
export function isPushGateInBurst(now: number = Date.now()): boolean {
  const bucket = buckets.get("gate.read");
  if (!bucket || bucket.lastNotified === null) return false;
  return now - bucket.lastNotified < COOLDOWN_MS;
}

export interface PushErrorMetricsSnapshot {
  /** Tunable thresholds in effect for this process. */
  config: {
    windowMs: number;
    threshold: number;
    cooldownMs: number;
  };
  /**
   * One entry per error key that has been recorded since process
   * start (or last reset). `recentCount` is the sliding-window
   * count at snapshot time; `lastNotifiedAt` is the wall-clock ms
   * of the most recent owner alert (null if never tripped).
   */
  buckets: {
    key: string;
    recentCount: number;
    lastNotifiedAt: number | null;
    inCooldown: boolean;
  }[];
}

/**
 * Read-only snapshot of the bucket state for /api/metrics. Computes
 * the recent count fresh (drops aged-out timestamps) so the endpoint
 * doesn't depend on a recent recordPushError call to clean up stale
 * data.
 */
export function getPushErrorMetricsSnapshot(now: number = Date.now()): PushErrorMetricsSnapshot {
  const result: PushErrorMetricsSnapshot["buckets"] = [];
  for (const [key, bucket] of buckets) {
    const recent = bucket.timestamps.filter(t => now - t < WINDOW_MS).length;
    result.push({
      key,
      recentCount: recent,
      lastNotifiedAt: bucket.lastNotified,
      inCooldown: bucket.lastNotified !== null && now - bucket.lastNotified < COOLDOWN_MS,
    });
  }
  return {
    config: { windowMs: WINDOW_MS, threshold: THRESHOLD, cooldownMs: COOLDOWN_MS },
    buckets: result,
  };
}

/** Test-only: reset all buckets between tests. */
export function _resetPushErrorCountersForTests(): void {
  buckets.clear();
}
