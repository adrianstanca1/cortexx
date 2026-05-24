# CIS Labour/Materials Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralise CIS rate logic in `server/_core/cis.ts`, fix three HMRC-compliance bugs (UI labour toggle missing, timesheet hardcoded 20%, signed timesheet hardcoded 20%), enforce CIS math at the persistence boundary, and tag receipt line items with labour vs materials.

**Architecture:** Single-source-of-truth helper module `server/_core/cis.ts` exports `CisStatus` enum, `cisRateForStatus`, `labourSubtotal`, and `computeCisDeduction`. All four CIS calc sites (`generateInvoice`, `generateTimesheet`, `generateTimesheetSignedOff`, `finance.createInvoice`) call into the helper. UI surfaces (invoice form, timesheet form, receipt scanner) gain explicit per-line/per-document controls. Persistence layer validates CIS amounts against re-derived calculation. Four phased PRs, each independently deployable.

**Tech Stack:** TypeScript, tRPC v11, Drizzle ORM (PostgreSQL), Zod, Vitest, Expo / React Native (NativeWind 4), `@testcontainers/postgresql`.

**Spec:** `docs/superpowers/specs/2026-05-07-cis-labour-materials-split-design.md` (commit `578d342`).

**Spec correction:** spec names the migration `0014_invoices_lineitems_jsonb.sql`, but `0014_material_deliveries.sql` already exists. This plan uses `0015_invoices_lineitems_jsonb.sql` and journal `idx: 12`.

**Branch strategy (decided 2026-05-07):** one feature branch per phase, named `cis-phase-N` (e.g. `cis-phase-1`). Each phase opens a PR; merge to `main` when CI green; Phase N+1 starts fresh from updated `main`. Rationale: `main` triggers a deploy on every push, so 18 commits to `main` = 18 deploys. Phase-level branches collapse this to 4 deploys, one per merged PR, and keep `main` deployable mid-implementation.

**Execution mode:** subagent-driven-development (one fresh implementer + spec reviewer + code quality reviewer per task). The controller (you) reads this plan once, then dispatches one task at a time with the full task text inlined into the implementer prompt — subagents do not read this file.

---

## File Structure

| File | Phase | Action | Responsibility |
|---|---|---|---|
| `server/_core/cis.ts` | 1 | Create | `CisStatus` type, `cisRateForStatus`, `labourSubtotal`, `computeCisDeduction` |
| `tests/cis-helper.test.ts` | 1 | Create | Unit-tests for the helper (matrix of status × items) |
| `server/routers/documents.ts` | 1 | Modify | `generateInvoice`, `generateTimesheet`, `generateTimesheetSignedOff` import + use helper |
| `tests/ai-doc-generators.test.ts` | 1 | Modify | Add 3 timesheet status branch tests; existing 7 invoice tests unchanged behavior |
| `app/documents.tsx` | 2 | Modify | Invoice form `isLabour` toggle per line; timesheet form `cisStatus` picker |
| `drizzle/0015_invoices_lineitems_jsonb.sql` | 3 | Create | `invoices.lineItems` text → jsonb with defensive cast |
| `drizzle/meta/_journal.json` | 3 | Modify | Append migration entry `idx: 12, tag: "0015_invoices_lineitems_jsonb"` |
| `server/routers/finance.ts` | 3 | Modify | `createInvoice` schema (lineItems array) + CIS validation |
| `tests/integration/finance-invoice.integration.test.ts` | 3 | Create | createInvoice accept/reject paths on real Postgres |
| `server/routers/ai.ts` | 4 | Modify | Add `'receipt'` to `analysisType` enum + receipt-extraction prompt |
| `app/receipt-scanner.tsx` | 4 | Modify | Switch to `'receipt'`, extract `isLabour` per line, mismatch warning banner |

---

## PHASE 1 — Shared helper + server refactors

PR title: `core(cis): shared rate helper`

### Task 1.1: CisStatus type + cisRateForStatus

**Files:**
- Create: `server/_core/cis.ts`
- Create: `tests/cis-helper.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/cis-helper.test.ts`:

```ts
/**
 * Unit tests for `server/_core/cis.ts` — single source of truth for HMRC
 * Construction Industry Scheme arithmetic. Errors here cost real money,
 * so the matrix below pins every status × item-mix × override branch
 * the helper claims to handle.
 */
import { describe, expect, it } from "vitest";
import {
  cisRateForStatus,
  labourSubtotal,
  computeCisDeduction,
  type CisStatus,
} from "../server/_core/cis";

describe("cisRateForStatus", () => {
  it("registered_20 → 20", () => {
    expect(cisRateForStatus("registered_20")).toBe(20);
  });

  it("registered_30 → 30 (unverified subcontractor)", () => {
    expect(cisRateForStatus("registered_30")).toBe(30);
  });

  it("gross_payment → 0 (HMRC-approved gross status)", () => {
    expect(cisRateForStatus("gross_payment")).toBe(0);
  });

  it("none → 0 (CIS does not apply, e.g. employee timesheet)", () => {
    expect(cisRateForStatus("none")).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/cis-helper.test.ts`
Expected: FAIL with module-not-found error for `../server/_core/cis`.

- [ ] **Step 3: Create the helper module with type and rate function**

Create `server/_core/cis.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/cis-helper.test.ts`
Expected: PASS — 4 tests in `cisRateForStatus` describe.

- [ ] **Step 5: Commit**

```bash
git add server/_core/cis.ts tests/cis-helper.test.ts
git commit -m "core(cis): add CisStatus type + cisRateForStatus

First slice of the shared CIS helper. Rate mapping per HMRC:
registered_20 → 20, registered_30 → 30, gross_payment → 0, none → 0.

Spec: docs/superpowers/specs/2026-05-07-cis-labour-materials-split-design.md"
```

---

### Task 1.2: labourSubtotal

**Files:**
- Modify: `server/_core/cis.ts`
- Modify: `tests/cis-helper.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/cis-helper.test.ts`:

```ts
describe("labourSubtotal", () => {
  it("returns 0 for an empty list", () => {
    expect(labourSubtotal([])).toBe(0);
  });

  it("sums all items when every isLabour is true", () => {
    const items = [
      { quantity: 5, unitRate: 350, isLabour: true },
      { quantity: 2, unitRate: 100, isLabour: true },
    ];
    expect(labourSubtotal(items)).toBe(5 * 350 + 2 * 100);
  });

  it("excludes items with isLabour:false (HMRC: not on materials)", () => {
    const items = [
      { quantity: 5, unitRate: 350, isLabour: true },
      { quantity: 1, unitRate: 1500, isLabour: false },
    ];
    expect(labourSubtotal(items)).toBe(5 * 350); // 1500 materials excluded
  });

  it("treats undefined isLabour as labour (back-compat for callers that don't pass the flag)", () => {
    const items = [
      { quantity: 5, unitRate: 350 }, // no isLabour
      { quantity: 2, unitRate: 100, isLabour: true },
    ];
    expect(labourSubtotal(items)).toBe(5 * 350 + 2 * 100);
  });

  it("returns 0 when every item is non-labour", () => {
    const items = [
      { quantity: 1, unitRate: 1500, isLabour: false },
      { quantity: 1, unitRate: 800, isLabour: false },
    ];
    expect(labourSubtotal(items)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/cis-helper.test.ts`
Expected: FAIL — `labourSubtotal is not a function` or import error.

- [ ] **Step 3: Implement labourSubtotal**

Append to `server/_core/cis.ts` (after `cisRateForStatus`):

```ts
/**
 * Sum the labour portion of a line-items array. Items with `isLabour ===
 * false` are excluded; items with `isLabour === true` or `isLabour ===
 * undefined` are included. The undefined-as-labour default preserves
 * back-compat for callers (mostly older API consumers and the timesheet
 * generator) that do not yet thread the flag through.
 */
export function labourSubtotal(
  items: ReadonlyArray<{ quantity: number; unitRate: number; isLabour?: boolean }>,
): number {
  return items
    .filter((item) => item.isLabour !== false)
    .reduce((sum, item) => sum + item.quantity * item.unitRate, 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/cis-helper.test.ts`
