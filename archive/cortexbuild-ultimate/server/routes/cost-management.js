const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/checkPermission');
const { logAudit } = require('./audit-helper');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Helper: parse a numeric field, returning null for missing/empty values
// and rejecting NaN. Used for optional financial fields.
function safeFloat(val, fallback = null) {
  if (val === undefined || val === null || val === '') return fallback;
  const n = parseFloat(val);
  return Number.isNaN(n) ? fallback : n;
}

// Helper: parse a required numeric field, returning 0 for missing/empty values
// and rejecting NaN. Used for required financial fields.
function safeFloatZero(val) {
  return safeFloat(val, 0);
}

/**
 * GET /api/cost-management/budget - Get budget items for company/projects
 */
router.get('/budget', checkPermission('cost-management', 'read'), async (req, res) => {
  try {
    const { projectId } = req.query;

    let query = `
      SELECT
        b.id, b.name, b.description, b.budgeted, b.spent, b.committed,
        b.remaining, b.variance, b.variance_percent, b.status,
        b.start_date, b.end_date, b.created_at,
        c.code as cost_code, c.name as cost_code_name, c.category,
        p.name as project_name,
        u.name as created_by_name
      FROM budget_items b
      LEFT JOIN cost_codes c ON b.cost_code_id = c.id
      LEFT JOIN projects p ON b.project_id = p.id
      LEFT JOIN users u ON b.created_by = u.id
      WHERE COALESCE(b.organization_id, b.company_id) = $1
    `;

    const params = [req.user.company_id];

    if (projectId) {
      query += ' AND b.project_id = $2';
      params.push(projectId);
    }

    query += ' ORDER BY c.code, b.name';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[cost-management/budget GET]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/cost-management/budget - Create budget item
 */
router.post('/budget', checkPermission('cost-management', 'create'), async (req, res) => {
  const {
    projectId, costCodeId, name, description,
    budgeted, spent, committed, status, startDate, endDate
  } = req.body;

  if (!name || budgeted === undefined || budgeted === null) {
    return res.status(400).json({ message: 'Name and budgeted amount are required' });
  }

  const budgetedVal = safeFloatZero(budgeted);
  const spentVal = safeFloatZero(spent);
  const committedVal = safeFloatZero(committed);

  // Reject negative financial amounts
  if (budgetedVal < 0 || spentVal < 0 || committedVal < 0) {
    return res.status(400).json({ message: 'Financial amounts cannot be negative' });
  }

  // Verify project ownership if projectId provided (IDOR protection)
  if (projectId) {
    const { rows: projectRows } = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND COALESCE(organization_id, company_id) = $2',
      [projectId, req.user.company_id]
    );
    if (!projectRows.length) {
      return res.status(403).json({ message: 'Project not found or access denied' });
    }
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO budget_items (
        organization_id, company_id, project_id, cost_code_id,
        name, description, budgeted, spent, committed,
        status, start_date, end_date, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        req.user.organization_id,
        req.user.company_id,
        projectId || null,
        costCodeId || null,
        name,
        description || null,
        budgetedVal,
        spentVal,
        committedVal,
        status || 'on-track',
        startDate || null,
        endDate || null,
        req.user.id
      ]
    );

    logAudit({
      auth: req.user,
      action: 'create',
      entityType: 'budget_items',
      entityId: rows[0].id,
      newData: { name, budgeted: budgetedVal, status }
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[cost-management/budget POST]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * PUT /api/cost-management/budget/:id - Update budget item
 */
router.put('/budget/:id', checkPermission('cost-management', 'update'), async (req, res) => {
  const {
    name, description, budgeted, spent, committed,
    status, startDate, endDate
  } = req.body;

  // Validate financial amounts if provided
  if (budgeted !== undefined && budgeted !== null && Number.isNaN(parseFloat(budgeted))) {
    return res.status(400).json({ message: 'Invalid budgeted amount' });
  }
  if (spent !== undefined && spent !== null && Number.isNaN(parseFloat(spent))) {
    return res.status(400).json({ message: 'Invalid spent amount' });
  }
  if (committed !== undefined && committed !== null && Number.isNaN(parseFloat(committed))) {
    return res.status(400).json({ message: 'Invalid committed amount' });
  }

  // Reject negative financial amounts
  if ((budgeted !== undefined && budgeted !== null && parseFloat(budgeted) < 0) ||
      (spent !== undefined && spent !== null && parseFloat(spent) < 0) ||
      (committed !== undefined && committed !== null && parseFloat(committed) < 0)) {
    return res.status(400).json({ message: 'Financial amounts cannot be negative' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE budget_items SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        budgeted = COALESCE($3, budgeted),
        spent = COALESCE($4, spent),
        committed = COALESCE($5, committed),
        status = COALESCE($6, status),
        start_date = COALESCE($7, start_date),
        end_date = COALESCE($8, end_date),
        updated_at = NOW()
       WHERE id = $9 AND COALESCE(organization_id, company_id) = $10
       RETURNING *`,
      [
        name, description,
        budgeted != null ? parseFloat(budgeted) : null,
        spent != null ? parseFloat(spent) : null,
        committed != null ? parseFloat(committed) : null,
        status,
        startDate, endDate,
        req.params.id,
        req.user.company_id
      ]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Budget item not found' });
    }

    logAudit({
      auth: req.user,
      action: 'update',
      entityType: 'budget_items',
      entityId: req.params.id,
      newData: { budgeted, spent, status }
    });

    res.json(rows[0]);
  } catch (err) {
    console.error('[cost-management/budget PUT]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * DELETE /api/cost-management/budget/:id - Delete budget item
 */
router.delete('/budget/:id', checkPermission('cost-management', 'delete'), async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM budget_items WHERE id = $1 AND COALESCE(organization_id, company_id) = $2',
      [req.params.id, req.user.company_id]
    );

    if (!rowCount) {
      return res.status(404).json({ message: 'Budget item not found' });
    }

    logAudit({
      auth: req.user,
      action: 'delete',
      entityType: 'budget_items',
      entityId: req.params.id
    });

    res.json({ message: 'Budget item deleted' });
  } catch (err) {
    console.error('[cost-management/budget DELETE]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/cost-management/forecast - Get cost forecasts
 */
router.get('/forecast', checkPermission('cost-management', 'read'), async (req, res) => {
  try {
    const { projectId } = req.query;

    let query = `
      SELECT
        f.*, p.name as project_name
      FROM cost_forecasts f
      LEFT JOIN projects p ON f.project_id = p.id
      WHERE COALESCE(f.organization_id, f.company_id) = $1
    `;

    const params = [req.user.company_id];

    if (projectId) {
      query += ' AND f.project_id = $2';
      params.push(projectId);
    }

    query += ' ORDER BY f.period_start';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[cost-management/forecast GET]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/cost-management/forecast - Create/update forecast
 */
router.post('/forecast', checkPermission('cost-management', 'create'), async (req, res) => {
  const { projectId, periodStart, periodEnd, projectedCost, actualCost, notes } = req.body;

  if (!projectId || !periodStart || !periodEnd || projectedCost === undefined || projectedCost === null) {
    return res.status(400).json({ message: 'Project, period, and projected cost are required' });
  }

  const projectedCostVal = safeFloatZero(projectedCost);
  const actualCostVal = safeFloat(actualCost);

  // Reject negative financial amounts
  if (projectedCostVal < 0 || (actualCostVal !== null && actualCostVal < 0)) {
    return res.status(400).json({ message: 'Financial amounts cannot be negative' });
  }

  // Verify project ownership (IDOR protection)
  const { rows: projectRows } = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND COALESCE(organization_id, company_id) = $2',
    [projectId, req.user.company_id]
  );
  if (!projectRows.length) {
    return res.status(403).json({ message: 'Project not found or access denied' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO cost_forecasts (
        organization_id, company_id, project_id,
        period_start, period_end, projected_cost, actual_cost, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (project_id, period_start, period_end)
       DO UPDATE SET
        projected_cost = EXCLUDED.projected_cost,
        actual_cost = COALESCE(EXCLUDED.actual_cost, cost_forecasts.actual_cost),
        notes = COALESCE(EXCLUDED.notes, cost_forecasts.notes)
       RETURNING *`,
      [
        req.user.organization_id,
        req.user.company_id,
        projectId,
        periodStart,
        periodEnd,
        projectedCostVal,
        actualCostVal,
        notes || null
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[cost-management/forecast POST]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/cost-management/summary - Get cost summary dashboard
 */
router.get('/summary', checkPermission('cost-management', 'read'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
        COUNT(*) as total_items,
        SUM(budgeted) as total_budgeted,
        SUM(spent) as total_spent,
        SUM(committed) as total_committed,
        SUM(remaining) as total_remaining,
        SUM(variance) as total_variance,
        AVG(variance_percent) as avg_variance_percent,
        COUNT(CASE WHEN status = 'on-track' THEN 1 END) as on_track_count,
        COUNT(CASE WHEN status = 'at-risk' THEN 1 END) as at_risk_count,
        COUNT(CASE WHEN status = 'over-budget' THEN 1 END) as over_budget_count
       FROM budget_items
       WHERE COALESCE(organization_id, company_id) = $1`,
      [req.user.company_id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('[cost-management/summary GET]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/cost-management/codes - Get cost codes
 */
router.get('/codes', checkPermission('cost-management', 'read'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
        c.*, p.name as parent_name,
        (SELECT COUNT(*) FROM budget_items WHERE cost_code_id = c.id) as items_count
       FROM cost_codes c
       LEFT JOIN cost_codes p ON c.parent_id = p.id
       WHERE COALESCE(c.organization_id, c.company_id) = $1 AND c.is_active = true
       ORDER BY c.code`,
      [req.user.company_id]
    );

    res.json(rows);
  } catch (err) {
    console.error('[cost-management/codes GET]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/cost-management/codes - Create cost code
 */
router.post('/codes', checkPermission('cost-management', 'create'), async (req, res) => {
  const { code, name, description, parentId, category } = req.body;

  if (!code || !name) {
    return res.status(400).json({ message: 'Code and name are required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO cost_codes (
        organization_id, company_id, code, name, description,
        parent_id, category
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (company_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        description = COALESCE(EXCLUDED.description, cost_codes.description),
        updated_at = NOW()
       RETURNING *`,
      [
        req.user.organization_id,
        req.user.company_id,
        code,
        name,
        description || null,
        parentId || null,
        category || null
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[cost-management/codes POST]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;