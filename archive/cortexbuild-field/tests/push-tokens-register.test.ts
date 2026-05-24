import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../server/_core/context";
import { log } from "../server/_core/logger";

/**
 * Tests for the `pushTokens.register` procedure. Three contracts:
 *
 *   1. Owner is derived from `ctx.user.id` — never trusted from input. Push
 *      tokens are stored in a non-tenant-scoped table (`push_tokens`) so a
 *      `protectedProcedure` that accepted `userId` from the client would let
 *      any logged-in user claim someone else's device's token and intercept
 *      their notifications.
 *
 *   2. Atomic upsert: a single `INSERT … ON CONFLICT DO UPDATE` keyed on
 *      `token` (UNIQUE constraint added in migration 0006). That handles
 *      both the same-user-re-registers and account-switch-on-shared-device
 *      cases without a delete-then-insert race window.
 *
 *   3. The conflict-update path flips ownership to the current user, so a
 *      newly-signed-in user actually wins the row.
 *
 * We don't need a real Postgres for this — Drizzle's chained query builder
 * is mockable with stubs that record the call shape. We DO record events
 * on a single ordered timeline so an assertion about ordering can't pass
 * accidentally if the implementation ever flips the call sequence.
 */

type DbEvent =
  | { kind: 'insert.values'; values: Record<string, unknown> }
  | { kind: 'insert.onConflictDoUpdate'; target: unknown; set: Record<string, unknown> }
  | { kind: 'delete.where' };

const events: DbEvent[] = [];
const state: { injectInsertError: Error | null } = { injectInsertError: null };

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({
    insert(_table: any) {
      return {
        values(values: Record<string, unknown>) {
          events.push({ kind: 'insert.values', values });
          // Return an awaitable chainable: drizzle's `.values(...)` is
          // both `await`-able by itself AND `.onConflictDoUpdate`-able.
          // We model that by returning an object that is BOTH then-able
          // and has `onConflictDoUpdate`.
          const builder: any = {
            onConflictDoUpdate(opts: { target: unknown; set: Record<string, unknown> }) {
              events.push({ kind: 'insert.onConflictDoUpdate', target: opts.target, set: opts.set });
              if (state.injectInsertError) return Promise.reject(state.injectInsertError);
              return Promise.resolve();
            },
            then(onFulfilled: any) {
              return Promise.resolve().then(onFulfilled);
            },
          };
          return builder;
        },
      };
    },
    delete(_table: any) {
      return {
        where(_predicate: any) {
          events.push({ kind: 'delete.where' });
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

describe("pushTokens.register", () => {
  beforeEach(() => {
    events.length = 0;
    state.injectInsertError = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("INSERTs with userId from ctx.user (input cannot override owner)", async () => {
    const caller = appRouter.createCaller(ctxFor(42));

    await caller.pushTokens.register({
      token: "ExponentPushToken[abc123]",
      platform: "ios",
    });

    const insertValues = events.find(
      (e): e is Extract<DbEvent, { kind: 'insert.values' }> => e.kind === 'insert.values',
    );
    expect(insertValues).toBeDefined();
    expect(insertValues?.values).toMatchObject({
      userId: 42,
      token: "ExponentPushToken[abc123]",
      platform: "ios",
    });
  });

  it("uses ON CONFLICT DO UPDATE keyed on the token column for atomic upsert", async () => {
    const caller = appRouter.createCaller(ctxFor(7));

    await caller.pushTokens.register({
      token: "ExponentPushToken[device-A]",
      platform: "android",
    });

    // The ordering of events on the timeline tells us the implementation
    // built the chain `insert(...).values(...).onConflictDoUpdate(...)` —
    // i.e. one atomic SQL statement, not delete + insert. This is what
    // closes the race window the prior delete-then-insert version had.
    expect(events.map(e => e.kind)).toEqual([
      'insert.values',
      'insert.onConflictDoUpdate',
    ]);
    // No DELETE was issued.
    expect(events.some(e => e.kind === 'delete.where')).toBe(false);
  });

  it("on conflict, the row's owner flips to the current ctx.user (not the prior owner)", async () => {
    // Simulates "user B signs in on a device that was last registered to A":
    // the upsert's SET branch runs, and userId must be the new caller's id.
    const caller = appRouter.createCaller(ctxFor(99));

    await caller.pushTokens.register({
      token: "ExponentPushToken[shared-device]",
      platform: "android",
    });

    const conflict = events.find(
      (e): e is Extract<DbEvent, { kind: 'insert.onConflictDoUpdate' }> =>
        e.kind === 'insert.onConflictDoUpdate',
    );
    expect(conflict).toBeDefined();
    expect(conflict?.set).toMatchObject({
      userId: 99,
      platform: "android",
    });
    // updatedAt must be bumped so the application can reason about
    // "last seen this device" without a separate write.
    expect(conflict?.set.updatedAt).toBeInstanceOf(Date);
  });

  it("rejects the call when no session is attached (UNAUTHORIZED, no DB writes)", async () => {
    const unauthCtx = {
      user: null,
      req: { protocol: "https", hostname: "localhost", headers: {} },
      res: { clearCookie: vi.fn() },
    } as unknown as TrpcContext;
    const caller = appRouter.createCaller(unauthCtx);

    await expect(
      caller.pushTokens.register({ token: "x", platform: "ios" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    // Crucially: nothing got written.
    expect(events).toHaveLength(0);
  });

  it("translates raw drizzle/Postgres errors to a typed TRPCError (not INTERNAL_SERVER_ERROR with leaky message)", async () => {
    // Simulate an FK violation (deleted users row), a platform-enum
    // schema-drift error, or a pool exhaustion. Without the wrap, the
    // raw Postgres error string lands in the client's err.message —
    // leaks driver internals and looks like a real bug to ops.
    state.injectInsertError = Object.assign(new Error("duplicate key value violates unique constraint"), {
      code: "23505",
    });
    const warnSpy = vi.spyOn(log, "warn").mockImplementation(() => {});
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.pushTokens.register({ token: "ExponentPushToken[abc]", platform: "ios" }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Could not register push token. Please try again.",
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("ignores any extra fields in input — owner stays the session user", async () => {
    const caller = appRouter.createCaller(ctxFor(1));

    await caller.pushTokens.register({
      token: "ExponentPushToken[xyz]",
      platform: "web",
      // @ts-expect-error — userId is not part of the input schema; defence-in-depth
      userId: 999,
    });

    const insertValues = events.find(
      (e): e is Extract<DbEvent, { kind: 'insert.values' }> => e.kind === 'insert.values',
    );
    expect(insertValues?.values).toMatchObject({ userId: 1 });
  });
});
