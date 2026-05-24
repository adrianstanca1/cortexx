# Phase 3.4 — RFI workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing 2-state RFI flow (`open`/`answered`) with a 4-state workflow (`submitted → answered → approved/rejected`), email the right parties at every transition, and surface a "pending review" queue for managers and admins. Spec at `docs/superpowers/specs/2026-05-05-rfi-workflow-design.md`.

**Architecture:** Pure helpers for the state machine, role checks, and email templates so the testable logic lives outside the router. New procedures `rfis.answer / approve / reject` chain `companyScopedProcedure` (tenant gate) + `requireCompanyRole` (role gate) + `assertTransition` (state-machine gate). `rfis.respond` stays as a 1-line alias for in-flight mobile clients. UI on `app/rfis.tsx` adds a status pill, a manager-only "Pending review" tab, and contextual Answer/Approve/Reject buttons (Reject sheet has a forced reason input).

**Tech stack:** TypeScript, Drizzle ORM (Postgres), tRPC v11, Vitest, React Native (Expo, NativeWind), `@testing-library/react` (web RTL alias).

---

## File structure

| File | Responsibility |
|---|---|
| `server/_core/rfi-state-machine.ts` (new) | Pure: `RfiStatus`, `canTransition`, `assertTransition` |
| `server/_core/role-check.ts` (new) | Pure: `requireCompanyRole(membership, min)` throws FORBIDDEN |
| `server/_core/email-templates/rfi.ts` (new) | Pure: 4 email-builder functions |
| `drizzle/0011_rfis_workflow.sql` (new) | Migration: status default, answeredById/approvedById/rejectedById/at, rejectedReason, partial index |
| `drizzle/meta/_journal.json` (modify) | Append idx-8 entry for 0011 |
| `drizzle/schema.ts` (modify) | Add new RFI columns to `rfis` table definition |
| `server/routers/index.ts` (modify, around line 1947) | Add `answer`, `approve`, `reject`, alias `respond`; retarget `create` recipients |
| `lib/rfi-actions.ts` (new) | Pure: `visibleRfiActions(status, companyRole)` |
| `components/rfi-status-pill.tsx` (new) | Presentational: 4-colour pill |
| `app/rfis.tsx` (modify) | Pending-review tab; relabel Respond→Answer; Approve + Reject sheets |
| `tests/_core/rfi-state-machine.test.ts` (new) | 16-cell transition matrix |
| `tests/_core/role-check.test.ts` (new) | role × min matrix + null membership |
| `tests/_core/email-templates/rfi.test.ts` (new) | 4 templates × subject/body assertions |
| `tests/rfis-router.test.ts` (new) | answer/approve/reject + alias behaviour, mocked DB |
| `tests/rfi-actions.test.ts` (new) | visibility matrix |
| `tests/rfi-status-pill.component.test.tsx` (new) | 4-status colour rendering |
| `tests/integration/rfis-workflow.integration.test.ts` (new) | Full lifecycle on real PG; cross-tenant FORBIDDEN |

Each task below produces a self-contained chunk with its own test, implementation, verification, and commit.

---

### Task 1: State-machine helper

**Files:**
- Create: `server/_core/rfi-state-machine.ts`
- Test: `tests/_core/rfi-state-machine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/_core/rfi-state-machine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  canTransition,
  assertTransition,
  type RfiStatus,
} from "../../server/_core/rfi-state-machine";

const STATES: RfiStatus[] = ["submitted", "answered", "approved", "rejected"];

const VALID = new Set([
  "submitted->answered",
  "answered->approved",
  "answered->rejected",
]);

describe("rfi-state-machine", () => {
  it("allows the four documented transitions and rejects the rest", () => {
    for (const from of STATES) {
      for (const to of STATES) {
        const expected = VALID.has(`${from}->${to}`);
        expect(canTransition(from, to)).toBe(expected);
      }
    }
  });

  it("treats approved and rejected as terminal — no outgoing transitions", () => {
    for (const to of STATES) {
      expect(canTransition("approved", to)).toBe(false);
      expect(canTransition("rejected", to)).toBe(false);
    }
  });

  it("assertTransition is a no-op on valid transitions", () => {
    expect(() => assertTransition("submitted", "answered")).not.toThrow();
    expect(() => assertTransition("answered", "approved")).not.toThrow();
    expect(() => assertTransition("answered", "rejected")).not.toThrow();
  });

  it("assertTransition throws TRPCError BAD_REQUEST on invalid transitions", async () => {
    try {
      assertTransition("submitted", "approved");
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("BAD_REQUEST");
      expect(err.message).toMatch(/submitted.*approved|cannot transition/i);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/_core/rfi-state-machine.test.ts`
Expected: FAIL with `Cannot find module '../../server/_core/rfi-state-machine'`.

- [ ] **Step 3: Write minimal implementation**

Create `server/_core/rfi-state-machine.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/_core/rfi-state-machine.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add server/_core/rfi-state-machine.ts tests/_core/rfi-state-machine.test.ts
git commit -m "feat(rfi): state machine for submitted → answered → approved/rejected"
```

---

### Task 2: Role-check helper

**Files:**
- Create: `server/_core/role-check.ts`
- Test: `tests/_core/role-check.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/_core/role-check.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { requireCompanyRole } from "../../server/_core/role-check";
import type { UserRole } from "../../lib/company-context";

const ROLES: UserRole[] = [
  "viewer",
  "worker",
  "supervisor",
  "manager",
  "company_admin",
  "super_admin",
];

describe("requireCompanyRole", () => {
  it("permits when the membership role meets or exceeds the minimum", () => {
    for (let i = 0; i < ROLES.length; i++) {
      for (let j = 0; j <= i; j++) {
        const userRole = ROLES[i];
        const min = ROLES[j];
        expect(
          () => requireCompanyRole({ companyRole: userRole }, min),
        ).not.toThrow();
      }
    }
  });

  it("throws FORBIDDEN when the membership role is below the minimum", () => {
    for (let i = 0; i < ROLES.length; i++) {
      for (let j = i + 1; j < ROLES.length; j++) {
        const userRole = ROLES[i];
        const min = ROLES[j];
        try {
          requireCompanyRole({ companyRole: userRole }, min);
          expect.fail(`should have thrown for ${userRole} < ${min}`);
        } catch (err: any) {
          expect(err.code).toBe("FORBIDDEN");
        }
      }
    }
  });

  it("throws FORBIDDEN when membership is null (e.g. platform-admin bypass on tenant procedures)", () => {
    // companyScopedProcedure leaves companyMembership=null for platform
    // admins. Role-gated transitions on tenant data should still require
    // an explicit company role — platform admins acting in a tenant
    // context need a real seat at the table.
    try {
      requireCompanyRole(null, "manager");
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("FORBIDDEN");
    }
  });

  it("throws FORBIDDEN when companyRole is an unknown string (defensive)", () => {
    try {
      requireCompanyRole({ companyRole: "garbage" }, "viewer");
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("FORBIDDEN");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/_core/role-check.test.ts`
Expected: FAIL — `Cannot find module '../../server/_core/role-check'`.

- [ ] **Step 3: Write minimal implementation**

Create `server/_core/role-check.ts`:

```ts
/**
 * Phase 3.4 — company-role gate.
 *
 * Layered on top of `companyScopedProcedure` (which gates by tenant
 * membership). This adds a HIERARCHY check: "the caller's companyRole
 * must be at least <min>". The hierarchy is the same one rendered in
 * the UI by `lib/company-context.tsx#hasPermission`, just enforced
 * server-side.
 *
 * Platform admins (companyMembership === null at the procedure level)
 * are NOT auto-bypassed here — admin tooling that needs to mutate
 * tenant data must do so through a real seat. This avoids a class of
 * "platform admin acting as someone they aren't" bugs.
 */
import { TRPCError } from "@trpc/server";
import { ROLE_LEVELS, type UserRole } from "../../lib/company-context";

export function requireCompanyRole(
  membership: { companyRole: string } | null,
  min: UserRole,
): void {
  const role = membership?.companyRole as UserRole | undefined;
  const userLevel = role ? ROLE_LEVELS[role] : undefined;
  const minLevel = ROLE_LEVELS[min];
  if (userLevel === undefined || userLevel < minLevel) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `This action requires company role "${min}" or higher.`,
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/_core/role-check.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add server/_core/role-check.ts tests/_core/role-check.test.ts
git commit -m "feat(rfi): requireCompanyRole helper for company-role gates"
```

---

### Task 3: Email templates

**Files:**
- Create: `server/_core/email-templates/rfi.ts`
- Test: `tests/_core/email-templates/rfi.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/_core/email-templates/rfi.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  rfiSubmittedEmail,
  rfiAnsweredEmail,
  rfiApprovedEmail,
  rfiRejectedEmail,
} from "../../../server/_core/email-templates/rfi";

