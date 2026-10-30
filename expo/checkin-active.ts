/** Prefer the authoritative active-only check-in lookup over a truncated history.
 * `undefined` means the lookup could not be verified (offline), while `null`
 * means the server definitively found no open check-in for this team member. */
export function selectActiveCheckIn<T extends { memberId: string; checkedOutAt?: string | null }>(
  history: T[], memberId: string | null | undefined, verified: T | null | undefined,
): T | null | undefined {
  if (!memberId) return undefined
  if (verified !== undefined) return verified
  return history.find(row => row.memberId === memberId && !row.checkedOutAt)
}