Expected: PASS — 9 total tests (4 from Task 1.1 + 5 from this task).

- [ ] **Step 5: Commit**

```bash
git add server/_core/cis.ts tests/cis-helper.test.ts
git commit -m "core(cis): labourSubtotal with isLabour-undefined-as-labour default

Back-compat default lets the existing timesheet generator (no flag)
keep working unchanged. Materials (isLabour:false) are excluded per
HMRC rules."
```

---

### Task 1.3: computeCisDeduction

**Files:**
- Modify: `server/_core/cis.ts`
- Modify: `tests/cis-helper.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/cis-helper.test.ts`:

```ts
describe("computeCisDeduction", () => {
  it("none → 0 regardless of labour subtotal", () => {
    expect(computeCisDeduction({ labourSubtotal: 1000, status: "none" })).toBe(0);
  });

  it("gross_payment → 0 (HMRC-approved gross status)", () => {
    expect(computeCisDeduction({ labourSubtotal: 1000, status: "gross_payment" })).toBe(0);
  });

  it("registered_20 → 20% of labour subtotal", () => {
    expect(computeCisDeduction({ labourSubtotal: 1000, status: "registered_20" })).toBe(200);
  });

  it("registered_30 → 30% of labour subtotal", () => {
    expect(computeCisDeduction({ labourSubtotal: 1000, status: "registered_30" })).toBe(300);
  });

  it("rounds to 2 decimal places (avoid floating-point trailing digits in £ amounts)", () => {
    // 333.33 × 0.20 = 66.666... → 66.67
    expect(computeCisDeduction({ labourSubtotal: 333.33, status: "registered_20" })).toBe(66.67);
  });

  it("overrideRate beats status (legacy callers pass an explicit rate)", () => {
    // status would say 20%, override says 25% → 250
    expect(
      computeCisDeduction({
        labourSubtotal: 1000,
        status: "registered_20",
        overrideRate: 25,
      }),
    ).toBe(250);
  });

  it("overrideRate of 0 wins (legacy caller explicitly suppressing CIS)", () => {
    expect(
      computeCisDeduction({
        labourSubtotal: 1000,
        status: "registered_20",
        overrideRate: 0,
      }),
    ).toBe(0);
  });

  it("zero labour subtotal → 0 even at non-zero rate", () => {
    expect(computeCisDeduction({ labourSubtotal: 0, status: "registered_20" })).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/cis-helper.test.ts`
Expected: FAIL — `computeCisDeduction is not a function`.

- [ ] **Step 3: Implement computeCisDeduction**

Append to `server/_core/cis.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/cis-helper.test.ts`
Expected: PASS — 17 total tests across the three describes.

- [ ] **Step 5: Commit**

```bash
git add server/_core/cis.ts tests/cis-helper.test.ts
git commit -m "core(cis): computeCisDeduction with override + rounding

overrideRate beats status to support legacy callers that pass an
explicit rate. Result rounds to 2dp so £ amounts don't leak floating-
point trailing digits."
```

---

### Task 1.4: Refactor generateInvoice to use helper

**Files:**
- Modify: `server/routers/documents.ts:151-282`
- Test: `tests/ai-doc-generators.test.ts` (existing 7 tests must still pass unchanged)

- [ ] **Step 1: Run existing invoice tests to capture baseline**

Run: `pnpm test tests/ai-doc-generators.test.ts`
Expected: PASS — 7 invoice tests under "documents.generateInvoice" describe (lines 234-345 region).

Note the count for verification after the refactor.

- [ ] **Step 2: Refactor the calc to use the helper**

In `server/routers/documents.ts`:

Add import at top of file (after the existing imports around line 17):

```ts
import {
  computeCisDeduction,
  labourSubtotal,
  type CisStatus,
} from "../_core/cis";
```

Replace lines 184-199 (the inline `subtotal` / `labourSubtotal` / `cisDeductionAmount` block) with:

```ts
      const subtotal = input.lineItems.reduce(
        (sum, item) => sum + item.quantity * item.unitRate,
        0,
      );
      // HMRC CIS rules: deduction applies to LABOUR subtotal only — never VAT,
      // never materials. Helper preserves the undefined-as-labour back-compat
      // default for callers that don't yet thread isLabour through.
      const labour = labourSubtotal(input.lineItems);
      const vatAmount = input.vatRate ? subtotal * (input.vatRate / 100) : 0;
      const grossTotal = subtotal + vatAmount;
      const cisDeductionAmount = input.cisDeduction
        ? computeCisDeduction({
            labourSubtotal: labour,
            status: "registered_20", // back-compat: legacy API uses cisRate override
            overrideRate: input.cisRate ?? 20,
          })
        : 0;
      const netPayable = grossTotal - cisDeductionAmount;
```

- [ ] **Step 3: Run all generateInvoice tests to verify behavior unchanged**

Run: `pnpm test tests/ai-doc-generators.test.ts -t "generateInvoice"`
Expected: PASS — same 7 tests as Step 1, identical numeric assertions.

- [ ] **Step 4: Run full test suite to catch any side-effects**

Run: `pnpm test`
Expected: PASS — full suite, no regressions.

- [ ] **Step 5: Commit**

```bash
git add server/routers/documents.ts
git commit -m "refactor(documents): generateInvoice uses cis helper

Same external API, same behaviour. Removes the inline labour filter
and CIS multiply in favour of the centralised helper. Existing 7
generateInvoice tests pass unchanged."
```

---

### Task 1.5: Add cisStatus enum to generateTimesheet

**Files:**
- Modify: `server/routers/documents.ts:288-395` (generateTimesheet)
- Modify: `tests/ai-doc-generators.test.ts` (add timesheet CIS tests)

- [ ] **Step 1: Add failing tests for the three CIS status branches**

Append to `tests/ai-doc-generators.test.ts` after the existing `describe("documents.generateInvoice"...` block (around line 350):

```ts
describe("documents.generateTimesheet — CIS status branches", () => {
  const baseInput = {
    companyId: 7,
    workerName: "Alice",
    workerTrade: "Steel-fixer",
    companyName: "Acme Ltd",
    projectName: "Acme HQ",
    weekEnding: "2026-05-07",
    hourlyRate: 25,
    entries: [
      // 5 days × 8h × £25/h = £1000 grossPay
      { date: "Mon", startTime: "08:00", endTime: "16:30", breakMinutes: 30 },
      { date: "Tue", startTime: "08:00", endTime: "16:30", breakMinutes: 30 },
      { date: "Wed", startTime: "08:00", endTime: "16:30", breakMinutes: 30 },
      { date: "Thu", startTime: "08:00", endTime: "16:30", breakMinutes: 30 },
      { date: "Fri", startTime: "08:00", endTime: "16:30", breakMinutes: 30 },
    ],
  };

  it("cisStatus:'none' → 0 deduction (employee timesheet)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateTimesheet({
      ...baseInput,
      cisStatus: "none",
    });
    expect(result.totals.grossPay).toBe(1000);
    expect(result.content).not.toContain("CIS Deduction");
  });

  it("cisStatus:'gross_payment' → 0 deduction (HMRC-approved gross status)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateTimesheet({
      ...baseInput,
      cisStatus: "gross_payment",
    });
    expect(result.totals.grossPay).toBe(1000);
    // gross_payment subbies receive payment in full — no CIS line in the doc
    expect(result.content).not.toContain("CIS Deduction");
  });

  it("cisStatus:'registered_20' → 20% of grossPay = £200", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateTimesheet({
      ...baseInput,
      cisStatus: "registered_20",
    });
    expect(result.totals.grossPay).toBe(1000);
    expect(result.content).toContain("| CIS Deduction (20%) | -£200.00 |");
  });

  it("cisStatus:'registered_30' → 30% of grossPay = £300 (unverified subbie)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateTimesheet({
      ...baseInput,
      cisStatus: "registered_30",
    });
    expect(result.totals.grossPay).toBe(1000);
    expect(result.content).toContain("| CIS Deduction (30%) | -£300.00 |");
  });
});
```

