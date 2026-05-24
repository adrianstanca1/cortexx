# HMRC CIS labour/materials split — design

**Date:** 2026-05-07
**Status:** Approved (full sweep, four phased PRs)
**Tracking:** SECURITY.md "Other notable findings" → CIS labour/material split (the third remaining item after pre-commit hook + icon bloat resolved on 2026-05-07)

## Background

The Construction Industry Scheme (HMRC's tax deduction regime for construction subcontractor payments) requires:

1. Deduction is on the **labour portion only** of a subcontractor's bill — never on materials, plant hire, fuel, manufactured components, or VAT.
2. Rate depends on the subcontractor's CIS status:
   - **Registered** (verified): 20%
   - **Unregistered** (or unverifiable): 30%
   - **Gross payment status** (HMRC-approved): 0%
3. The deduction is on the labour subtotal, not the gross-incl-VAT total. The VAT-inclusion bug was fixed in commit `6544c9e` (2026-05-05). The labour/materials split was named as follow-up there.

The cortexbuild-field codebase has CIS calculations spread across multiple surfaces — invoice document generator, two timesheet generators, finance persistence, receipt scanner, and a CIS reporting screen. An audit on 2026-05-07 found:

| # | Surface | File | State |
|---|---|---|---|
| 1 | Invoice doc generator | `server/routers/documents.ts:151-282` | ✅ `isLabour` per line, `labourSubtotal` filter, 5 unit tests |
| 2 | Invoice form UI | `app/documents.tsx:361-462` | ❌ No `isLabour` toggle — UI never sends the flag, so server back-compat default `true` over-deducts on materials |
| 3 | Timesheet generator | `server/routers/documents.ts:288-395` | ❌ Hardcoded `* 0.2`, ignores company CIS status |
| 4 | Signed timesheet generator | `server/routers/documents.ts:400-~520` | ❌ Same hardcoded `* 0.2` |
| 5 | Receipt scanner | `app/receipt-scanner.tsx:25-42` | ⚠️ Single `cisDeduction` field; no per-line-item labour flag |
| 6 | Finance settings UI preview | `app/finance.tsx:466` | ✅ Sample £1000 preview, correct |
| 7 | `finance.createInvoice` persistence | `server/routers/finance.ts:27-53` | ⚠️ Stores opaque pre-computed strings; no validation |
| 8 | CIS reporting screen | `app/cis.tsx` | ✅ Read-only; uses persisted values |

## Problem statement

Two HMRC-compliance bugs and two integrity gaps:

- **Bug A (#2):** Invoices generated through the app form treat every line item as labour, silently over-deducting CIS on the materials portion of mixed invoices.
- **Bug B (#3, #4):** Timesheet generators apply 20% regardless of subcontractor status — a `gross_payment` worker has 20% deducted (should be 0%, ¼ of pay disappears); a `registered_30` worker has 20% (should be 30%, under-deducted by ⅓).
- **Gap A (#7):** `finance.createInvoice` accepts caller-supplied `cisDeductionAmount` opaquely. A UI bug or malicious client could persist any amount.
- **Gap B (#5):** Receipt scanner extracts a single `cisDeduction` from external bills. The labour/materials breakdown isn't captured, preventing future validation against HMRC rules.

## Goals

- Single source of truth for CIS rate logic (`server/_core/cis.ts`).
- All four CIS calc sites read from that helper.
- UI surfaces (invoice form, timesheet form, receipt scanner) give users explicit per-line-item or per-document control over labour/materials and CIS status.
- Persistence layer enforces that stored CIS amounts match the line-items they claim to be derived from.

## Non-goals

- HMRC monthly returns automation. Out of scope.
- Subcontractor verification (HMRC API). Out of scope.
- Backfilling historical invoices' line items into the new structure beyond best-effort `JSON.parse`. Existing rows that fail to parse become `[]` and are not retroactively re-validated.

## Architecture

A new `server/_core/cis.ts` module owns all CIS arithmetic. Its public API:

```ts
export type CisStatus =
  | 'none'           // CIS doesn't apply (e.g. employee timesheet)
  | 'registered_20'  // verified subcontractor
  | 'registered_30'  // unregistered/unverified
  | 'gross_payment'; // HMRC-approved gross status

export const CIS_STATUSES: readonly CisStatus[];

export function cisRateForStatus(status: CisStatus): number;
// 'registered_20' → 20, 'registered_30' → 30, 'gross_payment' → 0, 'none' → 0

export function labourSubtotal(
  items: ReadonlyArray<{ quantity: number; unitRate: number; isLabour?: boolean }>,
): number;
// Items with `isLabour !== false` are summed (back-compat: undefined defaults to labour).

export function computeCisDeduction(args: {
  labourSubtotal: number;
  status: CisStatus;
  overrideRate?: number;  // legacy: explicit rate beats status
}): number;
// Returns 0 for 'none' / 'gross_payment'. Rounds to 2dp.
```

All four calc sites (`generateInvoice`, `generateTimesheet`, `generateTimesheetSignedOff`, `finance.createInvoice`) call into this. Removes the three-way drift between the (correct) per-line invoice filter, the (incorrect) hardcoded timesheet 20%, and the (preview-only) finance settings rate calc.

## Server changes

### `server/routers/documents.ts`

**`generateInvoice`** — refactor only. Replace the inline `labourSubtotal` filter and `cisDeductionAmount` calc with helper calls. External API unchanged. Existing 5 tests must still pass without modification.

**`generateTimesheet`** and **`generateTimesheetSignedOff`** — schema change:

```ts
// Before:
cisApplicable: z.boolean().optional(),

// After:
cisStatus: z.enum(['none', 'registered_20', 'registered_30', 'gross_payment']).default('none'),
```

Calc:

```ts
// Before:
${input.cisApplicable ? `| CIS Deduction (20%) | -£${(grossPay * 0.2).toFixed(2)} |` : ''}

// After:
const cisDeduction = computeCisDeduction({ labourSubtotal: grossPay, status: input.cisStatus });
const cisRate = cisRateForStatus(input.cisStatus);
${cisDeduction > 0 ? `| CIS Deduction (${cisRate}%) | -£${cisDeduction.toFixed(2)} |` : ''}
```

The timesheet's "labour subtotal" *is* gross pay — there are no materials in a timesheet by definition.

### `server/routers/finance.ts`

**`createInvoice`** — schema change:

```ts
// Before:
lineItems: z.string().optional(),

// After:
const LineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unit: z.string(),
  unitRate: z.number(),
  isLabour: z.boolean().optional(),
});
lineItems: z.array(LineItemSchema).optional(),
```

Validation — when `lineItems` is provided AND `isCisJob === true`:

```ts
const expected = computeCisDeduction({
  labourSubtotal: labourSubtotal(input.lineItems),
  status: cisStatusFromRate(input.cisDeductionRate),  // small adapter
});
const supplied = parseFloat(input.cisDeductionAmount ?? '0');
if (Math.abs(expected - supplied) > 0.01) {
  throw new TRPCError({ code: 'BAD_REQUEST',
    message: `cisDeductionAmount £${supplied} disagrees with labour-subtotal-derived £${expected.toFixed(2)}` });
}
```

The £0.01 tolerance accommodates floating-point rounding without permitting drift.

## Schema migration

`drizzle/0014_invoices_lineitems_jsonb.sql`:

```sql
ALTER TABLE invoices
  ALTER COLUMN "lineItems" TYPE jsonb
  USING CASE
    WHEN "lineItems" IS NULL THEN NULL
    WHEN "lineItems" = '' THEN '[]'::jsonb
    ELSE COALESCE(NULLIF("lineItems", '')::jsonb, '[]'::jsonb)
  END;
```

Defensive parse: rows whose `lineItems` is empty string or malformed JSON become `'[]'::jsonb` rather than failing the migration. The full backfill is best-effort — invoices that pre-date the structured schema will round-trip with empty arrays, which means CIS validation is skipped for them (the new validation only activates when `lineItems` is provided).

Migration journal entry must be added to `drizzle/meta/_journal.json` (per existing convention enforced by `tests/migration-journal-completeness.test.ts`).

## UI changes

### `app/documents.tsx` — invoice form

Line-item editor (`lines 425-442`) gains a fourth control: an `isLabour` toggle (label "Labour", switch, default `true`). Form state `items` extends to include `isLabour: boolean`. The mutation call (line 397) passes `isLabour` through to the existing `documents.generateInvoice` API.

### `app/documents.tsx` — timesheet form

Replace the existing `cisApplicable: boolean` toggle with a 4-choice picker:

- "None"
- "Registered (20%)"
- "Registered, unverified (30%)"
- "Gross payment (0%)"

Default reads from `currentCompany.cisStatus`; user can override per-timesheet. Form state `cisStatus: CisStatus`.

### `app/receipt-scanner.tsx`

`LineItem` interface extends with `isLabour?: boolean`. Per-line UI gets a Labour toggle on each item. The form recomputes labour subtotal client-side and shows a non-blocking warning banner if `form.cisDeduction` (extracted by AI) ≠ `computeCisDeduction({ labourSubtotal: filtered, status: form.cisStatus })` ± £0.01:

> *"AI-extracted CIS (£X) doesn't match labour-subtotal-derived CIS (£Y). Verify the receipt before submitting."*

The warning is non-fatal — receipts record what the *external* bill said, so the user has final say. The point is to surface the discrepancy.

The receipt scanner currently calls `trpc.ai.analysePhoto` with `analysisType: 'general'` — re-purposing the construction-site analysis prompt for receipt OCR. Phase 4 adds a dedicated `'receipt'` case to the `analysisType` enum in `server/routers/ai.ts:178` and a corresponding prompt in the `prompts` map at `ai.ts:182-263`. The receipt prompt asks the model to tag each line item with `isLabour` based on the description (heuristics: "labour", "supervision", "fitting", "installation" → true; "materials", "supply", "hire", "fuel", "components" → false; ambiguous → omit). `app/receipt-scanner.tsx:354` switches to `analysisType: 'receipt'` in the same PR.

## Testing

### New: `tests/cis-helper.test.ts`

Unit tests for `cisRateForStatus`, `labourSubtotal`, `computeCisDeduction`. Matrix:

| status | items | expected deduction |
|---|---|---|
| 'none' | mixed | 0 |
| 'gross_payment' | all labour | 0 |
| 'registered_20' | 100% labour, £1000 | £200 |
| 'registered_20' | 50/50 mix, £1000 total | £100 (only labour subtotal) |
| 'registered_30' | mixed | 30% of labour subtotal |
| 'registered_20' + override 0 | mixed | 0 (override beats status) |
| 'registered_20' | empty items | 0 |

~10 cases.

### Updated: `tests/ai-doc-generators.test.ts`

- Invoice tests (5 existing): unchanged behavior, but assertion values now derived from helper to avoid drift if defaults change.
- New timesheet tests (3): `cisStatus: 'gross_payment'` → 0 deduction, `'registered_30'` → 30% of grossPay, `'registered_20'` → 20%.

### New: `tests/integration/finance-invoice.integration.test.ts`

- `createInvoice` with structured `lineItems` and matching `cisDeductionAmount` → succeeds; row persisted; jsonb column round-trips.
- `createInvoice` with structured `lineItems` and mismatched `cisDeductionAmount` → rejects with `BAD_REQUEST`.
- `createInvoice` without `lineItems` → succeeds (back-compat), no validation.
- `createInvoice` with `lineItems` + `isCisJob: false` → succeeds without validation.

### UI smoke

Existing `tests/sync-queue-banner.component.test.tsx` and `tests/delivery-status-pill.component.test.tsx` patterns. The labour toggle is pure React state; no new component test required unless the design surfaces a non-trivial render path.

## Rollout — four phased PRs

| Phase | PR | Contents | Risk | Verification |
|---|---|---|---|---|
| 1 | `core(cis): shared rate helper` | `server/_core/cis.ts` + 4 server refactors. No schema, no UI. New unit tests. | Low — pure refactor; existing tests pin behavior. | `pnpm check && pnpm test` |
| 2 | `feat(invoices): UI labour/materials toggle + timesheet status` | `documents.tsx` invoice form `isLabour` toggle + timesheet form `cisStatus` picker. | Low — UI-only. | `pnpm check && pnpm test`; Expo dev-client smoke on iOS sim |
| 3 | `feat(finance): structured lineItems + CIS validation` | drizzle migration + `finance.createInvoice` schema + validation. | Med — schema migration with backfill. | `pnpm check && pnpm test:integration`; verify migration on real PG |
| 4 | `feat(receipts): line-item labour flag + AI prompt` | `receipt-scanner.tsx` extended; LLM extraction prompt updated; mismatch warning. | Low — opt-in extraction; existing receipts unaffected. | `pnpm check && pnpm test`; manual receipt scan smoke |

Each PR is independently deployable. Phase 1 must land first; 2/3/4 can interleave, but Phase 3's validation only activates when `lineItems` is provided, so deploying Phase 3 before Phase 2 is safe (existing UI just keeps sending the opaque string and validation skips).

## Risks & mitigations

- **Migration risk (Phase 3):** the `text → jsonb` cast on `invoices.lineItems` could fail on a malformed row. Mitigation: defensive `CASE` block in the migration falls back to `'[]'::jsonb` for empty/invalid; verified on integration test with hand-crafted bad rows before production deploy.
- **AI prompt drift (Phase 4):** LLM may tag line items inconsistently. Mitigation: the mismatch warning surfaces the discrepancy to the user; the user has final say. Track AI-tag accuracy in production via a `receipt_extraction_audit` table (out of scope for this PR; noted as follow-up).
- **CIS status source of truth (Phase 2):** the timesheet form defaults `cisStatus` from `currentCompany.cisStatus`, but a worker may legitimately have a different status than the company. Mitigation: per-timesheet override is in scope; per-worker status (e.g., on `users.cisStatus`) is a separate feature, not blocking.

## Open questions

None blocking design approval. Implementation may surface:

- Whether `finance.createInvoice`'s `cisDeductionRate: z.number()` should be replaced with `cisStatus` for consistency with timesheets (currently it's a raw number percentage). Recommend keeping numeric for back-compat; add a `cisStatusFromRate` adapter inside the validation. The same adapter belongs in `server/_core/cis.ts` so the rounding/clamping rule lives in one place.

## Appendix: HMRC CIS rules summary

Source: HMRC Construction Industry Scheme (CIS) guide for contractors, updated 2024.

- CIS deduction applies only to the **labour portion** of payments to subcontractors.
- "Labour" includes: site labour, supervision, fitting, installation, fabrication on-site.
- "Materials" (NOT subject to CIS) includes: materials directly used, plant hire (without operator), fuel for plant, manufactured components, manufactured plant.
- Edge cases: plant hire WITH operator → CIS applies to the operator portion only; consumables (small tools, PPE) → CIS-applicable as labour.
- Subcontractor status determines rate:
  - **Verified registered**: 20% (default)
  - **Unverified or unregistered**: 30%
  - **Gross payment status (HMRC-approved)**: 0%
- VAT is **never** subject to CIS — applied to labour subtotal pre-VAT.
- Contractors must remit deducted amounts to HMRC monthly via CIS300 return; out of scope for this design.
