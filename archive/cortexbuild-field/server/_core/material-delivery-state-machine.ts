/**
 * Phase 3.2 — material-delivery lifecycle state machine.
 *
 * Pure helper, server-side. Mirrors server/_core/rfi-state-machine.ts.
 * Every status mutation in server/routers/materials.ts MUST go through
 * `assertTransition` so the rules don't drift across endpoints.
 */
import { TRPCError } from '@trpc/server';

export type MaterialDeliveryStatus = 'expected' | 'delivered' | 'rejected' | 'cancelled';

const TRANSITIONS: Record<MaterialDeliveryStatus, MaterialDeliveryStatus[]> = {
  expected:  ['delivered', 'rejected', 'cancelled'],
  delivered: ['rejected'],          // correction path
  rejected:  ['delivered'],         // correction path
  cancelled: ['expected'],          // undo cancel
};

export function canTransition(from: MaterialDeliveryStatus, to: MaterialDeliveryStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: MaterialDeliveryStatus, to: MaterialDeliveryStatus): void {
  if (!canTransition(from, to)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Cannot transition material delivery from "${from}" to "${to}".`,
    });
  }
}
