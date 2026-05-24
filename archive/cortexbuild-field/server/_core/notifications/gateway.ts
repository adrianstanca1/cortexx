/**
 * NotificationGateway — fan-out coordinator over the email primitive.
 *
 * Replaces the duplicated `void sendEmail(...).catch(err => log.error(...))`
 * blocks in `server/routers/index.ts` (rfis.* mutations) with a single
 * `notify({ to, channels, context, mode })` call.
 *
 * Design constraints pinned by the characterisation tests in
 * `tests/_core/notifications/gateway.test.ts`:
 *   1. Empty recipient list is a no-op.
 *   2. Recipients with `email === null` are silently skipped.
 *   3. One `sendEmail` invocation per addressable recipient, body =
 *      `channel.template(recipient)`.
 *   4. A single `sendEmail` rejection is caught and logged with
 *      `params.context`; never thrown to the caller; loop continues.
 *   5. `mode: "fire-and-forget"` (default) resolves before sends settle.
 *   6. `mode: "awaited"` waits for every send to settle.
 *
 * Equivalence proof: `tests/integration/rfis-create-notification-equivalence.test.ts`.
 *
 * Composes — does not replace — `sendEmail` (Brevo) and (eventually)
 * `sendPushToUsers` (Expo). Push lane is intentionally NOT wired here
 * yet: no RFI event is registered in `shared/notification-events.ts`
 * today, and the existing push pipeline already owns prefs gating, the
 * fail-mode switch, and the burst counter. When push is added, the
 * shape will be `channels.push?: { eventType: NotificationEventType;
 * payload: PushPayload }` — see TRANSFORMATION_NOTES.md.
 */
import { sendEmail, type EmailParams } from "../email";
import { log } from "../logger";

export type NotifyMode = "fire-and-forget" | "awaited";

export interface NotificationRecipient {
  userId: number;
  /** Null email = "no inbox on file" → recipient is silently skipped. */
  email: string | null;
  name: string;
}

export interface EmailChannel {
  template: (recipient: NotificationRecipient) => EmailParams;
}

export interface NotifyParams {
  to: NotificationRecipient[];
  channels: { email?: EmailChannel };
  /** Tag for error logs (e.g. `"rfis.create"`); used to grep call sites. */
  context: string;
  /** Defaults to "fire-and-forget" — matches the legacy rfis.* posture. */
  mode?: NotifyMode;
}

/**
 * Result is mode-discriminated so that the field semantics cannot be
 * misread (e.g. logging `sent: 5` to an audit trail when fire-and-forget
 * mode never knew how many actually delivered). The caller MUST narrow
 * on `mode` to read counts:
 *
 *     const r = await notify({...});
 *     if (r.mode === "awaited") auditLog({ delivered: r.sent });
 *     else                      metrics.increment("notify.dispatched", r.dispatched);
 *
 * This split mirrors the established posture in `pushNotifications.ts`
 * (`PushResult` with separate `attempted` / `accepted` / `rejected`
 * fields). Background to the redesign: see TRANSFORMATION_NOTES.md, H2.
 */
export type NotifyResult =
  | {
      mode: "fire-and-forget";
      /** Count of sends issued to the network. Outcome is unknown — check logs for failures. */
      dispatched: number;
      /** Recipients with `email === null` — never reached the network. */
      skipped: number;
    }
  | {
      mode: "awaited";
      /** Count of sends that resolved successfully. */
      sent: number;
      /** Count of sends that rejected. */
      failed: number;
      /** Recipients with `email === null` — never reached the network. */
      skipped: number;
      /**
       * Captured rejection reasons in dispatch order — same length as
       * `failed`. Empty array when `failed === 0`. Lets callers re-throw
       * the original error (e.g. `users.invite` re-throws `errors[0]`
       * to preserve the Brevo error message its admin-facing tests
       * pin via `.rejects.toThrow(/Brevo/i)`).
       *
       * Only populated in `mode: "awaited"`. Fire-and-forget callers
       * must use the stderr log line (`[<context>] email send failed:`)
       * for diagnostics — the result returns before sends settle, so
       * the gateway has no errors to surface.
       */
      errors: readonly unknown[];
    };

export async function notify(params: NotifyParams): Promise<NotifyResult> {
  const { to, channels, context, mode = "fire-and-forget" } = params;

  // Partition: addressable (has email) vs skipped (no email).
  const addressable = to.filter((r): r is NotificationRecipient & { email: string } =>
    r.email !== null && r.email !== "",
  );
  const skipped = to.length - addressable.length;

  if (!channels.email || addressable.length === 0) {
    return mode === "awaited"
      ? { mode: "awaited", sent: 0, failed: 0, skipped, errors: [] }
      : { mode: "fire-and-forget", dispatched: 0, skipped };
  }

  const { template } = channels.email;

  // Synchronous dispatch — by the time this map() returns, every
  // sendEmail call has been issued. The `Promise.resolve().then(...)`
  // wrapper is load-bearing: it makes a SYNCHRONOUS throw inside
  // `template(recipient)` (e.g. a malformed input on a future template)
  // land in the same `.catch` below as an async sendEmail rejection.
  // Without it, a sync template throw would abort the .map() loop and
  // — in fire-and-forget mode — escape as an unhandledRejection
  // because `void notify(...)` at the call site discards the promise.
  // (Architect review H1.)
  const sends = addressable.map((recipient) =>
    Promise.resolve()
      .then(() => sendEmail(template(recipient)))
      .then(() => ({ ok: true as const }))
      .catch((err: unknown) => {
        // Match the legacy log shape so existing greps keep working:
        // `[rfis.create] email send failed: <err>`.
        log.error(`[${context}] email send failed:`, err);
        return { ok: false as const, error: err };
      }),
  );

  if (mode === "awaited") {
    const settled = await Promise.all(sends);
    const sent = settled.filter((r) => r.ok).length;
    const errors = settled.flatMap((r) => (r.ok ? [] : [r.error]));
    return { mode: "awaited", sent, failed: settled.length - sent, skipped, errors };
  }

  // Fire-and-forget: return immediately. The `.catch` chained above
  // still runs in the background — no unhandled rejection escapes,
  // and ops sees the error log for failures. We do NOT report a
  // success/failure count here because we genuinely don't know one
  // (and pretending to know was the H2 footgun).
  return { mode: "fire-and-forget", dispatched: addressable.length, skipped };
}
