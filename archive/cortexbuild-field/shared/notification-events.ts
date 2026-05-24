/**
 * Single source of truth for push notification event types.
 *
 * Convention:
 *   prefs[eventType] === undefined  → enabled (opt-out default)
 *   prefs[eventType] === false      → muted
 *   prefs[eventType] === true       → enabled (explicitly set)
 *
 * Sparse storage: when a user re-enables a previously-muted event, the
 * server deletes the key rather than writing `true`. This keeps the
 * column self-cleaning and means a future global-default flip (e.g.
 * opt-in) reaches sparse rows without a backfill.
 *
 * Adding a new event type:
 *   1. Append to NOTIFICATION_EVENTS below.
 *   2. Pass that string literal to sendPushToUsers at the call site.
 *   3. The Settings UI picks it up automatically via fillDefaults.
 *   4. The server gate already handles unknown→muted gracefully via z.enum.
 *
 * The TypeScript boundary is the safety net: an event type that is not
 * in the registry cannot be passed to sendPushToUsers without a cast.
 */

export const NOTIFICATION_EVENTS = {
  defect_assigned: { label: "Defect assigned to me", category: "Defects" },
  defect_resolved: { label: "My defect was resolved", category: "Defects" },
  delivery_expected: { label: "Delivery expected on my site", category: "Materials" },
  delivery_received: { label: "Material delivery confirmed", category: "Materials" },
  delivery_rejected: { label: "Material delivery rejected", category: "Materials" },
} as const;

export type NotificationEventType = keyof typeof NOTIFICATION_EVENTS;

export const NOTIFICATION_EVENT_TYPES = Object.keys(NOTIFICATION_EVENTS) as NotificationEventType[];

/**
 * Sparse-storage shape: only mutes are persisted as explicit `false`,
 * enabled is the absence of a key. The literal `false` (vs `boolean`)
 * is a compile-time enforcement of the rule the SQL encodes — a caller
 * cannot accidentally construct a persistable `{ event: true }` and
 * defeat the future-default-flip property of sparse storage.
 *
 * Read paths still tolerate legacy `true` values (a hand-edited row,
 * or a column written by an older deploy) because `isEventEnabled`
 * narrows on `=== false` — see its body.
 */
export type UserPushPreferences = Partial<Record<NotificationEventType, false>>;

/**
 * Returns true when this event should fire for a user with the given
 * preferences. Missing keys default to true (opt-out).
 */
export function isEventEnabled(
  prefs: UserPushPreferences | null | undefined,
  eventType: NotificationEventType,
): boolean {
  if (!prefs) return true;
  return prefs[eventType] !== false;
}

/**
 * Project a sparse preferences object onto the full registry, filling
 * defaults for missing keys. Used by the Settings UI so the client
 * doesn't need to know about defaults.
 */
export function fillDefaults(
  prefs: UserPushPreferences | null | undefined,
): Record<NotificationEventType, boolean> {
  const out = {} as Record<NotificationEventType, boolean>;
  for (const t of NOTIFICATION_EVENT_TYPES) {
    out[t] = isEventEnabled(prefs, t);
  }
  return out;
}
