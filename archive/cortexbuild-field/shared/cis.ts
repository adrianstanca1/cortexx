/**
 * HMRC Construction Industry Scheme (CIS) — single source of truth for rate
 * logic. All CIS arithmetic in cortexbuild-field flows through this module
 * so the rule "deduction is on the labour subtotal at the rate for the
 * subcontractor's status" lives in one place with one test surface.
 *
 * Status → rate mapping:
 *   registered_20  → 20%  (verified subcontractor, default)
 *   registered_30  → 30%  (unregistered or unverifiable)
 *   gross_payment  → 0%   (HMRC-approved gross status)
 *   none           → 0%   (CIS does not apply, e.g. employee timesheet)
 *
 * VAT is NEVER subject to CIS — the deduction applies to the labour
 * subtotal pre-VAT. The previous codebase bug (`grossTotal × cisRate%`)
 * was fixed in commit 6544c9e (2026-05-05).
 */
import { z } from "zod";

export type CisStatus =
  | "none"
  | "registered_20"
  | "registered_30"
  | "gross_payment";

export const CIS_STATUSES: readonly CisStatus[] = [
  "none",
  "registered_20",
  "registered_30",
  "gross_payment",
] as const;

/**
 * Coerce a loose `string | undefined` into a `CisStatus`. Used by UI forms
 * to safely consume `companies.cisStatus` (`varchar(20)` whose DB default
 * is the legacy `'not_registered'`, outside the new union). Anything that
 * isn't in `CIS_STATUSES` falls back to `'none'` — matches the historical
 * "no CIS deduction by default" UX posture.
 */
export function coerceCisStatus(s: string | undefined): CisStatus {
  return CIS_STATUSES.includes(s as CisStatus) ? (s as CisStatus) : "none";
}

export function cisRateForStatus(status: CisStatus): number {
  switch (status) {
    case "registered_20":
      return 20;
    case "registered_30":
      return 30;
    case "gross_payment":
      return 0;
    case "none":
      return 0;
  }
}

/**
 * Sum the labour portion of a line-items array. Items with `isLabour ===
 * false` are excluded; items with `isLabour === true` or `isLabour ===
 * undefined` are included. The undefined-as-labour default preserves
 * back-compat for callers (mostly older API consumers and the timesheet
 * generator) that do not yet thread the flag through.
 */
export function labourSubtotal(
  items: readonly { quantity: number; unitRate: number; isLabour?: boolean }[],
): number {
  return items
    .filter((item) => item.isLabour !== false)
    .reduce((sum, item) => sum + item.quantity * item.unitRate, 0);
}

/**
 * Compute the CIS deduction amount given a labour subtotal and the
 * subcontractor's CIS status. The `overrideRate` parameter exists for
 * legacy callers (the invoice generator) that pass an explicit rate
 * rather than a status string — it wins over the status-derived rate.
 *
 * Returns 0 for `none` and `gross_payment` (no deduction). Result is
 * rounded to 2 decimal places to match £ amounts and avoid floating-point
 * trailing digits leaking into invoices.
 */
export function computeCisDeduction(args: {
  labourSubtotal: number;
  status: CisStatus;
  overrideRate?: number;
}): number {
  const rate = args.overrideRate ?? cisRateForStatus(args.status);
  if (rate === 0) return 0;
  const raw = args.labourSubtotal * (rate / 100);
  return Math.round(raw * 100) / 100;
}

/**
 * Schema for an invoice line item. Used by:
 *   - server/routers/finance.ts createInvoice input
 *   - drizzle/schema.ts invoices.lineItems $type
 *   - (Phase 2.1) app/documents.tsx invoice form
 *   - (Phase 4) app/receipt-scanner.tsx
 *
 * `isLabour` is the CIS-relevant flag — true (or undefined for back-compat)
 * means CIS deduction applies; false means materials (no CIS).
 */
export const invoiceLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unit: z.string(),
  unitRate: z.number(),
  isLabour: z.boolean().optional(),
});

export type InvoiceLineItem = z.infer<typeof invoiceLineItemSchema>;
