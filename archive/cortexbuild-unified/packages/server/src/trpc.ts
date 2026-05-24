import { initTRPC, TRPCError } from "@trpc/server";
import { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { ZodError } from "zod";
import superjson from "superjson";
import { jwtVerify } from "jose";

const jwtSecretRaw = process.env.JWT_SECRET;
if (!jwtSecretRaw || jwtSecretRaw.length < 32) {
  throw new Error(
    "JWT_SECRET must be set to a value of at least 32 characters before the server can start. " +
    "Set it in the environment (e.g. `.env` for dev, repo secrets for CI/deploy).",
  );
}
const JWT_SECRET = new TextEncoder().encode(jwtSecretRaw);

export async function createContext({ req, res }: CreateExpressContextOptions) {
  const auth: any = {};
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET, { clockTolerance: 60 });
      auth.userId = Number(payload.sub);
      auth.email = payload.email as string;
      auth.role = payload.role as string;
      auth.companyId = payload.companyId ? Number(payload.companyId) : null;
    } catch {
      // invalid token
    }
  }
  return { req, res, auth };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return { ...shape, message: error.message, zodError: error.cause instanceof ZodError ? error.cause.flatten() : null };
  },
});

export const middleware = t.middleware;
export const router = t.router;
export const publicProcedure = t.procedure;

const _isAuthed = t.procedure.use(async function isAuthed({ ctx, next }) {
  if (!ctx.auth || !ctx.auth.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return next({ ctx: { ...ctx, auth: ctx.auth } });
});

const _isCompanyScoped = _isAuthed.use(async function isCompanyScoped({ ctx, next }) {
  if (!ctx.auth.companyId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No company context" });
  }
  return next({ ctx });
});

const _isAdmin = _isAuthed.use(async function isAdmin({ ctx, next }) {
  const adminRoles = ["super_admin", "company_owner", "admin"];
  if (!adminRoles.includes(ctx.auth.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

const _isManager = _isAuthed.use(async function isManager({ ctx, next }) {
  const mgrRoles = ["super_admin", "company_owner", "admin", "project_manager", "manager", "supervisor"];
  if (!mgrRoles.includes(ctx.auth.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Manager access required" });
  }
  return next({ ctx });
});

export const protectedProcedure = _isAuthed;
export const companyScopedProcedure = _isCompanyScoped;
export const adminProcedure = _isAdmin;
export const managerProcedure = _isManager;
