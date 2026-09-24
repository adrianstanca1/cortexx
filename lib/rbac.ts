/** Organization role helpers used by server-side route authorization. */

export type OrgRole =
  | 'owner'
  | 'company_admin'
  | 'project_manager'
  | 'foreman'
  | 'operative'
  | 'client'
  | 'viewer'
  // Legacy values retained while existing memberships are migrated.
  | 'admin'
  | 'member'

const ROLE_LEVEL: Record<OrgRole, number> = {
  viewer: 0,
  client: 0,
  operative: 1,
  member: 1,
  foreman: 2,
  project_manager: 3,
  company_admin: 4,
  admin: 4,
  owner: 5,
}

export function hasRole(actual: OrgRole | string, required: OrgRole): boolean {
  const a = ROLE_LEVEL[actual as OrgRole]
  const r = ROLE_LEVEL[required]
  return a !== undefined && r !== undefined && a >= r
}

/** General business-data writes. Project-level policies may further restrict scope. */
export function canWrite(role: OrgRole | string): boolean {
  return ['owner', 'admin', 'company_admin', 'project_manager', 'foreman', 'operative', 'member'].includes(role)
}

/** Company-level settings, membership and billing administration. */
export function canManage(role: OrgRole | string): boolean {
  return role === 'owner' || role === 'admin' || role === 'company_admin'
}

/** Project creation is intentionally company-admin-only; PMs manage assigned projects. */
export function canCreateProject(role: OrgRole | string): boolean {
  return role === 'owner' || role === 'admin' || role === 'company_admin'
}

export function isOwner(role: OrgRole | string): boolean {
  return role === 'owner'
}
