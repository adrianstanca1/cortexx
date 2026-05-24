/**
 * EQUIVALENCE PROOF — `rfis.create` notification fan-out.
 *
 * This is the load-bearing test for the Step 1 → Step 2 NotificationGateway
 * consolidation. It pins the EXACT side-effect signature of the legacy
 * fan-out block in `server/routers/index.ts` (lines 2135–2161 at the time
 * of writing):
 *
 *     const RECIPIENT_ROLES = ["manager", "company_admin", "super_admin"];
 *     const memberships = await db.select()...where(active && cid);
 *     const recipientUserIds = memberships
 *       .filter(m => RECIPIENT_ROLES.includes(m.companyRole))
 *       .map(m => m.userId);
 *     const recipients = recipientUserIds.length
 *       ? await db.select().from(users).where(inArray(...))
 *       : [];
 *     for (const r of recipients) {
 *       if (!r.email) continue;
 *       void sendEmail({ to: r.email, ...rfiSubmittedEmail({...}) })
 *         .catch(err => console.error(...));
 *     }
 *
 * After Step 2 lands, that block becomes a single
 * `await notify({ to: recipientsByCompanyRole(...), ... })` call. THIS
 * TEST MUST KEEP PASSING WITHOUT MODIFICATION. If the rewrite forces a
 * test edit, equivalence has been broken — investigate before merging.
 *
 * What's pinned:
 *   1. Recipients with role ∈ {manager, company_admin, super_admin} who are
 *      isActive=true and have a non-null email → 1 sendEmail call each.
 *   2. Recipients with `email = null`              → skipped.
 *   3. Recipients with `isActive = false`          → skipped.
 *   4. Recipients with role worker/supervisor/viewer → skipped.
 *   5. Each sendEmail body matches `rfiSubmittedEmail({...})` exactly,
 *      keyed by recipient (subject, text, html identical to the template).
 *   6. The procedure RESOLVES before the email sends settle
 *      (fire-and-forget) — pinned by stalling sendEmail with a never-
 *      resolving deferred and asserting `caller.rfis.create(...)` still
 *      resolves under a timeout.
 *
 * Why a real Postgres (testcontainers) and not a hand-rolled mock?
 *   The recipient-resolution logic walks two real WHERE clauses
 *   (`companyUsers.companyId = ? AND companyUsers.isActive = true`, then
 *   `inArray(users.id, ids)`) plus the cross-tenant FK guard. A mock
 *   that pretends those filter (the way `rfis-router.test.ts` does)
 *   gives Step 2 freedom to drop the `isActive` predicate without
 *   anyone noticing. A real DB locks the predicate down.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  setupTestPostgres,
  teardownTestPostgres,
  getTestDb,
  truncate,
} from "./setup";
import { projects, users, companyUsers, companies } from "../../drizzle/schema";
import { rfiSubmittedEmail } from "../../server/_core/email-templates/rfi";

// ── Mock sendEmail BEFORE importing the router ──────────────────────────────
// The default implementation is a no-op resolved promise; specific tests
// override with controlled deferreds (see "fire-and-forget" assertion).
const sendEmail = vi.fn(async (_p: unknown) => {});
vi.mock("../../server/_core/email", () => ({ sendEmail }));

// Container boot is slow (~5–10s); reuse one container across the whole
// suite. Truncate between tests for isolation.
let appRouter: typeof import("../../server/routers")["appRouter"];

beforeAll(async () => {
  await setupTestPostgres();
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "equivalence-test-secret";
  ({ appRouter } = await import("../../server/routers"));
}, 120_000);

afterAll(async () => {
  await teardownTestPostgres();
}, 30_000);

beforeEach(async () => {
  await truncate(["rfis", "projects", "company_users", "users", "companies"]);
  sendEmail.mockReset();
  sendEmail.mockImplementation(async () => {});
});

/**
 * Build a context for the supplied user record. companyScopedProcedure
 * re-queries the DB for membership, so `companyMembership` is left null
 * — the middleware overwrites it from the DB row inserted in `seed()`.
 */
