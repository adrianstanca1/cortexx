/**
 * Shared shape for "the user, plus their first active company membership".
 *
 * Both the Express OAuth handlers (`/api/auth/me`, `/api/oauth/mobile`) and
 * the tRPC `auth.me` query return this shape, so the client can rely on a
 * single contract regardless of which transport the session came from.
 *
 * Membership lookup is best-effort: if the DB is unavailable or the user
 * has no `companyUsers` row yet (e.g. a fresh super-admin from the bootstrap
 * endpoint), the membership fields come back as `null` and the caller is
 * still able to render the user identity. Platform admins (`role==='admin'`)
 * bypass tenant checks server-side anyway, so a missing membership doesn't
 * lock them out.
 */
import { eq } from "drizzle-orm";
import { companyUsers } from "../../drizzle/schema";
import { getDb } from "../db";

type MaybeUser = {
  id?: number | null;
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  role?: string | null;
  lastSignedIn?: Date | null;
} | null | undefined;

export type UserResponse = {
  id: number | null;
  openId: string | null;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: string;
  role: string;
  companyId: number | null;
  companyRole: string | null;
  companyUserId: number | null;
  jobTitle: string | null;
  department: string | null;
};

export async function buildUserResponse(user: MaybeUser): Promise<UserResponse> {
  let membership: {
    companyId: number;
    companyRole: string;
    companyUserId: number;
    jobTitle: string | null;
    department: string | null;
  } | null = null;

  const userId = user?.id ?? null;
  if (userId != null) {
    const db = await getDb();
    if (db) {
      const [row] = await db
        .select()
        .from(companyUsers)
        .where(eq(companyUsers.userId, userId))
        .limit(1);
      // companyUsers.isActive is `boolean(...).default(true)` with no .notNull(),
      // so null is a valid DB value. Treat null as inactive — only true grants
      // access — to match companyScopedProcedure's check.
      if (row && row.isActive === true) {
        membership = {
          companyId: row.companyId,
          companyRole: row.companyRole,
          companyUserId: row.id,
          jobTitle: row.jobTitle,
          department: row.department,
        };
      }
    }
  }

  return {
    id: user?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    lastSignedIn: (user?.lastSignedIn ?? new Date()).toISOString(),
    role: user?.role ?? "user",
    companyId: membership?.companyId ?? null,
    companyRole: membership?.companyRole ?? null,
    companyUserId: membership?.companyUserId ?? null,
    jobTitle: membership?.jobTitle ?? null,
    department: membership?.department ?? null,
  };
}
