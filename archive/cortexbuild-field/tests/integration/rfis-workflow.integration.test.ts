/**
 * Integration test: full RFI lifecycle on a real Postgres container.
 *
 * Tests cover:
 *   - happy path: create → answer → approve, with DB column checks + email counts
 *   - reject: persists rejectedReason, emails raiser + answerer
 *   - cross-tenant: company B's admin cannot approve company A's RFI (FORBIDDEN)
 *   - respond alias: same DB writes as answer
 *
 * Requires Docker (testcontainers spins up postgres:16-alpine).
 * Run with: pnpm test:integration
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  setupTestPostgres,
  teardownTestPostgres,
  getTestDb,
  truncate,
} from "./setup";
import { rfis, projects, users, companyUsers, companies } from "../../drizzle/schema";

// Mock email so we don't try to talk to Brevo in CI.
const sendEmail = vi.fn(async () => {});
vi.mock("../../server/_core/email", () => ({ sendEmail }));

// Import appRouter AFTER the mock is registered and the container is up.
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
  await truncate(["rfis", "projects", "company_users", "users", "companies"]);
  sendEmail.mockClear();
});

async function seed() {
  const db = getTestDb();

  // companies.slug is notNull + unique — supply distinct slugs.
  const [companyA] = await db.insert(companies).values({
    name: "ACo", slug: "aco",
  }).returning();
  const [companyB] = await db.insert(companies).values({
    name: "BCo", slug: "bco",
  }).returning();

  const [raiser] = await db.insert(users).values({
    openId: "r", name: "Raiser", email: "r@a.example", role: "user",
  }).returning();
  const [answerer] = await db.insert(users).values({
    openId: "a", name: "Answerer", email: "a@a.example", role: "user",
  }).returning();
  const [admin] = await db.insert(users).values({
    openId: "ad", name: "Admin", email: "ad@a.example", role: "user",
  }).returning();
  const [otherAdmin] = await db.insert(users).values({
    openId: "ob", name: "OtherAdmin", email: "ob@b.example", role: "user",
  }).returning();

  await db.insert(companyUsers).values([
    { userId: raiser.id,     companyId: companyA.id, companyRole: "worker",        isActive: true },
    { userId: answerer.id,   companyId: companyA.id, companyRole: "manager",       isActive: true },
    { userId: admin.id,      companyId: companyA.id, companyRole: "company_admin", isActive: true },
    { userId: otherAdmin.id, companyId: companyB.id, companyRole: "company_admin", isActive: true },
  ]);

  const [project] = await db.insert(projects).values({
    companyId: companyA.id, name: "Site 1",
  }).returning();

  return { companyA, companyB, raiser, answerer, admin, otherAdmin, project };
}

function ctx(user: any) {
  return {
    user,
    // companyScopedProcedure always re-queries the DB for membership,
    // so ctx.companyMembership is irrelevant here — the middleware overwrites
    // it from the DB. We leave it null; the middleware will set it correctly.
    companyMembership: null,
    req: { protocol: "https", hostname: "localhost", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  } as any;
}

describe("rfi lifecycle on real Postgres", () => {
  it("happy path: create → answer → approve persists every column + emails the right people", async () => {
    const s = await seed();
    const db = getTestDb();

    // create as worker (raiser)
    const callerWorker = appRouter.createCaller(ctx(s.raiser));
    const created = await callerWorker.rfis.create({
      companyId: s.companyA.id, projectId: s.project.id,
      subject: "Beam check", question: "Beam grid B-7?",
    });
    expect(created.status).toBe("submitted");

    // answer as manager
    const callerMgr = appRouter.createCaller(ctx(s.answerer));
    await callerMgr.rfis.answer({
      id: created.id, companyId: s.companyA.id, response: "Use 305x165 UB46.",
    });

    let [row] = await db.select().from(rfis).where(eq(rfis.id, created.id));
    expect(row.status).toBe("answered");
    expect(row.answeredById).toBe(s.answerer.id);
    expect(row.respondedAt).toBeInstanceOf(Date);

    // approve as company_admin
    const callerAdmin = appRouter.createCaller(ctx(s.admin));
    await callerAdmin.rfis.approve({ id: created.id, companyId: s.companyA.id });

    [row] = await db.select().from(rfis).where(eq(rfis.id, created.id));
    expect(row.status).toBe("approved");
    expect(row.approvedById).toBe(s.admin.id);
    expect(row.approvedAt).toBeInstanceOf(Date);

    // Email recipients across the lifecycle:
    //   - on create:   admin (company_admin) + answerer (manager) → 2
    //   - on answer:   raiser (worker)                            → 1
    //   - on approve:  raiser + answerer                          → 2
    // Total: 5
    expect(sendEmail).toHaveBeenCalledTimes(5);
  });

  it("reject persists the reason and emails raiser + answerer", async () => {
    const s = await seed();
    const db = getTestDb();

    const created = await appRouter.createCaller(ctx(s.raiser))
      .rfis.create({
        companyId: s.companyA.id, projectId: s.project.id,
        subject: "x", question: "?",
      });
    await appRouter.createCaller(ctx(s.answerer))
      .rfis.answer({ id: created.id, companyId: s.companyA.id, response: "see above" });

    sendEmail.mockClear();

    await appRouter.createCaller(ctx(s.admin))
      .rfis.reject({ id: created.id, companyId: s.companyA.id, reason: "Need updated drawings" });

    const [row] = await db.select().from(rfis).where(eq(rfis.id, created.id));
    expect(row.status).toBe("rejected");
    expect(row.rejectedReason).toBe("Need updated drawings");

    // reject emails raiser + answerer
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const recipients = sendEmail.mock.calls.map((c: any[]) => c[0].to).sort();
    expect(recipients).toEqual([s.answerer.email, s.raiser.email].sort());
  });

  it("cross-tenant: company B's admin cannot approve company A's RFI (FORBIDDEN)", async () => {
    const s = await seed();

    const created = await appRouter.createCaller(ctx(s.raiser))
      .rfis.create({
        companyId: s.companyA.id, projectId: s.project.id,
        subject: "x", question: "?",
      });
    await appRouter.createCaller(ctx(s.answerer))
      .rfis.answer({ id: created.id, companyId: s.companyA.id, response: "ok" });

    // otherAdmin is a member of companyB only. companyScopedProcedure will
    // look up their membership for companyA in the DB and find none → FORBIDDEN.
    const otherAdminCaller = appRouter.createCaller(ctx(s.otherAdmin));
    await expect(
      otherAdminCaller.rfis.approve({ id: created.id, companyId: s.companyA.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("respond alias still works — same DB writes as answer", async () => {
    const s = await seed();
    const db = getTestDb();

    const created = await appRouter.createCaller(ctx(s.raiser))
      .rfis.create({
        companyId: s.companyA.id, projectId: s.project.id,
        subject: "x", question: "?",
      });

    await appRouter.createCaller(ctx(s.answerer))
      .rfis.respond({ id: created.id, companyId: s.companyA.id, response: "answered via alias" });

    const [row] = await db.select().from(rfis).where(eq(rfis.id, created.id));
    expect(row.status).toBe("answered");
    expect(row.answeredById).toBe(s.answerer.id);
    expect(row.response).toBe("answered via alias");
  });
});
