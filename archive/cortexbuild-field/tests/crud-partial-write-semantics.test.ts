import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { TrpcContext } from "../server/_core/context";

/**
 * Per-resource partial-write coverage for the eight resources whose
 * `update` procedures shipped without a dedicated test file. The
 * sweep in `tests/all-resources-update-delete.test.ts` proves the
 * procedures exist and gate unauthenticated callers; this file
 * verifies the `set(...)` payload — that "edit only the title"
 * doesn't accidentally clobber siblings, and that special-case
 * field handling (Date conversion, JSON stringification, explicit
 * null clears) actually fires.
 *
 * Mirrors the shape of `tests/defects-update-delete.test.ts`,
 * `tests/announcements-update.test.ts`, and
 * `tests/drawings-update-delete.test.ts`.
 */

const dbCalls: { updateSets: Record<string, unknown>[] } = { updateSets: [] };

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({
    select(_columns?: any) {
      return {
        from(table: any) {
          const isMembership = getTableName(table).includes('company_users');
          return {
            where(_clause: unknown) {
              if (isMembership) {
                return { limit() { return Promise.resolve([{ companyRole: 'manager', isActive: true }]); } };
              }
              return Promise.resolve([]);
            },
          };
        },
      };
    },
    update(_table: any) {
      return {
        set(values: Record<string, unknown>) {
          dbCalls.updateSets.push(values);
          return { where(_c: unknown) { return Promise.resolve(); } };
        },
      };
    },
    delete(_table: any) {
      return { where(_c: unknown) { return Promise.resolve(); } };
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

beforeEach(() => { dbCalls.updateSets.length = 0; });
afterEach(() => { vi.clearAllMocks(); });

describe("tasks.update — partial-write semantics", () => {
  it("only writes fields actually present in input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.tasks.update({ id: 5, companyId: 7, title: 'Pour slab' });
    const set = dbCalls.updateSets[0]!;
    expect(set).toHaveProperty('title', 'Pour slab');
    expect(set).toHaveProperty('updatedAt');
    for (const k of ['description', 'status', 'priority', 'assignedTo', 'dueDate']) {
      expect(set, `should not write ${k}`).not.toHaveProperty(k);
    }
  });

  it("dueDate string is converted to Date; explicit null clears it", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.tasks.update({ id: 5, companyId: 7, dueDate: '2026-06-01T00:00:00Z' });
    expect(dbCalls.updateSets[0]!.dueDate).toBeInstanceOf(Date);

    await caller.tasks.update({ id: 5, companyId: 7, dueDate: null });
    expect(dbCalls.updateSets[1]!.dueDate).toBeNull();
  });

  it("nullable string fields accept explicit null", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.tasks.update({ id: 5, companyId: 7, description: null, assignedTo: null });
    expect(dbCalls.updateSets[0]).toMatchObject({ description: null, assignedTo: null });
  });
});

describe("inspections.update — partial-write semantics", () => {
  it("only writes fields actually present in input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.inspections.update({ id: 5, companyId: 7, title: 'Quality walkthrough' });
    const set = dbCalls.updateSets[0]!;
    expect(set).toHaveProperty('title', 'Quality walkthrough');
    for (const k of ['type', 'checklistItems', 'notes', 'scheduledAt']) {
      expect(set, `should not write ${k}`).not.toHaveProperty(k);
    }
  });

  it("scheduledAt string is converted to Date; explicit null clears it", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.inspections.update({ id: 5, companyId: 7, scheduledAt: '2026-06-15T09:00:00Z' });
    expect(dbCalls.updateSets[0]!.scheduledAt).toBeInstanceOf(Date);

    await caller.inspections.update({ id: 5, companyId: 7, scheduledAt: null });
    expect(dbCalls.updateSets[1]!.scheduledAt).toBeNull();
  });
});

describe("rfis.update — partial-write semantics", () => {
  it("only writes fields actually present in input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.rfis.update({ id: 5, companyId: 7, subject: 'Spec clarification' });
    const set = dbCalls.updateSets[0]!;
    expect(set).toHaveProperty('subject', 'Spec clarification');
    for (const k of ['question', 'priority', 'dueDate']) {
      expect(set, `should not write ${k}`).not.toHaveProperty(k);
    }
  });

  it("dueDate string is converted to Date; explicit null clears it", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.rfis.update({ id: 5, companyId: 7, dueDate: '2026-06-20T00:00:00Z' });
    expect(dbCalls.updateSets[0]!.dueDate).toBeInstanceOf(Date);

    await caller.rfis.update({ id: 5, companyId: 7, dueDate: null });
    expect(dbCalls.updateSets[1]!.dueDate).toBeNull();
  });
});

