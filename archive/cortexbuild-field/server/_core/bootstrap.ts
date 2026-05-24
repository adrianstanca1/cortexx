/**
 * First-run super-admin bootstrap endpoint.
 *
 *   POST /api/admin/bootstrap-superadmin  { email, name?, password }
 *
 * Creates the very first admin row when the users table has zero admins.
 * After that, the endpoint is permanently dead — any subsequent call
 * returns 410 Gone. The check + insert is one statement (`INSERT ...
 * WHERE NOT EXISTS`), so two simultaneous calls cannot both succeed.
 *
 * Why an HTTP endpoint instead of a CLI seed:
 *   - The production DB is reachable only from inside the VPS network,
 *     so a sandbox/operator without SSH access can't run `pnpm seed`.
 *   - The endpoint self-disables, so leaving it deployed after first
 *     use carries no ongoing risk.
 *
 * If you ever need to RE-seed (rotate password, recover lost admin),
 * delete the existing admin row first and the endpoint re-arms.
 */
import type { Express, Request, Response } from "express";
import { asc, sql } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import { companies, companyUsers } from "../../drizzle/schema";
import { getDb } from "../db";
import { hashPassword } from "./passwords";
import { log } from "./logger";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Per-IP throttle for the bootstrap endpoint. The endpoint self-disables
// after the first successful call, but until that happens (and to defend
// against parallel race attempts that all see "no admin yet" before any
// row commits) we cap calls at 10/min/IP. Nginx terminates TLS so the
// client IP arrives via X-Forwarded-For — the parent app must enable
// `trust proxy` for req.ip to reflect that.
const bootstrapLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many bootstrap attempts. Please try again later." },
});

export function registerBootstrapRoute(app: Express) {
  app.post("/api/admin/bootstrap-superadmin", bootstrapLimiter, async (req: Request, res: Response) => {
    const db = await getDb();
    if (!db) {
      res.status(503).json({ error: "Database unavailable" });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = isNonEmptyString(body.email) ? body.email.trim().toLowerCase() : null;
    const name = isNonEmptyString(body.name) ? body.name.trim() : email;
    const password = isNonEmptyString(body.password) ? body.password : null;

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "password must be at least 8 characters" });
      return;
    }

    try {
      const passwordHash = await hashPassword(password);
      const openId = `email:${email}`;

      // Atomic: INSERT only fires if no admin exists. Returning rows tells
      // us whether we actually wrote anything.
      const inserted = (await db.execute(sql`
        INSERT INTO users
          ("openId", name, email, "loginMethod", role, "passwordHash",
           "createdAt", "updatedAt", "lastSignedIn")
        SELECT ${openId}, ${name}, ${email}, 'password', 'admin',
               ${passwordHash}, now(), now(), now()
         WHERE NOT EXISTS (
           SELECT 1 FROM users WHERE role = 'admin'
         )
        RETURNING id, "openId", email, role
      `)) as unknown as { id: number; openId: string; email: string | null; role: string }[];

      if (inserted.length === 0) {
        res.status(410).json({ error: "Bootstrap already completed; an admin user already exists." });
        return;
      }

      const row = inserted[0];
      log.info(`[bootstrap] super-admin created id=${row.id} email=${row.email}`);

      // Best-effort: attach a `companyUsers` membership so the new admin has
      // a tenant binding from the first request. Without this, /api/auth/me
      // returns companyId=null until the operator manually adds a row, and
      // the client falls back to MOCK_COMPANIES[0] in CompanyProvider —
      // functional (admin role bypasses companyScopedProcedure) but visually
      // confusing. Failures here are logged but don't fail the bootstrap;
      // the user is already created and login still works.
      try {
        const existing = await db
          .select({ id: companies.id })
          .from(companies)
          .orderBy(asc(companies.id))
          .limit(1);
        let companyId: number;
        if (existing.length > 0) {
          companyId = existing[0].id;
        } else {
          const [created] = await db
            .insert(companies)
            .values({
              name: "Default Company",
              slug: "default-company",
              plan: "enterprise",
              isActive: true,
            })
            .returning({ id: companies.id });
          companyId = created.id;
          log.info(`[bootstrap] created default company id=${companyId}`);
        }

        await db.insert(companyUsers).values({
          companyId,
          userId: row.id,
          companyRole: "super_admin",
          isActive: true,
        });
        log.info(`[bootstrap] attached super-admin membership companyId=${companyId} userId=${row.id}`);
      } catch (membershipError) {
        log.error("[bootstrap] failed to attach company membership (admin role still active):", membershipError);
      }

      res.status(201).json({ ok: true, id: row.id, email: row.email, role: row.role });
    } catch (error) {
      log.error("[bootstrap] failed:", error);
      res.status(500).json({ error: "Bootstrap failed" });
    }
  });
}
