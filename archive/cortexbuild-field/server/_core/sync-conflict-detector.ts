/**
 * Server-side detector for field-level conflicts on offline-sync replays.
 *
 * Pure-ish — no DB access. Caller (the sync.replay dispatcher) does the
 * SELECT FOR UPDATE and feeds the row in. Splitting it this way keeps the
 * conflict logic unit-testable without spinning up a DB.
 */

export type DetectorResult =
  | { kind: 'ok' }
  | { kind: 'conflict'; fields: string[]; theirsValues: Record<string, unknown> }
  | { kind: 'row_deleted' };

interface RowLike {
  // The server's current row. Must include every field the client is touching.
  // updatedAt is read by the dispatcher, not the detector.
  [field: string]: unknown;
}

/**
 * @param currentRow      Server's row right now (from SELECT FOR UPDATE), or null if deleted.
 * @param baseUpdatedAt   The row's updatedAt at the moment the client opened the form.
 *                        Accepted as Date or ISO string (clients send strings).
 * @param payload         The fields the client wants to write, with their new values.
 * @param baseSnapshot    The values of those same fields at the moment the client opened the form.
 */
export function detectFieldConflicts(
  currentRow: RowLike | null,
  baseUpdatedAt: Date | string,
  payload: Record<string, unknown>,
  baseSnapshot: Record<string, unknown>,
): DetectorResult {
  if (currentRow === null) return { kind: 'row_deleted' };

  const conflictFields: string[] = [];
  const theirsValues: Record<string, unknown> = {};

  for (const field of Object.keys(payload)) {
    if (!(field in baseSnapshot)) {
      // Programming-error guard: payload mentions a field the snapshot doesn't.
      // We can't safely diff it, so flag a conflict and surface to the user.
      conflictFields.push(field);
      theirsValues[field] = currentRow[field];
      continue;
    }

    const serverValue = currentRow[field];
    const snapshotValue = baseSnapshot[field];
    const payloadValue = payload[field];

    // No conflict if server hasn't moved the field, or if both writers
    // happen to have written the same final value.
    if (serverValue === snapshotValue) continue;
    if (serverValue === payloadValue) continue;

    conflictFields.push(field);
    theirsValues[field] = serverValue;
  }

  if (conflictFields.length === 0) return { kind: 'ok' };
  return { kind: 'conflict', fields: conflictFields, theirsValues };
}
