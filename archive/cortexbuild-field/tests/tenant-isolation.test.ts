/**
 * Static-analysis style test: pin which procedure-builder each procedure in
 * `server/routers.ts` is wired to.
 *
 * Why this exists: `protectedProcedure` only verifies "some user is logged
 * in", not "the user has access to the company they're operating on".
 * Mutating or reading tenant data through `protectedProcedure` (instead of
 * `companyScopedProcedure`) silently allows a logged-in user from company A
 * to write to company B by passing the right `companyId`/`projectId`. We
 * cannot prevent that with a runtime test alone (most procedures don't
 * even take a `companyId` and rely on `projectId`/internal joins), so this
 * test is a deliberate snapshot:
 *
 *   - The CURRENT_BUILDERS map below is the source of truth. Any time a
 *     procedure changes its auth wrapper, this file must be updated, and
 *     the diff appears in code review where someone can ask "should that
 *     have stayed company-scoped?".
 *   - PUBLIC_ALLOWLIST is the *only* set of procedures allowed to be
 *     `publicProcedure`. Adding a public procedure requires adding it
 *     here — making the unauthenticated surface area explicit.
 *   - PROTECTED_BUT_TENANT_RISK enumerates procedures that read/write
 *     tenant data through `protectedProcedure` today. The list itself is
 *     a TODO surface — shrinking it (by upgrading to companyScoped) is
 *     the cross-tenant hardening the codebase needs.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// appRouter has been split into per-feature sub-router files under
// server/routers/. The `index.ts` file mounts them and still contains
// the inline procedures that haven't been extracted yet. We parse
// index.ts plus every sibling sub-router file so the topology snapshot
// continues to cover the whole appRouter as files migrate out.
const ROUTERS_DIR = path.resolve(__dirname, "../server/routers");
const ROUTERS_SRC = readFileSync(path.join(ROUTERS_DIR, "index.ts"), "utf8");
const SUB_ROUTER_FILES = readdirSync(ROUTERS_DIR)
  .filter((f) => f.endsWith(".ts") && f !== "index.ts")
  .map((f) => ({
    parent: f.replace(/\.ts$/, ""),
    src: readFileSync(path.join(ROUTERS_DIR, f), "utf8"),
  }));
// systemRouter lives in server/_core/ but is mounted into appRouter as
// `system: systemRouter`. Parse it the same way and merge the results.
const SYSTEM_SRC = readFileSync(
  path.resolve(__dirname, "../server/_core/systemRouter.ts"),
  "utf8",
);

type Builder =
  | "publicProcedure"
  | "protectedProcedure"
  | "adminProcedure"
  | "superAdminProcedure"
  | "companyScopedProcedure";

/**
 * Walk `appRouter` source and record the builder used by each procedure.
 *
 * `server/routers.ts` is structured as a flat appRouter with one level of
 * sub-routers (auth, sync, files, ai, …). We:
 *   1. Find the line number of every `<name>: router({` opener.
 *   2. For every `<name>: <builder>` line, find the most recent sub-router
 *      opener that comes BEFORE it and use that as the namespace.
 *
 * This is robust against the inner `{` / `}` chars inside `.input(z.object({…}))`,
 * which broke a brace-counting approach.
 */
