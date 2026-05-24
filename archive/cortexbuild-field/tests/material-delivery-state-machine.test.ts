import { describe, expect, it } from 'vitest';
import {
  canTransition,
  assertTransition,
  type MaterialDeliveryStatus,
} from '../server/_core/material-delivery-state-machine';
import { TRPCError } from '@trpc/server';

const ALLOWED: [MaterialDeliveryStatus, MaterialDeliveryStatus][] = [
  ['expected',  'delivered'],
  ['expected',  'rejected'],
  ['expected',  'cancelled'],
  ['delivered', 'rejected'],
  ['rejected',  'delivered'],
  ['cancelled', 'expected'],
];

const ALL: MaterialDeliveryStatus[] = ['expected', 'delivered', 'rejected', 'cancelled'];

describe('material-delivery state machine', () => {
  it('canTransition true for every allowed edge', () => {
    for (const [from, to] of ALLOWED) {
      expect(canTransition(from, to)).toBe(true);
    }
  });

  it('canTransition false for every other (from,to) pair', () => {
    for (const from of ALL) for (const to of ALL) {
      const allowed = ALLOWED.some(([f, t]) => f === from && t === to);
      if (allowed) continue;
      expect(canTransition(from, to)).toBe(false);
    }
  });

  it('assertTransition throws BAD_REQUEST on illegal transition', () => {
    let err: unknown;
    try { assertTransition('delivered', 'expected'); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe('BAD_REQUEST');
    expect((err as TRPCError).message).toContain('"delivered"');
    expect((err as TRPCError).message).toContain('"expected"');
  });

  it('assertTransition is a no-op on legal transition', () => {
    expect(() => assertTransition('expected', 'delivered')).not.toThrow();
  });
});
