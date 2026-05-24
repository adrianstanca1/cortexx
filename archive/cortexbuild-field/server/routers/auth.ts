/**
 * Auth router — `me`, `logout`, and email/password `login`.
 *
 * Extracted from `server/routers/index.ts` to keep the monolith file
 * smaller without changing any procedure shape. Re-imported and mounted
 * unchanged into `appRouter` as `auth: authRouter`.
 *
 * The companion `sync` router (offline-replay dispatcher) intentionally
 * stays in `index.ts` because it depends on `appRouter.createCaller(ctx)`
 * — extracting it would create a circular import.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { decodeJwt } from "jose";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { getSessionCookieOptions } from "../_core/cookies";
import { ENV } from "../_core/env";
import { dbUnavailable } from "../_core/errors";
import {
  assertLoginAttemptsAllowed,
  clearLoginAttemptBucket,
  recordFailedLoginAttempt,
} from "../_core/login-rate-limit";
import { hashPassword, verifyPassword } from "../_core/passwords";
import { sdk } from "../_core/sdk";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { buildUserResponse } from "../_core/user-response";
import { writeAuditLog } from "../_core/audit";
import { mintResetToken, verifyResetToken } from "../_core/auth-tokens";
import { passwordResetEmail } from "../_core/email-templates/password-reset";
import { notify } from "../_core/notifications";
import { getDb, getUserByEmail, recordLogin } from "../db";
import { users as dbUsers } from "../../drizzle/schema";
import { log } from "../_core/logger";

type IssuedSession = {
  sessionToken: string;
  user: {
    id: number;
    openId: string;
    email: string | null;
    name: string | null;
    role: "user" | "admin";
  };
};

/**
 * Mint a session JWT, drop the cookie, fire-and-forget recordLogin, and
 * return the standard logged-in response shape.
 */
