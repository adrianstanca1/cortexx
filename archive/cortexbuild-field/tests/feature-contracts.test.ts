import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import {
  files as dbFiles,
  drawings as dbDrawings,
  drawingPins as dbDrawingPins,
  companyUsers as dbCompanyUsers,
  projects as dbProjects,
  timesheets as dbTimesheets,
} from "../drizzle/schema";

const calls = {
  insertedTimesheet: null as any,
  insertedPin: null as any,
  insertedFile: null as any,
  pinListWhere: null as unknown,
};

function makeDb() {
  return {
    select() {
      return {
        from(table: unknown) {
          return {
            where(condition: unknown) {
              if (table === dbDrawingPins) calls.pinListWhere = condition;
              return {
                limit() {
                  if (table === dbDrawings) return Promise.resolve([{ id: 42, companyId: 7 }]);
                  // files.upload (and most company-scoped create procs) verify
                  // the projectId belongs to the requested company before
                  // inserting. Return a matching project so the test exercises
                  // the happy path.
                  if (table === dbProjects) return Promise.resolve([{ id: 42, companyId: 1 }]);
                  // companyScopedProcedure validates the requesting user has an
                  // active membership for input.companyId — return one for the
                  // user/company pair the tests use.
                  if (table === dbCompanyUsers) return Promise.resolve([{ companyRole: "manager", isActive: true }]);
                  return Promise.resolve([]);
                },
                orderBy() {
                  return Promise.resolve([]);
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
          if (table === dbTimesheets) calls.insertedTimesheet = values;
          if (table === dbDrawingPins) calls.insertedPin = values;
          if (table === dbFiles) calls.insertedFile = values;
          return {
            returning() {
              return Promise.resolve([{ id: 99, ...values }]);
            },
          };
        },
      };
    },
  };
}

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => makeDb()),
}));

function createAuthenticatedContext(): TrpcContext {
  return {
    user: {
      id: 11,
      openId: "user-11",
      name: "Test User",
      email: "test@example.com",
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

describe("feature API contracts", () => {
  it("preserves explicit zero overtime on timesheet submission", async () => {
    // timesheets.submit now uses companyScopedProcedure — auth + companyUsers row required.
    const caller = appRouter.createCaller(createAuthenticatedContext());

    await caller.timesheets.submit({
      companyId: 1,
      workerName: "Alice Worker",
      weekStarting: "2026-04-27",
      mondayHours: 10,
      tuesdayHours: 10,
      wednesdayHours: 10,
      thursdayHours: 10,
      fridayHours: 5,
      overtimeHours: 0,
    });

    expect(calls.insertedTimesheet).toMatchObject({
      totalHours: "45",
      overtimeHours: "0",
    });
  });

  it("persists and scopes drawing pins by company", async () => {
    // drawingPins now uses companyScopedProcedure — needs an authenticated user
    // and a mocked companyUsers row (provided by makeDb above).
    const caller = appRouter.createCaller(createAuthenticatedContext());

    await caller.drawingPins.add({
      companyId: 7,
      drawingId: "42",
      pinType: "note",
      xPct: 0.25,
      yPct: 0.5,
      title: "Check detail",
    });
    await caller.drawingPins.list({ companyId: 7, drawingId: "42" });

    expect(calls.insertedPin).toMatchObject({
      companyId: 7,
      drawingId: "42",
      title: "Check detail",
    });
    expect(calls.pinListWhere).toBeTruthy();
  });

  it("stores invoice vault uploads as documents with invoice tags", async () => {
    // files.upload is now protectedProcedure (every tRPC procedure requires
    // auth except the explicit auth.me / auth.logout / sync.replay /
    // users.acceptInvite exemptions).
    const caller = appRouter.createCaller(createAuthenticatedContext());

    await caller.files.upload({
      companyId: 1,
      fileName: "invoice.pdf",
      mimeType: "application/pdf",
      base64Data: Buffer.from("invoice").toString("base64"),
      category: "invoice",
      tags: ["supplier"],
      projectId: "42",
    });

    expect(calls.insertedFile).toMatchObject({
      projectId: 42,
      category: "document",
      name: "invoice.pdf",
    });
    expect(JSON.parse(calls.insertedFile.tags)).toEqual(["supplier", "invoice"]);
  });
});
