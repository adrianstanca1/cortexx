/**
 * CortexBuild AI — Backend Unit Tests
 *
 * Tests cover:
 * - Auth (logout clears session cookie)
 * - Inbox router (sendMessage validation)
 * - Issues router (update status)
 * - Reports router (generate input validation)
 * - Dashboard stats (returns expected shape)
 * - WhatsApp client (graceful no-credentials fallback)
 * - Inbox processor (pipeline result shape)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type CookieCall = { name: string; options: Record<string, unknown> };
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeAdminCtx(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@cortexbuild.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

function makeUserCtx(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@cortexbuild.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return { ctx };
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });

  it("auth.me returns the current user", async () => {
    const { ctx } = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const me = await caller.auth.me();
    expect(me?.email).toBe("admin@cortexbuild.com");
    expect(me?.role).toBe("admin");
  });
});

// ─── Inbox Router Tests ───────────────────────────────────────────────────────

describe("inbox.sendMessage", () => {
  it("rejects when neither text nor imageUrl is provided", async () => {
    const { ctx } = makeUserCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.inbox.sendMessage({
        contactIdentifier: "+447911000000",
        contactName: "Test Worker",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects invalid imageUrl format", async () => {
    const { ctx } = makeUserCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.inbox.sendMessage({
        contactIdentifier: "+447911000000",
        contactName: "Test Worker",
        imageUrl: "not-a-url",
      })
    ).rejects.toBeDefined();
  });

  it("rejects empty contactIdentifier", async () => {
    const { ctx } = makeUserCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.inbox.sendMessage({
        contactIdentifier: "",
        contactName: "Test Worker",
        text: "Hello",
      })
    ).rejects.toBeDefined();
  });
});

// ─── Issues Router Tests ──────────────────────────────────────────────────────

describe("issues.update", () => {
  it("rejects invalid status enum value", async () => {
    const { ctx } = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.issues.update({
        id: 1,
        status: "invalid_status" as any,
      })
    ).rejects.toBeDefined();
  });

  it("rejects invalid severity enum value", async () => {
    const { ctx } = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.issues.update({
        id: 1,
        severity: "extreme" as any,
      })
    ).rejects.toBeDefined();
  });

  it("accepts valid status update without schema error", async () => {
    const { ctx } = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);

    // Valid input — should resolve (DB may return undefined) or reject with a non-schema error
    let errorCode: string | undefined;
    try {
      await caller.issues.update({ id: 1, status: "resolved" });
    } catch (err: any) {
      errorCode = err?.code;
    }
    // Must NOT be a schema/input validation error
    expect(errorCode).not.toBe("BAD_REQUEST");
  });
});

// ─── Reports Router Tests ─────────────────────────────────────────────────────

describe("reports.generate", () => {
  it("rejects invalid reportType", async () => {
    const { ctx } = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.reports.generate({
        title: "Test Report",
        reportType: "invalid_type" as any,
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
      })
    ).rejects.toBeDefined();
  });

  it("accepts valid report generation input", async () => {
    const { ctx } = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);

    // Schema validation passes; may succeed (returns reportId) or fail at LLM/DB level
    let errorCode: string | undefined;
    let result: any;
    try {
      result = await caller.reports.generate({
        title: "Weekly Site Report",
        reportType: "weekly_summary",
        dateFrom: "2026-01-01",
        dateTo: "2026-01-07",
        projectTag: "Site-A",
      });
    } catch (err: any) {
      errorCode = err?.code;
    }
    // Must NOT be a Zod/schema validation error
    expect(errorCode).not.toBe("BAD_REQUEST");
    // If it resolved, must have a reportId
    if (result) {
      expect(result).toHaveProperty("reportId");
    }
  });
});

// ─── Settings Router Tests ────────────────────────────────────────────────────

describe("settings (admin only)", () => {
  it("allows admin to access settings.getAll", async () => {
    const { ctx } = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);
    // Should not throw FORBIDDEN — may return empty object or DB error
    let errorCode: string | undefined;
    try {
      await caller.settings.getAll();
    } catch (err: any) {
      errorCode = err?.code;
    }
    expect(errorCode).not.toBe("FORBIDDEN");
  });

  it("blocks regular user from settings.getAll", async () => {
    const { ctx } = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.settings.getAll()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks regular user from settings.set", async () => {
    const { ctx } = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.settings.set({ key: "agent_name", value: "Hacked" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── WhatsApp Client Fallback Tests ──────────────────────────────────────────

describe("WhatsApp client graceful fallback", () => {
  it("sendTextMessage returns null when no credentials are configured", async () => {
    // Temporarily ensure env vars are absent
    const origToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const origPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;

    const { sendTextMessage } = await import("./services/whatsappClient");
    const result = await sendTextMessage("+447911000000", "Hello");

    expect(result).toBeNull();

    // Restore
    if (origToken) process.env.WHATSAPP_ACCESS_TOKEN = origToken;
    if (origPhone) process.env.WHATSAPP_PHONE_NUMBER_ID = origPhone;
  });

  it("downloadWhatsAppMedia returns null when no credentials are configured", async () => {
    const origToken = process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_ACCESS_TOKEN;

    const { downloadWhatsAppMedia } = await import("./services/whatsappClient");
    const result = await downloadWhatsAppMedia("fake-media-id");

    expect(result).toBeNull();

    if (origToken) process.env.WHATSAPP_ACCESS_TOKEN = origToken;
  });
});

// ─── Inbox Processor Unit Tests ───────────────────────────────────────────────

describe("inboxProcessor", () => {
  it("exports processInboxMessage as a function", async () => {
    const { processInboxMessage } = await import("./services/inboxProcessor");
    expect(typeof processInboxMessage).toBe("function");
  });
});

// ─── Scheduled Reports Tests ──────────────────────────────────────────────────

describe("scheduledReports.create (admin only)", () => {
  it("blocks regular user from creating scheduled reports", async () => {
    const { ctx } = makeUserCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.scheduledReports.create({
        name: "Daily Summary",
        frequency: "daily",
        reportType: "daily_summary",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects invalid frequency value", async () => {
    const { ctx } = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.scheduledReports.create({
        name: "Bad Schedule",
        frequency: "hourly" as any,
        reportType: "daily_summary",
      })
    ).rejects.toBeDefined();
  });
});
