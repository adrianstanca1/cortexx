/**
 * Role-based access control.
 *
 * Per-org roles live on UserOrganization (owner / admin / member / viewer).
 * Helpers here standardise the permission checks so routes don't reinvent
 * the role hierarchy.
 */

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer'

const RANK: Record<OrgRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
}

/** True if `actual` has at least the privileges of `required`. */
export function hasRole(actual: OrgRole | string, required: OrgRole): boolean {
  const a = RANK[actual as OrgRole]
  const r = RANK[required]
  if (a === undefined || r === undefined) return false
  return a >= r
}

/** True if the role can perform write operations (create / update / delete). */
export function canWrite(role: OrgRole | string): boolean {
  return hasRole(role, 'member')
}

/** True if the role can manage members + workspace settings. */
export function canManage(role: OrgRole | string): boolean {
  return hasRole(role, 'admin')
}

/** True if the role can manage billing + delete the workspace. */
export function isOwner(role: OrgRole | string): boolean {
  return hasRole(role, 'owner')
}
