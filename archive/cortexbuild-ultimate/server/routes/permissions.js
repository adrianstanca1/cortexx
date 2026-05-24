const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

const PERMISSIONS = {
  modules: {
    dashboard: { label: 'Dashboard', defaultRole: 'all' },
    projects: { label: 'Projects', defaultRole: 'all' },
    invoicing: { label: 'Invoicing', defaultRole: 'project_manager' },
    accounting: { label: 'Accounting', defaultRole: 'admin' },
    'financial-reports': { label: 'Financial Reports', defaultRole: 'admin' },
    procurement: { label: 'Procurement', defaultRole: 'project_manager' },
    safety: { label: 'Safety', defaultRole: 'all' },
    teams: { label: 'Teams', defaultRole: 'project_manager' },
    tenders: { label: 'Tenders', defaultRole: 'admin' },
    crm: { label: 'CRM', defaultRole: 'project_manager' },
    documents: { label: 'Documents', defaultRole: 'all' },
    timesheets: { label: 'Timesheets', defaultRole: 'field_worker' },
    plant: { label: 'Plant & Equipment', defaultRole: 'project_manager' },
    subcontractors: { label: 'Subcontractors', defaultRole: 'project_manager' },
    'ai-assistant': { label: 'AI Assistant', defaultRole: 'all' },
    rfis: { label: 'RFIs', defaultRole: 'project_manager' },
    'change-orders': { label: 'Change Orders', defaultRole: 'project_manager' },
    inspections: { label: 'Inspections', defaultRole: 'project_manager' },
    meetings: { label: 'Meetings', defaultRole: 'all' },
    materials: { label: 'Materials', defaultRole: 'project_manager' },
    'daily-reports': { label: 'Daily Reports', defaultRole: 'field_worker' },
    calendar: { label: 'Calendar', defaultRole: 'all' },
    'audit-log': { label: 'Audit Log', defaultRole: 'admin' },
    settings: { label: 'Settings', defaultRole: 'admin' },
  },
  actions: {
    create: { label: 'Create', description: 'Create new records' },
    read: { label: 'Read', description: 'View records' },
    update: { label: 'Update', description: 'Modify records' },
    delete: { label: 'Delete', description: 'Remove records' },
    export: { label: 'Export', description: 'Export data' },
    approve: { label: 'Approve', description: 'Approve/reject items' },
    manage_users: { label: 'Manage Users', description: 'Add/remove users' },
    manage_roles: { label: 'Manage Roles', description: 'Edit role permissions' },
    view_financials: { label: 'View Financials', description: 'See financial data' },
    send_invoices: { label: 'Send Invoices', description: 'Email invoices to clients' },
  },
};

const DEFAULT_ROLES = {
  super_admin: {
    name: 'Super Admin',
    description: 'Full system access',
    permissions: { '*': ['*'] },
    isSystem: true,
  },
  company_owner: {
    name: 'Company Owner',
    description: 'Full access to company data',
    permissions: { '*': ['create', 'read', 'update', 'delete', 'export', 'approve', 'view_financials', 'send_invoices'] },
    isSystem: true,
  },
  admin: {
    name: 'Admin',
    description: 'Administrative access',
    permissions: {
      '*': ['create', 'read', 'update', 'export', 'approve', 'view_financials'],
      'audit-log': ['read'],
      settings: ['read', 'update'],
    },
    isSystem: true,
  },
  project_manager: {
    name: 'Project Manager',
    description: 'Manage projects and team',
    permissions: {
      projects: ['create', 'read', 'update'],
      invoicing: ['read'],
      safety: ['create', 'read', 'update'],
      teams: ['read'],
      documents: ['create', 'read', 'update'],
      rfis: ['create', 'read', 'update'],
      'change-orders': ['create', 'read', 'update'],
      inspections: ['read', 'update'],
      meetings: ['create', 'read', 'update'],
    },
    isSystem: true,
  },
  field_worker: {
    name: 'Field Worker',
    description: 'On-site operations',
    permissions: {
      dashboard: ['read'],
      projects: ['read'],
      safety: ['create', 'read', 'update'],
      timesheets: ['create', 'read', 'update'],
      'daily-reports': ['create', 'read', 'update'],
      documents: ['read'],
    },
    isSystem: true,
  },
  client: {
    name: 'Client',
    description: 'View project progress',
    permissions: {
      dashboard: ['read'],
      projects: ['read'],
      documents: ['read'],
    },
    isSystem: true,
  },
};

router.get('/permissions', (req, res) => {
  res.json(PERMISSIONS);
});

