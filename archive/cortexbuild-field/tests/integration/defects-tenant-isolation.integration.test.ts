/**
 * Integration test: tenant-isolation for `defects.*` against a REAL
 * Postgres container with REAL migrations applied. Most of the unit
 * tests for tenant scoping mock `getDb` with a stub query builder —
 * which proves the procedure constructs the right Drizzle expressions,
 * but cannot prove that the resulting SQL actually filters correctly
 * once the DB engine evaluates it.
 *
 * This test:
 *   1. Spins up Postgres 16 in Docker (testcontainers).
 *   2. Applies the production migrations.
 *   3. Seeds two companies with one project each + a defect on each.
 *   4. Calls `defects.list` for company A.
 *   5. Asserts the result contains ONLY company A's defect — no leak.
 *
 * If a future regression weakens the WHERE clause (e.g. drops the
 * `eq(dbDefects.companyId, ...)` predicate), this test fails where the
 * mocked unit test would silently pass.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  companies,
  companyUsers,
  defects,
  projects,
  users,
} from "../../drizzle/schema";
import {
  getTestDb,
  setupTestPostgres,
  teardownTestPostgres,
  truncate,
} from "./setup";

let appRouter: typeof import("../../server/routers")["appRouter"];

beforeAll(async () => {
  // Boot the container + apply migrations BEFORE importing routers,
  // because server/db.ts caches the postgres-js connection on first
  // use. We need DATABASE_URL set when that first call happens.
  await setupTestPostgres();
  // Ensure JWT_SECRET is set so the routers module loads cleanly.
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "integration-test-secret";
  ({ appRouter } = await import("../../server/routers"));
}, 120_000); // container boot + migrations (CI runners can be slow)

afterAll(async () => {
  await teardownTestPostgres();
}, 30_000);

beforeEach(async () => {
  // Wipe domain rows between tests so seeds don't leak across cases.
  await truncate(["defects", "projects", "company_users", "companies", "users"]);
});

describe("defects tenant isolation (real Postgres)", () => {
  it("only returns defects for the caller's company even when the table contains other tenants' rows", async () => {
    const db = getTestDb();

    // Seed two tenants with their own project + defect each.
    const [companyA] = await db.insert(companies).values({
      name: "Company A",
      slug: "company-a",
      primaryColor: "#000",
      cisStatus: "registered_20",
      activeAiProvider: "forge",
      activeAiModel: "default",
    }).returning();
    const [companyB] = await db.insert(companies).values({
      name: "Company B",
      slug: "company-b",
      primaryColor: "#000",
      cisStatus: "registered_20",
      activeAiProvider: "forge",
      activeAiModel: "default",
    }).returning();

    const [projectA] = await db.insert(projects).values({
      companyId: companyA.id, name: "Project A", status: "active",
    }).returning();
    const [projectB] = await db.insert(projects).values({
      companyId: companyB.id, name: "Project B", status: "active",
    }).returning();

    await db.insert(defects).values({
      companyId: companyA.id, projectId: projectA.id, title: "A's defect", reportedBy: "alice",
    });
    await db.insert(defects).values({
      companyId: companyB.id, projectId: projectB.id, title: "B's defect", reportedBy: "bob",
    });

    // The caller is a member of company A.
    const [aliceUser] = await db.insert(users).values({
      openId: "alice", name: "Alice", email: "alice@a.example", role: "user",
    }).returning();
    await db.insert(companyUsers).values({
      companyId: companyA.id, userId: aliceUser.id, companyRole: "manager", isActive: true,
    });

    const caller = appRouter.createCaller({
      user: aliceUser as any,
      req: { protocol: "https", hostname: "localhost", headers: {} } as any,
      res: { clearCookie: vi.fn() } as any,
    });

    const rows = await caller.defects.list({ companyId: companyA.id });

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("A's defect");
    // Belt-and-braces: companyId on the returned row must match the request.
    expect(rows[0].companyId).toBe(companyA.id);
  });

  it("FORBIDs defects.create when the projectId belongs to another company (real FK lookup)", async () => {
    const db = getTestDb();
    const [companyA] = await db.insert(companies).values({
      name: "A", slug: "a", primaryColor: "#000", cisStatus: "registered_20",
      activeAiProvider: "forge", activeAiModel: "default",
    }).returning();
    const [companyB] = await db.insert(companies).values({
      name: "B", slug: "b", primaryColor: "#000", cisStatus: "registered_20",
      activeAiProvider: "forge", activeAiModel: "default",
    }).returning();

    // Alice is a member of company A. The project belongs to company B.
    const [projectB] = await db.insert(projects).values({
      companyId: companyB.id, name: "B's project", status: "active",
    }).returning();
    const [aliceUser] = await db.insert(users).values({
      openId: "alice", name: "Alice", email: "alice@a.example", role: "user",
    }).returning();
    await db.insert(companyUsers).values({
      companyId: companyA.id, userId: aliceUser.id, companyRole: "manager", isActive: true,
    });

    const caller = appRouter.createCaller({
      user: aliceUser as any,
      req: { protocol: "https", hostname: "localhost", headers: {} } as any,
      res: { clearCookie: vi.fn() } as any,
    });

    // Alice tries to write to company B's project. companyScopedProcedure
    // accepts the call (she's a member of A). The handler then does a
    // project↔company lookup and FORBIDs. With the real Postgres, this
    // verifies the actual SQL predicate works — not just that the JS
    // builder constructs the right shape.
    await expect(
      caller.defects.create({
        companyId: companyA.id,
        projectId: projectB.id,
        title: "Cross-tenant attempt",
        reportedBy: "alice",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Confirm no row was inserted.
    const rows = await db.select().from(defects).where(eq(defects.title, "Cross-tenant attempt"));
    expect(rows).toHaveLength(0);
  });
});
