/**
 * Phase 3.4 — UI side of the RFI workflow gate.
 *
 * Pure helper deciding which action buttons show up on the RFI detail
 * row, given current state + viewer's company role. Mirrors the
 * server-side gates in rfis.answer / approve / reject so the UI can
 * never offer an action that the server would refuse.
 */
import { hasPermission, type UserRole } from "./company-context";

export type RfiStatus = "submitted" | "answered" | "approved" | "rejected";

export type VisibleActions = {
  answer: boolean;
  approve: boolean;
  reject: boolean;
};

export function visibleRfiActions(
  status: RfiStatus,
  role: UserRole | null,
): VisibleActions {
  if (!role) return { answer: false, approve: false, reject: false };
  return {
    answer:  status === "submitted" && hasPermission(role, "manager"),
    approve: status === "answered"  && hasPermission(role, "company_admin"),
    reject:  status === "answered"  && hasPermission(role, "company_admin"),
  };
}