describe("observations.update — partial-write semantics", () => {
  it("only writes fields actually present in input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.observations.update({ id: 5, companyId: 7, title: 'PPE compliance check' });
    const set = dbCalls.updateSets[0]!;
    expect(set).toHaveProperty('title', 'PPE compliance check');
    for (const k of ['type', 'description', 'location', 'photoUrls']) {
      expect(set, `should not write ${k}`).not.toHaveProperty(k);
    }
  });

  it("nullable fields accept explicit null", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.observations.update({ id: 5, companyId: 7, description: null, location: null });
    expect(dbCalls.updateSets[0]).toMatchObject({ description: null, location: null });
  });
});

describe("actionPlans.update — partial-write semantics", () => {
  it("only writes fields actually present in input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.actionPlans.update({ id: 5, companyId: 7, title: 'Safety stand-down' });
    const set = dbCalls.updateSets[0]!;
    expect(set).toHaveProperty('title', 'Safety stand-down');
    for (const k of ['description', 'assignedToId', 'linkedTo', 'linkedId', 'priority', 'dueDate']) {
      expect(set, `should not write ${k}`).not.toHaveProperty(k);
    }
  });

  it("dueDate string is converted to Date; explicit null clears it", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.actionPlans.update({ id: 5, companyId: 7, dueDate: '2026-07-01T00:00:00Z' });
    expect(dbCalls.updateSets[0]!.dueDate).toBeInstanceOf(Date);

    await caller.actionPlans.update({ id: 5, companyId: 7, dueDate: null });
    expect(dbCalls.updateSets[1]!.dueDate).toBeNull();
  });
});

describe("permits.update — partial-write semantics", () => {
  it("only writes fields actually present in input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.permits.update({ id: 5, companyId: 7, title: 'Hot work — bay 4' });
    const set = dbCalls.updateSets[0]!;
    expect(set).toHaveProperty('title', 'Hot work — bay 4');
    for (const k of ['type', 'location', 'issuedBy', 'issuedTo', 'validFrom', 'validTo', 'conditions', 'riskLevel']) {
      expect(set, `should not write ${k}`).not.toHaveProperty(k);
    }
  });

  it("validFrom and validTo strings are converted to Date; explicit null clears them", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.permits.update({
      id: 5, companyId: 7,
      validFrom: '2026-06-01T08:00:00Z',
      validTo: '2026-06-01T18:00:00Z',
    });
    expect(dbCalls.updateSets[0]!.validFrom).toBeInstanceOf(Date);
    expect(dbCalls.updateSets[0]!.validTo).toBeInstanceOf(Date);

    await caller.permits.update({ id: 5, companyId: 7, validFrom: null, validTo: null });
    expect(dbCalls.updateSets[1]!.validFrom).toBeNull();
    expect(dbCalls.updateSets[1]!.validTo).toBeNull();
  });
});

describe("dailyReports.update — partial-write semantics", () => {
  it("only writes fields actually present in input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.dailyReports.update({ id: 5, companyId: 7, status: 'submitted' });
    const set = dbCalls.updateSets[0]!;
    expect(set).toHaveProperty('status', 'submitted');
    for (const k of ['weather', 'temperature', 'workersOnSite', 'workCompleted', 'materialsUsed', 'issuesDelays', 'safetyObservations', 'nextDayPlan', 'photoUrls']) {
      expect(set, `should not write ${k}`).not.toHaveProperty(k);
    }
  });

  it("nullable fields accept explicit null", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.dailyReports.update({
      id: 5, companyId: 7,
      weather: null, workCompleted: null, materialsUsed: null,
      issuesDelays: null, safetyObservations: null, nextDayPlan: null,
    });
    expect(dbCalls.updateSets[0]).toMatchObject({
      weather: null, workCompleted: null, materialsUsed: null,
      issuesDelays: null, safetyObservations: null, nextDayPlan: null,
    });
  });
});

describe("incidents.update — partial-write semantics", () => {
  it("only writes fields actually present in input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.incidents.update({ id: 5, companyId: 7, title: 'Near-miss — scaffolding' });
    const set = dbCalls.updateSets[0]!;
    expect(set).toHaveProperty('title', 'Near-miss — scaffolding');
    for (const k of ['description', 'type', 'severity', 'location', 'immediateAction', 'photoUrls', 'riddorRequired']) {
      expect(set, `should not write ${k}`).not.toHaveProperty(k);
    }
  });

  it("photoUrls array is JSON-stringified to match the create procedure's storage shape", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.incidents.update({
      id: 5, companyId: 7,
      photoUrls: ['/storage/a.jpg', '/storage/b.jpg'],
    });
    expect(dbCalls.updateSets[0]!.photoUrls).toBe(
      JSON.stringify(['/storage/a.jpg', '/storage/b.jpg']),
    );
  });

  it("nullable fields accept explicit null", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.incidents.update({
      id: 5, companyId: 7,
      description: null, location: null, immediateAction: null,
    });
    expect(dbCalls.updateSets[0]).toMatchObject({
      description: null, location: null, immediateAction: null,
    });
  });
});
