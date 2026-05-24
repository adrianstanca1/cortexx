/**
 * Phase 3.4 — RFI lifecycle state machine.
 *
 * Pure helper so transition rules are unit-testable without a router or DB.
 * All non-terminal status checks in the RFI flow MUST go through here —
 * never inline `if (rfi.status === '...') { rfi.status = '...' }` in the
 * router, otherwise the rules drift across endpoints.
 */
import { TRPCError } from "@trpc/server";

export type RfiStatus = "submitted" | "answered" | "approved" | "rejected";

const TRANSITIONS: Record<RfiStatus, RfiStatus[]> = {
  submitted: ["answered"],
  answered: ["approved", "rejected"],
  approved: [],   // terminal
  rejected: [],   // terminal
};

export function canTransition(from: RfiStatus, to: RfiStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: RfiStatus, to: RfiStatus): void {
  if (!canTransition(from, to)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Cannot transition RFI from "${from}" to "${to}".`,
    });
  }
}
