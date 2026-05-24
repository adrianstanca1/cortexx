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
import { users, companies, companyUsers } from "../../drizzle/schema";

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
  await db.insert(companyUsers).values({
    companyId: c.id, userId: u.id, companyRole: "company_admin",
  });
  return { companyId: c.id, userId: u.id };
}

function ctx(userId: number, companyId: number) {
  return {
    user: {
      id: userId, openId: `oid-${userId}`, name: "U", email: "u@x.com",
      loginMethod: "manus", role: "admin" as const,
      passwordHash: null, pushPreferences: {},
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

  it("rejects empty lineItems[] with nonzero cisDeductionAmount (no bypass via empty array)", async () => {
    const { userId, companyId } = await seedUserAndCompany();
    // labourSubtotal([]) = 0; expected CIS = 0; caller claims 9999 → REJECT.
    // The undefined back-compat path is for legacy clients sending a string
    // total without itemisation; an explicit empty array means "I told you
    // there is no labour" and contradicts any nonzero deduction.
    await expect(
      appRouter.createCaller(ctx(userId, companyId)).finance.createInvoice({
        companyId,
        invoiceNumber: "INV-6",
        lineItems: [],
        isCisJob: true,
        cisDeductionRate: 20,
        cisDeductionAmount: "9999.00",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("type:'receipt' bypasses CIS validation (records what the supplier billed)", async () => {
    const { userId, companyId } = await seedUserAndCompany();
    // A receipt with mismatched CIS would reject for a normal invoice (labour
    // £1000 × 20% = £200, caller claims £999). For receipts we accept the
    // supplier's number verbatim — the user has no authority to rewrite it,
    // and the receipt-scanner UI shows a non-blocking warning banner instead.
    const result = await appRouter.createCaller(ctx(userId, companyId)).finance.createInvoice({
      companyId,
      invoiceNumber: "RCPT-1",
      type: "receipt",
      lineItems: [
        { description: "Labour", quantity: 5, unit: "days", unitRate: 200, isLabour: true },
      ],
      isCisJob: true,
      cisDeductionRate: 20,
      cisDeductionAmount: "999.00",
    });
    expect(result.id).toBeDefined();
  });
});