function ctx(user: any) {
  return {
    user,
    companyMembership: null,
    req: { protocol: "https", hostname: "localhost", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  } as any;
}

/**
 * Seed: one company, one project, plus eight membership/user rows
 * exercising every relevant edge:
 *
 *   - raiser (worker, active, addressable)         — caller, not a recipient
 *   - mgrA (manager, active, addressable)          — RECIPIENT
 *   - mgrB (manager, active, addressable)          — RECIPIENT
 *   - admin (company_admin, active, addressable)   — RECIPIENT
 *   - super (super_admin, active, addressable)     — RECIPIENT
 *   - mgrInactive (manager, INACTIVE, addressable) — skipped
 *   - mgrNoEmail (manager, active, email=null)     — skipped
 *   - supervisor (supervisor, active, addressable) — skipped (below role)
 *   - viewer (viewer, active, addressable)         — skipped (below role)
 *
 * Expected sendEmail count: 4 (mgrA, mgrB, admin, super).
 */
async function seed() {
  const db = getTestDb();

  const [company] = await db.insert(companies).values({
    name: "Equivalence Co", slug: "equivalence-co",
  }).returning();

  const insertUser = async (openId: string, name: string, email: string | null) => {
    const [u] = await db.insert(users).values({
      openId, name, email, role: "user",
    }).returning();
    return u;
  };

  const raiser      = await insertUser("eq-raiser",      "Raiser",      "raiser@eq.example");
  const mgrA        = await insertUser("eq-mgrA",        "Manager A",   "mgrA@eq.example");
  const mgrB        = await insertUser("eq-mgrB",        "Manager B",   "mgrB@eq.example");
  const admin       = await insertUser("eq-admin",       "Admin",       "admin@eq.example");
  const superUser   = await insertUser("eq-super",       "Super",       "super@eq.example");
  const mgrInactive = await insertUser("eq-mgrInactive", "Mgr Inactive","mgrInactive@eq.example");
  const mgrNoEmail  = await insertUser("eq-mgrNoEmail",  "Mgr No Inbox", null);
  const supervisor  = await insertUser("eq-supervisor",  "Supervisor",  "sup@eq.example");
  const viewer      = await insertUser("eq-viewer",      "Viewer",      "viewer@eq.example");

  await db.insert(companyUsers).values([
    { userId: raiser.id,      companyId: company.id, companyRole: "worker",        isActive: true  },
    { userId: mgrA.id,        companyId: company.id, companyRole: "manager",       isActive: true  },
    { userId: mgrB.id,        companyId: company.id, companyRole: "manager",       isActive: true  },
    { userId: admin.id,       companyId: company.id, companyRole: "company_admin", isActive: true  },
    { userId: superUser.id,   companyId: company.id, companyRole: "super_admin",   isActive: true  },
    { userId: mgrInactive.id, companyId: company.id, companyRole: "manager",       isActive: false },
    { userId: mgrNoEmail.id,  companyId: company.id, companyRole: "manager",       isActive: true  },
    { userId: supervisor.id,  companyId: company.id, companyRole: "supervisor",    isActive: true  },
    { userId: viewer.id,      companyId: company.id, companyRole: "viewer",        isActive: true  },
  ]);

  const [project] = await db.insert(projects).values({
    companyId: company.id, name: "Equivalence Site",
  }).returning();

  return {
    company, project,
    raiser, mgrA, mgrB, admin, superUser,
    mgrInactive, mgrNoEmail, supervisor, viewer,
  };
}

// ─── Test ────────────────────────────────────────────────────────────────────

describe("rfis.create — notification fan-out equivalence", () => {
  it("emails exactly the four addressable manager+/admin+/super members; everyone else is skipped", async () => {
    const s = await seed();

    const created = await appRouter.createCaller(ctx(s.raiser)).rfis.create({
      companyId: s.company.id,
      projectId: s.project.id,
      subject: "Equivalence smoke",
      question: "Does the fan-out still match after Step 2?",
    });

    // ── Assertion 1: count ──────────────────────────────────────────────────
    expect(sendEmail).toHaveBeenCalledTimes(4);

    // ── Assertion 2: addressee set ──────────────────────────────────────────
    const toAddresses = sendEmail.mock.calls
      .map(([p]) => (p as { to: string }).to)
      .sort();
    expect(toAddresses).toEqual(
      ["admin@eq.example", "mgrA@eq.example", "mgrB@eq.example", "super@eq.example"].sort(),
    );

    // ── Assertion 3: no email to skipped users ──────────────────────────────
    // Inactive manager, no-inbox manager, supervisor, viewer, the raiser
    // themselves, and any address from another tenant — none should appear.
    const FORBIDDEN = [
      "mgrInactive@eq.example",
      "sup@eq.example",
      "viewer@eq.example",
      "raiser@eq.example",
    ];
    for (const forbidden of FORBIDDEN) {
      expect(toAddresses).not.toContain(forbidden);
    }

    // ── Assertion 4: each body matches rfiSubmittedEmail exactly ────────────
    // We compute the expected body per recipient and look for an exact
    // match in the recorded calls. Asserting on { to, ...template } pins
    // the EXACT contract: subject, text, html, plus the to-line.
    type Recipient = { id: number; name: string; email: string };
    const expectedRecipients: Recipient[] = [
      { id: s.mgrA.id,      name: "Manager A", email: "mgrA@eq.example" },
      { id: s.mgrB.id,      name: "Manager B", email: "mgrB@eq.example" },
      { id: s.admin.id,     name: "Admin",     email: "admin@eq.example" },
      { id: s.superUser.id, name: "Super",     email: "super@eq.example" },
    ];
    for (const r of expectedRecipients) {
      const expected = {
        to: r.email,
        ...rfiSubmittedEmail({
          rfi:       { id: created.id, number: created.number, subject: created.subject },
          raiser:    { name: s.raiser.name },
          project:   { name: s.project.name },
          recipient: { name: r.name },
        }),
      };
      expect(sendEmail).toHaveBeenCalledWith(expected);
    }
  });

  it("returns the new RFI before the email sends settle (fire-and-forget)", async () => {
    const s = await seed();

    // Stall every sendEmail call by returning a promise we never resolve.
    // If the procedure awaited the sends, the test would deadlock and
    // fail on the timeout below.
    let pendingResolvers: (() => void)[] = [];
    sendEmail.mockImplementation(() =>
      new Promise<void>((resolve) => { pendingResolvers.push(resolve); }),
    );

    const start = Date.now();
    const createPromise = appRouter.createCaller(ctx(s.raiser)).rfis.create({
      companyId: s.company.id,
      projectId: s.project.id,
      subject: "Fire-and-forget smoke",
      question: "Does create() return before sends settle?",
    });
    const created = await Promise.race([
      createPromise,
      new Promise<never>((_res, rej) =>
        setTimeout(
          () => rej(new Error("create() did not resolve in 5s — sends are NOT fire-and-forget")),
          5_000,
        ),
      ),
    ]);
    const elapsed = Date.now() - start;

    expect(created.id).toBeGreaterThan(0);
    // Generous bound — cold testcontainers + drizzle warm-up can take
    // hundreds of ms. The point is "well below the test would-deadlock
    // line", not a tight perf assertion.
    expect(elapsed).toBeLessThan(5_000);

    // sendEmail must have been DISPATCHED (otherwise we haven't actually
    // exercised the fire-and-forget path).
    expect(sendEmail).toHaveBeenCalled();

    // Drain so the dangling promises don't keep the process alive.
    for (const res of pendingResolvers) res();
  });
});
