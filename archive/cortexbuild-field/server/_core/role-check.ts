/**
 * Phase 3.4 — company-role gate.
 *
 * Layered on top of `companyScopedProcedure` (which gates by tenant
 * membership). This adds a HIERARCHY check: "the caller's companyRole
 * must be at least <min>". The hierarchy is the same one rendered in
 * the UI by `lib/company-context.tsx#hasPermission`, just enforced
 * server-side.
 *
 * Platform admins (companyMembership === null at the procedure level)
 * are NOT auto-bypassed here — admin tooling that needs to mutate
 * tenant data must do so through a real seat. This avoids a class of
 * "platform admin acting as someone they aren't" bugs.
 */
import { TRPCError } from "@trpc/server";
import type { UserRole } from "../../lib/company-context";

// Inlined to avoid pulling `lib/company-context.tsx`'s React Native
// transitive dependencies (AsyncStorage, expo-modules-core, etc.) into
// server-side code and unit tests. Must stay in sync with ROLE_LEVELS
// in `lib/company-context.tsx` — the canonical copy for the UI layer.
// Exported so other server-side modules (e.g. notifications/recipients)
// can reuse the same hierarchy without re-declaring it.
export const ROLE_LEVELS: Record<UserRole, number> = {
  super_admin:   100,
  company_admin: 80,
  manager:       60,
  supervisor:    40,
  worker:        20,
  viewer:        10,
};

export function requireCompanyRole(
  membership: { companyRole: string } | null,
  min: UserRole,
): void {
  const role = membership?.companyRole as UserRole | undefined;
  const userLevel = role ? ROLE_LEVELS[role] : undefined;
  const minLevel = ROLE_LEVELS[min];
  if (userLevel === undefined || userLevel < minLevel) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `This action requires company role "${min}" or higher.`,
    });
  }
}
