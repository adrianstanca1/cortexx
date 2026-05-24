/**
 * Pins coverage of CONFLICT_FIELD_KINDS against the schema.
 *
 * For every table in QUEUEABLE_UPDATE_TABLES (kept in sync with the wired
 * `enqueue` callers), every editable column listed in EDITABLE_COLUMNS must
 * have a registered kind. Adding a new editable column without a registry
 * entry fails this test with a clear missing-kind message.
 *
 * "Editable" = directly settable via a form field. Workflow-managed columns
 * (answeredById, approvedById, etc. — set by tRPC procedures like rfis.answer)
 * and auto-managed columns (id, *_id FK to tenant scope, createdAt,
 * updatedAt) are excluded.
 */
import { describe, expect, it } from 'vitest';
import { CONFLICT_FIELD_KINDS } from '../drizzle/conflict-registry';

const QUEUEABLE_UPDATE_TABLES = ['rfis', 'materials'] as const;

const EDITABLE_COLUMNS: Record<typeof QUEUEABLE_UPDATE_TABLES[number], readonly string[]> = {
  rfis: ['question', 'response', 'status', 'priority', 'dueDate'],
  materials: [
    'supplierName',
    'materialDescription',
    'notes',
    'rejectionReason',
    'cancellationReason',
    'expectedAt',
    'deliveredAt',
    'status',
    'gpsLat',
    'gpsLng',
  ],
};

describe('CONFLICT_FIELD_KINDS coverage', () => {
  for (const table of QUEUEABLE_UPDATE_TABLES) {
    it(`covers every editable column in ${table}`, () => {
      const registered = CONFLICT_FIELD_KINDS[table] ?? {};
      const missing = EDITABLE_COLUMNS[table].filter(c => !(c in registered));
      expect(missing).toEqual([]);
    });

    it(`only registers kinds 'atomic' or 'text' in ${table}`, () => {
      const kinds = Object.values(CONFLICT_FIELD_KINDS[table] ?? {});
      const invalid = kinds.filter(k => k !== 'atomic' && k !== 'text');
      expect(invalid).toEqual([]);
    });
  }
});
