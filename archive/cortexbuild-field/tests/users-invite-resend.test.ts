import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { TrpcContext } from "../server/_core/context";

/**
 * Coverage for users.invite / listInvites / revokeInvite / resendInvite.
 * The acceptInvite procedure is covered separately by tests/invites.test.ts.
 *
 * Notable behaviours pinned:
 *   - invite generates a 6-digit PIN and a 7-day expiry; sends an
 *     email-relay via notifyOwner; survives notify failures
 *     non-blockingly (the invite row is the source of truth).
 *   - revokeInvite is a status flip to 'expired' (NOT a hard DELETE).
 *   - resendInvite rotates the PIN, extends expiry, and flips back to
 *     'pending' even if the previous invite had already expired.
 */

const notifyOwnerMock = vi.fn();
vi.mock("../server/_core/notification", () => ({
  notifyOwner: notifyOwnerMock,
}));

const sendEmailMock = vi.fn();
vi.mock("../server/_core/email", () => ({
  sendEmail: sendEmailMock,
}));

interface DbCalls {
  selectFroms: { table: string }[];
  inserts: { table: string; values: any }[];
  updates: { table: string; values: any }[];
  invitesSelectReturn: any[];
}
const dbCalls: DbCalls = {
  selectFroms: [], inserts: [], updates: [], invitesSelectReturn: [],
};

function tableName(table: any): string {
  return getTableName(table);
}

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({
    select() {
      return {
        from(table: any) {
          const name = tableName(table);
          dbCalls.selectFroms.push({ table: name });
          const returnRows = name === 'invited_users' ? dbCalls.invitesSelectReturn : [];
          const chain: any = {
            where(_c: unknown) { return chain; },
            orderBy(_o: unknown) { return chain; },
            limit(_n: number) { return Promise.resolve(returnRows); },
            then(resolve: any) { return Promise.resolve(returnRows).then(resolve); },
          };
          return chain;
        },
      };
    },
    insert(table: any) {
      return {
        values(values: any) {
          const name = tableName(table);
          dbCalls.inserts.push({ table: name, values });
          return Promise.resolve();
        },
      };
    },
    update(table: any) {
      return {
        set(values: any) {
          const name = tableName(table);
          dbCalls.updates.push({ table: name, values });
          return { where(_c: unknown) { return Promise.resolve(); } };
        },
      };
    },
  })),
}));

const { appRouter } = await import("../server/routers");

