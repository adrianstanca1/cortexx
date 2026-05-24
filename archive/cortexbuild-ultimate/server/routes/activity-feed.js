const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// Map table names to frontend category names
const TABLE_CATEGORY = {
  projects: 'projects',
  invoices: 'finance',
  cis_returns: 'finance',
  purchase_orders: 'finance',
  valuations: 'finance',
  timesheets: 'finance',
  safety_incidents: 'safety',
  rams: 'safety',
  inspections: 'safety',
  risk_register: 'safety',
  team_members: 'team',
  documents: 'documents',
  rfis: 'documents',
  submittals: 'documents',
  specifications: 'documents',
  drawings: 'documents',
  daily_reports: 'documents',
};

/**
 * GET /api/activity-feed
 * Query params: entity_type (category filter), time_range, limit, offset
 */
router.get('/', async (req, res) => {
  const { entity_type, time_range, limit = '50', offset = '0' } = req.query;
  const orgId = req.user?.organization_id;
  const role = req.user?.role;

  try {
    const whereClauses = [];
    const params = [];
    let paramIndex = 1;

    if (role === 'super_admin') {
      // no tenant filter — sees everything
    } else if (role === 'company_owner') {
      whereClauses.push(`a.company_id = $${paramIndex}`);
      params.push(req.user.company_id);
      paramIndex++;
    } else if (orgId || req.user.company_id) {
      whereClauses.push(`COALESCE(a.organization_id, a.company_id) = $${paramIndex}`);
      params.push(orgId || req.user.company_id);
      paramIndex++;
    }

    if (entity_type && entity_type !== 'all') {
      // Filter by tables that map to the requested category
      const tables = Object.entries(TABLE_CATEGORY)
        .filter(([, cat]) => cat === entity_type)
        .map(([tbl]) => tbl);
      if (tables.length > 0) {
        whereClauses.push(`a.table_name = ANY($${paramIndex}::text[])`);
        params.push(tables);
        paramIndex++;
      }
    }

    if (time_range) {
      const now = new Date();
      switch (time_range) {
        case 'today':
          whereClauses.push(`DATE(a.created_at) = $${paramIndex}`);
          params.push(now.toISOString().split('T')[0]);
          paramIndex++;
          break;
        case 'week': {
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          whereClauses.push(`a.created_at >= $${paramIndex}`);
          params.push(weekAgo.toISOString());
          paramIndex++;
          break;
        }
        case 'month': {
          const monthAgo = new Date(now);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          whereClauses.push(`a.created_at >= $${paramIndex}`);
          params.push(monthAgo.toISOString());
          paramIndex++;
          break;
        }
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT
         a.id::text AS id,
         a.action,
         a.table_name AS entity_type,
         a.record_id AS entity_id,
         COALESCE(
           a.changes->'new'->>'name',
           a.changes->'new'->>'title',
           a.changes->'old'->>'name',
           a.changes->'old'->>'title',
           a.table_name
         ) AS entity_name,
         COALESCE(u.name, 'System') AS user_name,
         COALESCE(u.role, 'system') AS user_role,
         a.action || ' ' || a.table_name AS description,
         a.created_at,
         a.changes AS metadata
       FROM audit_log a
       LEFT JOIN users u ON u.id::text = a.user_id
       ${whereSql}
       ORDER BY a.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit, 10), parseInt(offset, 10)]
    );

    // Attach category to each row
    const enriched = rows.map(r => ({
      ...r,
      module: r.entity_type,
      category: TABLE_CATEGORY[r.entity_type] || 'documents',
    }));

    res.json(enriched);
  } catch (err) {
    console.error('[Activity Feed] Failed to load:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
