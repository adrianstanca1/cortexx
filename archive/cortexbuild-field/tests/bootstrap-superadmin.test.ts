import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

import { getDb } from "../server/db";
import { registerBootstrapRoute } from "../server/_core/bootstrap";

// Mock the DB layer. We control what `db.execute(...)` returns to simulate
// "no admin yet" (insert lands) vs. "admin already exists" (insert skipped
// by the WHERE NOT EXISTS clause and returns zero rows).
vi.mock("../server/db", () => ({
  getDb: vi.fn(),
}));

// Minimal capture of an Express handler's behaviour. We register the
// route on a fake `app`, grab the handler, and invoke it with a stub
// req/res. Keeps the test free of supertest / http.createServer.
function captureHandler() {
  let handler: ((req: Request, res: Response) => Promise<void> | void) | null = null;
  const fakeApp = {
    // The bootstrap route is registered as
    //   app.post(path, rateLimiter, handler)
    // so we always grab the LAST function arg as the actual handler.
    // Tests intentionally bypass the rate-limit middleware since per-IP
    // throttling is exercised separately and would otherwise carry state
    // across cases in this file.
    post: (..._args: unknown[]) => {
      const fn = _args[_args.length - 1];
      if (typeof fn === "function") {
        handler = fn as (req: Request, res: Response) => Promise<void> | void;
      }
    },
  } as any;
  registerBootstrapRoute(fakeApp);
  if (!handler) throw new Error("handler not registered");
  return handler as (req: Request, res: Response) => Promise<void> | void;
}

function makeRes() {
  const out: { status: number | null; body: any } = { status: null, body: null };
  const res: any = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: any) {
      out.body = body;
      return res;
    },
  };
  return { res: res as Response, out };
}

function makeReq(body: unknown) {
  return { body } as Request;
}

// Drizzle's query builder is chainable; we fake just enough to satisfy the
// bootstrap's membership-attach path. `select` returns a promise that resolves
// to whatever rows the test stages; `insert` swallows .values/.returning and
// resolves to a stable id so the membership row write doesn't crash the tests
// that care about user creation.
function makeChainableQuery(result: any) {
  const promise = Promise.resolve(result);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    values: () => chain,
    returning: () => Promise.resolve(result),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  return chain;
}

describe("bootstrap-superadmin handler", () => {
  let executeMock: ReturnType<typeof vi.fn>;
  let selectMock: ReturnType<typeof vi.fn>;
  let insertMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    executeMock = vi.fn();
    // Default: pretend a default company already exists so the membership
    // path doesn't try to create one.
    selectMock = vi.fn(() => makeChainableQuery([{ id: 1 }]));
    // Default: succeed silently.
    insertMock = vi.fn(() => makeChainableQuery([{ id: 99 }]));
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: selectMock,
      insert: insertMock,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates the first admin (201) when users table has no admin yet", async () => {
    executeMock.mockResolvedValueOnce([
      { id: 1, openId: "email:bootstrap@example.com", email: "bootstrap@example.com", role: "admin" },
    ]);

    const handler = captureHandler();
    const { res, out } = makeRes();
    await handler(
      makeReq({ email: "Bootstrap@Example.com", name: "Bootstrap Admin", password: "long-enough-fixture" }),
      res,
    );

    expect(out.status).toBe(201);
    expect(out.body).toMatchObject({ ok: true, role: "admin", email: "bootstrap@example.com" });
    expect(executeMock).toHaveBeenCalledTimes(1);
    // Verify email was lowercased before being passed to SQL.
    const dump = JSON.stringify(executeMock.mock.calls[0][0]);
    expect(dump).toContain("bootstrap@example.com");
    expect(dump).not.toContain("Bootstrap@Example.com");
  });

  it("self-disables (410) on the second call when an admin already exists", async () => {
    // INSERT ... WHERE NOT EXISTS returns zero rows when the admin row is
    // already there — that's the signal the endpoint is permanently dead.
    executeMock.mockResolvedValueOnce([]);

    const handler = captureHandler();
    const { res, out } = makeRes();
    await handler(
      makeReq({ email: "second@example.com", password: "another-attempt-fixture" }),
      res,
    );

    expect(out.status).toBe(410);
    expect(out.body.error).toMatch(/already completed/i);
  });

  it("returns 400 when email or password is missing", async () => {
    const handler = captureHandler();
    const { res, out } = makeRes();
    await handler(makeReq({ email: "missing-pw@example.com" }), res);
    expect(out.status).toBe(400);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("returns 400 for passwords shorter than 8 characters", async () => {
    const handler = captureHandler();
    const { res, out } = makeRes();
    await handler(makeReq({ email: "short@example.com", password: "tiny" }), res);
    expect(out.status).toBe(400);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("returns 503 when the DB is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValueOnce(null as any);
    const handler = captureHandler();
    const { res, out } = makeRes();
    await handler(
      makeReq({ email: "any@example.com", password: "long-enough-fixture" }),
      res,
    );
    expect(out.status).toBe(503);
  });

  it("attaches a companyUsers membership after creating the super-admin", async () => {
    executeMock.mockResolvedValueOnce([
      { id: 1, openId: "email:bootstrap@example.com", email: "bootstrap@example.com", role: "admin" },
    ]);

    const handler = captureHandler();
    const { res, out } = makeRes();
    await handler(
      makeReq({ email: "Bootstrap@Example.com", name: "Bootstrap Admin", password: "long-enough-fixture" }),
      res,
    );

    expect(out.status).toBe(201);
    // Should have looked up an existing company first…
    expect(selectMock).toHaveBeenCalledTimes(1);
    // …then inserted exactly the membership row (no new company since
    // selectMock returned an existing one with id=1).
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("creates a default company first when the table is empty, then the membership", async () => {
    executeMock.mockResolvedValueOnce([
      { id: 1, openId: "email:bootstrap@example.com", email: "bootstrap@example.com", role: "admin" },
    ]);
    // Override the default mock: pretend NO companies exist yet.
    selectMock.mockReturnValueOnce(makeChainableQuery([]));

    const handler = captureHandler();
    const { res, out } = makeRes();
    await handler(
      makeReq({ email: "Bootstrap@Example.com", password: "long-enough-fixture" }),
      res,
    );

    expect(out.status).toBe(201);
    expect(selectMock).toHaveBeenCalledTimes(1);
    // First insert creates the company; second inserts the membership row.
    expect(insertMock).toHaveBeenCalledTimes(2);
  });

  it("still returns 201 when membership attach fails (admin role still active)", async () => {
    executeMock.mockResolvedValueOnce([
      { id: 1, openId: "email:bootstrap@example.com", email: "bootstrap@example.com", role: "admin" },
    ]);
    // Make the membership step blow up.
    selectMock.mockImplementationOnce(() => {
      throw new Error("simulated membership-step failure");
    });

    const handler = captureHandler();
    const { res, out } = makeRes();
    await handler(
      makeReq({ email: "Bootstrap@Example.com", password: "long-enough-fixture" }),
      res,
    );

    // User row was already inserted (executeMock fired); membership failure
    // is logged but doesn't fail the bootstrap.
    expect(out.status).toBe(201);
    expect(out.body).toMatchObject({ ok: true, role: "admin" });
  });
});
