import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { TrpcContext } from "../server/_core/context";

/**
 * Tests for `defects.update` and `defects.delete` — the new procedures
 * that complete the CRUD set for the snag list. Mirrors the test
 * shape of `tests/announcements-update.test.ts` and
 * `tests/drawings-update-delete.test.ts`.
 */

const dbCalls: {
  membershipChecks: number;
  updateSets: Record<string, unknown>[];
  deletes: number;
  // Set this to inject a "previous row" for defects.update — the
  // procedure SELECTs before updating to detect reassignments.
  defectsPrevious: Record<string, unknown>[];
} = { membershipChecks: 0, updateSets: [], deletes: 0, defectsPrevious: [] };

const pushCalls: { name: string; eventType: string; payload: unknown }[] = [];
const pendingPushes: Promise<unknown>[] = [];
vi.mock("../server/_core/pushNotifications", () => ({
  sendPushToUserByName: vi.fn((name: string, eventType: string, payload: unknown) => {
    // Capture the promise so tests can await it deterministically
    // instead of relying on a single setImmediate microtask. A future
    // refactor that wraps the call site in Promise.resolve().then(...)
    // or queues through a real worker would otherwise let the assertion
    // fire before the push lands and silently pass with pushCalls=[].
    const p = (async () => {
      pushCalls.push({ name, eventType, payload });
      return { attempted: 0, accepted: 0, rejected: 0, deactivated: 0, muted: 0, degraded: false };
    })();
    pendingPushes.push(p);
    return p;
  }),
}));

/**
 * Drain pending pushes — both the microtask the detached IIFE schedules
 * AND the promise(s) our mock captured. Combines a setImmediate drain
 * (catches the case where the IIFE hasn't been scheduled yet) with
 * Promise.allSettled (waits for whatever did land).
 */
async function flushPushes(): Promise<void> {
  await new Promise(r => setImmediate(r));
  await Promise.allSettled(pendingPushes);
}

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({
    select(_columns?: any) {
      return {
        from(table: any) {
          // Use Drizzle's public getTableName (vs Symbol.for('drizzle:Name'))
          // so the test survives a Drizzle internal refactor that
          // renames the symbol — flagged criticality 6 in the FU1-8
          // re-review.
          const isMembership = getTableName(table).includes('company_users');
          return {
            where(_clause: unknown) {
              if (isMembership) {
                dbCalls.membershipChecks += 1;
                return {
                  limit() {
                    return Promise.resolve([{ companyRole: 'manager', isActive: true }]);
                  },
                };
              }
              // defects.update reads the previous row via SELECT…
              // FROM defects…WHERE…LIMIT 1 to detect reassignment.
              // dbCalls.defectsPrevious lets a test inject a row;
              // default [] means "no previous row" → no push.
              const thenable = Promise.resolve(dbCalls.defectsPrevious);
              (thenable as any).limit = () => Promise.resolve(dbCalls.defectsPrevious);
              return thenable;
            },
          };
        },
      };
    },
    update(_table: any) {
      return {
        set(values: Record<string, unknown>) {
          dbCalls.updateSets.push(values);
          return {
            where(_clause: unknown) {
              return Promise.resolve();
            },
          };
        },
      };
    },
    delete(_table: any) {
      return {
        where(_clause: unknown) {
          dbCalls.deletes += 1;
          return Promise.resolve();
        },
      };
    },
  })),
}));

const { appRouter } = await import("../server/routers");

