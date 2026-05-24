/**
 * Characterisation tests for `recipientsByCompanyRole` in
 * `server/_core/notifications/recipients.ts`.
 *
 * Pins the role-hierarchy filter that today is open-coded in the rfis.*
 * mutations as:
 *
 *   const RECIPIENT_ROLES = ["manager", "company_admin", "super_admin"]
 *   memberships.filter(m => RECIPIENT_ROLES.includes(m.companyRole))
 *
 * Step 2 must move that filter into `recipientsByCompanyRole(db, cid,
 * "manager")` while still using the SAME numeric hierarchy declared in
 * `lib/company-context.tsx#ROLE_LEVELS` (mirrored in
 * `server/_core/role-check.ts`).
 *
 * Mocking strategy:
 *   We mock the DB at the smallest possible boundary — a fake `Db`
 *   object whose `select(...).from(...).where(...)` chain resolves with
 *   the fixture rows we set up per test. We do NOT spin up Postgres;
 *   that's the integration test's job.
 *
 * All three tests fail today against the stub
 * (`throw new Error("not implemented — Step 2")`). They turn green when
 * Step 2 lands the implementation.
 *
 * NOTE on role helper extraction:
 *   `lib/company-context.tsx` exports `hasPermission` but pulls in
 *   React + AsyncStorage; importing it from server code would drag the
 *   RN runtime into the API bundle. The numeric hierarchy is already
 *   duplicated server-side in `server/_core/role-check.ts#ROLE_LEVELS`.
 *   Step 2 should reuse THAT copy (export it, or call requireCompanyRole
 *   in a try/catch) — see the handoff note in the parent task.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../../../server/_core/notifications/recipients";
import { log } from "../../../server/_core/logger";

const { recipientsByCompanyRole, recipientsByUserIds, safeRecipients } = await import(
  "../../../server/_core/notifications/recipients"
);

/**
 * Fake drizzle handle that captures the most recent `from()` table and
 * returns whatever rows we've staged on `mockRows`. Mirrors the pattern
 * in `tests/rfis-router.test.ts` but stripped down — recipients only
 * issues two reads (companyUsers, then users), no inserts/updates.
 */
interface FakeDb {
  /** Set this before calling the function under test. */
  mockRows: { companyUsers?: any[]; users?: any[] };
  /** Captured for assertions. */
  fromCalls: string[];
}

