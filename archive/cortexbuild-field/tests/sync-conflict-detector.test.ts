/**
 * Pure-unit tests for the field-conflict detector.
 *
 * The detector takes the row's current state (as if SELECT FOR UPDATE just
 * returned), the client's baseSnapshot (what they thought the row looked
 * like), and the payload (what they want to write). It returns one of:
 *   - { kind: 'ok' }                                 → safe to apply
 *   - { kind: 'conflict', fields, theirsValues }     → same field touched
 *   - { kind: 'row_deleted' }                        → row no longer exists
 *
 * Definition of "conflict on field X":
 *   - server's current row[X] != client's snapshot[X]   (someone changed it)
 *   - AND payload[X] != server's current row[X]         (client also wants to change it; if they happen to match, no conflict)
 *
 * Disjoint edits (different fields) → kind: 'ok' even though row.updatedAt
 * has moved past baseUpdatedAt.
 */
import { describe, expect, it } from 'vitest';
import { detectFieldConflicts } from '../server/_core/sync-conflict-detector';

describe('detectFieldConflicts', () => {
  const baseSnapshot = { description: 'old desc', status: 'submitted' as const };
  const baseUpdatedAt = new Date('2026-05-06T10:00:00Z');

  it('returns ok when the row is unchanged since baseUpdatedAt', () => {
    const currentRow = { id: 1, description: 'old desc', status: 'submitted', updatedAt: baseUpdatedAt };
    const payload = { description: 'my new desc' };
    expect(detectFieldConflicts(currentRow, baseUpdatedAt, payload, baseSnapshot)).toEqual({ kind: 'ok' });
  });

  it('returns ok when server changed a different field than client is changing', () => {
    const currentRow = { id: 1, description: 'old desc', status: 'answered', updatedAt: new Date('2026-05-06T10:05:00Z') };
    const payload = { description: 'my new desc' };
    expect(detectFieldConflicts(currentRow, baseUpdatedAt, payload, baseSnapshot)).toEqual({ kind: 'ok' });
  });

  it('returns conflict when both touched the same field', () => {
    const currentRow = { id: 1, description: 'their new desc', status: 'submitted', updatedAt: new Date('2026-05-06T10:05:00Z') };
    const payload = { description: 'my new desc' };
    const result = detectFieldConflicts(currentRow, baseUpdatedAt, payload, baseSnapshot);
    expect(result).toEqual({
      kind: 'conflict',
      fields: ['description'],
      theirsValues: { description: 'their new desc' },
    });
  });

  it('returns conflict listing all overlapping fields', () => {
    const currentRow = { id: 1, description: 'their desc', status: 'answered', updatedAt: new Date('2026-05-06T10:05:00Z') };
    const payload = { description: 'my desc', status: 'approved' as const };
    const result = detectFieldConflicts(currentRow, baseUpdatedAt, payload, baseSnapshot);
    expect(result.kind).toBe('conflict');
    if (result.kind !== 'conflict') throw new Error('unreachable');
    expect(result.fields.sort()).toEqual(['description', 'status']);
    expect(result.theirsValues).toEqual({ description: 'their desc', status: 'answered' });
  });

  it('returns ok when client and server happen to write the same value', () => {
    const currentRow = { id: 1, description: 'agreed text', status: 'submitted', updatedAt: new Date('2026-05-06T10:05:00Z') };
    const payload = { description: 'agreed text' };
    expect(detectFieldConflicts(currentRow, baseUpdatedAt, payload, baseSnapshot)).toEqual({ kind: 'ok' });
  });

  it('returns row_deleted when current row is null', () => {
    const payload = { description: 'doesnt matter' };
    expect(detectFieldConflicts(null, baseUpdatedAt, payload, baseSnapshot)).toEqual({ kind: 'row_deleted' });
  });

  it('treats Date and string baseUpdatedAt equivalently', () => {
    const currentRow = { id: 1, description: 'old desc', status: 'submitted', updatedAt: new Date('2026-05-06T10:05:00Z') };
    const payload = { description: 'my new desc' };
    const result = detectFieldConflicts(currentRow, '2026-05-06T10:00:00Z', payload, baseSnapshot);
    expect(result).toEqual({ kind: 'ok' });
  });

  it('does not flag a conflict on a field the client did not change', () => {
    const currentRow = { id: 1, description: 'their desc', status: 'answered', updatedAt: new Date('2026-05-06T10:05:00Z') };
    const payload = { description: 'my new desc' };
    const result = detectFieldConflicts(currentRow, baseUpdatedAt, payload, baseSnapshot);
    expect(result.kind).toBe('conflict');
    if (result.kind !== 'conflict') throw new Error('unreachable');
    expect(result.fields).toEqual(['description']);
  });

  it('handles snapshot missing a field that payload touches (programming error guard)', () => {
    const currentRow = { id: 1, description: 'old desc', status: 'submitted', notes: 'server notes', updatedAt: baseUpdatedAt };
    const payload = { notes: 'my notes' };
    const result = detectFieldConflicts(currentRow, baseUpdatedAt, payload, baseSnapshot);
    expect(result.kind).toBe('conflict');
  });
});
