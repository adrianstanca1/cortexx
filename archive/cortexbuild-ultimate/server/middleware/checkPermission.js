/**
 * Permission check middleware
 * Verifies user has required action permission for a module
 */
const ROLES = {
  super_admin: { '*': ['*'] },
  company_owner: { '*': ['*'] },
  admin: {
    '*': ['create', 'read', 'update', 'export', 'approve', 'view_financials'],
    'financial-reports': ['read', 'export'],
    'cost-management': ['read', 'update'],
    'audit-log': ['read'],
    settings: ['read', 'update'],
    integrations: ['create', 'read', 'update', 'delete'],
  },
  project_manager: {
    projects: ['create', 'read', 'update'],
    invoicing: ['read'],
    'cost-management': ['create', 'read', 'update'],
    safety: ['create', 'read', 'update'],
    teams: ['read'],
    documents: ['create', 'read', 'update'],
    rfis: ['create', 'read', 'update'],
    'change-orders': ['create', 'read', 'update'],
    inspections: ['read', 'update'],
    meetings: ['create', 'read', 'update'],
  },
  field_worker: {
    dashboard: ['read'],
    projects: ['read'],
    safety: ['create', 'read', 'update'],
    timesheets: ['create', 'read', 'update'],
    'daily-reports': ['create', 'read', 'update'],
    documents: ['read'],
  },
  client: {
    dashboard: ['read'],
    projects: ['read'],
    documents: ['read'],
  },
};

function checkPermission(module, action) {
  return function checkPermissionMiddleware(req, res, next) {
    const userRole = req.user?.role || 'client';
    const rolePerms = ROLES[userRole];

    if (!rolePerms) {
      return res.status(403).json({ message: 'Unknown user role' });
    }

    // Check wildcard permission
    if (rolePerms['*']?.includes('*')) {
      return next();
    }

    // Check module-specific action
    if (rolePerms[module]?.includes(action)) {
      return next();
    }

    // Check wildcard action on module
    if (rolePerms[module]?.includes('*')) {
      return next();
    }

    // Check if role has wildcard action on all modules
    if (rolePerms['*']?.includes(action)) {
      return next();
    }

    return res.status(403).json({
      message: `Insufficient permissions to ${action} ${module}`,
    });
  };
}

module.exports = { checkPermission, ROLES };