const baseRfi = {
  id: 42,
  number: "RFI-0042",
  subject: "Beam spec mismatch on grid B-7",
};
const baseProject = { name: "Riverside Apartments" };
const recipient = { name: "Alex" };
const raiser = { name: "Sam" };
const answerer = { name: "Jamie" };

describe("rfi email templates", () => {
  it("rfiSubmittedEmail addresses the recipient and names the project + RFI number", () => {
    const e = rfiSubmittedEmail({ rfi: baseRfi, raiser, project: baseProject, recipient });
    expect(e.to).toBe(undefined as any); // template builders don't set `to` — caller does
    expect(e.subject).toContain("RFI-0042");
    expect(e.subject).toContain("Riverside Apartments");
    expect(e.text).toContain("Alex");
    expect(e.text).toContain("Sam");
    expect(e.text).toContain("Beam spec mismatch on grid B-7");
    expect(e.text).toContain("/rfis?id=42");
  });

  it("rfiAnsweredEmail names the answerer and the original subject", () => {
    const e = rfiAnsweredEmail({
      rfi: baseRfi, answerer, raiser, project: baseProject, recipient,
    });
    expect(e.subject).toContain("Answered");
    expect(e.subject).toContain("RFI-0042");
    expect(e.text).toContain("Jamie");
    expect(e.text).toContain("/rfis?id=42");
  });

  it("rfiApprovedEmail names the approver", () => {
    const e = rfiApprovedEmail({
      rfi: baseRfi, approver: { name: "Dana" }, project: baseProject, recipient,
    });
    expect(e.subject).toContain("Approved");
    expect(e.subject).toContain("Riverside Apartments");
    expect(e.text).toContain("Dana");
  });

  it("rfiRejectedEmail surfaces the rejection reason and rejecter", () => {
    const e = rfiRejectedEmail({
      rfi: { ...baseRfi, rejectedReason: "Insufficient detail on load case" },
      rejecter: { name: "Dana" },
      project: baseProject,
      recipient,
    });
    expect(e.subject).toContain("Rejected");
    expect(e.text).toContain("Dana");
    expect(e.text).toContain("Insufficient detail on load case");
  });

  it("each template provides BOTH text and html with the same key information", () => {
    const e = rfiRejectedEmail({
      rfi: { ...baseRfi, rejectedReason: "Need updated drawings" },
      rejecter: { name: "Dana" },
      project: baseProject,
      recipient,
    });
    expect(e.text).toContain("Need updated drawings");
    expect(e.html).toBeDefined();
    expect(e.html!).toContain("Need updated drawings");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/_core/email-templates/rfi.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `server/_core/email-templates/rfi.ts`:

```ts
/**
 * Phase 3.4 — RFI lifecycle email templates.
 *
 * Pure functions returning EmailParams-without-`to`. The router fills
 * `to` per recipient. Matches the pattern in `pin-email.ts`.
 */

const APP_BASE_URL = process.env.APP_BASE_URL ?? "https://field.cortexbuildpro.com";

type RfiCore = {
  id: number;
  number: string | null;
  subject: string;
};
type RfiWithReason = RfiCore & { rejectedReason: string };
type Named = { name: string | null };
type Project = { name: string };

type Body = { subject: string; text: string; html: string };

function deepLink(rfiId: number) {
  return `${APP_BASE_URL}/rfis?id=${rfiId}`;
}

function htmlWrap(bodyText: string, ctaUrl: string): string {
  // Simple deterministic HTML — same shape as pin-email.ts. No engine.
  const paragraphs = bodyText
    .split("\n\n")
    .map(p => `<p style="margin:0 0 12px 0;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;">${paragraphs}<p style="margin:24px 0 0 0;"><a href="${ctaUrl}" style="display:inline-block;padding:10px 16px;background:#1E3A5F;color:#fff;text-decoration:none;border-radius:8px;">Open in CortexBuild Field</a></p></div>`;
}

export function rfiSubmittedEmail(args: {
  rfi: RfiCore; raiser: Named; project: Project; recipient: Named;
}): Body {
  const { rfi, raiser, project, recipient } = args;
  const subject = `[${rfi.number ?? "RFI"}] New RFI on ${project.name}: ${rfi.subject}`;
  const text =
    `Hi ${recipient.name ?? "there"},\n\n` +
    `${raiser.name ?? "A team member"} has raised RFI ${rfi.number ?? ""} on ${project.name}.\n\n` +
    `Subject: ${rfi.subject}\n\n` +
    `Open in CortexBuild Field: ${deepLink(rfi.id)}\n\n` +
    `— CortexBuild Field`;
  return { subject, text, html: htmlWrap(text, deepLink(rfi.id)) };
}

export function rfiAnsweredEmail(args: {
  rfi: RfiCore; answerer: Named; raiser: Named; project: Project; recipient: Named;
}): Body {
  const { rfi, answerer, project, recipient } = args;
  const subject = `[${rfi.number ?? "RFI"}] Answered: ${rfi.subject}`;
  const text =
    `Hi ${recipient.name ?? "there"},\n\n` +
    `${answerer.name ?? "A team member"} has answered RFI ${rfi.number ?? ""} on ${project.name}.\n\n` +
    `Subject: ${rfi.subject}\n\n` +
    `Open in CortexBuild Field: ${deepLink(rfi.id)}\n\n` +
    `— CortexBuild Field`;
  return { subject, text, html: htmlWrap(text, deepLink(rfi.id)) };
}

export function rfiApprovedEmail(args: {
  rfi: RfiCore; approver: Named; project: Project; recipient: Named;
}): Body {
  const { rfi, approver, project, recipient } = args;
  const subject = `[${rfi.number ?? "RFI"}] Approved on ${project.name}`;
  const text =
    `Hi ${recipient.name ?? "there"},\n\n` +
    `${approver.name ?? "A reviewer"} has approved RFI ${rfi.number ?? ""} on ${project.name}.\n\n` +
    `Subject: ${rfi.subject}\n\n` +
    `Open in CortexBuild Field: ${deepLink(rfi.id)}\n\n` +
    `— CortexBuild Field`;
  return { subject, text, html: htmlWrap(text, deepLink(rfi.id)) };
}

export function rfiRejectedEmail(args: {
  rfi: RfiWithReason; rejecter: Named; project: Project; recipient: Named;
}): Body {
  const { rfi, rejecter, project, recipient } = args;
  const subject = `[${rfi.number ?? "RFI"}] Rejected: needs revision`;
  const text =
    `Hi ${recipient.name ?? "there"},\n\n` +
    `${rejecter.name ?? "A reviewer"} has rejected RFI ${rfi.number ?? ""} on ${project.name}.\n\n` +
    `Subject: ${rfi.subject}\n` +
    `Reason: ${rfi.rejectedReason}\n\n` +
    `Open in CortexBuild Field: ${deepLink(rfi.id)}\n\n` +
    `— CortexBuild Field`;
  return { subject, text, html: htmlWrap(text, deepLink(rfi.id)) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/_core/email-templates/rfi.test.ts`
Expected: PASS — 5 tests. The first test asserts `e.to === undefined` because builders return `Body` without `to`; if you find this off-putting, leave it as is — it documents the contract.

- [ ] **Step 5: Commit**

```bash
git add server/_core/email-templates/rfi.ts tests/_core/email-templates/rfi.test.ts
git commit -m "feat(rfi): email templates for submitted / answered / approved / rejected"
```

---

### Task 4: Schema migration + journal entry

**Files:**
- Create: `drizzle/0011_rfis_workflow.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `drizzle/schema.ts` (around line 484)

- [ ] **Step 1: Write the migration SQL**

Create `drizzle/0011_rfis_workflow.sql`:

```sql
-- ============================================================================
-- 0011_rfis_workflow.sql
-- ============================================================================
-- Phase 3.4 of docs/ROADMAP.md — RFI approval workflow.
-- Backfills existing rows from the legacy 'open' status and adds the
-- columns the new lifecycle needs. Idempotent (IF NOT EXISTS / no-op
-- ALTER).
-- ============================================================================

ALTER TABLE rfis ALTER COLUMN status TYPE varchar(20);
--> statement-breakpoint
ALTER TABLE rfis ALTER COLUMN status SET DEFAULT 'submitted';
--> statement-breakpoint

UPDATE rfis SET status = 'submitted' WHERE status = 'open';
--> statement-breakpoint

ALTER TABLE rfis ADD COLUMN IF NOT EXISTS "answeredById"   integer;
--> statement-breakpoint
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS "approvedById"   integer;
--> statement-breakpoint
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS "approvedAt"     timestamp;
--> statement-breakpoint
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS "rejectedById"   integer;
--> statement-breakpoint
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS "rejectedAt"     timestamp;
--> statement-breakpoint
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS "rejectedReason" text;
--> statement-breakpoint

-- Partial index for the manager "pending review" queue: only the rows
-- still awaiting approval get indexed, keeping it tiny + write-cheap.
CREATE INDEX IF NOT EXISTS idx_rfis_pending_review
  ON rfis ("companyId", status)
  WHERE status = 'answered';
```

- [ ] **Step 2: Add journal entry**

Open `drizzle/meta/_journal.json`. Append a new entry inside `entries` after the `0010_users_totp` entry (`when` should be roughly current epoch-ms — pick a value strictly greater than `1777953750000`):

```json
,
{
  "idx": 8,
  "version": "7",
  "when": 1778000000000,
  "tag": "0011_rfis_workflow",
  "breakpoints": true
}
```

(Replace `1778000000000` with `Date.now()` at edit time; the only constraint is `> 1777953750000`.)

- [ ] **Step 3: Update schema.ts**

In `drizzle/schema.ts`, replace the `rfis` table definition (current lines around 484–502) with:

```ts
export const rfis = pgTable('rfis', {
  id:              serial('id').primaryKey(),
  companyId:       integer('companyId').notNull(),
  projectId:       integer('projectId').notNull(),
  raisedById:      integer('raisedById').notNull(),
  number:          varchar('number', { length: 50 }),
  subject:         varchar('subject', { length: 255 }).notNull(),
  question:        text('question').notNull(),
  response:        text('response'),
  status:          varchar('status', { length: 20 }).default('submitted'),
  priority:        varchar('priority', { length: 20 }).default('normal'),
  dueDate:         varchar('dueDate', { length: 20 }),
  attachmentUrls:  text('attachmentUrls').default('[]'),
  // Phase 3.4 — workflow tracking (raisedById covers the originator)
  answeredById:    integer('answeredById'),
  respondedAt:     timestamp('respondedAt'),
  approvedById:    integer('approvedById'),
  approvedAt:      timestamp('approvedAt'),
  rejectedById:    integer('rejectedById'),
  rejectedAt:      timestamp('rejectedAt'),
  rejectedReason:  text('rejectedReason'),
  createdAt:       timestamp('createdAt').defaultNow().notNull(),
  updatedAt:       timestamp('updatedAt').defaultNow().notNull(),
});
export type Rfi = typeof rfis.$inferSelect;
export type InsertRfi = typeof rfis.$inferInsert;
```

(Keep `respondedAt` — it already exists in the legacy schema and the `answer` procedure will continue to set it for back-compat with read paths.)

- [ ] **Step 4: Verify migration journal regression test passes**

Run: `pnpm vitest run tests/migration-journal-completeness.test.ts`
Expected: PASS — 4 tests. (If it fails on "every Postgres SQL is registered", the journal entry from Step 2 is missing or has the wrong `tag`.)

- [ ] **Step 5: Verify integration tests boot the new migration cleanly**

Run: `pnpm test:integration`
Expected: PASS — the existing 12 integration tests should still pass on top of the new migration.

- [ ] **Step 6: Commit**

```bash
git add drizzle/0011_rfis_workflow.sql drizzle/meta/_journal.json drizzle/schema.ts
git commit -m "feat(rfi): 0011 migration — workflow columns + pending-review index"
```

---

### Task 5: `rfis.answer` procedure (with deprecated `respond` alias + state-machine guard)

**Files:**
- Modify: `server/routers/index.ts` (the `rfis: router({ ... })` block, around line 1947)
- Test: `tests/rfis-router.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/rfis-router.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../server/_core/context";

const sendEmail = vi.fn(async () => {});
vi.mock("../server/_core/email", () => ({
  sendEmail,
  // Keep the EmailParams type re-exportable; the consumer file doesn't import it.
}));

// Minimal in-memory DB stub keyed by table reference, mimicking what the
// rfis router actually calls. Using an object to thread mutable state
// across mock factory + test bodies.
const DB_STATE: any = {
  rfis: [] as any[],
  projects: [] as any[],
  users: [] as any[],
  companyUsers: [] as any[],
};

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => makeFakeDb()),
}));