- [ ] **Step 2: Run new tests to verify they fail**

Run: `pnpm test tests/ai-doc-generators.test.ts -t "generateTimesheet — CIS status"`
Expected: FAIL — Zod input validation error (`cisStatus` not in schema) or wrong rate (hardcoded 20%).

- [ ] **Step 3: Update the generateTimesheet schema and calc**

In `server/routers/documents.ts`:

Replace the input schema field at line ~309:

```ts
        cisApplicable: z.boolean().optional(),
```

with:

```ts
        cisStatus: z
          .enum(["none", "registered_20", "registered_30", "gross_payment"])
          .default("none"),
```

Replace lines ~366-368 (the hardcoded `* 0.2` block) with:

```ts
${(() => {
  const cisDeduction = computeCisDeduction({
    labourSubtotal: grossPay,
    status: input.cisStatus,
  });
  if (cisDeduction === 0) return "";
  const rate = cisRateForStatus(input.cisStatus);
  return `| CIS Deduction (${rate}%) | -£${cisDeduction.toFixed(2)} |
| **Net Pay** | **£${(grossPay - cisDeduction).toFixed(2)}** |`;
})()}
```

Add `cisRateForStatus` to the existing import block at the top of the file (the one added in Task 1.4).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/ai-doc-generators.test.ts`
Expected: PASS — 4 new timesheet tests + all existing tests still green.

Run: `pnpm check`
Expected: PASS — no type errors.

- [ ] **Step 5: Commit**

```bash
git add server/routers/documents.ts tests/ai-doc-generators.test.ts
git commit -m "fix(timesheet): cisStatus enum replaces hardcoded 20% (HMRC compliance)

generateTimesheet previously hardcoded \`grossPay * 0.2\` regardless of
the worker's CIS status. A subbie with gross_payment status had 20%
deducted (should be 0%); a registered_30 subbie had 20% (should be
30%). Replace cisApplicable:boolean with cisStatus:enum and route
through the central helper.

BREAKING (internal): cisApplicable is removed. The UI form change
ships in PR #2 of the CIS sweep."
```

---

### Task 1.6: Mirror cisStatus change in generateTimesheetSignedOff

**Files:**
- Modify: `server/routers/documents.ts:400-~520` (generateTimesheetSignedOff)
- Modify: `tests/ai-doc-generators.test.ts` (add 1 status branch test)

- [ ] **Step 1: Add a failing test**

Append to `tests/ai-doc-generators.test.ts`:

```ts
describe("documents.generateTimesheetSignedOff — CIS status", () => {
  const baseInput = {
    companyId: 7,
    workerName: "Bob",
    projectName: "Acme HQ",
    weekStarting: "2026-05-05",
    totalHours: 40,
    overtimeHours: 0,
    hourlyRate: 25, // grossPay = 40 × 25 = 1000
  };

  it("cisStatus:'gross_payment' → no CIS line in signed timesheet", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateTimesheetSignedOff({
      ...baseInput,
      cisStatus: "gross_payment",
    });
    expect(result.content).not.toContain("CIS Deduction");
  });

  it("cisStatus:'registered_30' → 30% deduction line (£300 from £1000 grossPay)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.documents.generateTimesheetSignedOff({
      ...baseInput,
      cisStatus: "registered_30",
    });
    expect(result.content).toContain("CIS Deduction (30%) | -£300.00");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/ai-doc-generators.test.ts -t "generateTimesheetSignedOff"`
Expected: FAIL — schema doesn't accept `cisStatus`, or wrong rate.

- [ ] **Step 3: Apply the same schema + calc changes**

In `server/routers/documents.ts`, mirror Task 1.5 changes to `generateTimesheetSignedOff` (procedure starts around line 400):

Replace the `cisApplicable: z.boolean().optional(),` line in its input schema with:

```ts
        cisStatus: z
          .enum(["none", "registered_20", "registered_30", "gross_payment"])
          .default("none"),
```

Replace the hardcoded `${(grossPay * 0.2).toFixed(2)}` block (around lines 500-503) with:

```ts
        ...(() => {
          const cisDeduction = computeCisDeduction({
            labourSubtotal: grossPay,
            status: input.cisStatus,
          });
          if (cisDeduction === 0 || grossPay <= 0) return [];
          const rate = cisRateForStatus(input.cisStatus);
          return [
            `| CIS Deduction (${rate}%) | -£${cisDeduction.toFixed(2)} |`,
            `| **Net Pay** | **£${(grossPay - cisDeduction).toFixed(2)}** |`,
          ];
        })(),
```

