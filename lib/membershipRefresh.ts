/** An unavailable membership lookup must never be replaced by stale JWT role data. */
export function refreshedMemberships<T>(rows: T[] | null): { available: true; rows: T[] } | { available: false } {
  return rows === null ? { available: false } : { available: true, rows };
}
