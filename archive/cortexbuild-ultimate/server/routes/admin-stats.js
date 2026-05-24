const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

const router = express.Router();
router.use(auth);

// GET /api/admin/stats — platform-wide stats (super_admin only)
router.get('/', async (req, res) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const [
      usersRow, totalProjectsRow, activeProjectsRow, companiesRow, apiCallsRow,
      storageRow, activeOrgsRow
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total FROM users'),
      pool.query('SELECT COUNT(*) AS total FROM projects'),
      pool.query("SELECT COUNT(*) AS total FROM projects WHERE status = 'active'"),
      pool.query('SELECT COUNT(*) AS total FROM organizations'),
      pool.query("SELECT COUNT(*) AS total FROM audit_log WHERE created_at >= NOW() - INTERVAL '1 day'"),
      pool.query('SELECT COALESCE(SUM(LENGTH(chunk_text)::bigint), 0) AS used FROM document_embeddings'),
      pool.query("SELECT COUNT(*) AS total FROM organizations WHERE created_at >= NOW() - INTERVAL '30 days'"),
    ]);

    const totalUsers = parseInt(usersRow.rows[0].total, 10);
    const totalProjects = parseInt(totalProjectsRow.rows[0].total, 10);
    const activeProjects = parseInt(activeProjectsRow.rows[0].total, 10);
    const totalCompanies = parseInt(companiesRow.rows[0].total, 10);
    const apiCallsToday = parseInt(apiCallsRow.rows[0].total, 10);
    const storageUsed = parseInt(storageRow.rows[0].used, 10) || 0;
    const newOrgsLast30Days = parseInt(activeOrgsRow.rows[0].total, 10);

    // Estimate uploads dir size
    let uploadsSize = 0;
    try {
      const uploadsDir = path.join(__dirname, '../uploads');
      const files = fs.readdirSync(uploadsDir);
      uploadsSize = files.reduce((acc, f) => {
        try { return acc + fs.statSync(path.join(uploadsDir, f)).size; } catch { return acc; }
      }, 0);
    } catch { /* ok */ }

    const uptimeSeconds = process.uptime();

    res.json({
      totalUsers,
      activeUsers: totalUsers,
      totalCompanies,
      activeCompanies: totalCompanies,
      totalProjects,
      activeProjects,
      newOrgsLast30Days,
      apiCallsToday,
      storageUsed: storageUsed + uploadsSize,
      storageTotal: 10 * 1024 * 1024 * 1024,
      systemHealth: 'healthy',
      uptimeSeconds,
    });
  } catch (err) {
    console.error('[Admin Stats]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/stats/organizations — list orgs (super_admin sees all; company_owner sees their own)
router.get('/organizations', async (req, res) => {
  if (!['super_admin', 'company_owner'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const isSuper = req.user.role === 'super_admin';
    const params = isSuper ? [] : [req.user.company_id];
    const { rows } = await pool.query(`
      SELECT
        o.id, o.name, o.description, o.created_at,
        COUNT(DISTINCT u.id) AS user_count,
        COUNT(DISTINCT p.id) AS project_count
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id
      LEFT JOIN projects p ON p.organization_id = o.id
      ${isSuper ? '' : 'WHERE o.company_id = $1'}
      GROUP BY o.id, o.name, o.description, o.created_at
      ORDER BY o.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) {
    console.error('[Admin Orgs]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/stats/organizations — create an organization (super_admin only)
router.post('/organizations', async (req, res) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const id = require('crypto').randomUUID();
    const { rows } = await pool.query(
      `INSERT INTO organizations (id, name, description) VALUES ($1, $2, $3) RETURNING *`,
      [id, name, description || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[Admin Orgs Create]', err.message);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// PUT /api/admin/stats/organizations/:id — update an organization (super_admin only)
router.put('/organizations/:id', async (req, res) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { name, description } = req.body;
    const { rows } = await pool.query(
      `UPDATE organizations SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 RETURNING *`,
      [name || null, description, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Organization not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[Admin Orgs Update]', err.message);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// DELETE /api/admin/stats/organizations/:id — delete an organization (super_admin only)
router.delete('/organizations/:id', async (req, res) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { rows } = await pool.query(
      `DELETE FROM organizations WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Organization not found' });
    res.json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error('[Admin Orgs Delete]', err.message);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

// GET /api/admin/stats/activity — recent audit log entries (super_admin)
router.get('/activity', async (req, res) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { rows } = await pool.query(`
      SELECT al.*, u.name as user_name, u.email as user_email
      FROM audit_log al
      LEFT JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC
      LIMIT 20
    `);
    res.json(rows);
  } catch (err) {
    console.error('[Admin Activity]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/stats/analytics — time-series data for charts (super_admin)
router.get('/analytics', async (req, res) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { rows: userGrowth } = await pool.query(`
      SELECT
        DATE_TRUNC('month', created_at) AS month,
        COUNT(*) AS new_users
      FROM users
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month ASC
    `);

    const { rows: projectTrend } = await pool.query(`
      SELECT
        DATE_TRUNC('week', created_at) AS week,
        COUNT(*) AS new_projects
      FROM projects
      WHERE created_at >= NOW() - INTERVAL '4 weeks'
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY week ASC
    `);

    const { rows: moduleUsage } = await pool.query(`
      SELECT table_name, COUNT(*) AS operations
      FROM audit_log
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY table_name
      ORDER BY operations DESC
      LIMIT 10
    `);

    res.json({ userGrowth, projectTrend, moduleUsage });
  } catch (err) {
    console.error('[Admin Analytics]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