function ctxFor(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
      name: `User ${userId}`,
      email: `u${userId}@example.com`,
      loginMethod: "manus",
      role: "user",
      passwordHash: null, pushPreferences: {}, createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", hostname: "localhost", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("defects.update", () => {
  beforeEach(() => {
    dbCalls.membershipChecks = 0;
    dbCalls.updateSets.length = 0;
    dbCalls.deletes = 0;
    // Default previous row so the rows-affected guard passes.
    // Push-behaviour tests below overwrite this with their own row.
    dbCalls.defectsPrevious = [{
      id: 5, companyId: 7,
      title: "existing title",
      assignedTo: "Existing User",
      priority: "medium",
      status: "open",
    }];
    pushCalls.length = 0;
    pendingPushes.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("only writes fields actually present in input — partial edit doesn't clobber others", async () => {
    const caller = appRouter.createCaller(ctxFor(1));

    await caller.defects.update({
      id: 5,
      companyId: 7,
      title: 'Cracked tile near bay 3',
    });

    expect(dbCalls.updateSets).toHaveLength(1);
    const set = dbCalls.updateSets[0]!;
    expect(set).toHaveProperty('title', 'Cracked tile near bay 3');
    // Description / location / trade / priority / assignedTo / photoUrls were not in input — must NOT be in the update.
    for (const k of ['description', 'location', 'trade', 'priority', 'assignedTo', 'photoUrls']) {
      expect(set, `should not write ${k}`).not.toHaveProperty(k);
    }
  });

  it("photoUrls array is JSON-stringified to match the create procedure's storage shape", async () => {
    const caller = appRouter.createCaller(ctxFor(1));

    await caller.defects.update({
      id: 5,
      companyId: 7,
      photoUrls: ['/storage/a.jpg', '/storage/b.jpg'],
    });

    expect(dbCalls.updateSets[0]).toHaveProperty(
      'photoUrls',
      JSON.stringify(['/storage/a.jpg', '/storage/b.jpg']),
    );
  });

  it("nullable fields accept explicit null — clears the value (description, location, trade, assignedTo)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));

    await caller.defects.update({
      id: 5,
      companyId: 7,
      description: null,
      location: null,
      trade: null,
      assignedTo: null,
    });

    const set = dbCalls.updateSets[0]!;
    expect(set).toMatchObject({
      description: null,
      location: null,
      trade: null,
      assignedTo: null,
    });
  });

  it("rejects unauthenticated callers (UNAUTHORIZED) — no DB write", async () => {
    const unauthCtx = {
      user: null,
      req: { protocol: "https", hostname: "localhost", headers: {} },
      res: { clearCookie: vi.fn() },
    } as unknown as TrpcContext;
    const caller = appRouter.createCaller(unauthCtx);

    await expect(
      caller.defects.update({ id: 1, companyId: 1, title: 'noop' }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(dbCalls.updateSets).toHaveLength(0);
  });

  it("fires defect_assigned push only on a genuine reassignment to a non-empty user", async () => {
    // Reassignment: assignedTo changes from "Old" to "New". Push fires
    // exactly once with the registry's defect_assigned event type so
    // it's subject to the per-event preference gate.
    dbCalls.defectsPrevious = [{
      id: 42,
      title: "Cracked tile",
      assignedTo: "Old User",
      priority: "medium",
      status: "open",
    }];
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.defects.update({
      id: 42, companyId: 1, assignedTo: "New User",
    });
    // Detached push runs on next microtask tick.
    await flushPushes();
    expect(pushCalls).toHaveLength(1);
    expect(pushCalls[0].name).toBe("New User");
    expect(pushCalls[0].eventType).toBe("defect_assigned");
  });

  it("does NOT push when the edit doesn't touch assignedTo", async () => {
    dbCalls.defectsPrevious = [{
      id: 42,
      title: "Cracked tile",
      assignedTo: "Old User",
      priority: "medium",
      status: "open",
    }];
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.defects.update({ id: 42, companyId: 1, title: "New title" });
    await flushPushes();
    expect(pushCalls).toHaveLength(0);
  });

  it("does NOT push when assignedTo is set to the SAME user (idempotent)", async () => {
    dbCalls.defectsPrevious = [{
      id: 42, title: "Cracked tile", assignedTo: "Same User",
      priority: "medium", status: "open",
    }];
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.defects.update({ id: 42, companyId: 1, assignedTo: "Same User" });
    await flushPushes();
    expect(pushCalls).toHaveLength(0);
  });

  it("does NOT push when assignedTo is cleared (set to null or empty)", async () => {
    dbCalls.defectsPrevious = [{
      id: 42, title: "Cracked tile", assignedTo: "Old User",
      priority: "medium", status: "open",
    }];
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.defects.update({ id: 42, companyId: 1, assignedTo: null });
    await flushPushes();
    expect(pushCalls).toHaveLength(0);
  });

  it("DOES push on first-time assignment (previous.assignedTo === null)", async () => {
    // High-traffic real-world path: a defect is created with no
    // assignee, then assigned in a follow-up edit. A regression that
    // added `&& previous.assignedTo` (truthy guard) would silently
    // break this without firing the push to the new owner.
    dbCalls.defectsPrevious = [{
      id: 42, title: "Cracked tile", assignedTo: null,
      priority: "high", status: "open",
    }];
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.defects.update({ id: 42, companyId: 1, assignedTo: "First Owner" });
    await flushPushes();
    expect(pushCalls).toHaveLength(1);
    expect(pushCalls[0].name).toBe("First Owner");
    expect(pushCalls[0].eventType).toBe("defect_assigned");
  });

  it("does NOT push when assignedTo is whitespace-only (.trim() yields empty)", async () => {
    // Guard against a refactor that drops the .trim() — a pure-whitespace
    // assignedTo would otherwise pass the identity-change check, hit
    // sendPushToUserByName, and then no-op there. Making the gate fail
    // earlier is the cheaper failure mode.
    dbCalls.defectsPrevious = [{
      id: 42, title: "Cracked tile", assignedTo: "Old User",
      priority: "medium", status: "open",
    }];
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.defects.update({ id: 42, companyId: 1, assignedTo: "   " });
    await flushPushes();
    expect(pushCalls).toHaveLength(0);
  });

  it("throws NOT_FOUND when the defect doesn't exist in this company", async () => {
    // No previous row → wrong companyId (cross-tenant attempt), deleted
    // defect, or stale id from the client. Surface the failure
    // explicitly rather than letting the UPDATE silently match zero
    // rows and report success.
    dbCalls.defectsPrevious = [];
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.defects.update({ id: 999, companyId: 1, title: "noop" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(dbCalls.updateSets).toHaveLength(0);
  });
});

describe("defects.delete", () => {
  beforeEach(() => {
    dbCalls.membershipChecks = 0;
    dbCalls.updateSets.length = 0;
    dbCalls.deletes = 0;
    dbCalls.defectsPrevious = [];
    pushCalls.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("issues exactly one DELETE through companyScopedProcedure", async () => {
    const caller = appRouter.createCaller(ctxFor(1));

    await caller.defects.delete({ id: 5, companyId: 7 });

    expect(dbCalls.deletes).toBe(1);
    expect(dbCalls.membershipChecks).toBe(1);
  });

  it("rejects unauthenticated callers (UNAUTHORIZED) — no DELETE issued", async () => {
    const unauthCtx = {
      user: null,
      req: { protocol: "https", hostname: "localhost", headers: {} },
      res: { clearCookie: vi.fn() },
    } as unknown as TrpcContext;
    const caller = appRouter.createCaller(unauthCtx);

    await expect(
      caller.defects.delete({ id: 1, companyId: 1 }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(dbCalls.deletes).toBe(0);
  });
});