// Avoid auditing noise in router tests.
process.env.AUDIT_DISABLED = "1";

function makeFakeDb() {
  // The router calls db.select().from(<table>).where(...).limit(?)
  // and db.update(...).set(...).where(...). This stub implements just
  // enough chained methods to satisfy each call site invoked by `answer`,
  // `approve`, `reject` and `respond` alias.
  function chain(rows: any[]) {
    const api: any = {
      where: () => api,
      limit: () => Promise.resolve(rows),
      orderBy: () => Promise.resolve(rows),
      then: (resolve: any) => resolve(rows),
    };
    return api;
  }
  return {
    select: () => ({
      from: (table: any) => chain(rowsFor(table)),
    }),
    update: (table: any) => ({
      set: (patch: any) => ({
        where: () => {
          // Mutate the matching row in place so subsequent reads see it.
          const rows = rowsFor(table);
          if (rows[0]) Object.assign(rows[0], patch);
          return Promise.resolve();
        },
      }),
    }),
    insert: (table: any) => ({
      values: (vals: any) => ({
        returning: () => {
          const row = { id: rowsFor(table).length + 1, ...vals };
          rowsFor(table).push(row);
          return Promise.resolve([row]);
        },
      }),
    }),
  };
}

function rowsFor(table: any): any[] {
  // Disambiguate by .toString() — Drizzle table objects expose a name.
  const name = String(table?.[Symbol.for("drizzle:Name")] ?? "").toLowerCase();
  if (name.includes("rfi")) return DB_STATE.rfis;
  if (name.includes("project")) return DB_STATE.projects;
  if (name.includes("companyuser")) return DB_STATE.companyUsers;
  if (name.includes("user")) return DB_STATE.users;
  return [];
}

const { appRouter } = await import("../server/routers");

