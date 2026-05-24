import { describe, expect, it } from 'vitest';
import {
  visibleMaterialDeliveryActions,
  groupDeliveriesByDay,
  type MaterialDeliveryRow,
} from '../lib/material-delivery-actions';

const row = (overrides: Partial<MaterialDeliveryRow>): MaterialDeliveryRow => ({
  id: 1,
  companyId: 1,
  projectId: 1,
  supplierName: 'Travis Perkins',
  materialDescription: 'Bricks',
  expectedAt: new Date('2026-05-07T14:00:00Z'),
  deliveredAt: null,
  status: 'expected',
  ...overrides,
} as MaterialDeliveryRow);

describe('visibleMaterialDeliveryActions', () => {
  it('expected + supervisor → mark/reject/edit, no cancel', () => {
    expect(visibleMaterialDeliveryActions('expected', 'supervisor'))
      .toEqual({ markDelivered: true, markRejected: true, cancel: false, edit: true });
  });

  it('expected + manager → adds cancel', () => {
    expect(visibleMaterialDeliveryActions('expected', 'manager'))
      .toEqual({ markDelivered: true, markRejected: true, cancel: true, edit: true });
  });

  it('delivered + supervisor → only edit (state-flip via edit form)', () => {
    expect(visibleMaterialDeliveryActions('delivered', 'supervisor'))
      .toEqual({ markDelivered: false, markRejected: false, cancel: false, edit: true });
  });

  it('cancelled + manager → only edit (undo path)', () => {
    expect(visibleMaterialDeliveryActions('cancelled', 'manager'))
      .toEqual({ markDelivered: false, markRejected: false, cancel: false, edit: true });
  });

  it('worker / null role → all false', () => {
    expect(visibleMaterialDeliveryActions('expected', 'worker'))
      .toEqual({ markDelivered: false, markRejected: false, cancel: false, edit: false });
    expect(visibleMaterialDeliveryActions('expected', null))
      .toEqual({ markDelivered: false, markRejected: false, cancel: false, edit: false });
  });
});

describe('groupDeliveriesByDay', () => {
  // Anchor "today" at midnight UTC for determinism. The helper accepts an ISO
  // anchor so tests don't depend on system clock.
  const today = '2026-05-07T00:00:00.000Z';

  it('groups rows by day in TZ of the anchor', () => {
    const rows = [
      row({ id: 1, expectedAt: new Date('2026-05-07T09:00:00Z') }), // today
      row({ id: 2, expectedAt: new Date('2026-05-07T17:30:00Z') }), // today
      row({ id: 3, expectedAt: new Date('2026-05-08T08:00:00Z') }), // tomorrow
      row({ id: 4, expectedAt: new Date('2026-05-06T12:00:00Z') }), // yesterday
    ];
    const groups = groupDeliveriesByDay(rows, today);
    // Today first, then future ascending, then past descending — same rule
    // exercised more thoroughly in the next test. With inputs spanning today,
    // tomorrow, and yesterday: 5/7 → 5/8 → 5/6.
    expect(groups.map(g => g.dayIso)).toEqual([
      '2026-05-07', '2026-05-08', '2026-05-06',
    ]);
    expect(groups.find(g => g.dayIso === '2026-05-07')!.rows.map(r => r.id)).toEqual([1, 2]);
  });

  it('sorts future ascending and past descending around today', () => {
    const rows = [
      row({ id: 1, expectedAt: new Date('2026-05-09T09:00:00Z') }),
      row({ id: 2, expectedAt: new Date('2026-05-08T09:00:00Z') }),
      row({ id: 3, expectedAt: new Date('2026-05-07T09:00:00Z') }),
      row({ id: 4, expectedAt: new Date('2026-05-06T09:00:00Z') }),
      row({ id: 5, expectedAt: new Date('2026-05-05T09:00:00Z') }),
    ];
    const groups = groupDeliveriesByDay(rows, today);
    // Today first, then future ascending, then past descending.
    expect(groups.map(g => g.dayIso)).toEqual([
      '2026-05-07', '2026-05-08', '2026-05-09', '2026-05-06', '2026-05-05',
    ]);
  });

  it('flags overdue: status=expected and day < today', () => {
    const rows = [
      row({ id: 1, expectedAt: new Date('2026-05-06T09:00:00Z'), status: 'expected' }), // overdue
      row({ id: 2, expectedAt: new Date('2026-05-06T09:00:00Z'), status: 'delivered' }),
      row({ id: 3, expectedAt: new Date('2026-05-08T09:00:00Z'), status: 'expected' }), // future, not overdue
    ];
    const groups = groupDeliveriesByDay(rows, today);
    const lookup = new Map(groups.flatMap(g => g.rows.map(r => [r.id, r])));
    expect(lookup.get(1)!.isOverdue).toBe(true);
    expect(lookup.get(2)!.isOverdue).toBe(false);
    expect(lookup.get(3)!.isOverdue).toBe(false);
  });
});
