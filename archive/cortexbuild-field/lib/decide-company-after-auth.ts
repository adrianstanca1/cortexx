/**
 * Pure decision helper for `CompanyProvider`'s "what should currentCompany
 * be once the user resolves" question. Extracted to its own file (no React,
 * no tRPC, no AsyncStorage imports) so it can be unit-tested in a Node-only
 * vitest run without dragging in the whole app provider chain.
 */

/**
 * Minimal shape the helper needs to inspect on a Company. Constraining
 * the generic to `{ id: number; name: string; slug: string }` (no index
 * signature) lets callers pass any concrete Company type — including
 * the rich one from `lib/company-context` — without a structural mismatch.
 */
type WithIdNameSlug = {
  id: number;
  name: string;
  slug: string;
};

/**
 * Build the placeholder `Company` value we should pin `currentCompany` to
 * when a user transitions from "no session" to "signed in" (or signs in
 * as a different user.id).
 *
 * Returns:
 *  - `null` when there's no user or the user has no `companyId` — caller
 *    leaves `currentCompany` untouched.
 *  - `defaultCompany` unchanged when the user's primary company IS the
 *    default. Reusing the existing reference (no spread) avoids needless
 *    churn for any state-setter that uses referential equality.
 *  - A placeholder `{...defaultCompany, id: user.companyId, name: '', slug: ''}`
 *    when the user's primary company differs from the default — pins the
 *    right `id` so the next `companyScopedProcedure` query targets the
 *    user's tenant; `settingsQuery.data` hydrates the rest a tick later.
 *
 * IMPORTANT — caller responsibility:
 * This helper must only be invoked once per `user.id` transition. The
 * caller in `CompanyProvider` enforces that with a ref (`pinnedForUserIdRef`)
 * so an explicit `switchCompany()` after the initial pin is never undone
 * by a re-render of the auth effect — including the case where the user
 * picks a tenant whose id happens to equal `defaultCompany.id`, which
 * the helper has no way to distinguish from "still on the pre-login
 * default" if it inspected `current` itself.
 */
export function buildCompanyPinForUser<T extends WithIdNameSlug>(
  user: { companyId?: number | null } | null,
  defaultCompany: T,
): T | null {
  if (!user?.companyId) return null;
  if (user.companyId === defaultCompany.id) return defaultCompany;
  return { ...defaultCompany, id: user.companyId, name: '', slug: '' };
}
