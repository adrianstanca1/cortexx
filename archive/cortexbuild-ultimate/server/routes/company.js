const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { logAudit } = require('./audit-helper');
const {
  safeParse,
  companyUpdateSchema,
  companyCreateUserSchema,
  companyUpdateUserSchema,
} = require('../lib/zod-validation');

const router = express.Router();

/**
 * GET /api/company - Get company settings for current user's company
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
        id, name, registered_address, city, country, postal_code,
        phone, email, website, companies_house_number, vat_number,
        utr_number, hmrc_office, cis_contractor, cis_subcontractor,
        logo_url, insurance_expiry, tax_reference
       FROM companies 
       WHERE id = $1`,
      [req.user.company_id]
    );
    
    if (!rows.length) {
      return res.status(404).json({ message: 'Company not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('[company GET]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * PUT /api/company - Update company settings
 * Only accessible by super_admin, company_owner, or admin
 */
router.put('/', authMiddleware, async (req, res) => {
  if (!['super_admin', 'company_owner', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }

  const validation = safeParse(companyUpdateSchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.error });
  }

  const {
    name, registered_address, city, country, postal_code,
    phone, email, website, companies_house_number, vat_number,
    utr_number, hmrc_office, cis_contractor, cis_subcontractor,
    logo_url, insurance_expiry, tax_reference
  } = validation.data;

  try {
    const { rows } = await pool.query(
      `UPDATE companies SET
        name = COALESCE($1, name),
        registered_address = COALESCE($2, registered_address),
        city = COALESCE($3, city),
        country = COALESCE($4, country),
        postal_code = COALESCE($5, postal_code),
        phone = COALESCE($6, phone),
        email = COALESCE($7, email),
        website = COALESCE($8, website),
        companies_house_number = COALESCE($9, companies_house_number),
        vat_number = COALESCE($10, vat_number),
        utr_number = COALESCE($11, utr_number),
        hmrc_office = COALESCE($12, hmrc_office),
        cis_contractor = COALESCE($13, cis_contractor),
        cis_subcontractor = COALESCE($14, cis_subcontractor),
        logo_url = COALESCE($15, logo_url),
        insurance_expiry = COALESCE($16, insurance_expiry),
        tax_reference = COALESCE($17, tax_reference)
       WHERE id = $18
       RETURNING *`,
      [
        name, registered_address, city, country, postal_code,
        phone, email, website, companies_house_number, vat_number,
        utr_number, hmrc_office, cis_contractor, cis_subcontractor,
        logo_url, insurance_expiry ? new Date(insurance_expiry) : null, tax_reference,
        req.user.company_id
      ]
    );

    logAudit({
      auth: req.user,
      action: 'update',
      entityType: 'companies',
      entityId: req.user.company_id,
      newData: { name, vat_number, companies_house_number }
    });

    res.json(rows[0]);
  } catch (err) {
    console.error('[company PUT]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/company/users - Get all users in current user's company
 * Only accessible by super_admin, company_owner, or admin
 */
router.get('/users', authMiddleware, async (req, res) => {
  if (!['super_admin', 'company_owner', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT 
        u.id, u.email, u.name, u.phone,
        u.role, u.avatar, u.created_at,
        c.name as company_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.company_id = $1
       ORDER BY u.created_at DESC`,
      [req.user.company_id]
    );

    res.json(rows);
  } catch (err) {
    console.error('[company/users GET]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/company/users - Create new user in company
 * Only accessible by super_admin, company_owner, or admin
 */
router.post('/users', authMiddleware, async (req, res) => {
  if (!['super_admin', 'company_owner', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }

  const validation = safeParse(companyCreateUserSchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.error });
  }

  const { email, name, firstName, lastName, role, phone, password } = validation.data;
  const fullName = name || (firstName && lastName ? `${firstName.trim()} ${lastName.trim()}` : null);

  if (!fullName) {
    return res.status(400).json({ message: 'Email and name are required' });
  }

  // SECURITY: Restrict creatable roles based on creator's role to prevent privilege escalation
  const CREATABLE_ROLES = {
    super_admin: [], // Cannot create other super_admins via this endpoint
    company_owner: ['admin', 'project_manager', 'field_worker', 'viewer'],
    admin: ['project_manager', 'field_worker', 'viewer']
  };
  
  const allowedRoles = CREATABLE_ROLES[req.user.role] || ['field_worker', 'viewer'];
  const targetRole = role || 'field_worker';
  
  if (!allowedRoles.includes(targetRole)) {
    return res.status(403).json({ 
      message: `Cannot create user with role '${targetRole}'. Your role allows creating: ${allowedRoles.join(', ')}` 
    });
  }

  try {
    // Check for duplicate email
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    // Hash password or generate random one
    const bcrypt = require('bcrypt');
    const passwordHash = password
      ? await bcrypt.hash(password, 10)
      : await bcrypt.hash(Math.random().toString(36).slice(-8), 10);

    const { rows } = await pool.query(
      `INSERT INTO users (
        email, name, role, phone,
        password_hash, company_id, organization_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, name, role, phone, created_at`,
      [
        email.toLowerCase().trim(),
        fullName,
        targetRole,
        phone || null,
        passwordHash,
        req.user.company_id,
        req.user.organization_id
      ]
    );

    logAudit({
      auth: req.user,
      action: 'create',
      entityType: 'users',
      entityId: rows[0].id,
      newData: { email: rows[0].email, role: rows[0].role }
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Email already in use' });
    }
    console.error('[company/users POST]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * DELETE /api/company/users/:id - Delete user from company
 * Only accessible by super_admin or company_owner
 */
router.delete('/users/:id', authMiddleware, async (req, res) => {
  if (!['super_admin', 'company_owner'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }

  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ message: 'Cannot delete your own account' });
  }

  try {
    // Verify user belongs to same company
    const userCheck = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );

    if (!userCheck.rows.length) {
      return res.status(404).json({ message: 'User not found in your company' });
    }

    const oldData = userCheck.rows[0];

    await pool.query('DELETE FROM users WHERE id = $1 AND company_id = $2', [req.params.id, req.user.company_id]);

    logAudit({
      auth: req.user,
      action: 'delete',
      entityType: 'users',
      entityId: req.params.id,
      oldData
    });

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('[company/users DELETE]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * PUT /api/company/users/:id - Update user role/status
 * Only accessible by super_admin, company_owner, or admin
 */
router.put('/users/:id', authMiddleware, async (req, res) => {
  if (!['super_admin', 'company_owner', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }

  const validation = safeParse(companyUpdateUserSchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.error });
  }

  const { role, phone, is_active } = validation.data;

  // SECURITY: Restrict assignable roles based on updater's role to prevent privilege escalation
  const ASSIGNABLE_ROLES = {
    super_admin: ['super_admin', 'company_owner', 'admin', 'project_manager', 'field_worker', 'viewer'],
    company_owner: ['admin', 'project_manager', 'field_worker', 'viewer'],
    admin: ['project_manager', 'field_worker', 'viewer']
  };

  // Self-escalation guard: users cannot change their own role
  if (req.params.id === req.user.id.toString() && role) {
    return res.status(403).json({ message: 'Cannot change your own role' });
  }

  const allowedRoles = ASSIGNABLE_ROLES[req.user.role] || ['field_worker', 'viewer'];
  if (role && !allowedRoles.includes(role)) {
    return res.status(403).json({
      message: `Cannot assign role "${role}". Your role "${req.user.role}" can only assign: ${allowedRoles.join(', ')}`
    });
  }

  const VALID_ROLES = ['super_admin', 'company_owner', 'admin', 'project_manager', 'field_worker', 'viewer'];
  if (role && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE users SET
        role = COALESCE($1, role),
        phone = COALESCE($2, phone),
        is_active = COALESCE($3, is_active)
       WHERE id = $4 AND company_id = $5
       RETURNING id, email, name, role, phone, is_active`,
      [role || null, phone || null, is_active !== undefined ? is_active : null, req.params.id, req.user.company_id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'User not found in your company' });
    }

    logAudit({
      auth: req.user,
      action: 'update',
      entityType: 'users',
      entityId: req.params.id,
      newData: { role, is_active }
    });

    res.json(rows[0]);
  } catch (err) {
    console.error('[company/users PUT]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