function ctxFor(userId: number | null = 1, role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: userId === null ? null : {
      id: userId, openId: `user-${userId}`, name: `User ${userId}`,
      email: `u${userId}@example.com`, loginMethod: "manus", role,
      passwordHash: null, pushPreferences: {}, createdAt: new Date(), updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any,
    req: { protocol: "https", hostname: "localhost", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

beforeEach(() => {
  dbCalls.selectFroms.length = 0;
  dbCalls.inserts.length = 0;
  dbCalls.updates.length = 0;
  dbCalls.invitesSelectReturn = [];
  notifyOwnerMock.mockReset().mockResolvedValue(true);
  sendEmailMock.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("users.invite", () => {
  it("generates a 6-digit PIN, 7-day expiry, and persists the invite row (PIN delivered via email, NOT response — closes P1-A)", async () => {
    const before = Date.now();
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    const result = await caller.users.invite({
      companyId: 7,
      email: 'newhire@example.com', name: 'New Hire',
    });
    const after = Date.now();

    // PIN lives in the persisted row, not the response.
    const insert = dbCalls.inserts.find(i => i.table === 'invited_users')!;
    expect(insert.values.pin).toMatch(/^\d{6}$/);
    expect(result).not.toHaveProperty('pin');
    expect(result).not.toHaveProperty('onboardingLink');

    expect(result.message).toContain('newhire@example.com');
    // Expiry is 7 days from issue (small tolerance for test-runtime drift).
    const expiresAtMs = new Date(result.expiresAt).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expiresAtMs).toBeLessThanOrEqual(after + sevenDaysMs + 1000);

    expect(insert.values.email).toBe('newhire@example.com');
    expect(insert.values.role).toBe('field_worker'); // default
    expect(insert.values.employeeClass).toBe('Operative'); // default
  });

  it("sends invitation email to the invitee containing the PIN (closes P1-A delivery channel)", async () => {
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    await caller.users.invite({
      companyId: 7,
      email: 'alice@test.com', name: 'A B',
    });
    const generatedPin = dbCalls.inserts.find(i => i.table === 'invited_users')!.values.pin;
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0][0];
    expect(call.to).toBe('alice@test.com');
    expect(call.subject).toMatch(/CortexBuild|Invitation/);
    expect(call.text).toContain(generatedPin);
    expect(call.text).toContain('alice@test.com');
  });

  it("still notifies the owner (admin email-relay) with the PIN in the body", async () => {
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    await caller.users.invite({
      companyId: 7,
      email: 'alice@test.com', name: 'A B',
    });
    const generatedPin = dbCalls.inserts.find(i => i.table === 'invited_users')!.values.pin;
    expect(notifyOwnerMock).toHaveBeenCalledTimes(1);
    const call = notifyOwnerMock.mock.calls[0][0];
    expect(call.title).toMatch(/Invitation for A B/);
    expect(call.content).toContain(generatedPin);
    expect(call.content).toContain('alice@test.com');
  });

  it("non-blocking on notifyOwner failure — invite row still persisted, email still attempted", async () => {
    notifyOwnerMock.mockRejectedValueOnce(new Error('upstream down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    const result = await caller.users.invite({
      companyId: 7, email: 'xander@test.com', name: 'X',
    });
    expect(result.success).toBe(true);
    expect(dbCalls.inserts.filter(i => i.table === 'invited_users')).toHaveLength(1);
    expect(sendEmailMock).toHaveBeenCalledTimes(1); // invitee email still went out
  });

  it("propagates Brevo failure as an error (admin sees it; can use resendInvite to retry)", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('Brevo 502 Bad Gateway'));
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    await expect(
      caller.users.invite({
        companyId: 7, email: 'fails@test.com', name: 'X',
      }),
    ).rejects.toThrow(/Brevo/i);
  });

  it("rejects malformed email via zod", async () => {
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    await expect(caller.users.invite({
      companyId: 7, email: 'not-an-email', name: 'X',
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(dbCalls.inserts).toHaveLength(0);
  });

  it("rejects calls without companyId (BAD_REQUEST — closes IDOR P1-B)", async () => {
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    await expect(
      // @ts-expect-error — deliberately omitting companyId
      caller.users.invite({ email: 'x@y.com', name: 'X' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(dbCalls.inserts).toHaveLength(0);
  });

  it("non-admin caller without membership in companyId gets FORBIDDEN", async () => {
    const caller = appRouter.createCaller(ctxFor(1)); // role 'user', no membership row mocked
    await expect(
      caller.users.invite({ companyId: 99, email: 'x@y.com', name: 'X' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(dbCalls.inserts).toHaveLength(0);
  });
});

describe("users.listInvites", () => {
  it("filters by companyId in the WHERE clause", async () => {
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    await caller.users.listInvites({ companyId: 7 });
    expect(dbCalls.selectFroms.filter(s => s.table === 'invited_users')).toHaveLength(1);
  });

  it("rejects unauthenticated callers (UNAUTHORIZED)", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(caller.users.listInvites({ companyId: 7 })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it("rejects calls without companyId (BAD_REQUEST — closes IDOR P1-C)", async () => {
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    // @ts-expect-error — deliberately omitting companyId
    await expect(caller.users.listInvites({})).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(dbCalls.selectFroms).toHaveLength(0);
  });

  it("non-admin caller without membership in companyId gets FORBIDDEN", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.users.listInvites({ companyId: 99 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe("users.revokeInvite", () => {
  it("flips status to 'expired' (NOT a hard DELETE)", async () => {
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    await caller.users.revokeInvite({ id: 5, companyId: 7 });
    const update = dbCalls.updates.find(u => u.table === 'invited_users')!;
    expect(update.values.status).toBe('expired');
  });

  it("rejects unauthenticated callers (UNAUTHORIZED)", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(caller.users.revokeInvite({ id: 5, companyId: 7 })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it("rejects calls without companyId (BAD_REQUEST — closes IDOR P1-D)", async () => {
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    // @ts-expect-error — deliberately omitting companyId
    await expect(caller.users.revokeInvite({ id: 5 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    // No DB write should happen if the gate rejected before the handler.
    expect(dbCalls.updates).toHaveLength(0);
  });

  it("non-admin users without membership in companyId get FORBIDDEN (cross-tenant revoke blocked)", async () => {
    // Default ctxFor (no admin role) + getDb mock returns no companyUsers row,
    // so the companyScopedProcedure middleware blocks before the handler runs.
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(caller.users.revokeInvite({ id: 5, companyId: 99 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(dbCalls.updates).toHaveLength(0);
  });
});

describe("users.resendInvite", () => {
  it("rotates PIN, extends expiry, flips to 'pending', delivers via email NOT response (closes P1-F)", async () => {
    const before = Date.now();
    dbCalls.invitesSelectReturn = [{
      id: 9, email: 'returning@test.com', status: 'expired',
      pin: '111111', expiresAt: new Date(before - 86400_000), // 1 day ago
    }];
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.users.resendInvite({ email: 'returning@test.com' });
    const after = Date.now();

    // Rotated PIN lives on the DB update — not in the response.
    const update = dbCalls.updates.find(u => u.table === 'invited_users')!;
    expect(update.values.pin).toMatch(/^\d{6}$/);
    expect(update.values.pin).not.toBe('111111'); // rotated
    expect(update.values.status).toBe('pending'); // flipped back from 'expired'
    expect(result).not.toHaveProperty('pin');
    expect(result).not.toHaveProperty('onboardingLink');
    const newExpMs = new Date(update.values.expiresAt).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(newExpMs).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(newExpMs).toBeLessThanOrEqual(after + sevenDaysMs + 1000);

    // Email goes to the invitee with the new PIN (the only delivery channel now).
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const emailCall = sendEmailMock.mock.calls[0][0];
    expect(emailCall.to).toBe('returning@test.com');
    expect(emailCall.text).toContain(update.values.pin);
  });

  it("throws when no invite row matches the email", async () => {
    dbCalls.invitesSelectReturn = [];
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(caller.users.resendInvite({
      email: 'noone@nowhere.com',
    })).rejects.toThrow(/No invitation found/);
    expect(dbCalls.updates).toHaveLength(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("survives notifyOwner failure (PIN is already rotated, sent via Brevo, persisted)", async () => {
    dbCalls.invitesSelectReturn = [{
      id: 9, email: 'xander@test.com', status: 'pending', pin: '111111',
    }];
    notifyOwnerMock.mockRejectedValueOnce(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.users.resendInvite({ email: 'xander@test.com' });
    expect(result.success).toBe(true);
    const update = dbCalls.updates.find(u => u.table === 'invited_users')!;
    expect(update.values.pin).toMatch(/^\d{6}$/);
    expect(sendEmailMock).toHaveBeenCalledTimes(1); // primary delivery path still ran
  });

  it("propagates Brevo failure (PIN was rotated in DB but admin sees the error)", async () => {
    dbCalls.invitesSelectReturn = [{
      id: 9, email: 'fail@test.com', status: 'pending', pin: '111111',
    }];
    sendEmailMock.mockRejectedValueOnce(new Error('Brevo 503 Service Unavailable'));
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.users.resendInvite({ email: 'fail@test.com' }),
    ).rejects.toThrow(/Brevo/i);
  });
});
