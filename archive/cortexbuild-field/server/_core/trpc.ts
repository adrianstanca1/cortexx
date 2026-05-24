import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import superjson from "superjson";
import { companyUsers } from "../../drizzle/schema";
import { getDb } from "../db";
import { writeAuditLog } from "./audit";
import type { TrpcContext } from "./context";

/**
 * Sanitize INTERNAL_SERVER_ERROR responses in production. Without this, tRPC
 * echoes the raw thrown Error.message back to the client — and Drizzle /
 * postgres-js error messages include the full SQL query, the column list,
 * and even the bound parameter values. That leaks the users-table schema
 * and the email the client just submitted to anyone who can probe the API.
 *
 * Operational error codes (UNAUTHORIZED, BAD_REQUEST, FORBIDDEN, NOT_FOUND,
 * …) keep their messages — those are intentional and useful to clients.
 * Stack traces are also stripped from production responses.
 *
 * Exported so it can be unit-tested in isolation; tRPC's `createCaller`
 * bypasses errorFormatter (it's only invoked on the HTTP wire path), so
 * end-to-end behaviour has to be asserted by calling this directly.
 */
export function sanitizeErrorShape(shape: any, errorCode: string, nodeEnv: string | undefined) {
  if (errorCode === "INTERNAL_SERVER_ERROR" && nodeEnv === "production") {
    return {
      ...shape,
      message: "Internal server error",
      data: {
        ...shape.data,
        stack: undefined,
      },
    };
  }
  return shape;
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return sanitizeErrorShape(shape, error.code, process.env.NODE_ENV);
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * Super-admin procedure.
 *
 * Currently identical to `adminProcedure` (`role === 'admin'`). Historically
 * also required completed TOTP enrolment; that gate was removed when 2FA
 * was taken out of the product. Kept as a distinct exported name so call
 * sites stay readable and a future second-factor can be re-introduced
 * without churning every endpoint signature.
 */
export const superAdminProcedure = adminProcedure;

/**
 * Company-scoped procedure.
 *
 * Requires:
 *   1. `ctx.user` is set (logged in)
 *   2. `input.companyId` is a positive integer
 *   3. The user has an active `companyUsers` membership for that company
 *
 * On success, populates `ctx.companyMembership` with the membership row so
 * downstream handlers can inspect `companyRole` etc. without a second query.
 *
 * Use this for any procedure that mutates or reads a tenant-scoped table —
 * it closes the gap where `protectedProcedure` only verifies "some user is
 * logged in" but happily accepts any `companyId` the client claims.
 *
 * Platform admins (ctx.user.role === 'admin') bypass the membership check
 * so support tooling still works across tenants.
 */
export const companyScopedProcedure = protectedProcedure.use(async (opts) => {
  const { ctx, next, getRawInput, type, path } = opts;
  const rawInput = (await getRawInput()) as { companyId?: unknown } | undefined;
  const companyId = typeof rawInput?.companyId === "number" ? rawInput.companyId : undefined;

  if (companyId === undefined || !Number.isInteger(companyId) || companyId <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "companyId is required for this procedure.",
    });
  }

  let companyMembership: { companyRole: string; isActive: boolean | null } | null = null;

  if (ctx.user.role !== "admin") {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database unavailable; cannot verify company membership.",
      });
    }

    const [row] = await db
      .select({ companyRole: companyUsers.companyRole, isActive: companyUsers.isActive })
      .from(companyUsers)
      .where(and(eq(companyUsers.userId, ctx.user.id), eq(companyUsers.companyId, companyId)))
      .limit(1);

    // companyUsers.isActive is `boolean('isActive').default(true)` with no
    // .notNull(), so null is a valid DB value. Use `!== true` (not `=== false`)
    // so a null isActive is treated as inactive — null should never grant access.
    if (!row || row.isActive !== true) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to this company.",
      });
    }
    companyMembership = row;
  }
  // Platform admins (ctx.user.role === "admin") fall through with
  // companyMembership=null — they bypass the membership check so support
  // tooling still works across tenants.

  // Run the handler. Errors propagate naturally — only successful
  // mutations are audited (Phase 2.5). This keeps TypeScript's ctx-
  // augmentation inference clean and avoids re-entering the (likely
  // mocked) DB on the failure path in tests.
  const result = await next({ ctx: { ...ctx, companyMembership } });

  // Fire-and-forget audit on success. NEVER throws; audit failure must
  // not affect the user's mutation result. AUDIT_DISABLED=1 turns it
  // off — used by unit tests where mocked DBs would treat the audit
  // INSERT as an unexpected side-effect. Integration tests + production
  // leave it enabled.
  if (type === "mutation" && process.env.AUDIT_DISABLED !== "1") {
    void writeAuditLog({
      companyId,
      userId: ctx.user.id,
      action: path ?? "unknown",
      req: ctx.req,
      input: rawInput,
      result: { success: true },
    });
  }

  return result;
});
