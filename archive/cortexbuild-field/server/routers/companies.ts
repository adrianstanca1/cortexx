import { and, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  companies as dbCompanies,
  companyUsers as dbCompanyUsers,
} from "../../drizzle/schema";

export const companiesRouter = router({
  /**
   * Return every company the authenticated user is a member of (i.e.
   * has an active row in `companyUsers`), joined with the company
   * record so the client gets name / slug / plan / branding in a
   * single call.
   *
   * Why this is `protectedProcedure` and not `companyScopedProcedure`:
   * the entire point is to be cross-company — the user picks one of
   * the returned rows to switch context to. The procedure is
   * implicitly scoped by `ctx.user.id` so a user can only see
   * memberships they actually hold; another tenant's companies
   * are not surfaced. This is logged in `tests/tenant-isolation.test
   * .ts PROTECTED_TENANT_GAPS` with that explicit rationale.
   *
   * Drives `lib/company-context.tsx`'s `companies` array — replaces
   * the MOCK_COMPANIES fallback that used to ship to every signed-in
   * user regardless of membership.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        id: dbCompanies.id,
        name: dbCompanies.name,
        slug: dbCompanies.slug,
        plan: dbCompanies.plan,
        logoUrl: dbCompanies.logoUrl,
        primaryColor: dbCompanies.primaryColor,
        utr: dbCompanies.utr,
        cisStatus: dbCompanies.cisStatus,
        vatNumber: dbCompanies.vatNumber,
        companyNumber: dbCompanies.companyNumber,
        address: dbCompanies.address,
        phone: dbCompanies.phone,
        email: dbCompanies.email,
        payrollEmail: dbCompanies.payrollEmail,
        activeAiProvider: dbCompanies.activeAiProvider,
        activeAiModel: dbCompanies.activeAiModel,
        maxProjects: dbCompanies.maxProjects,
        maxUsers: dbCompanies.maxUsers,
        maxPipelines: dbCompanies.maxPipelines,
        // Membership-side fields the UI needs to badge the row.
        companyRole: dbCompanyUsers.companyRole,
        companyUserId: dbCompanyUsers.id,
      })
      .from(dbCompanyUsers)
      .innerJoin(dbCompanies, eq(dbCompanyUsers.companyId, dbCompanies.id))
      .where(
        and(
          eq(dbCompanyUsers.userId, ctx.user.id),
          // companyUsers.isActive defaults true but is nullable. Using
          // `eq(..., true)` matches the same rule as the
          // `companyScopedProcedure` middleware in server/_core/trpc.ts.
          eq(dbCompanyUsers.isActive, true),
        ),
      );
    return rows;
  }),
});