(The signed timesheet builds content as a string array joined later, so the IIFE returns lines instead of a string.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/ai-doc-generators.test.ts`
Expected: PASS — both signed timesheet tests + everything else.

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routers/documents.ts tests/ai-doc-generators.test.ts
git commit -m "fix(timesheet-signed): cisStatus enum mirroring generateTimesheet

Same hardcoded-20% bug as the unsigned generator. Same fix shape.
Both timesheet generators now share the central helper and the
status-aware rate logic."
```

---

### Task 1.7: Push Phase 1 and watch CI

**Files:** none (deploy/CI verification step)

- [ ] **Step 1: Verify locally**

Run: `pnpm check && pnpm test`
Expected: PASS for typecheck and full vitest suite (~1100+ tests including the 17 new helper tests + 6 new timesheet tests).

- [ ] **Step 2: Push to main**

```bash
git push origin main
```

- [ ] **Step 3: Watch CI + Deploy**

Load PAT and poll the runs:

```bash
. /root/source-env.sh
TOKEN="${GITHUB_TOKEN:-$GITHUB_PAT}"
SHA=$(git rev-parse HEAD)
curl -sH "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/adrianstanca1/cortexbuild-field/actions/runs?head_sha=$SHA&per_page=5" \
  | python3 -c "import json,sys;[print(r['name'],r['status'],r['conclusion'],r['html_url']) for r in json.load(sys.stdin).get('workflow_runs',[])]"
```

Expected: both `CI` and `Deploy to VPS` reach `conclusion=success`.

- [ ] **Step 4: Verify production deploy advanced**

```bash
echo -n "Prod SHA: "; curl -s https://field.cortexbuildpro.com/cortexbuild-field-deploy.txt
echo -n "/api/health: "; curl -s -o /dev/null -w "%{http_code}\n" https://field.cortexbuildpro.com/api/health
```

Expected: Prod SHA matches HEAD; `/api/health` is 200.

- [ ] **Step 5: Phase 1 complete — proceed to Phase 2**

No commit; this is a verification gate.

---

## PHASE 2 — UI changes

PR title: `feat(invoices): UI labour/materials toggle + timesheet CIS status`

### Task 2.1: Invoice form `isLabour` toggle per line item

**Files:**
- Modify: `app/documents.tsx:361-462` (InvoiceForm)

- [ ] **Step 1: Extend invoice form state to include isLabour per item**

In `app/documents.tsx`, find the InvoiceForm (line ~361). Update the initial form state at line 374:

```ts
    items: [{ description: '', quantity: '1', unit: 'sum', unitRate: '' }],
```

to:

```ts
    items: [{ description: '', quantity: '1', unit: 'sum', unitRate: '', isLabour: true }],
```

Update `addItem` (line ~379):

```ts
  const addItem = () => setForm(p => ({
    ...p,
    items: [...p.items, { description: '', quantity: '1', unit: 'sum', unitRate: '', isLabour: true }],
  }));
```

- [ ] **Step 2: Pass isLabour through the mutation call**

In the same file, the `generateMutation.mutateAsync` call at line ~391-405. Update the `lineItems` map (line 397):

```ts
        lineItems: form.items.filter(i => i.description && i.unitRate).map(i => ({
          description: i.description, quantity: parseFloat(i.quantity) || 1,
          unit: i.unit, unitRate: parseFloat(i.unitRate) || 0,
          isLabour: i.isLabour,
        })),
```

- [ ] **Step 3: Add the toggle to the line-item editor**

In the same file, the line-item editor JSX is at lines 426-442. After the `lineItemRow` View (line 440), add a new row with the labour toggle. Replace lines 426-442 with:

```tsx
    {form.items.map((item, i) => (
      <View key={i} style={[styles.lineItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.lineItemNum, { color: colors.muted }]}>#{i + 1}</Text>
        <FormField label="Description" value={item.description} onChange={v => updateItem(i, 'description', v)} placeholder="Work description" colors={colors} />
        <View style={styles.lineItemRow}>
          <View style={{ flex: 1 }}>
            <FormField label="Qty" value={item.quantity} onChange={v => updateItem(i, 'quantity', v)} placeholder="1" colors={colors} />
          </View>
          <View style={{ flex: 1 }}>
            <FormField label="Unit" value={item.unit} onChange={v => updateItem(i, 'unit', v)} placeholder="sum/m²/hr" colors={colors} />
          </View>
          <View style={{ flex: 1 }}>
            <FormField label="Rate (£)" value={item.unitRate} onChange={v => updateItem(i, 'unitRate', v)} placeholder="0.00" colors={colors} />
          </View>
        </View>
        <TouchableOpacity
          style={[styles.toggleRow, { backgroundColor: colors.background, borderColor: colors.border, marginTop: 8 }]}
          onPress={() => setForm(p => {
            const items = [...p.items];
            items[i] = { ...items[i], isLabour: !items[i].isLabour };
            return { ...p, items };
          })}
          activeOpacity={0.8}
        >
          <View>
            <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Labour</Text>
            <Text style={[styles.toggleSub, { color: colors.muted }]}>{item.isLabour ? 'CIS deduction applies' : 'Materials — no CIS'}</Text>
          </View>
          <View style={[styles.toggle, { backgroundColor: item.isLabour ? '#22C55E' : colors.border }]}>
            <View style={[styles.toggleThumb, { transform: [{ translateX: item.isLabour ? 18 : 2 }] }]} />
          </View>
        </TouchableOpacity>
      </View>
    ))}
```

- [ ] **Step 4: Verify typecheck + tests still pass**

Run: `pnpm check`
Expected: PASS — `items` shape now includes `isLabour: boolean`, `generateInvoice` already accepts it.

Run: `pnpm test`
Expected: PASS — no test regressions (this is a UI-only change; server tests cover the math).

- [ ] **Step 5: Commit**

```bash
git add app/documents.tsx
git commit -m "feat(invoices): per-line isLabour toggle in invoice form

Closes the actual user-facing CIS labour/materials gap. Server-side
isLabour was already implemented (commit 6544c9e + earlier); the form
just never sent it, so every line item defaulted to labour and over-
deducted CIS on materials."
```

---

### Task 2.2: Timesheet form `cisStatus` picker

**Files:**
- Modify: `app/documents.tsx:466-?` (TimesheetForm)

- [ ] **Step 1: Read the existing timesheet form state shape**

In `app/documents.tsx`, find the `TimesheetForm` component (line ~466). Identify the `cisApplicable: false` field in the state initialiser (line ~477).

- [ ] **Step 2: Replace `cisApplicable` with `cisStatus`**

Add to the imports at the top of the file (if not already present from Task 2.1):

```ts
import { useCompany } from '@/lib/company-context';
```

(This may already be imported — check first.)

Update the form state initialiser at line ~477 from:

```ts
    hourlyRate: '', dayRate: '', cisApplicable: false,
```

to:

```ts
    hourlyRate: '', dayRate: '',
    cisStatus: (currentCompany?.cisStatus ?? 'none') as 'none' | 'registered_20' | 'registered_30' | 'gross_payment',
```

(`currentCompany` is already destructured from `useCompany()` earlier in the component — confirm this is the case; if not, add `const { currentCompany } = useCompany();` at the top of the component.)

- [ ] **Step 3: Replace the cisApplicable toggle with a 4-option picker**

Find the existing `cisApplicable` toggle in the timesheet form's JSX (mirror of the invoice form's toggle at lines 447-459). Replace it with a row of pressable cards:

```tsx
    <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 8 }]}>CIS STATUS</Text>
    <View style={{ gap: 6 }}>
      {([
        { key: 'none',          label: 'None',                       sub: 'CIS does not apply (employee)' },
        { key: 'registered_20', label: 'Registered (20%)',           sub: 'Verified subcontractor' },
        { key: 'registered_30', label: 'Unverified (30%)',           sub: 'Unregistered or unverifiable' },
        { key: 'gross_payment', label: 'Gross payment (0%)',         sub: 'HMRC-approved gross status' },
      ] as const).map(opt => (
        <TouchableOpacity
          key={opt.key}
          style={[
            styles.toggleRow,
            { backgroundColor: colors.surface, borderColor: form.cisStatus === opt.key ? '#22C55E' : colors.border, borderWidth: form.cisStatus === opt.key ? 2 : 1 },
          ]}
          onPress={() => setForm(p => ({ ...p, cisStatus: opt.key }))}
          activeOpacity={0.8}
        >
          <View>
            <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{opt.label}</Text>
            <Text style={[styles.toggleSub, { color: colors.muted }]}>{opt.sub}</Text>
          </View>
          {form.cisStatus === opt.key && <Text style={{ color: '#22C55E', fontWeight: '600' }}>✓</Text>}
        </TouchableOpacity>
      ))}
    </View>
```

- [ ] **Step 4: Update the mutation call to send cisStatus**

