import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";

let inserts: any[];

vi.mock("../../server/db", () => ({
  getDb: vi.fn(async () => ({
    insert(table: any) {
      return {
        values(values: any) {
          const name = getTableName(table);
          inserts.push({ table: name, values });
          return Promise.resolve();
        },
      };
    },
  })),
}));

const { writeAuditLog } = await import("../../server/_core/audit");

beforeEach(() => {
  inserts = [];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("writeAuditLog", () => {
  it("inserts one row with the canonical fields", async () => {
    const ok = await writeAuditLog({
      companyId: 7,
      userId: 11,
      action: "users.revokeInvite",
      entityType: "invited_user",
      entityId: 99,
      input: { id: 99, companyId: 7 },
      result: { success: true },
    });
    expect(ok).toBe(true);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].table).toBe("audit_log");
    expect(inserts[0].values).toMatchObject({
      companyId: 7,
      userId: 11,
      action: "users.revokeInvite",
      entityType: "invited_user",
      entityId: 99,
    });
  });

  it("redacts credentials from input JSON before persisting", async () => {
    await writeAuditLog({
      companyId: 7,
      userId: 11,
      action: "users.invite",
      input: { email: "x@y.com", pin: "654321", companyId: 7 },
      result: { success: true },
    });
    const v = inserts[0].values;
    expect(v.inputJson).toContain("x@y.com");
    expect(v.inputJson).not.toContain("654321");
    expect(v.inputJson).toContain("[REDACTED]");
  });

  it("captures ip + userAgent from the Express request", async () => {
    const req: any = {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1", "user-agent": "Test/1.0" },
      ip: "10.0.0.1",
      socket: { remoteAddress: "127.0.0.1" },
    };
    await writeAuditLog({
      companyId: 7, userId: 11, action: "x.y", req,
    });
    expect(inserts[0].values.ip).toBe("1.2.3.4");
    expect(inserts[0].values.userAgent).toBe("Test/1.0");
  });

  it("records error code + message on failure-type events", async () => {
    await writeAuditLog({
      companyId: 7, userId: 11, action: "users.acceptInvite",
      input: { email: "x@y.com", pin: "000000" },
      errorCode: "UNAUTHORIZED",
      errorMessage: "Invalid email or PIN",
    });
    expect(inserts[0].values.errorCode).toBe("UNAUTHORIZED");
    expect(inserts[0].values.errorMessage).toBe("Invalid email or PIN");
    expect(inserts[0].values.resultJson).toBeNull();
  });

  it("never throws — DB failure returns false but caller continues", async () => {
    // Re-mock getDb to return null (db unavailable).
    const dbModule = await import("../../server/db");
    vi.spyOn(dbModule, "getDb").mockResolvedValueOnce(null as any);
    const ok = await writeAuditLog({
      companyId: 7, userId: 11, action: "x.y",
    });
    expect(ok).toBe(false);
    // No insert recorded.
    expect(inserts).toHaveLength(0);
  });

  it("redacts oversized single fields via the logger long-string stub", async () => {
    const huge = { blob: "x".repeat(20_000) };
    await writeAuditLog({
      companyId: 7, userId: 11, action: "x.y", input: huge,
    });
    const v = inserts[0].values;
    expect(v.inputJson.length).toBeLessThan(200);
    expect(v.inputJson).toContain("[redacted-long-string");
  });

  it("truncates oversized aggregate JSON (many small fields > 8 KB) via the audit layer", async () => {
    const wide: Record<string, string> = {};
    // ~200 fields × 50 bytes each ≈ 10 KB serialised. Each value ≤ 200 chars
    // so the per-field long-string stub doesn't fire — the audit truncation
    // layer is the one that has to keep the row bounded.
    for (let i = 0; i < 200; i++) wide[`field${i}`] = "v".repeat(50);
    await writeAuditLog({
      companyId: 7, userId: 11, action: "x.y", input: wide,
    });
    const v = inserts[0].values;
    expect(v.inputJson.length).toBeLessThan(9_000);
    expect(v.inputJson).toContain("[truncated:");
  });
});
