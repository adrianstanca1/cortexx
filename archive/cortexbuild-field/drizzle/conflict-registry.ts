/**
 * Per-column resolution kind for the offline-sync conflict UI.
 *
 * 'atomic' → Keep Mine / Use Theirs widget. For enums, dates, FKs, numbers.
 * 'text'   → side-by-side display + editable textarea. For free-text fields.
 *
 * The dispatcher in app/conflicts/[id].tsx picks the widget by reading
 * CONFLICT_FIELD_KINDS[tableName][fieldName].
 *
 * Keeping the kinds out-of-band (here, not introspected from Drizzle types)
 * is deliberate: a 'priority' enum and a 'dueDate' date both look like
 * "atomic from the type system but the resolution UX is identical." The
 * registry encodes the *intent*, not the type.
 *
 * Adding a new editable column to a queueable table must add an entry here.
 * tests/conflict-registry-coverage.test.ts pins this — missing entries fail
 * the build with a clear message.
 *
 * Workflow-managed columns (answeredById set by rfis.answer, etc.) are
 * intentionally excluded — those mutations don't go through the offline
 * sync queue's UPDATE path.
 */
export type ConflictFieldKind = 'atomic' | 'text';

export const CONFLICT_FIELD_KINDS = {
  rfis: {
    question: 'text',
    response: 'text',
    status:   'atomic',
    priority: 'atomic',
    dueDate:  'atomic',
  },
  materials: {
    supplierName:        'text',
    materialDescription: 'text',
    notes:               'text',
    rejectionReason:     'text',
    cancellationReason:  'text',
    expectedAt:          'atomic',
    deliveredAt:         'atomic',
    status:              'atomic',
    gpsLat:              'atomic',
    gpsLng:              'atomic',
  },
} as const satisfies Record<string, Record<string, ConflictFieldKind>>;

export type ConflictTableName = keyof typeof CONFLICT_FIELD_KINDS;