router.get('/roles', async (req, res) => {
  try {
    const orgId = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const { rows: customRoles } = await pool.query(
      'SELECT * FROM custom_roles WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC',
      [orgId || companyId]
    );
    const roles = [
      ...Object.entries(DEFAULT_ROLES).map(([key, val]) => ({
        id: key,
        ...val,
        isCustom: false,
      })),
      ...customRoles.map(r => ({
        id: `custom_${r.id}`,
        name: r.name,
        description: r.description,
        permissions: r.permissions,
        isCustom: true,
        isSystem: false,
      })),
    ];
    res.json(roles);
  } catch (err) {
    console.error('[Get Roles]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/roles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (DEFAULT_ROLES[id]) {
      return res.json({ id, ...DEFAULT_ROLES[id], isCustom: false });
    }
    const customId = id.replace('custom_', '');
    const orgId = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const { rows } = await pool.query(
      'SELECT * FROM custom_roles WHERE id = $1 AND COALESCE(organization_id, company_id) = $2',
      [customId, orgId || companyId]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Role not found' });
    res.json({
      id: `custom_${rows[0].id}`,
      name: rows[0].name,
      description: rows[0].description,
      permissions: rows[0].permissions,
      isCustom: true,
    });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/roles', async (req, res) => {
  if (!['super_admin', 'company_owner', 'admin'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Insufficient permissions to create custom roles' });
  }
  try {
    const { name, description, permissions } = req.body;
    if (!name || !permissions) {
      return res.status(400).json({ message: 'name and permissions are required' });
    }
    const createdBy = req.user?.id || 'unknown';
    const orgId = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const { rows } = await pool.query(
      `INSERT INTO custom_roles (name, description, permissions, created_by, organization_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description || '', JSON.stringify(permissions), createdBy, orgId || null, companyId || null]
    );
    res.status(201).json({
      id: `custom_${rows[0].id}`,
      name: rows[0].name,
      description: rows[0].description,
      permissions: rows[0].permissions,
      isCustom: true,
    });
  } catch (err) {
    console.error('[Create Role]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/roles/:id', async (req, res) => {
  if (!['super_admin', 'company_owner', 'admin'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Insufficient permissions to modify custom roles' });
  }
  try {
    const { id } = req.params;
    if (!id.startsWith('custom_')) {
      return res.status(400).json({ message: 'Cannot modify system roles' });
    }
    const customId = id.replace('custom_', '');
    const { name, description, permissions } = req.body;
    const orgId = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const { rows } = await pool.query(
      `UPDATE custom_roles
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           permissions = COALESCE($3, permissions),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND COALESCE(organization_id, company_id) = $5 RETURNING *`,
      [name, description, permissions ? JSON.stringify(permissions) : null, customId, orgId || companyId]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Role not found' });
    res.json({
      id: `custom_${rows[0].id}`,
      name: rows[0].name,
      description: rows[0].description,
      permissions: rows[0].permissions,
    });
  } catch (err) {
    console.error('[Update Role]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/roles/:id', async (req, res) => {
  if (!['super_admin', 'company_owner', 'admin'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Insufficient permissions to delete custom roles' });
  }
  try {
    const { id } = req.params;
    if (!id.startsWith('custom_')) {
      return res.status(400).json({ message: 'Cannot delete system roles' });
    }
    const customId = id.replace('custom_', '');
    const orgId = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const { rowCount } = await pool.query(
      'DELETE FROM custom_roles WHERE id = $1 AND COALESCE(organization_id, company_id) = $2',
      [customId, orgId || companyId]
    );
    if (!rowCount) return res.status(404).json({ message: 'Role not found' });
    res.json({ message: 'Role deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/users/:userId/permissions', async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.id;

    const { rows: requestingUserRows } = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [requestingUserId]
    );
    const requestingRole = requestingUserRows[0]?.role;
    const isAdmin = requestingRole && (DEFAULT_ROLES[requestingRole]?.permissions?.['*']?.includes('manage_users') || requestingRole === 'super_admin' || requestingRole === 'admin');
    const isSelf = requestingUserId === userId;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ message: 'Not authorized to view this user\'s permissions' });
    }

    const { rows: userRows } = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );
    if (!userRows[0]) return res.status(404).json({ message: 'User not found' });

    const roleId = userRows[0].role;
    const role = DEFAULT_ROLES[roleId] || null;
    if (!role) {
      const { rows: customRows } = await pool.query(
        'SELECT permissions FROM custom_roles WHERE id = $1',
        [roleId.replace('custom_', '')]
      );
      if (!customRows[0]) return res.status(404).json({ message: 'Role not found' });
      return res.json(customRows[0].permissions);
    }
    res.json(role.permissions);
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/check', async (req, res) => {
  try {
    const { module, action, userId } = req.body;

    // Users can only check their own permissions, unless they're admin+
    if (userId && userId !== req.user.id) {
      const allowedRoles = ['super_admin', 'company_owner', 'admin'];
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Insufficient permissions to check other users\' permissions' });
      }
    }

    const targetUserId = userId || req.user.id;
    const { rows: userRows } = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [targetUserId]
    );
    if (!userRows[0]) return res.json({ allowed: false });

    const roleId = userRows[0].role;
    const role = DEFAULT_ROLES[roleId];
    if (!role) return res.json({ allowed: false });

    const perms = role.permissions;
    if (perms['*']?.includes('*') || perms['*']?.includes(action)) return res.json({ allowed: true });
    if (perms[module]?.includes(action)) return res.json({ allowed: true });
    if (perms[module]?.includes('*')) return res.json({ allowed: true });

    res.json({ allowed: false });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