function makeFakeDb(): FakeDb & Pick<Db, "select"> {
  // Single live object — the closure below reads `fake.mockRows`
  // directly, so `db.mockRows = {...}` reassignment in tests is picked
  // up at query time. (An earlier version split `state` and the
  // returned object via `Object.assign`, which silently broke
  // reassignment because the closure kept reading the stale `state`
  // reference.)
  const fake: any = {
    mockRows: { companyUsers: [] as any[], users: [] as any[] },
    fromCalls: [] as string[],
  };
  fake.select = vi.fn(() => ({
    from(table: any) {
      // Match by the drizzle-internal table name. `getTableName(table)`
      // would also work but importing it here makes the helper depend
      // on drizzle-orm at test time — keep it simple with a duck check.
      const name =
        (table?.[Symbol.for("drizzle:Name")] as string | undefined) ??
        (table?._?.name as string | undefined) ??
        "unknown";
      fake.fromCalls.push(name);
      const rows =
        name === "company_users"
          ? fake.mockRows.companyUsers ?? []
          : name === "users"
            ? fake.mockRows.users ?? []
            : [];
      // Chainable terminator: both `.where(...)` and direct await must
      // resolve to the rows. `.then()` makes the chain itself awaitable
      // (matches the pattern in tests/rfis-router.test.ts).
      const chain: any = {
        where(_p: unknown) { return chain; },
        orderBy(_o: unknown) { return Promise.resolve(rows); },
        limit(_n: number) { return Promise.resolve(rows); },
        then(resolve: any, reject?: any) {
          return Promise.resolve(rows).then(resolve, reject);
        },
      };
      return chain;
    },
  }));
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

const COMPANY_ID = 7;

// Five memberships across every role tier — used by the happy-path test.
// userIds are arbitrary but distinct so we can assert recipient identity.
const MEMBERSHIP_FIXTURES = [
  { id: 1, companyId: COMPANY_ID, userId: 11, companyRole: "worker",        isActive: true },
  { id: 2, companyId: COMPANY_ID, userId: 12, companyRole: "supervisor",    isActive: true },
  { id: 3, companyId: COMPANY_ID, userId: 13, companyRole: "manager",       isActive: true },
  { id: 4, companyId: COMPANY_ID, userId: 14, companyRole: "company_admin", isActive: true },
  { id: 5, companyId: COMPANY_ID, userId: 15, companyRole: "super_admin",   isActive: true },
] as const;

const USER_FIXTURES = [
  { id: 11, name: "Worker One",     email: "w1@example.com" },
  { id: 12, name: "Supervisor Two", email: "s2@example.com" },
  { id: 13, name: "Manager Three",  email: "m3@example.com" },
  { id: 14, name: "Admin Four",     email: "a4@example.com" },
  { id: 15, name: "Super Five",     email: "su5@example.com" },
] as const;

// ─── 1. Role-filtered active members ─────────────────────────────────────────

describe("recipientsByCompanyRole — role-filtered active members", () => {
  it("with minRole='manager', returns 3 recipients (manager / company_admin / super_admin)", async () => {
    const db = makeFakeDb();
    db.mockRows = {
      companyUsers: [...MEMBERSHIP_FIXTURES],
      users: [...USER_FIXTURES],
    };

    const recipients = await recipientsByCompanyRole(db as unknown as Db, COMPANY_ID, "manager");

    // Order-agnostic — implementation may sort.
    const ids = recipients.map(r => r.userId).sort((a, b) => a - b);
    expect(ids).toEqual([13, 14, 15]);

    // Shape check on the manager row — every recipient must carry
    // userId / email / name (the NotificationRecipient contract).
    const manager = recipients.find(r => r.userId === 13);
    expect(manager).toEqual({
      userId: 13,
      email: "m3@example.com",
      name: "Manager Three",
    });
  });
});

// ─── 2. Excludes isActive=false ──────────────────────────────────────────────

describe("recipientsByCompanyRole — excludes inactive memberships", () => {
  it("with the manager marked isActive=false, returns only company_admin and super_admin", async () => {
    const db = makeFakeDb();
    db.mockRows = {
      companyUsers: MEMBERSHIP_FIXTURES.map(m =>
        m.companyRole === "manager" ? { ...m, isActive: false } : m,
      ),
      users: [...USER_FIXTURES],
    };

    const recipients = await recipientsByCompanyRole(db as unknown as Db, COMPANY_ID, "manager");
    const ids = recipients.map(r => r.userId).sort((a, b) => a - b);
    expect(ids).toEqual([14, 15]);
  });
});

// ─── 3. Excludes lower roles ─────────────────────────────────────────────────

describe("recipientsByCompanyRole — excludes lower roles", () => {
  it("with minRole='manager' and only worker+supervisor fixtures, returns []", async () => {
    const db = makeFakeDb();
    db.mockRows = {
      companyUsers: MEMBERSHIP_FIXTURES.filter(
        m => m.companyRole === "worker" || m.companyRole === "supervisor",
      ),
      users: USER_FIXTURES.filter(u => u.id === 11 || u.id === 12),
    };

    const recipients = await recipientsByCompanyRole(db as unknown as Db, COMPANY_ID, "manager");
    expect(recipients).toEqual([]);
  });
});

// ─── 4. recipientsByUserIds — happy path ─────────────────────────────────────

describe("recipientsByUserIds — happy path", () => {
  it("returns one NotificationRecipient per matching user, preserving null email", async () => {
    const db = makeFakeDb();
    db.mockRows = {
      // companyUsers fixture is irrelevant for this resolver — it only
      // touches the `users` table. Set anyway so a future regression
      // that calls the wrong table fails loudly via fromCalls.
      companyUsers: [],
      users: [
        { id: 13, name: "Manager Three", email: "m3@example.com" },
        { id: 14, name: "Admin Four",    email: null },
      ],
    };

    const recipients = await recipientsByUserIds(db as unknown as Db, [13, 14]);

    expect(recipients).toEqual([
      { userId: 13, email: "m3@example.com", name: "Manager Three" },
      { userId: 14, email: null,             name: "Admin Four" },
    ]);
    // Only the `users` table is queried — the resolver does NOT touch
    // companyUsers (no role / membership concept here).
    expect((db as unknown as { fromCalls: string[] }).fromCalls).toEqual(["users"]);
  });
});

// ─── 5. recipientsByUserIds — strips null/undefined inputs ───────────────────

describe("recipientsByUserIds — strips null/undefined IDs", () => {
  it("filters null/undefined out of the input array; queries with only the real IDs", async () => {
    const db = makeFakeDb();
    db.mockRows = {
      companyUsers: [],
      users: [
        { id: 13, name: "Manager Three", email: "m3@example.com" },
      ],
    };

    // [rfi.raisedById, rfi.answeredById] when the RFI isn't answered yet:
    // raisedById is a number, answeredById is null. Resolver must
    // tolerate that without throwing.
    const recipients = await recipientsByUserIds(db as unknown as Db, [13, null, undefined]);
    expect(recipients).toEqual([
      { userId: 13, email: "m3@example.com", name: "Manager Three" },
    ]);
  });

  it("returns [] when every input is null/undefined (no SQL query issued)", async () => {
    const db = makeFakeDb();
    db.mockRows = { companyUsers: [], users: [{ id: 13, name: "x", email: "x@x" }] };

    const recipients = await recipientsByUserIds(db as unknown as Db, [null, undefined]);
    expect(recipients).toEqual([]);
    // Critical: the resolver must short-circuit BEFORE issuing the
    // `select().from(users)` query. Otherwise an empty `inArray` could
    // turn into an unbounded scan on some PG configurations.
    expect((db as unknown as { fromCalls: string[] }).fromCalls).toEqual([]);
  });
});

// ─── 6. recipientsByUserIds — empty input ────────────────────────────────────

describe("recipientsByUserIds — empty input", () => {
  it("returns [] for an empty array without issuing a query", async () => {
    const db = makeFakeDb();
    db.mockRows = { companyUsers: [], users: [{ id: 13, name: "x", email: "x@x" }] };

    const recipients = await recipientsByUserIds(db as unknown as Db, []);
    expect(recipients).toEqual([]);
    expect((db as unknown as { fromCalls: string[] }).fromCalls).toEqual([]);
  });
});

// ─── 7. safeRecipients — Architect M5 (resolver throw must NOT leak) ─────────

describe("safeRecipients — swallows resolver throws", () => {
  it("returns the resolver's value on success (no logging)", async () => {
    const errSpy = vi.spyOn(log, "error").mockImplementation(() => {});

    const result = await safeRecipients(
      async () => [
        { userId: 11, email: "a@x", name: "A" },
        { userId: 12, email: "b@x", name: "B" },
      ],
      "rfis.create",
    );
    expect(result).toEqual([
      { userId: 11, email: "a@x", name: "A" },
      { userId: 12, email: "b@x", name: "B" },
    ]);
    // Pure happy-path — no error log.
    expect(errSpy).not.toHaveBeenCalled();

    errSpy.mockRestore();
  });

  it("returns [] when the resolver throws; logs the cause with the context tag", async () => {
    const errSpy = vi.spyOn(log, "error").mockImplementation(() => {});

    // Simulate a transient drizzle SELECT failure mid-mutation.
    const cause = new Error("connection terminated unexpectedly");
    const result = await safeRecipients(
      async () => { throw cause; },
      "rfis.approve",
    );

    // The mutation that called us has ALREADY committed by this
    // point — returning [] means the fan-out is a no-op (no
    // emails) but the procedure proceeds to its `return`. Without
    // this swallow, the throw would propagate to tRPC, the client
    // would retry, and the row would be inserted again.
    expect(result).toEqual([]);

    // The cause is preserved in stderr with the context tag so ops
    // can grep by site.
    const logged = errSpy.mock.calls.some((args) =>
      args.some((a) => typeof a === "string" && a.includes("rfis.approve")) &&
      args.includes(cause),
    );
    expect(logged).toBe(true);

    errSpy.mockRestore();
  });
});
