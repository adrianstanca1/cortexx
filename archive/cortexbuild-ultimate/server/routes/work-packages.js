const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { buildTenantFilter, isSuperAdmin, isCompanyOwner, getTenantId } = require('../middleware/tenantFilter');

const router = express.Router();
router.use(authMiddleware);

// ─── GET /api/work-packages?project_id=xxx ─────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    const { clause: filter, params } = buildTenantFilter(req, 'AND', 'wp');
    const queryParams = [...params];

    let query = `SELECT wp.*, p.name as project_name FROM work_packages wp
                 LEFT JOIN projects p ON wp.project_id = p.id
                 WHERE 1=1${filter}`;

    if (project_id) {
      queryParams.push(project_id);
      query += ` AND wp.project_id = $${queryParams.length}`;
    }

    query += ' ORDER BY wp.created_at DESC';
    const { rows } = await pool.query(query, queryParams);
    res.json({ data: rows });
  } catch (err) {
    console.error('[GET /api/work-packages]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── GET /api/work-packages/:id ────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clause: filter, params } = buildTenantFilter(req, 'AND', 'wp');
    const { rows } = await pool.query(
      `SELECT wp.*, p.name as project_name FROM work_packages wp
       LEFT JOIN projects p ON wp.project_id = p.id
       WHERE wp.id = $${params.length + 1}${filter}`,
      [...params, id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Work package not found' });

    res.json(rows[0]);
  } catch (err) {
    console.error('[GET /api/work-packages/:id]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── POST /api/work-packages ───────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      project_id, name, description, status, priority,
      assigned_to, start_date, end_date, budget, progress
    } = req.body;

    const tenantId = getTenantId(req);

    if (!tenantId && !isSuperAdmin(req)) {
      return res.status(400).json({ message: 'User profile incomplete. Please complete your profile setup.' });
    }

    if (!name) return res.status(400).json({ message: 'Name is required' });

    // Verify project belongs to user's tenant
    if (project_id && !isSuperAdmin(req)) {
      const { clause: projFilter, params: projParams } = buildTenantFilter(req, 'AND');
      const { rows: proj } = await pool.query(
        `SELECT id FROM projects WHERE id = $1${projFilter}`,
        [project_id, ...projParams]
      );
      if (proj.length === 0) {
        return res.status(403).json({ message: 'Project not found or access denied' });
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO work_packages
        (organization_id, company_id, project_id, name, description, status, priority, assigned_to, start_date, end_date, budget, progress)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        req.user.organization_id || null,
        req.user.company_id || null,
        project_id || null,
        name,
        description || '',
        status || 'planned',
        priority || 'medium',
        assigned_to || null,
        start_date || null,
        end_date || null,
        budget || null,
        progress || 0
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /api/work-packages]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── PATCH /api/work-packages/:id ──────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, description, status, priority, assigned_to,
      start_date, end_date, budget, progress
    } = req.body;

    // Build query params: update values first, then id, then tenant filter
    const queryParams = [];
    const updates = [];

    const ALLOWED_FIELDS = ['name', 'description', 'status', 'priority', 'assigned_to', 'start_date', 'end_date', 'budget', 'progress'];
    const fields = {
      name, description, status, priority, assigned_to,
      start_date, end_date, budget, progress
    };

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && ALLOWED_FIELDS.includes(key)) {
        updates.push(`${key} = $${queryParams.length + 1}`);
        queryParams.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    // Add id param after update values
    const idParamIdx = queryParams.length + 1;
    queryParams.push(id);

    // Tenant filter uses param index AFTER id
    const tenantParamIdx = queryParams.length + 1;
    const { clause: wpFilter, params: wpParams } = buildTenantFilter(req, 'AND', 'wp', tenantParamIdx);
    queryParams.push(...wpParams);

    const { rows } = await pool.query(
      `UPDATE work_packages wp SET ${updates.join(', ')}
       WHERE wp.id = $${idParamIdx}${wpFilter}
       RETURNING wp.*`,
      queryParams
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Work package not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[PATCH /api/work-packages/:id]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── DELETE /api/work-packages/:id ─────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clause: wpFilter, params: wpParams } = buildTenantFilter(req, 'AND', 'wp');

    const queryParams = [id, ...wpParams];

    const { rows } = await pool.query(
      `DELETE FROM work_packages wp
       WHERE wp.id = $1${wpFilter}
       RETURNING wp.id`,
      queryParams
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Work package not found' });

    res.json({ message: 'Work package deleted' });
  } catch (err) {
    console.error('[DELETE /api/work-packages/:id]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
