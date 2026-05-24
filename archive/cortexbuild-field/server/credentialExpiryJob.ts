/**
 * Credential Expiry Scheduled Job
 * Runs daily at 08:00 UTC.
 * Checks all employee_credentials for certs expiring within 30 days (or already expired),
 * sends a push notification to the admin for each affected record,
 * and marks alertSent = 1 to avoid duplicate alerts.
 *
 * Logs through `_core/logger` (redacted, structured) under the
 * `[cron.credentialExpiry]` namespace so ops can grep run history,
 * timings, and outcome counts from PM2 stdout/stderr.
 */
import { getDb } from './db';
import { employeeCredentials } from '../drizzle/schema';
import { and, eq, isNotNull, lte } from 'drizzle-orm';
import { notifyOwner } from './_core/notification';
import { log } from './_core/logger';

const ALERT_WINDOW_DAYS = 30;
const LOG_NS = '[cron.credentialExpiry]';

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export async function runCredentialExpiryCheck(): Promise<void> {
  const startMs = Date.now();
  const now = new Date();
  const alertThreshold = addDays(now, ALERT_WINDOW_DAYS);
  const thresholdStr = alertThreshold.toISOString().slice(0, 10); // YYYY-MM-DD
  const todayStr = now.toISOString().slice(0, 10);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  log.info(LOG_NS, 'start', { thresholdStr, todayStr });

  try {
    const db = await getDb();
    if (!db) {
      log.warn(LOG_NS, 'db unavailable; skipping', { durationMs: Date.now() - startMs });
      return;
    }
    // Find credentials that are expiring within 30 days OR already expired, and alert not yet sent
    const expiring = await db
      .select()
      .from(employeeCredentials)
      .where(
        and(
          eq(employeeCredentials.alertSent, 0),
          isNotNull(employeeCredentials.expiryDate),
          lte(employeeCredentials.expiryDate, thresholdStr),
        ),
      );

    processed = expiring.length;

    if (processed === 0) {
      log.info(LOG_NS, 'complete', { processed: 0, succeeded: 0, failed: 0, durationMs: Date.now() - startMs });
      return;
    }

    for (const cred of expiring) {
      const isExpired = cred.expiryDate && cred.expiryDate < todayStr;
      const daysUntil = cred.expiryDate
        ? Math.ceil((new Date(cred.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const statusLabel = isExpired
        ? 'EXPIRED'
        : daysUntil !== null
        ? `expiring in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`
        : 'expiring soon';

      const title = isExpired
        ? `⚠️ Credential Expired — ${cred.employeeName}`
        : `🔔 Credential Expiring Soon — ${cred.employeeName}`;

      const content = [
        `Employee: ${cred.employeeName}`,
        `Credential: ${cred.credType}${cred.credNumber ? ` (${cred.credNumber})` : ''}`,
        `Status: ${statusLabel}`,
        cred.expiryDate ? `Expiry Date: ${formatDate(cred.expiryDate)}` : '',
        '',
        'Please review and renew this credential in the Super Admin Panel → Employees tab.',
      ]
        .filter(Boolean)
        .join('\n');

      try {
        await notifyOwner({ title, content });
        // Mark alert as sent so we don't re-notify
        await db
          .update(employeeCredentials)
          .set({ alertSent: 1 })
          .where(eq(employeeCredentials.id, cred.id));
        succeeded += 1;
      } catch (err) {
        failed += 1;
        log.warn(LOG_NS, 'alert failed', { credentialId: cred.id, err });
      }
    }

    log.info(LOG_NS, 'complete', { processed, succeeded, failed, durationMs: Date.now() - startMs });
  } catch (err) {
    log.error(LOG_NS, 'fatal', { err, processed, succeeded, failed, durationMs: Date.now() - startMs });
  }
}

/**
 * Schedule the job to run daily at 08:00 UTC.
 * Call this once from server startup.
 */
export function scheduleCredentialExpiryJob(): void {
  const MS_PER_MINUTE = 60 * 1000;
  const MS_PER_HOUR = 60 * MS_PER_MINUTE;

  function msUntilNextRun(): number {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(8, 0, 0, 0);
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next.getTime() - now.getTime();
  }

  function scheduleNext() {
    const delay = msUntilNextRun();
    log.info(LOG_NS, 'scheduled', {
      hours: Math.round(delay / MS_PER_HOUR),
      minutes: Math.round((delay % MS_PER_HOUR) / MS_PER_MINUTE),
    });
    setTimeout(async () => {
      await runCredentialExpiryCheck();
      scheduleNext(); // reschedule for next day
    }, delay);
  }

  scheduleNext();

  // Also run once on startup (after a 5-second delay to let DB connect)
  setTimeout(async () => {
    log.info(LOG_NS, 'startup run');
    await runCredentialExpiryCheck();
  }, 5000);
}