async function issueSessionFor(
  user: { id: number; openId: string; email: string | null; name: string | null; role: "user" | "admin" },
  ctx: { req: any; res: any },
): Promise<IssuedSession> {
  const sessionToken = await sdk.createSessionToken(user.openId, {
    name: user.name ?? user.email ?? user.openId,
    expiresInMs: ONE_YEAR_MS,
  });
  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
  recordLogin(user.id).catch((error) => {
    log.error("[auth] recordLogin failed (non-fatal):", error);
  });
  return {
    sessionToken,
    user: {
      id: user.id,
      openId: user.openId,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

export const authRouter = router({
  // auth.me must be callable without auth — it's how the client checks "am I
  // logged in?" by inspecting the result. Returns null when no session.
  //
  // Returns the same shape as Express /api/auth/me so the client gets one
  // contract regardless of transport: id, openId, name, email, loginMethod,
  // lastSignedIn, role, plus the user's first active companyUsers
  // membership (companyId / companyRole / companyUserId / jobTitle /
  // department) — null when there's no membership yet, e.g. a fresh
  // super-admin from the bootstrap endpoint.
  //
  // buildUserResponse drops passwordHash on the way out — even though
  // scrypt is one-way, exposing the hash enables offline brute-force and
  // leaks whether a user has a password set.
  me: publicProcedure.query(async (opts) => {
    if (!opts.ctx.user) return null;
    return await buildUserResponse(opts.ctx.user);
  }),
  // logout must work even with a stale/invalid session so the user can clear
  // a broken cookie and recover.
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  /**
   * Email + password login. Issues the same JWT session token that the
   * Manus OAuth flow uses, so once authenticated the rest of the API
   * (protectedProcedure / companyScopedProcedure / adminProcedure) treats
   * the session identically.
   *
   * Errors are deliberately uniform — both "no such email" and "wrong
   * password" return the same UNAUTHORIZED message so the response can't
   * be used to enumerate which emails are registered.
   *
   * On success:
   *   - sets the HTTP-only session cookie (web)
   *   - returns the JWT in the body so native clients can persist it via
   *     expo-secure-store, exactly like the OAuth callback does
   */
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const emailNorm = input.email.trim().toLowerCase();
      assertLoginAttemptsAllowed(ctx.req, emailNorm);

      const user = await getUserByEmail(input.email);
      // Always run the verifier — even when the user doesn't exist — so that
      // a missing-account response and a wrong-password response take the
      // same wall-clock time and don't leak which emails are registered.
      const stored = user?.passwordHash ?? "scrypt$N=16384,r=8,p=1$AAAA$AAAA";
      const ok = await verifyPassword(input.password, stored);

      if (!user || !user.passwordHash || !ok) {
        recordFailedLoginAttempt(ctx.req, emailNorm);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }

      clearLoginAttemptBucket(ctx.req, emailNorm);

      return await issueSessionFor(user, ctx);
    }),


  /**
   * Rotate the password for a signed-in user. Requires proof-of-knowledge
   * of the current password — protects against session-hijack scenarios
   * where an attacker has the cookie but not the password.
   *
   * OAuth-only users (no passwordHash) get BAD_REQUEST: there's nothing
   * to rotate, and silently succeeding would mask the misconfiguration.
   *
   * Existing JWT cookies stay valid after rotation — this codebase's
   * session JWT is signed with JWT_SECRET, not derived from the password
   * hash. To invalidate all sessions, rotate JWT_SECRET separately.
   */
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();

      const [row] = await db.select({ passwordHash: dbUsers.passwordHash })
        .from(dbUsers).where(eq(dbUsers.id, ctx.user.id)).limit(1);
      if (!row?.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This account uses OAuth — password change does not apply.",
        });
      }
      const ok = await verifyPassword(input.currentPassword, row.passwordHash);
      if (!ok) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect." });
      }
      const newHash = await hashPassword(input.newPassword);
      await db.update(dbUsers).set({ passwordHash: newHash }).where(eq(dbUsers.id, ctx.user.id));

      void writeAuditLog({
        companyId: 0,
        userId: ctx.user.id,
        action: "auth.changePassword",
        entityType: "user",
        entityId: ctx.user.id,
        req: ctx.req,
        result: { success: true },
      });
      return { success: true };
    }),

  /**
   * Step 1 of the email-link reset flow — accept an email, look up the user,
   * and (if they exist + have a password set) mint a JWT reset token and
   * email a CTA link.
   *
   * Anti-enumeration: every code path returns `{ success: true }`. The
   * only observable difference between "we sent a mail" and "we didn't"
   * lives in the audit log. Brevo outages are also caught and logged
   * to audit rather than thrown — a transient send failure must not
   * become an oracle for which addresses are registered.
   *
   * OAuth-only users (no passwordHash) deliberately do NOT get a reset
   * email — there's no password to rotate, and emailing them a "reset"
   * link would mislead.
   */
  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserByEmail(input.email);

      if (!user) {
        void writeAuditLog({
          companyId: 0,
          userId: 0,
          action: "auth.requestPasswordReset",
          entityType: "user",
          entityId: 0,
          req: ctx.req,
          result: { sent: false, reason: "unknown-email" },
        });
        return { success: true } as const;
      }

      if (!user.passwordHash) {
        void writeAuditLog({
          companyId: 0,
          userId: user.id,
          action: "auth.requestPasswordReset",
          entityType: "user",
          entityId: user.id,
          req: ctx.req,
          result: { sent: false, reason: "oauth-only" },
        });
        return { success: true } as const;
      }

      const token = await mintResetToken({
        userId: user.id,
        passwordHash: user.passwordHash,
      });
      const body = passwordResetEmail({ recipientName: user.name, token });

      // Send via the gateway in awaited mode so we know the actual
      // outcome before writing the audit log entry. The gateway catches
      // sendEmail failures internally and surfaces them as `failed > 0`
      // — the legacy outer try/catch is no longer needed because the
      // anti-enumeration property (always returning {success:true}) is
      // structural here, not exception-driven. The per-failure error
      // string the legacy audit captured is preserved in stderr via
      // the gateway's `log.error("[auth.requestPasswordReset] ...")`
      // log line — ops dashboards / Sentry pipelines can correlate by
      // the context tag.
      const result = await notify({
        to: [{ userId: user.id, email: user.email, name: user.name ?? "" }],
        channels: {
          email: {
            template: (r) => ({ to: r.email ?? "", ...body }),
          },
        },
        context: "auth.requestPasswordReset",
        mode: "awaited",
      });
      const sent = result.mode === "awaited" && result.sent === 1;

      void writeAuditLog({
        companyId: 0,
        userId: user.id,
        action: "auth.requestPasswordReset",
        entityType: "user",
        entityId: user.id,
        req: ctx.req,
        result: sent ? { sent: true } : { sent: false, reason: "email-failed" },
      });

      return { success: true } as const;
    }),

  /**
   * Step 2 of the email-link reset flow — accept a JWT reset token plus a
   * new password, verify the signature + per-user passwordHash prefix, and
   * rotate the hash.
   *
   * Two-step verification:
   *   1. `decodeJwt` (UNSAFE — no signature check) extracts the userId so
   *      we can look up the user and fetch their CURRENT passwordHash. We
   *      need that hash for the real verify step.
   *   2. `verifyResetToken` runs jwtVerify (signature + exp + alg + purpose)
   *      AND compares the embedded passwordHash prefix against the hash we
   *      just fetched. A mismatch returns null → BAD_REQUEST.
   *
   * Single-use falls out of the design: once we UPDATE passwordHash, the
   * prefix changes and any other outstanding token for this user fails
   * verifyResetToken on its next call.
   */
  resetPasswordWithToken: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();

      // Step 1: unsafe decode to get the userId. Any malformed token,
      // missing/non-numeric userId, etc. → BAD_REQUEST. We deliberately
      // surface the same generic message regardless of the underlying
      // cause so a tampered token can't be used to probe the format.
      let claimedUserId: number;
      try {
        const claims = decodeJwt(input.token);
        if (typeof claims.userId !== "number" || !Number.isInteger(claims.userId)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Reset link is invalid or has expired.",
          });
        }
        claimedUserId = claims.userId;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reset link is invalid or has expired.",
        });
      }

      const [row] = await db.select({ passwordHash: dbUsers.passwordHash })
        .from(dbUsers).where(eq(dbUsers.id, claimedUserId)).limit(1);
      const currentHash = row?.passwordHash ?? null;

      // Step 2: real verify against the fetched hash. Returns null on
      // signature mismatch, expiry, wrong purpose, or hash-prefix
      // mismatch (i.e. the password was already rotated).
      const verified = await verifyResetToken({
        token: input.token,
        currentPasswordHash: currentHash,
      });
      if (!verified) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reset link is invalid or has expired.",
        });
      }

      // Defence-in-depth: the verified userId must match the one we used
      // to fetch the hash. If verifyResetToken passed but the userIds
      // diverge, something is structurally wrong — bail rather than
      // rotate the wrong account's password.
      if (verified.userId !== claimedUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reset link is invalid or has expired.",
        });
      }

      const newHash = await hashPassword(input.newPassword);
      await db.update(dbUsers)
        .set({ passwordHash: newHash })
        .where(eq(dbUsers.id, verified.userId));

      void writeAuditLog({
        companyId: 0,
        userId: verified.userId,
        action: "auth.resetPasswordWithToken",
        entityType: "user",
        entityId: verified.userId,
        req: ctx.req,
        result: { success: true },
      });
      return { success: true } as const;
    }),

  /**
   * Self-service registration, gated by ENV.registrationAllowedDomains.
   * Returns FORBIDDEN if the email domain isn't whitelisted (or if the
   * list is empty — registration is opt-in via env config). Returns
   * CONFLICT if the email is already in use. On success, the caller
   * routes to /login — no auto-sign-in here so the new user explicitly
   * confirms their password works against the rotated hash.
   *
   * Email verification is intentionally not part of this PR — the
   * domain whitelist is the only gate. If self-service ever opens to
   * arbitrary domains, add `users.emailVerifiedAt` and a verification
   * email step before relaxing the domain check.
   */
  register: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().min(1).max(255),
    }))
    .mutation(async ({ ctx, input }) => {
      const allowed = ENV.registrationAllowedDomains;
      if (allowed.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Self-service registration is not enabled.",
        });
      }
      const email = input.email.toLowerCase();
      const domain = email.split("@").pop() ?? "";
      if (!allowed.includes(domain)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This email domain is not permitted to self-register. Ask your administrator for an invite.",
        });
      }

      const db = await getDb();
      if (!db) throw dbUnavailable();

      const existing = await getUserByEmail(email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with that email already exists. Sign in or reset your password instead.",
        });
      }

      const passwordHash = await hashPassword(input.password);
      const [created] = await db.insert(dbUsers).values({
        openId: "email:" + email,
        email,
        name: input.name,
        role: "user",
        loginMethod: "password",
        passwordHash,
      }).returning({ id: dbUsers.id });

      void writeAuditLog({
        companyId: 0,
        userId: created.id,
        action: "auth.register",
        entityType: "user",
        entityId: created.id,
        req: ctx.req,
        result: { success: true, domain },
      });
      return { success: true, userId: created.id };
    }),
});
