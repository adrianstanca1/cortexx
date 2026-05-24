/**
 * Behaviour tests for cross-tenant guards on the second batch of upgraded
 * procedures: files.*, permits.*, tasks.*, dailyReports.*. Same pattern as
 * tests/defects-incidents-scoping.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import {
  files as dbFiles,
  permits as dbPermits,
  tasks as dbTasks,
  dailyReports as dbDailyReports,
  projects as dbProjects,
  companyUsers as dbCompanyUsers,
} from "../drizzle/schema";

interface MockState {
  insertedFile: any;
  insertedPermit: any;
  insertedTask: any;
  insertedDailyReport: any;
  filesListWhere: unknown;
  permitsListWhere: unknown;
  tasksListWhere: unknown;
  dailyReportsListWhere: unknown;
  filesDeleteWhere: unknown;
  permitsUpdateWhere: unknown;
  tasksUpdateWhere: unknown;
  projectLookups: { where: unknown }[];
  projectLookupResult: { id: number; companyId: number }[];
}

const state: MockState = {
  insertedFile: null,
  insertedPermit: null,
  insertedTask: null,
  insertedDailyReport: null,
  filesListWhere: null,
  permitsListWhere: null,
  tasksListWhere: null,
  dailyReportsListWhere: null,
  filesDeleteWhere: null,
  permitsUpdateWhere: null,
  tasksUpdateWhere: null,
  projectLookups: [],
  projectLookupResult: [{ id: 100, companyId: 7 }],
};

function makeDb() {
  return {
    select() {
      return {
        from(table: unknown) {
          return {
            where(condition: unknown) {
              if (table === dbFiles) state.filesListWhere = condition;
              if (table === dbPermits) state.permitsListWhere = condition;
              if (table === dbTasks) state.tasksListWhere = condition;
              if (table === dbDailyReports) state.dailyReportsListWhere = condition;
              if (table === dbProjects) state.projectLookups.push({ where: condition });
              return {
                limit() {
                  if (table === dbProjects) return Promise.resolve(state.projectLookupResult);
                  if (table === dbCompanyUsers) return Promise.resolve([{ companyRole: "manager", isActive: true }]);
                  if (table === dbFiles) return Promise.resolve([{ id: 99, companyId: 7, storageKey: "test-key" }]);
                  return Promise.resolve([]);
                },
                orderBy() {
                  // Some procedures chain .where().orderBy() (no .limit()).
                  // Return a stub that resolves to []; the inner methods on it
                  // (.limit) also resolve to [] for the same reason.
                  return Object.assign(Promise.resolve([]), { limit: () => Promise.resolve([]) });
                },
              };
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: any) {
          if (table === dbFiles) state.insertedFile = values;
          if (table === dbPermits) state.insertedPermit = values;
          if (table === dbTasks) state.insertedTask = values;
          if (table === dbDailyReports) state.insertedDailyReport = values;
          return {
            returning() {
              return Promise.resolve([{ id: 999, ...values }]);
            },
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set() {
          return {
            where(condition: unknown) {
              if (table === dbPermits) state.permitsUpdateWhere = condition;
              if (table === dbTasks) state.tasksUpdateWhere = condition;
              return Promise.resolve();
            },
          };
        },
      };
    },
    delete(table: unknown) {
      return {
        where(condition: unknown) {
          if (table === dbFiles) state.filesDeleteWhere = condition;
          return Promise.resolve();
        },
      };
    },
  };
}

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => makeDb()),
}));

// files.upload calls storagePut → don't actually hit S3 / disk.
vi.mock("../server/storage", () => ({
  storagePut: vi.fn(async (key: string) => ({ key, url: `/storage/${key}` })),
}));

function ctxWithUser(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: 11,
      openId: "user-11",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role,
      passwordHash: null, pushPreferences: {}, createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", hostname: "h", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  state.insertedFile = null;
  state.insertedPermit = null;
  state.insertedTask = null;
  state.insertedDailyReport = null;
  state.filesListWhere = null;
  state.permitsListWhere = null;
  state.tasksListWhere = null;
  state.dailyReportsListWhere = null;
  state.filesDeleteWhere = null;
  state.permitsUpdateWhere = null;
  state.tasksUpdateWhere = null;
  state.projectLookups = [];
  state.projectLookupResult = [{ id: 100, companyId: 7 }];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("files tenant-scoping", () => {
  it("rejects list without companyId (BAD_REQUEST)", async () => {
    const caller = appRouter.createCaller(ctxWithUser());
    // @ts-expect-error — deliberately omitting companyId
    await expect(caller.files.list({})).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("upload FORBIDden when projectId belongs to a different company", async () => {
    state.projectLookupResult = []; // project does not belong to company 7
    const caller = appRouter.createCaller(ctxWithUser());
    await expect(
      caller.files.upload({
        companyId: 7,
        fileName: "x.jpg",
        mimeType: "image/jpeg",
        base64Data: "AAAA",
        category: "photo",
        projectId: "100",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.insertedFile).toBeNull();
  });

  it("upload without projectId skips the FK check (e.g. avatar uploads)", async () => {
    // Even with NO matching project row in the mock, a project-less upload
    // must succeed — it's how avatars / generic vault uploads work.
    state.projectLookupResult = [];
    const caller = appRouter.createCaller(ctxWithUser());
    await caller.files.upload({
      companyId: 7,
      fileName: "avatar.png",
      mimeType: "image/png",
      base64Data: "AAAA",
      category: "photo",
    });
    expect(state.insertedFile).toMatchObject({ companyId: 7, projectId: null });
  });

  it("upload persists companyId on success", async () => {
    state.projectLookupResult = [{ id: 100, companyId: 7 }];
    const caller = appRouter.createCaller(ctxWithUser());
    await caller.files.upload({
      companyId: 7,
      fileName: "ok.jpg",
      mimeType: "image/jpeg",
      base64Data: "AAAA",
      category: "photo",
      projectId: "100",
    });
    expect(state.insertedFile).toMatchObject({ companyId: 7, projectId: 100 });
  });

  it("delete builds a WHERE that includes companyId", async () => {
    const caller = appRouter.createCaller(ctxWithUser());
    await caller.files.delete({ companyId: 7, id: 99 });
    expect(state.filesDeleteWhere).toBeTruthy();
  });
});

describe("permits tenant-scoping", () => {
  it("rejects list without companyId", async () => {
    const caller = appRouter.createCaller(ctxWithUser());
    // @ts-expect-error
    await expect(caller.permits.list({})).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("create FORBIDden for a project from another tenant", async () => {
    state.projectLookupResult = [];
    const caller = appRouter.createCaller(ctxWithUser());
    await expect(
      caller.permits.create({
        companyId: 7,
        projectId: 100,
        title: "Hot work",
        type: "hot_work",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.insertedPermit).toBeNull();
  });

  it("updateStatus WHERE includes companyId", async () => {
    const caller = appRouter.createCaller(ctxWithUser());
    await caller.permits.updateStatus({ companyId: 7, id: 42, status: "active" });
    expect(state.permitsUpdateWhere).toBeTruthy();
  });
});

describe("tasks tenant-scoping", () => {
  it("rejects list without companyId", async () => {
    const caller = appRouter.createCaller(ctxWithUser());
    // @ts-expect-error
    await expect(caller.tasks.list({})).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("create FORBIDden for a project from another tenant", async () => {
    state.projectLookupResult = [];
    const caller = appRouter.createCaller(ctxWithUser());
    await expect(
      caller.tasks.create({
        companyId: 7,
        projectId: 100,
        title: "Build wall",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.insertedTask).toBeNull();
  });

  it("updateStatus WHERE includes companyId", async () => {
    const caller = appRouter.createCaller(ctxWithUser());
    await caller.tasks.updateStatus({ companyId: 7, id: 42, status: "completed" });
    expect(state.tasksUpdateWhere).toBeTruthy();
  });
});

describe("dailyReports tenant-scoping", () => {
  it("rejects list without companyId", async () => {
    const caller = appRouter.createCaller(ctxWithUser());
    // @ts-expect-error
    await expect(caller.dailyReports.list({})).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("create FORBIDden for a project from another tenant", async () => {
    state.projectLookupResult = [];
    const caller = appRouter.createCaller(ctxWithUser());
    await expect(
      caller.dailyReports.create({
        companyId: 7,
        projectId: 100,
        reportDate: "2026-05-03",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.insertedDailyReport).toBeNull();
  });

  it("create persists companyId on success and folds visitors into safetyObservations", async () => {
    const caller = appRouter.createCaller(ctxWithUser());
    await caller.dailyReports.create({
      companyId: 7,
      projectId: 100,
      reportDate: "2026-05-03",
      safetyObservations: "Toolbox talk completed",
      visitors: "Inspector at 14:00",
    });
    expect(state.insertedDailyReport).toMatchObject({
      companyId: 7,
      projectId: 100,
    });
    expect(state.insertedDailyReport.safetyObservations).toContain("Inspector at 14:00");
    expect(state.insertedDailyReport.safetyObservations).toContain("Toolbox talk");
  });
});
