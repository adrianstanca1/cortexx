/**
 * Centralized tenant isolation filter generator.
 *
 * Every route that scopes data by organization/company MUST use this module
 * instead of ad-hoc WHERE clauses. This ensures consistent handling of:
 *   - super_admin (no filter, sees everything)
 *   - company_owner (organization_id IS NULL, uses company_id)
 *   - regular users (filters by organization_id)
 *   - users with neither ID (denied access)
 *
 * Usage:
 *   const { getTenantScope, buildTenantFilter, buildTenantJoin } = require('../middleware/tenantFilter');
 *
 *   // Simple WHERE clause:
 *   const { clause, params } = buildTenantFilter(req, 'WHERE');
 *   // → { clause: ' WHERE COALESCE(organization_id, company_id) = $1', params: [id] }
 *
 *   // AND clause (for adding to existing WHERE):
 *   const { clause, params } = buildTenantFilter(req, 'AND');
 *   // → { clause: ' AND COALESCE(organization_id, company_id) = $1', params: [id] }
 *
 *   // With table alias:
 *   const { clause, params } = buildTenantFilter(req, 'AND', 't');
 *   // → { clause: ' AND COALESCE(t.organization_id, t.company_id) = $1', params: [id] }
 *
 *   // With custom param index (for multi-param queries):
 *   const { clause, params } = buildTenantFilter(req, 'AND', null, 3);
 *   // → { clause: ' AND COALESCE(organization_id, company_id) = $3', params: [id] }
 */

/**
 * Determine the tenant scope for the current user.
 * @param {object} req - Express request with req.user
 * @returns {'all'|'tenant'|'company'|'deny'}
 */
function getTenantScope(req) {
  if (!req.user) return "deny";
  if (req.user.role === "super_admin") return "all";
  if (req.user.organization_id) return "tenant";
  // company_owner (or any user) with null organization_id but valid company_id
  if (req.user.company_id) return "company";
  return "deny";
}

/**
 * Get the effective tenant ID for the current user.
 * @param {object} req - Express request with req.user
 * @returns {string|null} The ID to filter by (null for super_admin/deny)
 */
function getTenantId(req) {
  const scope = getTenantScope(req);
  if (scope === "all" || scope === "deny") return null;
  if (scope === "company") return req.user.company_id;
  return req.user.organization_id;
}

/**
 * Build a tenant filter SQL clause.
 *
 * @param {object} req - Express request with req.user
 * @param {'WHERE'|'AND'} prefix - SQL clause prefix
 * @param {string|null} alias - Optional table alias (e.g. 't', 'p', 'wp')
 * @param {number} paramIndex - 1-based parameter index (default: 1)
 * @returns {{ clause: string, params: any[] }}
 */
function buildTenantFilter(
  req,
  prefix = "WHERE",
  alias = null,
  paramIndex = 1,
) {
  const scope = getTenantScope(req);
  const a = alias ? `${alias}.` : "";
  const p = `$${paramIndex}`;

  if (scope === "all") {
    return { clause: "", params: [] };
  }
  if (scope === "deny") {
    return { clause: ` ${prefix} 1=0`, params: [] };
  }
  if (scope === "company") {
    return {
      clause: ` ${prefix} ${a}company_id = ${p}`,
      params: [req.user.company_id],
    };
  }
  // scope === 'tenant'
  return {
    clause: ` ${prefix} ${a}organization_id = ${p}`,
    params: [req.user.organization_id],
  };
}

/**
 * Build a tenant filter for a JOIN condition (e.g. JOIN projects p ON ... AND tenant).
 *
 * @param {object} req - Express request with req.user
 * @param {string} alias - Table alias for the joined table
 * @param {number} paramIndex - 1-based parameter index
 * @returns {{ clause: string, params: any[] }}
 */
function buildTenantJoin(req, alias, paramIndex) {
  const scope = getTenantScope(req);
  const a = alias ? `${alias}.` : "";
  const p = `$${paramIndex}`;

  if (scope === "all") return { clause: "", params: [] };
  if (scope === "deny") return { clause: " AND 1=0", params: [] };
  if (scope === "company") {
    return {
      clause: ` AND ${a}company_id = ${p}`,
      params: [req.user.company_id],
    };
  }
  return {
    clause: ` AND ${a}organization_id = ${p}`,
    params: [req.user.organization_id],
  };
}

/**
 * Check if the current user is a company_owner.
 * @param {object} req - Express request with req.user
 * @returns {boolean}
 */
function isCompanyOwner(req) {
  return req.user?.role === "company_owner";
}

/**
 * Check if the current user is a super_admin.
 * @param {object} req - Express request with req.user
 * @returns {boolean}
 */
function isSuperAdmin(req) {
  return req.user?.role === "super_admin";
}

module.exports = {
  getTenantScope,
  getTenantId,
  buildTenantFilter,
  buildTenantJoin,
  isCompanyOwner,
  isSuperAdmin,
};
