/**
 * Integration test: cross-tenant safety for the `update` and `delete`
 * procedures across every tenant-scoped resource. Mocks alone can't
 * prove this — they verify the procedure CONSTRUCTS a WHERE clause
 * with the right shape, but if a future refactor accidentally drops
 * the `companyId` predicate, the unit test still passes (because the
 * mock query builder evaluates nothing). This test runs against real
 * Postgres to confirm the SQL actually filters.
 *
 * Attack vector under test:
 *   Alice belongs to company A. She guesses (or sees) a row id from
 *   company B. She calls `resource.update({ id, companyId: A, ... })`
 *   or `resource.delete({ id, companyId: A })`.
 *   `companyScopedProcedure` lets her in (she IS a member of A).
 *   The handler builds a WHERE that filters on BOTH id AND companyId.
 *   No rows match (the row belongs to B). The mutation silently
 *   no-ops. The row in B is unchanged.
 *
 * If a future commit drops the companyId predicate, alice's mutation
 * lands on B's row, and one of these tests fails.
 *
 * Companion to `defects-tenant-isolation.integration.test.ts` which
 * covers the read path (defects.list) and the create-side FK lookup.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  companies,
  companyUsers,
  projects,
  users,
  tasks,
  inspections,
  rfis,
  observations,
  actionPlans,
  permits,
  dailyReports,
  incidents,
  defects,
} from "../../drizzle/schema";
import {
  getTestDb,
  setupTestPostgres,
  teardownTestPostgres,
  truncate,
} from "./setup";

let appRouter: typeof import("../../server/routers")["appRouter"];

beforeAll(async () => {
  await setupTestPostgres();
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "integration-test-secret";
  ({ appRouter } = await import("../../server/routers"));
}, 60_000);

afterAll(async () => {
  await teardownTestPostgres();
}, 30_000);

interface Fixture {
  companyA: { id: number };
  companyB: { id: number };
  projectA: { id: number };
  projectB: { id: number };
  alice: { id: number };
}

async function seedTenants(): Promise<Fixture> {
  const db = getTestDb();
  const [companyA] = await db.insert(companies).values({
    name: "Company A", slug: "company-a", primaryColor: "#000",
    cisStatus: "registered_20", activeAiProvider: "forge", activeAiModel: "default",
  }).returning();
  const [companyB] = await db.insert(companies).values({
    name: "Company B", slug: "company-b", primaryColor: "#000",
    cisStatus: "registered_20", activeAiProvider: "forge", activeAiModel: "default",
  }).returning();
  const [projectA] = await db.insert(projects).values({
    companyId: companyA.id, name: "Project A", status: "active",
  }).returning();
  const [projectB] = await db.insert(projects).values({
    companyId: companyB.id, name: "Project B", status: "active",
  }).returning();
  const [alice] = await db.insert(users).values({
    openId: "alice", name: "Alice", email: "alice@a.example", role: "user",
  }).returning();
  await db.insert(companyUsers).values({
    companyId: companyA.id, userId: alice.id, companyRole: "manager", isActive: true,
  });
  return { companyA, companyB, projectA, projectB, alice };
}

function callerForAlice(alice: Fixture["alice"]) {
  return appRouter.createCaller({
    user: alice as any,
    req: { protocol: "https", hostname: "localhost", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  });
}

beforeEach(async () => {
  await truncate([
    "tasks", "inspections", "rfis", "observations", "action_plans",
    "permits", "daily_reports", "incidents", "defects",
    "projects", "company_users", "companies", "users",
  ]);
});

describe("cross-tenant update/delete (real Postgres)", () => {
  it("tasks.update with company-A's companyId can't tamper with company-B's row", async () => {
    const db = getTestDb();
    const { companyA, companyB, projectB, alice } = await seedTenants();
    const [bRow] = await db.insert(tasks).values({
      companyId: companyB.id, projectId: projectB.id, title: "B's task",
    }).returning();

    await callerForAlice(alice).tasks.update({
      id: bRow.id, companyId: companyA.id, title: "Tampered by Alice",
    });

    const [after] = await db.select().from(tasks).where(eq(tasks.id, bRow.id));
    expect(after.title).toBe("B's task");
    expect(after.companyId).toBe(companyB.id);
  });

  it("tasks.delete with company-A's companyId can't delete company-B's row", async () => {
    const db = getTestDb();
    const { companyA, companyB, projectB, alice } = await seedTenants();
    const [bRow] = await db.insert(tasks).values({
      companyId: companyB.id, projectId: projectB.id, title: "B's task",
    }).returning();

    await callerForAlice(alice).tasks.delete({ id: bRow.id, companyId: companyA.id });

    const after = await db.select().from(tasks).where(eq(tasks.id, bRow.id));
    expect(after).toHaveLength(1);
  });

  it("inspections.update / .delete can't touch another tenant's row", async () => {
    const db = getTestDb();
    const { companyA, companyB, projectB, alice } = await seedTenants();
    const [bRow] = await db.insert(inspections).values({
      companyId: companyB.id, projectId: projectB.id, conductedById: 1, title: "B's inspection",
    }).returning();

    await callerForAlice(alice).inspections.update({
      id: bRow.id, companyId: companyA.id, title: "Tampered",
    });
    const [afterUpdate] = await db.select().from(inspections).where(eq(inspections.id, bRow.id));
    expect(afterUpdate.title).toBe("B's inspection");

    await callerForAlice(alice).inspections.delete({ id: bRow.id, companyId: companyA.id });
    const afterDelete = await db.select().from(inspections).where(eq(inspections.id, bRow.id));
    expect(afterDelete).toHaveLength(1);
  });

  it("rfis.update / .delete can't touch another tenant's row", async () => {
    const db = getTestDb();
    const { companyA, companyB, projectB, alice } = await seedTenants();
    const [bRow] = await db.insert(rfis).values({
      companyId: companyB.id, projectId: projectB.id, raisedById: 1,
      subject: "B's RFI", question: "B's question",
    }).returning();

    await callerForAlice(alice).rfis.update({
      id: bRow.id, companyId: companyA.id, subject: "Tampered",
    });
    const [afterUpdate] = await db.select().from(rfis).where(eq(rfis.id, bRow.id));
    expect(afterUpdate.subject).toBe("B's RFI");

    await callerForAlice(alice).rfis.delete({ id: bRow.id, companyId: companyA.id });
    const afterDelete = await db.select().from(rfis).where(eq(rfis.id, bRow.id));
    expect(afterDelete).toHaveLength(1);
  });

  it("observations.update / .delete can't touch another tenant's row", async () => {
    const db = getTestDb();
    const { companyA, companyB, projectB, alice } = await seedTenants();
    const [bRow] = await db.insert(observations).values({
      companyId: companyB.id, projectId: projectB.id, observedById: 1, title: "B's observation",
    }).returning();

    await callerForAlice(alice).observations.update({
      id: bRow.id, companyId: companyA.id, title: "Tampered",
    });
    const [afterUpdate] = await db.select().from(observations).where(eq(observations.id, bRow.id));
    expect(afterUpdate.title).toBe("B's observation");

    await callerForAlice(alice).observations.delete({ id: bRow.id, companyId: companyA.id });
    const afterDelete = await db.select().from(observations).where(eq(observations.id, bRow.id));
    expect(afterDelete).toHaveLength(1);
  });

  it("actionPlans.update / .delete can't touch another tenant's row", async () => {
    const db = getTestDb();
    const { companyA, companyB, projectB, alice } = await seedTenants();
    const [bRow] = await db.insert(actionPlans).values({
      companyId: companyB.id, projectId: projectB.id, createdById: 1, title: "B's plan",
    }).returning();

    await callerForAlice(alice).actionPlans.update({
      id: bRow.id, companyId: companyA.id, title: "Tampered",
    });
    const [afterUpdate] = await db.select().from(actionPlans).where(eq(actionPlans.id, bRow.id));
    expect(afterUpdate.title).toBe("B's plan");

    await callerForAlice(alice).actionPlans.delete({ id: bRow.id, companyId: companyA.id });
    const afterDelete = await db.select().from(actionPlans).where(eq(actionPlans.id, bRow.id));
    expect(afterDelete).toHaveLength(1);
  });

  it("permits.update / .delete can't touch another tenant's row", async () => {
    const db = getTestDb();
    const { companyA, companyB, projectB, alice } = await seedTenants();
    const [bRow] = await db.insert(permits).values({
      companyId: companyB.id, projectId: projectB.id, title: "B's permit", type: "hot_work",
    }).returning();

    await callerForAlice(alice).permits.update({
      id: bRow.id, companyId: companyA.id, title: "Tampered",
    });
    const [afterUpdate] = await db.select().from(permits).where(eq(permits.id, bRow.id));
    expect(afterUpdate.title).toBe("B's permit");

    await callerForAlice(alice).permits.delete({ id: bRow.id, companyId: companyA.id });
    const afterDelete = await db.select().from(permits).where(eq(permits.id, bRow.id));
    expect(afterDelete).toHaveLength(1);
  });

  it("dailyReports.update / .delete can't touch another tenant's row", async () => {
    const db = getTestDb();
    const { companyA, companyB, projectB, alice } = await seedTenants();
    const [bRow] = await db.insert(dailyReports).values({
      companyId: companyB.id, projectId: projectB.id,
      reportDate: new Date(), submittedBy: "bob",
    }).returning();

    await callerForAlice(alice).dailyReports.update({
      id: bRow.id, companyId: companyA.id, status: "approved",
    });
    const [afterUpdate] = await db.select().from(dailyReports).where(eq(dailyReports.id, bRow.id));
    expect(afterUpdate.status).toBe("draft");

    await callerForAlice(alice).dailyReports.delete({ id: bRow.id, companyId: companyA.id });
    const afterDelete = await db.select().from(dailyReports).where(eq(dailyReports.id, bRow.id));
    expect(afterDelete).toHaveLength(1);
  });

  it("incidents.update / .delete can't touch another tenant's row", async () => {
    const db = getTestDb();
    const { companyA, companyB, projectB, alice } = await seedTenants();
    const [bRow] = await db.insert(incidents).values({
      companyId: companyB.id, projectId: projectB.id,
      title: "B's incident", type: "near_miss", severity: "low", reportedBy: "bob",
    }).returning();

    await callerForAlice(alice).incidents.update({
      id: bRow.id, companyId: companyA.id, title: "Tampered",
    });
    const [afterUpdate] = await db.select().from(incidents).where(eq(incidents.id, bRow.id));
    expect(afterUpdate.title).toBe("B's incident");

    await callerForAlice(alice).incidents.delete({ id: bRow.id, companyId: companyA.id });
    const afterDelete = await db.select().from(incidents).where(eq(incidents.id, bRow.id));
    expect(afterDelete).toHaveLength(1);
  });

  it("defects.update / .delete can't touch another tenant's row", async () => {
    const db = getTestDb();
    const { companyA, companyB, projectB, alice } = await seedTenants();
    const [bRow] = await db.insert(defects).values({
      companyId: companyB.id, projectId: projectB.id, title: "B's defect", reportedBy: "bob",
    }).returning();

    // defects.update now throws NOT_FOUND when the row isn't visible
    // to the caller's tenant — strictly stronger than the silent no-op
    // the other resources still do, because the procedure pre-SELECTs
    // the row to gate the assignment-change push (Phase 3.6 follow-up).
    // The cross-tenant guarantee is preserved: B's row remains intact.
    await expect(
      callerForAlice(alice).defects.update({
        id: bRow.id, companyId: companyA.id, title: "Tampered",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const [afterUpdate] = await db.select().from(defects).where(eq(defects.id, bRow.id));
    expect(afterUpdate.title).toBe("B's defect");

    await callerForAlice(alice).defects.delete({ id: bRow.id, companyId: companyA.id });
    const afterDelete = await db.select().from(defects).where(eq(defects.id, bRow.id));
    expect(afterDelete).toHaveLength(1);
  });
});
