/**
 * Recipient resolution — server-side rollup of "active companyUsers
 * whose role >= minRole, hydrated to NotificationRecipient".
 *
 * Replaces the open-coded two-step query repeated across rfis.* mutations:
 *
 *     const memberships = await db.select().from(companyUsers).where(and(
 *       eq(companyUsers.companyId, cid),
 *       eq(companyUsers.isActive, true),
 *     ));
 *     const ids = memberships
 *       .filter(m => RECIPIENT_ROLES.includes(m.companyRole))
 *       .map(m => m.userId);
 *     const recipients = ids.length
 *       ? await db.select().from(users).where(inArray(users.id, ids))
 *       : [];
 *
 * Filtering posture (matches legacy + unit-test fakes):
 *   - `isActive = true` is enforced BOTH in SQL (perf — narrows the row
 *     set on the server) AND in JS (correctness — the unit-test fake DB
 *     does not honour SQL where clauses, and a future schema change
 *     making `isActive` nullable shouldn't silently re-enable inactive
 *     memberships).
 *   - Role hierarchy uses `ROLE_LEVELS` from `server/_core/role-check.ts`
 *     (the canonical server-side mirror of `lib/company-context.tsx`).
 *     A row whose `companyRole` is not in the enum is excluded.
 *
 * Pinned by `tests/_core/notifications/recipients.test.ts`. Production
 * shape exercised by `tests/integration/rfis-create-notification-equivalence.test.ts`.
 */
import { and, eq, inArray } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/postgres-js";
import { companyUsers, users } from "../../../drizzle/schema";
import type { UserRole } from "../../../lib/company-context";
import { ROLE_LEVELS } from "../role-check";
import type { NotificationRecipient } from "./gateway";
import { log } from "../logger";

/**
 * Drizzle handle returned by `getDb()` in `server/db.ts`. Re-derived here
 * (rather than imported) to avoid circular type pulls — `_core/` is
 * framework-level and should not depend on `server/db.ts`.
 */
export type Db = ReturnType<typeof drizzle>;

export async function recipientsByCompanyRole(
  db: Db,
  companyId: number,
  minRole: UserRole,
): Promise<NotificationRecipient[]> {
  const minLevel = ROLE_LEVELS[minRole];

  const memberships = await db.select().from(companyUsers).where(and(
    eq(companyUsers.companyId, companyId),
    eq(companyUsers.isActive, true),
  ));

  const recipientUserIds = memberships
    .filter((m) => m.isActive === true)
    .filter((m) => {
      const level = ROLE_LEVELS[m.companyRole as UserRole];
      return level !== undefined && level >= minLevel;
    })
    .map((m) => m.userId);

  if (recipientUserIds.length === 0) return [];

  const rows = await db.select().from(users).where(inArray(users.id, recipientUserIds));

  // JS filter mirrors the `isActive` belt-and-suspenders above: production
  // Postgres honours `inArray` for perf, but the unit-test fake DB
  // returns every staged row, and a future drizzle bug shouldn't silently
  // re-include unintended users either.
  const idSet = new Set(recipientUserIds);
  return rows
    .filter((u) => idSet.has(u.id))
    .map((u) => ({
      userId: u.id,
      email: u.email ?? null,
      name: u.name ?? "",
    }));
}

/**
 * Resolve recipients by exact user IDs — used by the `rfis.answer`,
 * `rfis.respond`, `rfis.approve`, `rfis.reject` flows, where the
 * notifiable parties are specific people the row already tracks
 * (raiser, answerer) rather than a role-filtered set.
 *
 * Behaviour matches legacy:
 *   - Null/undefined IDs in the input array are filtered out
 *     (legacy uses `.filter((id): id is number => id != null)`).
 *   - **No `isActive` filter.** A user who raised an RFI is entitled
 *     to know it was answered even if they were deactivated since,
 *     and the legacy `if (raiser?.email)` short-circuit at the call
 *     site preserves that posture. Membership-based filtering belongs
 *     to `recipientsByCompanyRole`, not this resolver.
 *   - Returned rows are de-duplicated implicitly via the SQL `inArray`
 *     (PG returns each row once even if a userId appears twice in the
 *     input). Callers that pass `[raiser, answerer]` where the two
 *     are the same person get one email, not two — matches legacy.
 *
 * Pinned by `tests/_core/notifications/recipients.test.ts` (cases 4–6).
 */
export async function recipientsByUserIds(
  db: Db,
  userIds: readonly (number | null | undefined)[],
): Promise<NotificationRecipient[]> {
  // Strip null/undefined defensively — `rfi.answeredById` is nullable
  // in the schema, so `[rfi.raisedById, rfi.answeredById]` legitimately
  // contains nulls when the RFI hasn't been answered yet.
  const filtered = userIds.filter((id): id is number => typeof id === "number");
  if (filtered.length === 0) return [];

  const rows = await db.select().from(users).where(inArray(users.id, filtered));

  // Defensive JS filter — the unit-test fake DB returns every row
  // regardless of the SQL `where`, and a future drizzle bug shouldn't
  // silently re-include unintended users either. Also de-dupes if the
  // SQL ever loses its UNIQUE-on-id guarantee.
  const idSet = new Set(filtered);
  return rows
    .filter((u) => idSet.has(u.id))
    .map((u) => ({
      userId: u.id,
      email: u.email ?? null,
      name: u.name ?? "",
    }));
}

/**
 * Wraps a recipient-resolution thunk in a try/catch that logs and
 * returns `[]` on failure — so a transient drizzle SELECT failure (pool
 * exhaustion, mid-flight DB drop, etc.) **after** the originating
 * mutation has already committed cannot escape as
 * `INTERNAL_SERVER_ERROR` to the client. The client would retry, the
 * mutation would run again, and we'd get a duplicate row.
 *
 * Mirrors the posture documented for the push pipeline in
 * `server/_core/pushNotifications.ts` and `CLAUDE.md`:
 *   "notification failure must NEVER block the originating mutation."
 *
 * Closes architect review **M5**. The log shape `[${context}]
 * recipient resolution failed:` follows the same convention as
 * `gateway.ts`'s send-failure log so ops can grep by context tag.
 *
 * @example
 * const recipients = await safeRecipients(
 *   () => recipientsByCompanyRole(db, input.companyId, "manager"),
 *   "rfis.create",
 * );
 * void notify({ to: recipients, ... });
 */
export async function safeRecipients(
  fn: () => Promise<NotificationRecipient[]>,
  context: string,
): Promise<NotificationRecipient[]> {
  try {
    return await fn();
  } catch (err) {
    log.error(`[${context}] recipient resolution failed:`, err);
    return [];
  }
}
