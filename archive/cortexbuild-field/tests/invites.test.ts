import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import {
  invitedUsers as dbInvitedUsers,
  users as dbUsers,
} from "../drizzle/schema";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-session-secret";
process.env.APP_ID = process.env.APP_ID || "test-app";

const pendingInvite = {
  id: 7,
  companyId: 3,
  email: "worker@example.com",
  name: "Original Worker",
  role: "project_manager",
  employeeClass: "Management",
  projectId: "42",
  projectName: "Live Project",
  pin: "123456",
  status: "pending",
  invitedBy: "Admin",
  expiresAt: new Date(Date.now() + 86_400_000),
  acceptedAt: null,
  createdAt: new Date(),
};

const existingUser = {
  id: 11,
  openId: "invite:worker@example.com",
  name: "Old Worker",
  email: "worker@example.com",
  loginMethod: "invitation",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const calls = {
  updateInvite: [] as unknown[],
  updateUser: [] as unknown[],
  insertCompanyUser: [] as unknown[],
  insertTeamMember: [] as unknown[],
  cookies: [] as unknown[],
};

function makeDb() {
  return {
    select() {
      return {
        from(table: unknown) {
          return {
            where() {
              return {
                limit() {
                  if (table === dbInvitedUsers) return Promise.resolve([pendingInvite]);
                  if (table === dbUsers) return Promise.resolve([existingUser]);
                  return Promise.resolve([]);
                },
                orderBy() {
                  return {
                    limit() {
                      return Promise.resolve([pendingInvite]);
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: unknown) {
          return {
            where() {
              if (table === dbInvitedUsers) calls.updateInvite.push(values);
              if (table === dbUsers) calls.updateUser.push(values);
              return {
                returning() {
                  return Promise.resolve([{ ...existingUser, ...(values as object) }]);
                },
              };
            },
          };
        },
      };
    },
    insert() {
      return {
        values(values: any) {
          if (values.companyId && values.userId) calls.insertCompanyUser.push(values);
          if (values.projectId !== undefined && values.email) calls.insertTeamMember.push(values);
          return {
            returning() {
              return Promise.resolve([{ ...existingUser, ...values, id: existingUser.id }]);
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

vi.mock("../server/_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn(async () => "invite-session-token"),
  },
}));

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {}, hostname: "app.example.com" } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn((name: string, value: string, options: unknown) => {
        calls.cookies.push({ name, value, options });
      }),
    } as unknown as TrpcContext["res"],
  };
}

describe("users.acceptInvite", () => {
  beforeEach(() => {
    calls.updateInvite = [];
    calls.updateUser = [];
    calls.insertCompanyUser = [];
    calls.insertTeamMember = [];
    calls.cookies = [];
  });

  it("activates an invite and creates company membership/team record", async () => {
    const caller = appRouter.createCaller(createContext());

    const result = await caller.users.acceptInvite({
      email: "worker@example.com",
      pin: "123456",
      firstName: "New",
      lastName: "Worker",
      phone: "07000000000",
      trade: "Concrete",
    });

    expect(result).toMatchObject({
      success: true,
      companyId: 3,
      companyRole: "manager",
      name: "New Worker",
      userId: existingUser.id,
      sessionToken: expect.any(String),
      user: expect.objectContaining({
        id: existingUser.id,
        companyId: 3,
        companyRole: "manager",
      }),
    });
    expect(calls.cookies[0]).toMatchObject({
      name: "app_session_id",
      value: expect.any(String),
    });
    expect(calls.insertCompanyUser[0]).toMatchObject({
      companyId: 3,
      userId: existingUser.id,
      companyRole: "manager",
      isActive: true,
    });
    expect(calls.insertTeamMember[0]).toMatchObject({
      name: "New Worker",
      email: "worker@example.com",
      phone: "07000000000",
      trade: "Concrete",
      status: "active",
    });
  });
});