function ctx(opts: { role?: "user" | "admin"; companyRole?: string; userId?: number; companyId?: number } = {}): TrpcContext {
  const userId = opts.userId ?? 1;
  return {
    user: {
      id: userId, openId: `u-${userId}`, name: `User ${userId}`,
      email: `u${userId}@example.com`, loginMethod: "manus",
      role: opts.role ?? "user",
      passwordHash: null, totpSecret: null, totpVerifiedAt: null,
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    companyMembership: opts.companyRole
      ? { companyRole: opts.companyRole, isActive: true } as any
      : null,
    req: { protocol: "https", hostname: "localhost", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  } as any;
}

beforeEach(() => {
  DB_STATE.rfis.length = 0;
  DB_STATE.projects.length = 0;
  DB_STATE.users.length = 0;
  DB_STATE.companyUsers.length = 0;
  sendEmail.mockClear();
});

afterEach(() => vi.restoreAllMocks());

describe("rfis.answer", () => {
  it("requires manager+ — throws FORBIDDEN for worker", async () => {
    DB_STATE.rfis.push({ id: 1, companyId: 1, projectId: 1, status: "submitted", subject: "x", raisedById: 9, number: "RFI-0001" });
    const caller = appRouter.createCaller(ctx({ companyRole: "worker" }));
    await expect(
      caller.rfis.answer({ id: 1, companyId: 1, response: "ok" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("transitions submitted → answered, sets respondedAt + answeredById, emails the raiser", async () => {
    DB_STATE.rfis.push({ id: 1, companyId: 1, projectId: 1, status: "submitted", subject: "x", raisedById: 9, number: "RFI-0001" });
    DB_STATE.users.push({ id: 9, name: "Sam", email: "sam@example.com" });
    DB_STATE.projects.push({ id: 1, companyId: 1, name: "P1" });
    const caller = appRouter.createCaller(ctx({ companyRole: "manager", userId: 5 }));

    await caller.rfis.answer({ id: 1, companyId: 1, response: "the answer" });

    expect(DB_STATE.rfis[0].status).toBe("answered");
    expect(DB_STATE.rfis[0].answeredById).toBe(5);
    expect(DB_STATE.rfis[0].response).toBe("the answer");
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "sam@example.com" }));
  });

  it("rejects an already-answered RFI with BAD_REQUEST (state-machine guard)", async () => {
    DB_STATE.rfis.push({ id: 1, companyId: 1, status: "answered", subject: "x", raisedById: 9, projectId: 1, number: "RFI-0001" });
    const caller = appRouter.createCaller(ctx({ companyRole: "manager" }));
    await expect(
      caller.rfis.answer({ id: 1, companyId: 1, response: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("rfis.respond (deprecated alias)", () => {
  it("delegates to answer — same DB writes, same email", async () => {
    DB_STATE.rfis.push({ id: 1, companyId: 1, projectId: 1, status: "submitted", subject: "x", raisedById: 9, number: "RFI-0001" });
    DB_STATE.users.push({ id: 9, name: "Sam", email: "sam@example.com" });
    DB_STATE.projects.push({ id: 1, companyId: 1, name: "P1" });
    const caller = appRouter.createCaller(ctx({ companyRole: "manager", userId: 5 }));

    await caller.rfis.respond({ id: 1, companyId: 1, response: "the answer" });

    expect(DB_STATE.rfis[0].status).toBe("answered");
    expect(DB_STATE.rfis[0].answeredById).toBe(5);
    expect(sendEmail).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/rfis-router.test.ts`
Expected: FAIL — `caller.rfis.answer is not a function`.

- [ ] **Step 3: Implement `answer` and migrate `respond` to alias**

In `server/routers/index.ts`, locate the `respond` procedure (around line 1988–1998) inside the `rfis: router({ ... })` block. Replace just that procedure with the new pair.

Find:

```ts
    respond: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number(), response: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        await db.update(dbRfis).set({
          response: input.response, status: 'answered',
          respondedAt: new Date(), updatedAt: new Date(),
        }).where(and(eq(dbRfis.id, input.id), eq(dbRfis.companyId, input.companyId)));
        return { success: true };
      }),
```

Replace with:

```ts
    answer: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number(), response: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        requireCompanyRole(ctx.companyMembership, "manager");
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');

        const [rfi] = await db.select().from(dbRfis)
          .where(and(eq(dbRfis.id, input.id), eq(dbRfis.companyId, input.companyId)))
          .limit(1);
        if (!rfi) throw new TRPCError({ code: "NOT_FOUND", message: "RFI not found." });
        assertTransition(rfi.status as RfiStatus, "answered");

        await db.update(dbRfis).set({
          response: input.response,
          status: "answered",
          respondedAt: new Date(),
          answeredById: ctx.user.id,
          updatedAt: new Date(),
        }).where(and(eq(dbRfis.id, input.id), eq(dbRfis.companyId, input.companyId)));

        // Fire-and-forget email to the raiser. We re-read via the DB to
        // get the up-to-date row + project name + raiser email/name in
        // one place — readability beats a tighter join here.
        const [raiser] = await db.select().from(dbUsers).where(eq(dbUsers.id, rfi.raisedById)).limit(1);
        const [project] = await db.select().from(dbProjects).where(eq(dbProjects.id, rfi.projectId)).limit(1);
        if (raiser?.email) {
          void sendEmail({
            to: raiser.email,
            ...rfiAnsweredEmail({
              rfi: { id: rfi.id, number: rfi.number, subject: rfi.subject },
              answerer: { name: ctx.user.name },
              raiser: { name: raiser.name },
              project: { name: project?.name ?? "" },
              recipient: { name: raiser.name },
            }),
          }).catch(err => console.error("[rfis.answer] email send failed:", err));
        }

        return { success: true };
      }),

    /**
     * @deprecated Phase 3.4 — alias of `answer`. In-flight mobile
     * clients still call `respond`; this delegate keeps them working
     * until the next EAS update lands. Drop in a follow-up commit
     * once telemetry shows no callers.
     */
    respond: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number(), response: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const caller = appRouter.createCaller(ctx as any);
        return caller.rfis.answer(input);
      }),
```

At the top of the file (around line 46 where `rfis as dbRfis` is imported), confirm these imports exist; add what's missing:

```ts
import { requireCompanyRole } from "../_core/role-check";
import { assertTransition, type RfiStatus } from "../_core/rfi-state-machine";
import { sendEmail } from "../_core/email";
import { rfiAnsweredEmail } from "../_core/email-templates/rfi";
import { TRPCError } from "@trpc/server";
import { users as dbUsers, projects as dbProjects } from "../../drizzle/schema";
```

(Some of these — `TRPCError`, `dbUsers`, `dbProjects` — may already exist. If so, leave the existing import and only add the missing ones.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/rfis-router.test.ts`
Expected: PASS — 4 tests under "rfis.answer" and "rfis.respond".

- [ ] **Step 5: Type-check**

Run: `pnpm check`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add server/routers/index.ts tests/rfis-router.test.ts
git commit -m "feat(rfi): rfis.answer with state-machine + role gate; respond as alias"
```

---

### Task 6: `rfis.approve` procedure

**Files:**
- Modify: `server/routers/index.ts` (append inside `rfis: router({ ... })`)
- Modify: `tests/rfis-router.test.ts` (append a new describe block)

- [ ] **Step 1: Append the failing test**

Append to `tests/rfis-router.test.ts`:

```ts
describe("rfis.approve", () => {
  it("requires company_admin+ — manager is FORBIDDEN", async () => {
    DB_STATE.rfis.push({ id: 1, companyId: 1, projectId: 1, status: "answered", subject: "x", raisedById: 9, answeredById: 7, number: "RFI-0001" });
    const caller = appRouter.createCaller(ctx({ companyRole: "manager" }));
    await expect(
      caller.rfis.approve({ id: 1, companyId: 1 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("transitions answered → approved, sets approvedAt + approvedById, emails raiser + answerer", async () => {
    DB_STATE.rfis.push({ id: 1, companyId: 1, projectId: 1, status: "answered", subject: "x", raisedById: 9, answeredById: 7, number: "RFI-0001" });
    DB_STATE.users.push({ id: 9, name: "Sam", email: "sam@example.com" });
    DB_STATE.users.push({ id: 7, name: "Jamie", email: "jamie@example.com" });
    DB_STATE.projects.push({ id: 1, companyId: 1, name: "P1" });
    const caller = appRouter.createCaller(ctx({ companyRole: "company_admin", userId: 5 }));

    await caller.rfis.approve({ id: 1, companyId: 1 });

    expect(DB_STATE.rfis[0].status).toBe("approved");
    expect(DB_STATE.rfis[0].approvedById).toBe(5);
    // Fire-and-forget loop: emails to BOTH raiser and answerer.
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const recipients = sendEmail.mock.calls.map(c => c[0].to).sort();
    expect(recipients).toEqual(["jamie@example.com", "sam@example.com"]);
  });

  it("rejects an already-approved RFI with BAD_REQUEST", async () => {
    DB_STATE.rfis.push({ id: 1, companyId: 1, status: "approved", subject: "x", raisedById: 9, projectId: 1, number: "RFI-0001" });
    const caller = appRouter.createCaller(ctx({ companyRole: "company_admin" }));
    await expect(
      caller.rfis.approve({ id: 1, companyId: 1 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects a not-yet-answered RFI with BAD_REQUEST", async () => {
    DB_STATE.rfis.push({ id: 1, companyId: 1, status: "submitted", subject: "x", raisedById: 9, projectId: 1, number: "RFI-0001" });
    const caller = appRouter.createCaller(ctx({ companyRole: "company_admin" }));
    await expect(
      caller.rfis.approve({ id: 1, companyId: 1 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/rfis-router.test.ts`
Expected: FAIL — `caller.rfis.approve is not a function`.

- [ ] **Step 3: Implement `approve`**

In `server/routers/index.ts`, after the `respond` alias inside `rfis: router({ ... })`, add:

```ts
    approve: companyScopedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        requireCompanyRole(ctx.companyMembership, "company_admin");
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');

        const [rfi] = await db.select().from(dbRfis)
          .where(and(eq(dbRfis.id, input.id), eq(dbRfis.companyId, input.companyId)))
          .limit(1);
        if (!rfi) throw new TRPCError({ code: "NOT_FOUND", message: "RFI not found." });
        assertTransition(rfi.status as RfiStatus, "approved");

        await db.update(dbRfis).set({
          status: "approved",
          approvedAt: new Date(),
          approvedById: ctx.user.id,
          updatedAt: new Date(),
        }).where(and(eq(dbRfis.id, input.id), eq(dbRfis.companyId, input.companyId)));

        // Email raiser + answerer. Both are tracked on the row.
        const userIds = [rfi.raisedById, rfi.answeredById].filter((id): id is number => id != null);
        const recipients = userIds.length
          ? await db.select().from(dbUsers).where(inArray(dbUsers.id, userIds))
          : [];
        const [project] = await db.select().from(dbProjects).where(eq(dbProjects.id, rfi.projectId)).limit(1);

        for (const r of recipients) {
          if (!r.email) continue;
          void sendEmail({
            to: r.email,
            ...rfiApprovedEmail({
              rfi: { id: rfi.id, number: rfi.number, subject: rfi.subject },
              approver: { name: ctx.user.name },
              project: { name: project?.name ?? "" },
              recipient: { name: r.name },
            }),
          }).catch(err => console.error("[rfis.approve] email send failed:", err));
        }

        return { success: true };
      }),
```

Update the imports at the top of the file:

```ts
import { rfiAnsweredEmail, rfiApprovedEmail } from "../_core/email-templates/rfi";
import { and, eq, desc, sql, inArray } from "drizzle-orm";
```

(Add `inArray` to the existing `drizzle-orm` import; add `rfiApprovedEmail` to the existing rfi templates import.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/rfis-router.test.ts`
Expected: PASS — 8 tests total now (4 prior + 4 approve).

- [ ] **Step 5: Type-check**

Run: `pnpm check`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add server/routers/index.ts tests/rfis-router.test.ts
git commit -m "feat(rfi): rfis.approve — answered → approved + email raiser+answerer"
```

---

### Task 7: `rfis.reject` procedure (with forced reason)

**Files:**
- Modify: `server/routers/index.ts`
- Modify: `tests/rfis-router.test.ts`

- [ ] **Step 1: Append the failing test**

Append to `tests/rfis-router.test.ts`:

```ts
describe("rfis.reject", () => {
  it("requires company_admin+", async () => {
    DB_STATE.rfis.push({ id: 1, companyId: 1, projectId: 1, status: "answered", subject: "x", raisedById: 9, answeredById: 7, number: "RFI-0001" });
    const caller = appRouter.createCaller(ctx({ companyRole: "manager" }));
    await expect(
      caller.rfis.reject({ id: 1, companyId: 1, reason: "needs more detail" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects empty reason at the input layer (BAD_REQUEST)", async () => {
    DB_STATE.rfis.push({ id: 1, companyId: 1, projectId: 1, status: "answered", subject: "x", raisedById: 9, answeredById: 7, number: "RFI-0001" });
    const caller = appRouter.createCaller(ctx({ companyRole: "company_admin" }));
    await expect(
      caller.rfis.reject({ id: 1, companyId: 1, reason: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("transitions answered → rejected, persists the reason, emails raiser + answerer", async () => {
    DB_STATE.rfis.push({ id: 1, companyId: 1, projectId: 1, status: "answered", subject: "x", raisedById: 9, answeredById: 7, number: "RFI-0001" });
    DB_STATE.users.push({ id: 9, name: "Sam", email: "sam@example.com" });
    DB_STATE.users.push({ id: 7, name: "Jamie", email: "jamie@example.com" });
    DB_STATE.projects.push({ id: 1, companyId: 1, name: "P1" });
    const caller = appRouter.createCaller(ctx({ companyRole: "company_admin", userId: 5 }));

    await caller.rfis.reject({ id: 1, companyId: 1, reason: "Insufficient detail on load case" });

    expect(DB_STATE.rfis[0].status).toBe("rejected");
    expect(DB_STATE.rfis[0].rejectedById).toBe(5);
    expect(DB_STATE.rfis[0].rejectedReason).toBe("Insufficient detail on load case");
    expect(sendEmail).toHaveBeenCalledTimes(2);
    // Surface the reason in the email body.
    const reasonInBody = sendEmail.mock.calls.some(c => c[0].text?.includes("Insufficient detail on load case"));
    expect(reasonInBody).toBe(true);
  });

  it("rejects a not-yet-answered RFI with BAD_REQUEST", async () => {
    DB_STATE.rfis.push({ id: 1, companyId: 1, status: "submitted", subject: "x", raisedById: 9, projectId: 1, number: "RFI-0001" });
    const caller = appRouter.createCaller(ctx({ companyRole: "company_admin" }));
    await expect(
      caller.rfis.reject({ id: 1, companyId: 1, reason: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/rfis-router.test.ts`
Expected: FAIL — `caller.rfis.reject is not a function`.

- [ ] **Step 3: Implement `reject`**

In `server/routers/index.ts`, after `approve` inside `rfis: router({ ... })`, add:

```ts
    reject: companyScopedProcedure
      .input(z.object({
        id: z.number(),
        companyId: z.number(),
        reason: z.string().min(1, "rejection reason is required"),
      }))
      .mutation(async ({ ctx, input }) => {
        requireCompanyRole(ctx.companyMembership, "company_admin");
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');

        const [rfi] = await db.select().from(dbRfis)
          .where(and(eq(dbRfis.id, input.id), eq(dbRfis.companyId, input.companyId)))
          .limit(1);
        if (!rfi) throw new TRPCError({ code: "NOT_FOUND", message: "RFI not found." });
        assertTransition(rfi.status as RfiStatus, "rejected");

        await db.update(dbRfis).set({
          status: "rejected",
          rejectedAt: new Date(),
          rejectedById: ctx.user.id,
          rejectedReason: input.reason,
          updatedAt: new Date(),
        }).where(and(eq(dbRfis.id, input.id), eq(dbRfis.companyId, input.companyId)));

        const userIds = [rfi.raisedById, rfi.answeredById].filter((id): id is number => id != null);
        const recipients = userIds.length
          ? await db.select().from(dbUsers).where(inArray(dbUsers.id, userIds))
          : [];
        const [project] = await db.select().from(dbProjects).where(eq(dbProjects.id, rfi.projectId)).limit(1);

        for (const r of recipients) {
          if (!r.email) continue;
          void sendEmail({
            to: r.email,
            ...rfiRejectedEmail({
              rfi: { id: rfi.id, number: rfi.number, subject: rfi.subject, rejectedReason: input.reason },
              rejecter: { name: ctx.user.name },
              project: { name: project?.name ?? "" },
              recipient: { name: r.name },
            }),
          }).catch(err => console.error("[rfis.reject] email send failed:", err));
        }

        return { success: true };
      }),
```

Update the imports:

```ts
import { rfiAnsweredEmail, rfiApprovedEmail, rfiRejectedEmail } from "../_core/email-templates/rfi";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/rfis-router.test.ts`
Expected: PASS — 12 tests total.

- [ ] **Step 5: Type-check**

Run: `pnpm check`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add server/routers/index.ts tests/rfis-router.test.ts
git commit -m "feat(rfi): rfis.reject — answered → rejected with forced reason + emails"
```

---

### Task 8: `rfis.create` — broadcast email to managers + admins

**Files:**
- Modify: `server/routers/index.ts` (`rfis.create` mutation)
- Modify: `tests/rfis-router.test.ts`

- [ ] **Step 1: Append the failing test**

Append to `tests/rfis-router.test.ts`:

```ts
describe("rfis.create — recipient broadcast", () => {
  it("emails every active companyUsers row with role manager / company_admin / super_admin", async () => {
    // Seed: project + 5 users with varied roles.
    DB_STATE.projects.push({ id: 1, companyId: 1, name: "P1" });
    DB_STATE.users.push({ id: 100, name: "Mgr", email: "mgr@example.com" });
    DB_STATE.users.push({ id: 101, name: "Adm", email: "adm@example.com" });
    DB_STATE.users.push({ id: 102, name: "Sup", email: "super@example.com" });
    DB_STATE.users.push({ id: 103, name: "Sv",  email: "sv@example.com" });   // supervisor — NOT a recipient
    DB_STATE.users.push({ id: 104, name: "Wkr", email: "wkr@example.com" });  // worker — NOT a recipient
    DB_STATE.companyUsers.push({ userId: 100, companyId: 1, companyRole: "manager",       isActive: true });
    DB_STATE.companyUsers.push({ userId: 101, companyId: 1, companyRole: "company_admin", isActive: true });
    DB_STATE.companyUsers.push({ userId: 102, companyId: 1, companyRole: "super_admin",   isActive: true });
    DB_STATE.companyUsers.push({ userId: 103, companyId: 1, companyRole: "supervisor",    isActive: true });
    DB_STATE.companyUsers.push({ userId: 104, companyId: 1, companyRole: "worker",        isActive: true });

    const caller = appRouter.createCaller(ctx({ companyRole: "worker", userId: 104 }));
    await caller.rfis.create({
      companyId: 1, projectId: 1, subject: "Beam spec", question: "?",
    });

    const recipients = sendEmail.mock.calls.map(c => c[0].to).sort();
    expect(recipients).toEqual(["adm@example.com", "mgr@example.com", "super@example.com"]);
  });

  it("does not email inactive members", async () => {
    DB_STATE.projects.push({ id: 1, companyId: 1, name: "P1" });
    DB_STATE.users.push({ id: 100, name: "Mgr", email: "mgr@example.com" });
    DB_STATE.companyUsers.push({ userId: 100, companyId: 1, companyRole: "manager", isActive: false });
    const caller = appRouter.createCaller(ctx({ companyRole: "worker", userId: 999 }));
    await caller.rfis.create({ companyId: 1, projectId: 1, subject: "x", question: "?" });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
```

> Implementation note: the in-memory stub from Task 5 doesn't model joins. The implementation below queries `companyUsers` and `users` separately and joins in JS, so the stub's per-table fetch behaviour is sufficient.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/rfis-router.test.ts -t "rfis.create — recipient broadcast"`
Expected: FAIL — `sendEmail` was not called (current `create` doesn't email).

- [ ] **Step 3: Modify `create` to broadcast**

In `server/routers/index.ts`, find the existing `rfis.create` mutation. After the `db.insert(dbRfis).values(...).returning()` block (just before `return rows[0];`), add:

```ts
        // Phase 3.4 — fire-and-forget broadcast to every active manager+
        // company_admin+ super_admin in the company. Uses the role
        // hierarchy from lib/company-context.tsx; per the spec, lower
        // ranks don't get notified to keep inbox noise sane.
        const RECIPIENT_ROLES = ["manager", "company_admin", "super_admin"] as const;
        const memberships = await db.select().from(companyUsers).where(and(
          eq(companyUsers.companyId, input.companyId),
          eq(companyUsers.isActive, true),
        ));
        const recipientUserIds = memberships
          .filter(m => RECIPIENT_ROLES.includes(m.companyRole as any))
          .map(m => m.userId);
        const recipients = recipientUserIds.length
          ? await db.select().from(dbUsers).where(inArray(dbUsers.id, recipientUserIds))
          : [];
        for (const r of recipients) {
          if (!r.email) continue;
          void sendEmail({
            to: r.email,
            ...rfiSubmittedEmail({
              rfi: { id: rows[0].id, number: rows[0].number, subject: rows[0].subject },
              raiser: { name: ctx.user.name },
              project: { name: project.name },
              recipient: { name: r.name },
            }),
          }).catch(err => console.error("[rfis.create] email send failed:", err));
        }
```

Update the import on the rfi templates:

```ts
import { rfiAnsweredEmail, rfiApprovedEmail, rfiRejectedEmail, rfiSubmittedEmail } from "../_core/email-templates/rfi";
```

Confirm `companyUsers` is already imported at top of file (it is — used by `companyScopedProcedure`). If not, add: `import { companyUsers } from "../../drizzle/schema";`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/rfis-router.test.ts -t "rfis.create — recipient broadcast"`
Expected: PASS — 2 cases.

- [ ] **Step 5: Run the full router test file**

Run: `pnpm vitest run tests/rfis-router.test.ts`
Expected: PASS — 14 tests.

- [ ] **Step 6: Commit**

```bash
git add server/routers/index.ts tests/rfis-router.test.ts
git commit -m "feat(rfi): rfis.create broadcasts to managers + admins on submit"
```

---

### Task 9: Action-visibility helper

**Files:**
- Create: `lib/rfi-actions.ts`
- Test: `tests/rfi-actions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/rfi-actions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { visibleRfiActions } from "@/lib/rfi-actions";
import type { UserRole } from "@/lib/company-context";

describe("visibleRfiActions", () => {
  it("submitted + manager+: shows Answer only", () => {
    expect(visibleRfiActions("submitted", "manager")).toEqual({ answer: true, approve: false, reject: false });
    expect(visibleRfiActions("submitted", "company_admin")).toEqual({ answer: true, approve: false, reject: false });
  });

  it("submitted + below manager: no actions", () => {
    expect(visibleRfiActions("submitted", "supervisor")).toEqual({ answer: false, approve: false, reject: false });
    expect(visibleRfiActions("submitted", "worker")).toEqual({ answer: false, approve: false, reject: false });
  });

  it("answered + company_admin+: shows Approve and Reject (no Answer)", () => {
    expect(visibleRfiActions("answered", "company_admin")).toEqual({ answer: false, approve: true, reject: true });
    expect(visibleRfiActions("answered", "super_admin")).toEqual({ answer: false, approve: true, reject: true });
  });

  it("answered + manager: no actions (manager can answer but not approve)", () => {
    expect(visibleRfiActions("answered", "manager")).toEqual({ answer: false, approve: false, reject: false });
  });

  it("approved or rejected: terminal — no actions for any role", () => {
    const allRoles: UserRole[] = ["viewer", "worker", "supervisor", "manager", "company_admin", "super_admin"];
    for (const r of allRoles) {
      expect(visibleRfiActions("approved", r)).toEqual({ answer: false, approve: false, reject: false });
      expect(visibleRfiActions("rejected", r)).toEqual({ answer: false, approve: false, reject: false });
    }
  });

  it("null role (no membership): no actions", () => {
    expect(visibleRfiActions("submitted", null)).toEqual({ answer: false, approve: false, reject: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/rfi-actions.test.ts`
Expected: FAIL — `Cannot find module '@/lib/rfi-actions'`.

- [ ] **Step 3: Write the helper**

Create `lib/rfi-actions.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/rfi-actions.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/rfi-actions.ts tests/rfi-actions.test.ts
git commit -m "feat(rfi): visibleRfiActions helper — UI mirror of server gates"
```

---

### Task 10: Status pill component

**Files:**
- Create: `components/rfi-status-pill.tsx`
- Test: `tests/rfi-status-pill.component.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/rfi-status-pill.component.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RfiStatusPill } from "@/components/rfi-status-pill";
import type { RfiStatus } from "@/lib/rfi-actions";

afterEach(() => cleanup());

describe("<RfiStatusPill>", () => {
  it.each<[RfiStatus, string]>([
    ["submitted", "Submitted"],
    ["answered",  "Answered"],
    ["approved",  "Approved"],
    ["rejected",  "Rejected"],
  ])("renders the human-readable label for status=%s", (status, label) => {
    render(<RfiStatusPill status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("applies a distinct background colour per status — colours are not shared", () => {
    const colours = new Set<string>();
    for (const status of ["submitted", "answered", "approved", "rejected"] as RfiStatus[]) {
      const { container, unmount } = render(<RfiStatusPill status={status} />);
      // RN-Web flattens style props onto the outer div as inline style.
      const root = container.firstChild as HTMLElement;
      colours.add(root.style.backgroundColor || "");
      unmount();
    }
    expect(colours.size).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/rfi-status-pill.component.test.tsx`
Expected: FAIL — `Cannot find module '@/components/rfi-status-pill'`.

- [ ] **Step 3: Write the component**

Create `components/rfi-status-pill.tsx`:

```tsx
import React from "react";
import { Text, View, StyleSheet } from "react-native";
import type { RfiStatus } from "@/lib/rfi-actions";

const COLOURS: Record<RfiStatus, { bg: string; fg: string; label: string }> = {
  submitted: { bg: "#FEF3C7", fg: "#92400E", label: "Submitted" },
  answered:  { bg: "#DBEAFE", fg: "#1E40AF", label: "Answered" },
  approved:  { bg: "#DCFCE7", fg: "#166534", label: "Approved" },
  rejected:  { bg: "#FEE2E2", fg: "#991B1B", label: "Rejected" },
};

export function RfiStatusPill({ status }: { status: RfiStatus }) {
  const c = COLOURS[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.label, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  label: { fontSize: 12, fontWeight: "600" },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/rfi-status-pill.component.test.tsx`
Expected: PASS — 5 cases.

- [ ] **Step 5: Commit**

```bash
git add components/rfi-status-pill.tsx tests/rfi-status-pill.component.test.tsx
git commit -m "feat(rfi): RfiStatusPill — 4-colour status indicator"
```

---

### Task 11: Wire the new lifecycle into `app/rfis.tsx`

**Files:**
- Modify: `app/rfis.tsx`

This task has no separate unit test — the helpers it depends on (`visibleRfiActions`, `RfiStatusPill`, the new procedures) all have their own coverage. The integration suite in Task 12 will exercise the full path.

- [ ] **Step 1: Read the current screen**

Run: `pnpm exec ls -la app/rfis.tsx` — confirm it's the ~700-LoC file. Then read it once end-to-end so the patches below land in the right places.

Run: `cat app/rfis.tsx | head -60` (and similar) to locate:
- Where the list query renders RFI rows
- Where the "Respond" button + sheet currently live
- Where the top of the screen header / tab strip is

- [ ] **Step 2: Replace the inline status text with the pill**

Find the JSX that currently renders the RFI status as plain text (search for `rfi.status` inside the row component). Replace the text node with:

```tsx
<RfiStatusPill status={rfi.status as RfiStatus} />
```

Add the imports at the top of the file:

```tsx
import { RfiStatusPill } from "@/components/rfi-status-pill";
import { visibleRfiActions, type RfiStatus } from "@/lib/rfi-actions";
import { useCompany } from "@/lib/company-context";
```

- [ ] **Step 3: Add a "Pending review" tab gated to managers+**

At the top of the screen body (just below the existing header), add a tab strip. Locate the screen's main `<View>` that wraps the list, and just above the `FlatList` (or equivalent), insert:

```tsx
// useCompany() exposes `currentUser.role` (the user's company role)
// and a `can(min)` helper. Use both.
const { currentUser, can } = useCompany();
const companyRole = currentUser?.role ?? null;
const showPendingTab = can("manager");
const [view, setView] = React.useState<"all" | "pending">("all");
```

Then render the strip:

```tsx
{showPendingTab && (
  <View style={{ flexDirection: "row", gap: 8, padding: 12 }}>
    <Pressable onPress={() => setView("all")}
      style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8,
        backgroundColor: view === "all" ? "#1E3A5F" : "transparent" }}>
      <Text style={{ color: view === "all" ? "#fff" : "#1E3A5F", fontWeight: "600" }}>All</Text>
    </Pressable>
    <Pressable onPress={() => setView("pending")}
      style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8,
        backgroundColor: view === "pending" ? "#1E3A5F" : "transparent" }}>
      <Text style={{ color: view === "pending" ? "#fff" : "#1E3A5F", fontWeight: "600" }}>Pending review</Text>
    </Pressable>
  </View>
)}
```

Then filter the list before passing to `FlatList`:

```tsx
const visibleRfis = React.useMemo(() => {
  if (view === "pending") return rfis.filter(r => r.status === "answered");
  return rfis;
}, [rfis, view]);
```

(Replace `rfis` in the existing FlatList `data={...}` prop with `visibleRfis`.)

- [ ] **Step 4: Replace the Respond sheet with the action set**

Find the existing "Respond" button + the sheet/modal it opens. Replace that block with action-set rendering keyed on `visibleRfiActions(rfi.status as RfiStatus, companyRole)`:

```tsx
// `companyRole` was destructured from useCompany() in Step 3 above.
const actions = visibleRfiActions(selectedRfi.status as RfiStatus, companyRole);
```

Render three buttons in the detail row:

```tsx
{actions.answer && (
  <Pressable onPress={() => openAnswerSheet(selectedRfi)} style={btnStyle("#1E3A5F")}>
    <Text style={{ color: "#fff", fontWeight: "600" }}>Answer</Text>
  </Pressable>
)}
{actions.approve && (
  <Pressable onPress={() => approveMutation.mutate({ id: selectedRfi.id, companyId })} style={btnStyle("#16A34A")}>
    <Text style={{ color: "#fff", fontWeight: "600" }}>Approve</Text>
  </Pressable>
)}
{actions.reject && (
  <Pressable onPress={() => openRejectSheet(selectedRfi)} style={btnStyle("#DC2626")}>
    <Text style={{ color: "#fff", fontWeight: "600" }}>Reject</Text>
  </Pressable>
)}
```

Helper `btnStyle`:

```tsx
const btnStyle = (bg: string) => ({
  backgroundColor: bg, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10,
});
```

The Answer sheet is the existing Respond sheet, just renamed. Have its submit handler call `answerMutation.mutate({...})` instead of `respondMutation.mutate({...})`. Wire:

```tsx
const answerMutation = trpc.rfis.answer.useMutation({ onSuccess: () => listQuery.refetch() });
const approveMutation = trpc.rfis.approve.useMutation({ onSuccess: () => listQuery.refetch() });
const rejectMutation  = trpc.rfis.reject.useMutation({  onSuccess: () => listQuery.refetch() });
```

- [ ] **Step 5: Add the Reject sheet with forced reason**

Add a new sheet/modal component (mirroring the Answer sheet pattern in the same file):

```tsx
const [rejectFor, setRejectFor] = React.useState<typeof selectedRfi | null>(null);
const [rejectReason, setRejectReason] = React.useState("");
const openRejectSheet = (r: typeof selectedRfi) => { setRejectFor(r); setRejectReason(""); };
const submitReject = () => {
  if (!rejectFor) return;
  if (rejectReason.trim().length === 0) return; // disabled-state guard
  rejectMutation.mutate({ id: rejectFor.id, companyId, reason: rejectReason.trim() });
  setRejectFor(null);
};
```

Render conditionally (modal/sheet — match existing pattern in file):

```tsx
{rejectFor && (
  <View /* sheet container — match the Answer sheet's existing wrapper */>
    <Text style={{ fontWeight: "700", fontSize: 16 }}>Reject RFI {rejectFor.number}</Text>
    <Text style={{ color: "#6B7280", marginTop: 4 }}>
      The raiser and the answerer will be notified. Please explain what needs revision.
    </Text>
    <TextInput
      multiline
      value={rejectReason}
      onChangeText={setRejectReason}
      placeholder="Reason for rejection"
      style={{ borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8, padding: 10, minHeight: 80, marginTop: 12 }}
    />
    <View style={{ flexDirection: "row", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
      <Pressable onPress={() => setRejectFor(null)} style={btnStyle("#6B7280")}>
        <Text style={{ color: "#fff" }}>Cancel</Text>
      </Pressable>
      <Pressable
        onPress={submitReject}
        disabled={rejectReason.trim().length === 0}
        style={[btnStyle("#DC2626"), { opacity: rejectReason.trim().length === 0 ? 0.5 : 1 }]}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>Reject</Text>
      </Pressable>
    </View>
  </View>
)}
```

- [ ] **Step 6: Type-check + lint**

Run: `pnpm check && pnpm lint`
Expected: clean.

- [ ] **Step 7: Smoke-test in dev**

Run: `pnpm dev`
Open `http://localhost:3000/rfis` (or whichever port `pnpm dev` reports) signed in as a `manager` and as a `company_admin` (use the seeded super-admin), and confirm:
- Status pills render in 4 colours
- "Pending review" tab visible only for managers+
- Submit → Answer flow works (existing happy path)
- Approve button appears for company_admins on answered RFIs
- Reject button is disabled until reason is non-empty

If any of these are wrong, fix in this task — don't move on until the manual smoke passes.

- [ ] **Step 8: Commit**

```bash
git add app/rfis.tsx
git commit -m "feat(rfi): pending-review tab, action buttons, forced rejection reason"
```

---

### Task 12: Integration test on real Postgres

**Files:**
- Create: `tests/integration/rfis-workflow.integration.test.ts`

- [ ] **Step 1: Write the integration test**

Create `tests/integration/rfis-workflow.integration.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  setupTestPostgres,
  teardownTestPostgres,
  getTestDb,
  truncate,
} from "./setup";
import { rfis, projects, users, companyUsers, companies } from "../../drizzle/schema";

// Mock email so we don't try to talk to SendGrid in CI.
const sendEmail = vi.fn(async () => {});
vi.mock("../../server/_core/email", () => ({ sendEmail }));

const { appRouter } = await import("../../server/routers");

beforeAll(setupTestPostgres);
afterAll(teardownTestPostgres);

beforeEach(async () => {
  await truncate(["rfis", "projects", "companyUsers", "users", "companies"]);
  sendEmail.mockClear();
});

async function seed() {
  const db = getTestDb();
  const [companyA] = await db.insert(companies).values({ name: "ACo" }).returning();
  const [companyB] = await db.insert(companies).values({ name: "BCo" }).returning();
  const [raiser]   = await db.insert(users).values({ openId: "r", name: "Raiser",  email: "r@a", role: "user" }).returning();
  const [answerer] = await db.insert(users).values({ openId: "a", name: "Answerer", email: "a@a", role: "user" }).returning();
  const [admin]    = await db.insert(users).values({ openId: "ad", name: "Admin",    email: "ad@a", role: "user" }).returning();
  const [otherAdmin] = await db.insert(users).values({ openId: "ob", name: "OtherAdmin", email: "ob@b", role: "user" }).returning();
  await db.insert(companyUsers).values([
    { userId: raiser.id,   companyId: companyA.id, companyRole: "worker",        isActive: true },
    { userId: answerer.id, companyId: companyA.id, companyRole: "manager",       isActive: true },
    { userId: admin.id,    companyId: companyA.id, companyRole: "company_admin", isActive: true },
    { userId: otherAdmin.id, companyId: companyB.id, companyRole: "company_admin", isActive: true },
  ]);
  const [project] = await db.insert(projects).values({ companyId: companyA.id, name: "Site 1" }).returning();
  return { companyA, companyB, raiser, answerer, admin, otherAdmin, project };
}

function ctx(user: any, companyRole: string | null) {
  return {
    user,
    companyMembership: companyRole ? { companyRole, isActive: true } : null,
    req: { protocol: "https", hostname: "localhost", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  } as any;
}

describe("rfi lifecycle on real Postgres", () => {
  it("happy path: create → answer → approve persists every column + emails the right people", async () => {
    const s = await seed();
    const db = getTestDb();

    // create as worker
    const callerWorker = appRouter.createCaller(ctx(s.raiser, "worker"));
    const created = await callerWorker.rfis.create({
      companyId: s.companyA.id, projectId: s.project.id,
      subject: "Beam check", question: "Beam grid B-7?",
    });
    expect(created.status).toBe("submitted");

    // answer as manager
    const callerMgr = appRouter.createCaller(ctx(s.answerer, "manager"));
    await callerMgr.rfis.answer({ id: created.id, companyId: s.companyA.id, response: "Use 305x165 UB46." });

    let [row] = await db.select().from(rfis).where(eq(rfis.id, created.id));
    expect(row.status).toBe("answered");
    expect(row.answeredById).toBe(s.answerer.id);
    expect(row.respondedAt).toBeInstanceOf(Date);

    // approve as company_admin
    const callerAdmin = appRouter.createCaller(ctx(s.admin, "company_admin"));
    await callerAdmin.rfis.approve({ id: created.id, companyId: s.companyA.id });

    [row] = await db.select().from(rfis).where(eq(rfis.id, created.id));
    expect(row.status).toBe("approved");
    expect(row.approvedById).toBe(s.admin.id);
    expect(row.approvedAt).toBeInstanceOf(Date);

    // Email recipients across the lifecycle:
    //  - on create:   admin (company_admin) + manager (manager) — 2
    //  - on answer:   raiser (worker)                            — 1
    //  - on approve:  raiser + answerer                          — 2
    expect(sendEmail).toHaveBeenCalledTimes(5);
  });

  it("reject persists the reason and emails raiser + answerer", async () => {
    const s = await seed();
    const db = getTestDb();
    const created = await appRouter.createCaller(ctx(s.raiser, "worker"))
      .rfis.create({ companyId: s.companyA.id, projectId: s.project.id, subject: "x", question: "?" });
    await appRouter.createCaller(ctx(s.answerer, "manager"))
      .rfis.answer({ id: created.id, companyId: s.companyA.id, response: "see above" });
    sendEmail.mockClear();

    await appRouter.createCaller(ctx(s.admin, "company_admin"))
      .rfis.reject({ id: created.id, companyId: s.companyA.id, reason: "Need updated drawings" });

    const [row] = await db.select().from(rfis).where(eq(rfis.id, created.id));
    expect(row.status).toBe("rejected");
    expect(row.rejectedReason).toBe("Need updated drawings");
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const recipients = sendEmail.mock.calls.map(c => c[0].to).sort();
    expect(recipients).toEqual([s.answerer.email, s.raiser.email].sort());
  });

  it("cross-tenant: company B's admin cannot approve company A's RFI (FORBIDDEN)", async () => {
    const s = await seed();
    const created = await appRouter.createCaller(ctx(s.raiser, "worker"))
      .rfis.create({ companyId: s.companyA.id, projectId: s.project.id, subject: "x", question: "?" });
    await appRouter.createCaller(ctx(s.answerer, "manager"))
      .rfis.answer({ id: created.id, companyId: s.companyA.id, response: "ok" });

    // companyId on input still names companyA, but the caller's
    // membership is in companyB → companyScopedProcedure rejects.
    const otherAdminCaller = appRouter.createCaller(ctx(s.otherAdmin, null));
    await expect(
      otherAdminCaller.rfis.approve({ id: created.id, companyId: s.companyA.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("respond alias still works — same DB writes as answer", async () => {
    const s = await seed();
    const db = getTestDb();
    const created = await appRouter.createCaller(ctx(s.raiser, "worker"))
      .rfis.create({ companyId: s.companyA.id, projectId: s.project.id, subject: "x", question: "?" });

    await appRouter.createCaller(ctx(s.answerer, "manager"))
      .rfis.respond({ id: created.id, companyId: s.companyA.id, response: "answered via alias" });

    const [row] = await db.select().from(rfis).where(eq(rfis.id, created.id));
    expect(row.status).toBe("answered");
    expect(row.answeredById).toBe(s.answerer.id);
    expect(row.response).toBe("answered via alias");
  });
});
```

- [ ] **Step 2: Run integration tests**

Run: `pnpm test:integration`
Expected: PASS — the new file's 4 tests on top of the existing 12.

- [ ] **Step 3: Run the full unit suite to confirm no cross-effects**

Run: `pnpm test`
Expected: PASS — `Tests <previous-count>+18 passed` (3 helper + 12 router + 5 pill + 6 actions + 4 templates = 30 unit additions across the plan, plus the 4 integration tests).

- [ ] **Step 4: Commit**

```bash
git add tests/integration/rfis-workflow.integration.test.ts
git commit -m "test(rfi): real-PG integration suite for full lifecycle + cross-tenant"
```

---

### Task 13: ROADMAP update + push

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Mark Phase 3.4 done**

In `docs/ROADMAP.md`, find the Phase 3.4 section. Update the heading and append closing notes:

```md
### 3.4 — RFIs: approval workflow + SendGrid notifications ✅ DONE (2026-05-05)

**Tasks:**
1. ✅ Status enum: `submitted|answered|approved|rejected` (closed implicit/terminal). Spec at `docs/superpowers/specs/2026-05-05-rfi-workflow-design.md`.
2. ✅ tRPC: `rfis.answer`, `rfis.approve`, `rfis.reject` with state-machine + role gates; `rfis.respond` retained as deprecated alias for in-flight mobile clients.
3. ✅ UI: status pill + manager-only "Pending review" tab + contextual Approve/Reject buttons; Reject sheet has forced reason.
4. ✅ Email templates in `server/_core/email-templates/rfi.ts`; recipients are raiser + answerer + role broadcast (manager / company_admin / super_admin).

**Acceptance:** RFIs route through draft → review → approval; each transition emails the relevant party. ✅ Met (drafts collapsed into `submitted` per design decision — see spec § 1).
```

Also bump the phase-status table at the top of ROADMAP.md to reflect Phase 3 progress.

- [ ] **Step 2: Run all gates one more time**

```bash
pnpm test && pnpm test:integration && pnpm check && pnpm lint
```

Expected: all green.

- [ ] **Step 3: Commit + push**

```bash
git add docs/ROADMAP.md
git commit -m "docs(roadmap): mark Phase 3.4 (RFI workflow) done"
git push origin main
```

- [ ] **Step 4: Verify deploy**

Wait for the Deploy + CI workflows to finish on the new HEAD (use `gh run list` or the GitHub API). Then:

```bash
curl -s https://field.cortexbuildpro.com/api/version
```

Expected: returned `sha` matches the new HEAD commit.

---

## Verification at the very end

- `pnpm test` — full unit suite green, ~30 new tests across helpers, router, UI components
- `pnpm test:integration` — 16 integration tests green (12 prior + 4 new)
- `pnpm check` — clean tsc
- `pnpm lint` — clean
- Deploy on main — green
- Prod `/api/version` reports the new sha
- Manually as a `company_admin` on prod: can approve + reject; raiser + answerer receive emails
- Manually as a `worker` on prod: status pills render, Answer/Approve/Reject buttons not visible

---

## Out-of-scope (do not implement here)

- RFI threading / comments
- File attachments on responses
- Approval notes
- Re-opening terminal RFIs (re-raise as a new RFI)
- Per-user notification preferences (Phase 3.6)
- Email digest / batching
- Server-side pagination for the pending-review queue (client filter is fine up to ~500 RFIs/company; revisit in 3.6 or later)