Find the timesheet generate mutation call in `TimesheetForm` (mirror of invoice form's `generateMutation.mutateAsync`). The previous payload included `cisApplicable: form.cisApplicable`. Replace with `cisStatus: form.cisStatus`.

If the form also dispatches to `documents.generateTimesheetSignedOff`, mirror the change there.

Run typecheck to confirm:

Run: `pnpm check`
Expected: PASS — server input schemas now accept `cisStatus`, and `cisApplicable` is gone.

- [ ] **Step 5: Commit**

```bash
git add app/documents.tsx
git commit -m "feat(timesheet): cisStatus picker replaces cisApplicable toggle

Default reads from currentCompany.cisStatus; user can override per-
timesheet. Closes the hardcoded-20% UI gap to match server PR #1.

BREAKING (internal): the form's cisApplicable boolean is removed;
the field name in the form state is now cisStatus."
```

---

### Task 2.3: Push Phase 2 and watch CI

**Files:** none (verification step)

- [ ] **Step 1: Verify locally**

Run: `pnpm check && pnpm test`
Expected: PASS.

- [ ] **Step 2: Push and poll**

```bash
git push origin main
```

Then poll runs as in Task 1.7 Step 3.

- [ ] **Step 3: Verify production deploy advanced**

```bash
echo -n "Prod SHA: "; curl -s https://field.cortexbuildpro.com/cortexbuild-field-deploy.txt
echo -n "/api/health: "; curl -s -o /dev/null -w "%{http_code}\n" https://field.cortexbuildpro.com/api/health
```

Expected: Prod SHA matches HEAD; HTTP 200.

- [ ] **Step 4: Manual smoke (optional but recommended)**

If an Expo dev client is convenient: open the app, navigate to the document generator, create a test invoice with two line items (one labour, one materials), confirm the CIS deduction in the generated markdown matches `labourSubtotal × 20%`, not `subtotal × 20%`.

- [ ] **Step 5: Phase 2 complete — proceed to Phase 3**

No commit; verification gate.

---

## PHASE 3 — Persistence enforcement

PR title: `feat(finance): structured lineItems + CIS validation`

### Task 3.1: Drizzle migration text → jsonb

**Files:**
- Create: `drizzle/0015_invoices_lineitems_jsonb.sql`
- Modify: `drizzle/meta/_journal.json`

- [ ] **Step 1: Verify the next available migration number**

```bash
ls drizzle/*.sql | tail -3
tail -10 drizzle/meta/_journal.json
```

Expected: `0014_material_deliveries.sql` is latest; journal `idx: 11` is the latest entry. The new migration is `0015_invoices_lineitems_jsonb.sql` with `idx: 12`.

- [ ] **Step 2: Create the migration SQL**

Create `drizzle/0015_invoices_lineitems_jsonb.sql`:

```sql
-- 0015_invoices_lineitems_jsonb
-- Convert invoices.lineItems from opaque text → structured jsonb so that
-- finance.createInvoice can re-derive cisDeductionAmount from the line
-- items and reject mismatches at the persistence boundary.
--
-- Defensive cast: empty strings become '[]'::jsonb; rows that aren't
-- valid JSON also become '[]'::jsonb (rather than failing the migration
-- mid-deploy). The validation only activates when lineItems is provided
-- in the input, so backfilled '[]' rows are not retroactively re-checked.
ALTER TABLE invoices
  ALTER COLUMN "lineItems" TYPE jsonb
  USING CASE
    WHEN "lineItems" IS NULL THEN NULL
    WHEN "lineItems" = '' THEN '[]'::jsonb
    ELSE COALESCE(
      NULLIF(
        (SELECT to_jsonb(t) FROM (SELECT "lineItems"::jsonb AS v) t)->'v',
        'null'::jsonb
      ),
      '[]'::jsonb
    )
  END;
```

Note: the inner `to_jsonb`/SELECT is a defensive cast that avoids the migration failing if a row has malformed JSON — the parse error is contained inside the COALESCE chain. If this SQL idiom proves too clever in review, simpler alternative:

```sql
-- Simpler defensive cast (Postgres 16+):
ALTER TABLE invoices
  ALTER COLUMN "lineItems" TYPE jsonb
  USING CASE
    WHEN "lineItems" IS NULL THEN NULL
    WHEN "lineItems" = '' THEN '[]'::jsonb
    ELSE COALESCE("lineItems"::jsonb, '[]'::jsonb)
  END;
```

The simpler form fails on truly malformed JSON. Audit invoices first:

```bash
# On the production DB:
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM invoices WHERE \"lineItems\" IS NOT NULL AND \"lineItems\" != '' AND \"lineItems\" !~ '^\\s*[\\[{]';"
```

Expected: `0` malformed rows. If 0, use the simpler form. If non-zero, use the defensive form.

For this plan, use the **simpler form** (with the audit step done first). If the audit shows malformed rows, switch to defensive.

- [ ] **Step 3: Append entry to migration journal**

Edit `drizzle/meta/_journal.json`. Append after the `0014_material_deliveries` entry (which has `idx: 11`):

```json
    {
      "idx": 12,
      "version": "7",
      "when": 1778300000000,
      "tag": "0015_invoices_lineitems_jsonb",
      "breakpoints": true
    }
```

(Adjust the trailing comma on the previous entry; ensure the new entry is the last in the `entries` array.)

- [ ] **Step 4: Run the journal completeness test**

Run: `pnpm test tests/migration-journal-completeness.test.ts`
Expected: PASS — every `drizzle/*.sql` has a matching journal entry, indices contiguous, `when` monotonic.

- [ ] **Step 5: Commit**

```bash
git add drizzle/0015_invoices_lineitems_jsonb.sql drizzle/meta/_journal.json
git commit -m "drizzle(invoices): lineItems text → jsonb (0015)

Prepares for finance.createInvoice CIS validation. Defensive cast
falls back to '[]'::jsonb for empty/malformed rows so the migration
cannot fail mid-deploy on bad data."
```

---

### Task 3.2: Update finance.createInvoice schema (no validation yet)

**Files:**
- Modify: `server/routers/finance.ts:27-53` (createInvoice)

- [ ] **Step 1: Run existing finance tests to capture baseline**

Run: `pnpm test tests/finance-mappers.test.ts`
Expected: PASS — current passing count noted.

- [ ] **Step 2: Replace the opaque lineItems string with a structured array**

In `server/routers/finance.ts`, add the line-item schema near the top of the file (after imports):

```ts
const InvoiceLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unit: z.string(),
  unitRate: z.number(),
  isLabour: z.boolean().optional(),
});
```

Update the `createInvoice` input at line ~39:

```ts
      lineItems: z.string().optional(),
```

to:

```ts
      lineItems: z.array(InvoiceLineItemSchema).optional(),
```

The Drizzle write at line ~48 takes `...input`, which will now spread a structured array into the jsonb column. Drizzle's postgres-js driver serialises arrays into jsonb automatically; verify this by running typecheck.

- [ ] **Step 3: Run typecheck**

Run: `pnpm check`
Expected: PASS.

If `db.insert(dbInvoices).values({...input})` complains about jsonb shape, replace with explicit serialisation:

```ts
const rows = await db.insert(dbInvoices).values({
  ...input,
  lineItems: input.lineItems ?? null,
  createdById: ctx.user.id,
}).returning();
```

(Drizzle's PG dialect treats jsonb columns as native arrays/objects in TS; should not require manual JSON.stringify.)

- [ ] **Step 4: Run unit tests**

Run: `pnpm test`
Expected: PASS — no regressions. UI callers that currently pass `lineItems` as a string will start failing typecheck/zod, but the only such caller is `app/receipt-scanner.tsx`, which is updated in Phase 4.

If receipt-scanner blocks the typecheck pre-Phase-4, temporarily mark it: change line 380 region in `app/receipt-scanner.tsx` to `lineItems: undefined,` (don't send the field at all). Phase 4 wires it up properly. Note this in the commit body.

- [ ] **Step 5: Commit**

```bash
git add server/routers/finance.ts app/receipt-scanner.tsx
git commit -m "feat(finance): createInvoice accepts structured lineItems array

Schema flip from z.string().optional() to z.array(LineItemSchema).
Pairs with the 0015 jsonb migration. CIS validation lands in the
next commit; this commit is just the schema change.

Receipt-scanner temporarily stops sending lineItems (Phase 4 wires
it back up with the structured shape)."
```

---

### Task 3.3: Add CIS validation to finance.createInvoice

**Files:**
- Modify: `server/routers/finance.ts` (createInvoice mutation body)
- Create: `tests/integration/finance-invoice.integration.test.ts`

- [ ] **Step 1: Write failing integration tests**

Create `tests/integration/finance-invoice.integration.test.ts`:

```ts
/**
 * Integration test: finance.createInvoice CIS validation on real Postgres.
 *
 * Pins the load-bearing invariant that a caller-supplied
 * cisDeductionAmount must match what the server re-derives from the
 * structured line items. A regression that drops the validation would
 * let any value persist (UI bug, malicious client).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  setupTestPostgres,
  teardownTestPostgres,
  truncate,
  getTestDb,
} from "./setup";
import { users, companies } from "../../drizzle/schema";

let appRouter: typeof import("../../server/routers")["appRouter"];

beforeAll(async () => {
  await setupTestPostgres();
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "integration-test-secret";
  ({ appRouter } = await import("../../server/routers"));
}, 120_000);

afterAll(async () => {
  await teardownTestPostgres();
}, 30_000);

beforeEach(async () => {
  await truncate(["users", "companies", "company_users", "invoices"]);
});

async function seedUserAndCompany() {
  const db = getTestDb();
  const [c] = await db.insert(companies).values({
    name: "Acme", slug: "acme", plan: "starter", isActive: true,
  }).returning();
  const [u] = await db.insert(users).values({
    openId: "u1", name: "U1", email: "u1@x.com", role: "admin",
  }).returning();
  return { companyId: c.id, userId: u.id };
}

function ctx(userId: number, companyId: number) {
  return {
    user: {
      id: userId, openId: `oid-${userId}`, name: "U", email: "u@x.com",
      loginMethod: "manus", role: "admin" as const,
      passwordHash: null, totpSecret: null, totpVerifiedAt: null, pushPreferences: {},
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    companyMembership: { companyId, companyRole: "company_admin" as const },
    req: { protocol: "https", hostname: "localhost", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  } as any;
}

describe("finance.createInvoice — CIS validation on real PG", () => {
  it("accepts when caller-supplied cisDeductionAmount matches labour-derived value", async () => {
    const { userId, companyId } = await seedUserAndCompany();
    // 5×£200 labour + 1×£500 materials → labourSubtotal = 1000; CIS @ 20% = 200
    const result = await appRouter.createCaller(ctx(userId, companyId)).finance.createInvoice({
      companyId,
      invoiceNumber: "INV-1",
      lineItems: [
        { description: "Labour", quantity: 5, unit: "days", unitRate: 200, isLabour: true },
        { description: "Materials", quantity: 1, unit: "lot", unitRate: 500, isLabour: false },
      ],
      isCisJob: true,
      cisDeductionRate: 20,
      cisDeductionAmount: "200.00",
    });
    expect(result.id).toBeDefined();
  });

  it("rejects when caller-supplied cisDeductionAmount disagrees by more than £0.01", async () => {
    const { userId, companyId } = await seedUserAndCompany();
    // labour 1000; expected CIS @ 20% = 200; caller claims 300 (would over-deduct)
    await expect(
      appRouter.createCaller(ctx(userId, companyId)).finance.createInvoice({
        companyId,
        invoiceNumber: "INV-2",
        lineItems: [
          { description: "Labour", quantity: 5, unit: "days", unitRate: 200, isLabour: true },
          { description: "Materials", quantity: 1, unit: "lot", unitRate: 500, isLabour: false },
        ],
        isCisJob: true,
        cisDeductionRate: 20,
        cisDeductionAmount: "300.00",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("accepts when isCisJob is false (no validation)", async () => {
    const { userId, companyId } = await seedUserAndCompany();
    const result = await appRouter.createCaller(ctx(userId, companyId)).finance.createInvoice({
      companyId,
      invoiceNumber: "INV-3",
      lineItems: [{ description: "Anything", quantity: 1, unit: "sum", unitRate: 100 }],
      isCisJob: false,
      cisDeductionAmount: "999.00", // ignored
    });
    expect(result.id).toBeDefined();
  });

  it("accepts when lineItems is omitted (back-compat)", async () => {
    const { userId, companyId } = await seedUserAndCompany();
    const result = await appRouter.createCaller(ctx(userId, companyId)).finance.createInvoice({
      companyId,
      invoiceNumber: "INV-4",
      isCisJob: true,
      cisDeductionRate: 20,
      cisDeductionAmount: "200.00",
    });
    // No line items → no validation; persists what caller said.
    expect(result.id).toBeDefined();
  });

  it("£0.01 floating-point tolerance is within bounds (200.00 vs 200.01)", async () => {
    const { userId, companyId } = await seedUserAndCompany();
    const result = await appRouter.createCaller(ctx(userId, companyId)).finance.createInvoice({
      companyId,
      invoiceNumber: "INV-5",
      lineItems: [
        { description: "Labour", quantity: 5, unit: "days", unitRate: 200, isLabour: true },
      ],
      isCisJob: true,
      cisDeductionRate: 20,
      cisDeductionAmount: "200.01", // £0.01 over expected 200.00
    });
    expect(result.id).toBeDefined();
  });
});
```

- [ ] **Step 2: Run integration tests to verify they fail**

Run: `pnpm test:integration tests/integration/finance-invoice.integration.test.ts`
Expected: FAIL — the "rejects when …" test fails because no validation exists; the others should pass.

- [ ] **Step 3: Add the validation logic**

In `server/routers/finance.ts`:

Add to the imports at the top:

```ts
import { TRPCError } from "@trpc/server";
import { computeCisDeduction, labourSubtotal, type CisStatus } from "../_core/cis";
```

Add a small helper near the top of the file (above `financeRouter`):

```ts
/**
 * Adapter: the legacy createInvoice schema uses `cisDeductionRate: number`.
 * Map that to a CisStatus so the central helper can do the math.
 *   20 → 'registered_20', 30 → 'registered_30', 0 → 'gross_payment',
 *   anything else → 'none' (validation effectively skipped — caller error).
 */
function cisStatusFromRate(rate: number | undefined): CisStatus {
  if (rate === 20) return "registered_20";
  if (rate === 30) return "registered_30";
  if (rate === 0) return "gross_payment";
  return "none";
}
```

Update the `createInvoice.mutation` body (at `server/routers/finance.ts:41-52`):

```ts
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();

      // CIS integrity gate: when isCisJob is true AND structured lineItems are
      // provided, re-derive the deduction from the labour subtotal and reject
      // any caller-supplied amount that disagrees by more than £0.01. The
      // tolerance accommodates float rounding without permitting drift.
      if (input.isCisJob && input.lineItems && input.lineItems.length > 0) {
        const expected = computeCisDeduction({
          labourSubtotal: labourSubtotal(input.lineItems),
          status: cisStatusFromRate(input.cisDeductionRate),
        });
        const supplied = parseFloat(input.cisDeductionAmount ?? "0");
        if (Math.abs(expected - supplied) > 0.01) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `cisDeductionAmount £${supplied.toFixed(2)} disagrees with labour-subtotal-derived £${expected.toFixed(2)}`,
          });
        }
      }

      // Author is always the authenticated caller, never trusted from input.
      // See createInvoice prior commit for rationale.
      const rows = await db.insert(dbInvoices).values({
        ...input,
        createdById: ctx.user.id,
      }).returning();
      return rows[0];
    }),
```

- [ ] **Step 4: Run integration tests to verify they pass**

Run: `pnpm test:integration tests/integration/finance-invoice.integration.test.ts`
Expected: PASS — all 5 tests.

Run full integration suite to confirm no other test broke:

Run: `pnpm test:integration`
Expected: PASS.

Run unit suite + typecheck:

Run: `pnpm check && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routers/finance.ts tests/integration/finance-invoice.integration.test.ts
git commit -m "feat(finance): server-side CIS amount validation

When createInvoice receives structured lineItems and isCisJob:true,
re-derive cisDeductionAmount from the labour subtotal and reject
caller-supplied amounts that disagree by more than £0.01. Closes the
'persistence trusts caller' gap surfaced in the 2026-05-07 audit."
```

---

### Task 3.4: Push Phase 3 and watch CI + verify migration

**Files:** none (verification step)

- [ ] **Step 1: Verify locally + run integration suite**

```bash
pnpm check && pnpm test && pnpm test:integration
```

Expected: PASS.

- [ ] **Step 2: Push and poll**

```bash
git push origin main
```

Poll runs as in Task 1.7 Step 3. Expected: both `CI` (typecheck + tests + integration) and `Deploy to VPS` reach `success`.

- [ ] **Step 3: Verify migration ran on production**

The deploy.yml runs `drizzle-kit migrate` as part of the SSH deploy step. After deploy success, confirm the migration journal on prod reflects 0015:

```bash
# From this VPS (which IS the prod box):
sudo -u postgres psql cortexbuild_field -c \
  "SELECT idx, tag, when_ FROM __drizzle_migrations ORDER BY idx DESC LIMIT 3;"
```

Expected: `0015_invoices_lineitems_jsonb` is the most recent row.

- [ ] **Step 4: Verify the column type changed**

```bash
sudo -u postgres psql cortexbuild_field -c \
  "SELECT data_type FROM information_schema.columns WHERE table_name='invoices' AND column_name='lineItems';"
```

Expected: `jsonb`.

- [ ] **Step 5: Phase 3 complete — proceed to Phase 4**

No commit; verification gate.

---

## PHASE 4 — Receipt scanner

PR title: `feat(receipts): line-item labour flag + AI prompt`

### Task 4.1: Add 'receipt' analysisType to ai.ts

**Files:**
- Modify: `server/routers/ai.ts:174-264` (analysePhoto)

- [ ] **Step 1: Extend the analysisType enum**

In `server/routers/ai.ts`, line 178:

```ts
        analysisType: z.enum(['defect', 'safety', 'progress', 'material', 'general']),
```

becomes:

```ts
        analysisType: z.enum(['defect', 'safety', 'progress', 'material', 'general', 'receipt']),
```

- [ ] **Step 2: Add the receipt-extraction prompt**

In the same file, the `prompts: Record<string, string>` map starts around line 182. Add a new key after `general`:

```ts
          receipt: `You are a UK construction receipt-extraction expert. Extract structured data from this supplier receipt or invoice photo.

For each line item, tag whether it is LABOUR or MATERIALS for HMRC CIS purposes:
- isLabour: true  → site labour, supervision, fitting, installation, fabrication on site
- isLabour: false → materials, plant hire (no operator), fuel, manufactured components, consumable supplies
- Omit the field for ambiguous items (a human reviewer will set it).

Return a JSON object with this structure:
{
  "vendor": "supplier name",
  "vendorAddress": "address if visible",
  "invoiceNumber": "receipt/invoice number",
  "invoiceDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD or null",
  "lineItems": [
    { "description": "", "quantity": 1, "unitPrice": 0, "vatRate": 20, "total": 0, "isLabour": true }
  ],
  "subtotal": 0,
  "vatAmount": 0,
  "vatRate": 20,
  "cisDeduction": 0,
  "cisRate": 20,
  "total": 0,
  "currency": "GBP",
  "confidence": 0.0,
  "notes": "brief summary or extraction quality concerns"
}

If the receipt is illegible or not a receipt, return { "vendor": null, "lineItems": [], "confidence": 0.0, "notes": "explanation" } — the form falls back to manual entry.`,
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm check`
Expected: PASS — `analysisType` enum widened, prompt map covers all enum keys.

- [ ] **Step 4: Verify the existing analysePhoto tests still pass**

Run: `pnpm test`
Expected: PASS — no test changes; the new analysisType is additive.

(There's no unit test for the prompt content because it's a string. The receipt-extraction quality is verified via manual smoke in Task 4.3.)

- [ ] **Step 5: Commit**

```bash
git add server/routers/ai.ts
git commit -m "feat(ai): add 'receipt' analysisType with isLabour line tagging

The receipt scanner currently re-purposes 'general' (the construction-
site analysis prompt) for receipts, which is sub-optimal. New 'receipt'
analysisType has a dedicated extraction prompt that asks the model to
tag each line as labour or materials per HMRC CIS rules."
```

---

### Task 4.2: Switch receipt-scanner to 'receipt' analysisType + extract isLabour

**Files:**
- Modify: `app/receipt-scanner.tsx`

- [ ] **Step 1: Add isLabour to the LineItem interface and form parsing**

In `app/receipt-scanner.tsx`, find the LineItem interface (look in the imports or near top of file). It needs `isLabour?: boolean`. Find the type:

```bash
grep -n "interface LineItem\|type LineItem" app/receipt-scanner.tsx
```

Update the interface (or its definition file) to add:

```ts
  isLabour?: boolean;
```

In the same file, update `parseReceiptAnalysis` (line ~275-314). In the `lineItems.map(item => …)` block (lines 280-292), add `isLabour` extraction:

```ts
      ? items.map((item: any) => {
          const quantity = Number(item.quantity ?? 1) || 1;
          const unitPrice = Number(item.unitPrice ?? item.price ?? item.unit_price ?? item.total ?? 0) || 0;
          const total = Number(item.total ?? quantity * unitPrice) || 0;
          return {
            description: String(item.description ?? item.name ?? 'Line item'),
            quantity,
            unitPrice,
            vatRate: Number(item.vatRate ?? item.vat ?? 20) || 0,
            total,
            isOnSite: item.isOnSite ?? true,
            isLabour: typeof item.isLabour === 'boolean' ? item.isLabour : undefined,
          };
        })
```

- [ ] **Step 2: Switch to 'receipt' analysisType**

In the same file, line 354:

```ts
        analysisType: 'general',
```

becomes:

```ts
        analysisType: 'receipt',
```

- [ ] **Step 3: Re-instate lineItems in the createInvoice call (post-Phase 3 schema)**

In the same file, the `createInvoiceMutation.mutateAsync({...})` call (around lines 370-390). The schema now expects `lineItems` as a structured array. Replace the existing `lineItems` line in that payload:

```ts
        lineItems: form.lineItems.map(li => ({
          description: li.description,
          quantity: li.quantity,
          unit: 'each',
          unitRate: li.unitPrice,
          isLabour: li.isLabour,
        })),
```

(Adjust the `unit: 'each'` if the receipt LineItem already carries a unit field — confirm by reading the LineItem type.)

- [ ] **Step 4: Run typecheck**

Run: `pnpm check`
Expected: PASS — receipt-scanner now sends structured lineItems matching the post-Phase-3 schema.

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/receipt-scanner.tsx
git commit -m "feat(receipts): use 'receipt' analysisType + extract isLabour

Previously sent analysisType:'general' which uses the construction-site
analysis prompt. New 'receipt' prompt asks the LLM to tag each line as
labour vs materials. Pipes the tag through into the createInvoice
payload, restoring structured lineItems persistence."
```

---

### Task 4.3: Mismatch warning banner

**Files:**
- Modify: `app/receipt-scanner.tsx` (ExtractedForm)

- [ ] **Step 1: Compute the expected CIS deduction client-side**

In `app/receipt-scanner.tsx`, the `ExtractedForm` component starts around line 45. Inside the component body (after the `useState`s but before `recalcTotals`), add a derived value:

```ts
  // HMRC CIS sanity check: re-derive the deduction from the labour subtotal
  // and warn if it disagrees with the AI-extracted cisDeduction. Non-fatal —
  // receipts record what the EXTERNAL bill said, so the user has final say,
  // but a discrepancy worth flagging means either the AI mis-tagged a line
  // or the supplier's bill itself is wrong.
  const labourSubtotal = form.lineItems
    .filter(li => li.isLabour !== false)
    .reduce((sum, li) => sum + li.total, 0);
  const expectedCis = form.cisDeduction !== undefined && form.cisRate
    ? Math.round(labourSubtotal * (form.cisRate / 100) * 100) / 100
    : 0;
  const cisMismatch = form.cisDeduction !== undefined &&
    Math.abs((form.cisDeduction ?? 0) - expectedCis) > 0.01;
```

- [ ] **Step 2: Render the warning banner**

Find the existing confidence banner (line ~78-86). Below it, add:

```tsx
      {cisMismatch && (
        <View style={[styles.confBanner, { borderColor: '#F59E0B40', backgroundColor: '#F59E0B15' }]}>
          <View style={[styles.confDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={[styles.confText, { color: '#F59E0B' }]}>
            CIS check: AI extracted £{(form.cisDeduction ?? 0).toFixed(2)}, labour subtotal × {form.cisRate ?? 20}% = £{expectedCis.toFixed(2)}. Verify before submitting.
          </Text>
        </View>
      )}
```

- [ ] **Step 3: Add a labour toggle per line item**

Find the per-line-item editor in the same component. After the existing fields (description, quantity, price, vatRate), add a labour toggle inside each line-item card. The pattern mirrors Task 2.1's invoice-form toggle:

```tsx
      <TouchableOpacity
        style={[styles.toggleRow, { backgroundColor: colors.background, borderColor: colors.border, marginTop: 6 }]}
        onPress={() => {
          const items = [...form.lineItems];
          items[idx] = { ...items[idx], isLabour: items[idx].isLabour === false ? true : items[idx].isLabour === true ? undefined : false };
          recalcTotals(items);
        }}
        activeOpacity={0.8}
      >
        <View>
          <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Labour</Text>
          <Text style={[styles.toggleSub, { color: colors.muted }]}>
            {item.isLabour === true ? 'CIS applies' : item.isLabour === false ? 'Materials — no CIS' : 'Unknown (manual)'}
          </Text>
        </View>
      </TouchableOpacity>
```

(Three-state cycle: true → undefined → false → true. The undefined state is the "AI didn't tag this" case.)

- [ ] **Step 4: Verify typecheck + tests**

Run: `pnpm check`
Expected: PASS.

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/receipt-scanner.tsx
git commit -m "feat(receipts): per-line labour toggle + CIS mismatch warning

Three-state labour toggle (Labour / Materials / Unknown) per line item
plus a non-blocking warning banner when the AI-extracted cisDeduction
disagrees with the labour-subtotal-derived value by more than £0.01.
Receipts record what the external bill said — user has final say —
but a mismatch flags either AI mis-tagging or a wrong supplier bill."
```

---

### Task 4.4: Push Phase 4 and watch CI

**Files:** none (verification step)

- [ ] **Step 1: Verify locally**

Run: `pnpm check && pnpm test && pnpm test:integration`
Expected: PASS.

- [ ] **Step 2: Push and poll**

```bash
git push origin main
```

Poll runs as in Task 1.7 Step 3. Expected: both `CI` and `Deploy to VPS` reach `success`.

- [ ] **Step 3: Verify production deploy advanced**

```bash
echo -n "Prod SHA: "; curl -s https://field.cortexbuildpro.com/cortexbuild-field-deploy.txt
echo -n "/api/health: "; curl -s -o /dev/null -w "%{http_code}\n" https://field.cortexbuildpro.com/api/health
```

Expected: Prod SHA matches HEAD; HTTP 200.

- [ ] **Step 4: Manual smoke test for receipt scanner**

Open the app in dev client, scan a test receipt that has both labour and materials lines. Confirm:
- The AI returns `isLabour` per line (most lines tagged correctly; ambiguous lines undefined).
- The mismatch warning banner appears if the AI's `cisDeduction` disagrees with the labour-subtotal-derived value.
- Submitting the receipt persists the structured `lineItems` to the `invoices` table; verify with:

```bash
sudo -u postgres psql cortexbuild_field -c \
  "SELECT id, \"invoiceNumber\", jsonb_array_length(\"lineItems\") AS items_count, \"cisDeductionAmount\" FROM invoices ORDER BY id DESC LIMIT 3;"
```

Expected: latest row has `items_count > 0` and a non-null jsonb `lineItems`.

- [ ] **Step 5: Update SECURITY.md and project memory to mark CIS resolved**

Edit `SECURITY.md` "Other notable findings":

Replace:

```markdown
- **CIS labour/material split**: HMRC CIS deducts on labour only, not materials. Current CIS calc applies to the entire subtotal (labour + materials). Full compliance needs a per-line-item `isLabour` flag in the input schema. Tracked in commit 6544c9e's commit message.
```

with:

```markdown
- **CIS labour/material split** — RESOLVED (2026-05-07, commits in `core(cis): shared rate helper` chain). All four CIS calc sites (invoice generator, two timesheet generators, finance.createInvoice persistence) now route through `server/_core/cis.ts`. UI surfaces (invoice form, timesheet form, receipt scanner) expose per-line-item `isLabour` and per-document `cisStatus` controls. Persistence enforces server-side validation. Spec: `docs/superpowers/specs/2026-05-07-cis-labour-materials-split-design.md`.
```

Edit `/root/.claude/projects/-root/memory/project_cortexbuildpro.md`. Replace:

```markdown
- CIS labour/materials split: HMRC deducts only on labour, current code deducts on full subtotal. Needs `isLabour` per-line-item flag.
```

with:

```markdown
- ~~CIS labour/materials split~~ — resolved 2026-05-07: full sweep landed (helper + 4 server refactors + UI toggles + persistence validation + receipt extraction). All three "Other notable findings" from the 2026-05-05 audit now resolved.
```

Commit + push:

```bash
git add SECURITY.md
git commit -m "docs(security): mark CIS labour/materials split as resolved

All three 'Other notable findings' from the 2026-05-05 audit are now
resolved (pre-commit hook, icon bloat, CIS split).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

## Self-Review

### Spec coverage

Mapping each spec section/requirement to a task:

- **Architecture (helper module)** → Tasks 1.1, 1.2, 1.3 ✓
- **Server changes — generateInvoice refactor** → Task 1.4 ✓
- **Server changes — generateTimesheet** → Task 1.5 ✓
- **Server changes — generateTimesheetSignedOff** → Task 1.6 ✓
- **Server changes — finance.createInvoice schema + validation** → Tasks 3.2, 3.3 ✓
- **Schema migration (text → jsonb + journal entry)** → Task 3.1 ✓
- **UI — invoice form isLabour toggle** → Task 2.1 ✓
- **UI — timesheet form cisStatus picker** → Task 2.2 ✓
- **UI — receipt scanner per-line + mismatch warning** → Tasks 4.2, 4.3 ✓
- **Testing — cis-helper.test.ts (10 cases target)** → Tasks 1.1–1.3 (17 cases delivered) ✓
- **Testing — ai-doc-generators.test.ts timesheet branches** → Tasks 1.5, 1.6 (6 new tests) ✓
- **Testing — finance-invoice integration test** → Task 3.3 (5 cases) ✓
- **Rollout — 4 phased PRs** → Phase 1 (Tasks 1.1–1.7), Phase 2 (Tasks 2.1–2.3), Phase 3 (Tasks 3.1–3.4), Phase 4 (Tasks 4.1–4.4) ✓
- **HMRC rules appendix** → in spec doc, no plan task needed ✓

No gaps.

### Placeholder scan

- "TBD" / "TODO" / "implement later" → none found in plan.
- "Add appropriate error handling" / "handle edge cases" → none found; specific behaviour described per task.
- "Write tests for the above" without code → none found; every test step has a code block.
- "Similar to Task N" without repeating code → Task 1.6 references Task 1.5 but does include the full code blocks for both schema and calc changes. ✓
- Steps describing what without showing how → none found; every code step has the actual code.
- References to undefined types/functions → checked: every referenced type (`CisStatus`, `InvoiceLineItemSchema`, `LineItem`) and function (`computeCisDeduction`, `labourSubtotal`, `cisRateForStatus`, `cisStatusFromRate`) is defined in an earlier task or imported from a confirmed location.

### Type consistency

- `CisStatus` defined in Task 1.1, used in Tasks 1.5, 1.6, 3.3.
- `cisRateForStatus` defined Task 1.1, used Tasks 1.5, 1.6.
- `labourSubtotal` defined Task 1.2, used Task 1.4 (via helper), Task 3.3.
- `computeCisDeduction` defined Task 1.3, used Tasks 1.4, 1.5, 1.6, 3.3.
- `InvoiceLineItemSchema` defined Task 3.2, used Task 3.3.
- `cisStatusFromRate` defined Task 3.3 (helper for legacy rate adapter).
- `cisStatus` form field added in Task 2.2 maps to the same enum the server expects (Tasks 1.5, 1.6).
- Receipt LineItem `isLabour?: boolean` added in Task 4.2; Task 4.3 reads it consistently.

All consistent.

---

## Plan complete

Plan saved to `docs/superpowers/plans/2026-05-07-cis-labour-materials-split.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task (or per phase), review between tasks, fast iteration. Good for a 4-phase plan because each phase has natural review checkpoints (push + watch CI).

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

Which approach?