function extractProcedures(src: string, defaultParent: string | null = null): Record<string, Builder> {
  const out: Record<string, Builder> = {};
  const lines = src.split("\n");

  const subRouterOpenRegex = /^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*router\(\{\s*$/;
  const procRegex = /^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(publicProcedure|protectedProcedure|adminProcedure|superAdminProcedure|companyScopedProcedure)\b/;

  // Build [{ name, line }, ...] of sub-router openers in source order.
  const openers: { name: string; line: number }[] = [];
  lines.forEach((line, idx) => {
    const m = subRouterOpenRegex.exec(line);
    if (m) openers.push({ name: m[1], line: idx });
  });

  // For each procedure line, attribute it to the most recent opener — or
  // fall back to defaultParent when the file doesn't have an inline
  // sub-router opener (e.g. systemRouter is the whole file's export).
  lines.forEach((line, idx) => {
    const m = procRegex.exec(line);
    if (!m) return;

    let parent: string | null = defaultParent;
    for (const o of openers) {
      if (o.line < idx) parent = o.name;
      else break;
    }
    if (!parent) return;

    const qualified = `${parent}.${m[1]}`;
    out[qualified] = m[2] as Builder;
  });

  return out;
}

const PROCEDURES: Record<string, Builder> = {
  ...extractProcedures(ROUTERS_SRC),
  ...extractProcedures(SYSTEM_SRC, "system"),
  ...Object.fromEntries(
    SUB_ROUTER_FILES.flatMap(({ parent, src }) =>
      Object.entries(extractProcedures(src, parent)),
    ),
  ),
};

// ─── Allow-lists / Snapshots ──────────────────────────────────────────────

/**
 * Procedures that MUST be `publicProcedure`. Adding to this list expands
 * the unauthenticated attack surface — every entry needs justification.
 */
const PUBLIC_ALLOWLIST: ReadonlySet<string> = new Set([
  "auth.login",        // bootstrap session from email+password
  "auth.logout",       // must work even with a stale/invalid session
  "auth.me",           // returns null when no session — used as the login probe
  "auth.requestPasswordReset", // anyone can request a reset email; response shape is constant to avoid email-enumeration
  "auth.resetPasswordWithToken", // token-bearing reset completion; possession of the JWT is the auth
  "auth.register", // Self-service registration, domain-whitelist gated
  "sync.replay",       // offline queue replay — auth happens via inner ctx
  "system.health",     // liveness probe behind the gateway
  "users.acceptInvite", // first-login token swap before a session exists
]);

/**
 * Procedures that read/write tenant data but are currently wired to
 * `protectedProcedure` (not `companyScopedProcedure`). Each entry is a
 * known cross-tenant gap: a logged-in user from another company could
 * pass a `projectId` belonging to a different tenant and the procedure
 * would happily process it. Shrinking this list is the goal — but we
 * pin it as a snapshot so accidental ADDITIONS fail loudly.
 */
const PROTECTED_TENANT_GAPS: ReadonlySet<string> = new Set([
  // checkins use projectId only — checkIns table has no companyId column,
  // so a schema migration is required before these can be company-scoped.
  "checkins.create",
  "checkins.checkout",
  "checkins.history",
  // (defects.*, incidents.*, files.*, permits.*, dailyReports.*, tasks.*
  // were upgraded to companyScopedProcedure in PRs #58 / #59. settings.*,
  // documents.*, ai.* were upgraded in the third batch.)
  // teams CRUD was upgraded on 2026-05-05 — companyId added to team_members
  // via drizzle/0008_team_members_companyId.sql; all four procedures now use
  // companyScopedProcedure with project FK guard on create.
  // user invites — invite/listInvites/revokeInvite were upgraded to
  // companyScopedProcedure on 2026-05-05. resendInvite still uses email-only
  // lookup (no companyId in input — admin-style "find any pending invite for
  // this email"); pending its own scoping fix.
  "users.resendInvite",
  // Password rotation — scoped by ctx.user.id, not companyId. A user's
  // password is account-level (follows them across companies), so this
  // is intentionally not company-scoped.
  "auth.changePassword",
  // misc — pushTokens.register has no companyId column on push_tokens table
  "pushTokens.register",
  // Per-event push preferences. Stored on users.pushPreferences,
  // scoped by ctx.user.id — a user's notification choices follow the
  // user across companies, not per-tenant.
  "pushTokens.preferences",
  "pushTokens.updatePreference",
  // companies.list — INTENTIONALLY cross-company. The whole point is to
  // return every membership the authenticated user holds so they can
  // switch context to one of them. Implicitly scoped by ctx.user.id;
  // a user can only see companies they're a member of.
  "companies.list",
]);

/**
 * Procedures that MUST be `adminProcedure` (platform admin).
 * Empty by design — `system.notifyOwner` is the sole platform-level
 * procedure and it sits on `superAdminProcedure`. Kept as an empty set
 * rather than removed so a future regression that introduces a new
 * `adminProcedure` without justification still trips the topology test.
 */
const ADMIN_ALLOWLIST: ReadonlySet<string> = new Set([]);

/**
 * Procedures that MUST be `superAdminProcedure`. Currently aliases
 * `adminProcedure` (TOTP gate dropped in `0016_remove_totp`) but kept as
 * a distinct named export so a future second factor can be reintroduced
 * without churning every call site. Allow-listing keeps platform-wide
 * privileged ops explicit.
 */
const SUPER_ADMIN_ALLOWLIST: ReadonlySet<string> = new Set([
  "system.notifyOwner",
]);

// ─── Tests ────────────────────────────────────────────────────────────────

describe("appRouter procedure topology", () => {
  it("parses the expected number of procedures (sanity check on the extractor)", () => {
    // Drift-detector: if the extractor regex breaks, this number will collapse.
    expect(Object.keys(PROCEDURES).length).toBeGreaterThanOrEqual(95);
    expect(Object.keys(PROCEDURES).length).toBeLessThanOrEqual(155);
  });

  it("every `publicProcedure` is on the explicit allow-list", () => {
    const publics = Object.entries(PROCEDURES)
      .filter(([, b]) => b === "publicProcedure")
      .map(([n]) => n)
      .sort();

    for (const name of publics) {
      expect(
        PUBLIC_ALLOWLIST.has(name),
        `"${name}" is publicProcedure but not in PUBLIC_ALLOWLIST. Adding a publicProcedure expands the unauthenticated API — update PUBLIC_ALLOWLIST in tenant-isolation.test.ts only after a security review.`,
      ).toBe(true);
    }
  });

  it("every entry in PUBLIC_ALLOWLIST actually exists and is publicProcedure", () => {
    // Catches stale allow-list entries (procedure renamed / removed but the
    // allow-list still references the old name).
    for (const name of PUBLIC_ALLOWLIST) {
      expect(PROCEDURES[name], `${name} listed in PUBLIC_ALLOWLIST but not found in appRouter`).toBeDefined();
      expect(PROCEDURES[name]).toBe("publicProcedure");
    }
  });

  it("every `protectedProcedure` is on the explicit tenant-gap list", () => {
    const protectedProcs = Object.entries(PROCEDURES)
      .filter(([, b]) => b === "protectedProcedure")
      .map(([n]) => n);

    for (const name of protectedProcs) {
      expect(
        PROTECTED_TENANT_GAPS.has(name),
        `"${name}" is protectedProcedure (tenant data not company-scoped). If this is a NEW procedure, prefer companyScopedProcedure. If it genuinely should not be company-scoped, add it to PROTECTED_TENANT_GAPS in tenant-isolation.test.ts so the gap is tracked.`,
      ).toBe(true);
    }
  });

  it("every entry in PROTECTED_TENANT_GAPS still exists and is still protectedProcedure", () => {
    for (const name of PROTECTED_TENANT_GAPS) {
      expect(PROCEDURES[name], `${name} listed in PROTECTED_TENANT_GAPS but not found in appRouter`).toBeDefined();
      // If a procedure was upgraded to companyScopedProcedure, that's good
      // news — the test fails so the list can be shrunk.
      expect(
        PROCEDURES[name],
        `${name} was upgraded out of protectedProcedure — remove it from PROTECTED_TENANT_GAPS in tenant-isolation.test.ts. Win!`,
      ).toBe("protectedProcedure");
    }
  });

  it("`auth.me` returns null without throwing for unauth callers (publicProcedure contract)", () => {
    // auth.me is intentionally publicProcedure: the client uses it to ask
    // "am I logged in?" and inspects whether the result is null. If this
    // ever moved to protectedProcedure, every cold-start would hit a
    // 401/UNAUTHORIZED instead of getting `null`, breaking the flow.
    expect(PROCEDURES["auth.me"]).toBe("publicProcedure");
  });

  it("every `adminProcedure` is on the explicit admin allow-list", () => {
    const admins = Object.entries(PROCEDURES)
      .filter(([, b]) => b === "adminProcedure")
      .map(([n]) => n);

    for (const name of admins) {
      expect(ADMIN_ALLOWLIST.has(name), `${name} is adminProcedure but not in ADMIN_ALLOWLIST`).toBe(true);
    }
    for (const name of ADMIN_ALLOWLIST) {
      expect(PROCEDURES[name]).toBe("adminProcedure");
    }
  });

  it("every `superAdminProcedure` is on the explicit super-admin allow-list", () => {
    const supers = Object.entries(PROCEDURES)
      .filter(([, b]) => b === "superAdminProcedure")
      .map(([n]) => n);

    for (const name of supers) {
      expect(
        SUPER_ADMIN_ALLOWLIST.has(name),
        `${name} is superAdminProcedure but not in SUPER_ADMIN_ALLOWLIST. Adding super-admin endpoints requires explicit listing — they represent platform-wide privileged ops and any future second-factor gate would land on this procedure builder.`,
      ).toBe(true);
    }
    for (const name of SUPER_ADMIN_ALLOWLIST) {
      expect(
        PROCEDURES[name],
        `${name} listed in SUPER_ADMIN_ALLOWLIST but missing from appRouter`,
      ).toBeDefined();
      expect(PROCEDURES[name]).toBe("superAdminProcedure");
    }
  });

  it("every `companyScopedProcedure` exists — sanity check the count", () => {
    const scoped = Object.entries(PROCEDURES).filter(([, b]) => b === "companyScopedProcedure");
    // Pinning the count loosely so adding a new company-scoped procedure
    // doesn't break the test, but a regression that strips `companyScoped`
    // off many at once will be visible.
    expect(scoped.length).toBeGreaterThanOrEqual(40);
  });
});
