const express = require('express');
const authMiddleware = require('../middleware/auth');
const pool = require('../db');

const router = express.Router();
router.use(authMiddleware);

router.get('/overview', async (req, res) => {
  try {
    const auth = req.user || {};
    const orgId = auth.organization_id;

    let params = [];
    let where = '';
    if (auth.role === 'super_admin') {
      // no filter — global admin
    } else {
      where = 'WHERE COALESCE(organization_id, company_id) = $1';
      params.push(orgId || auth.company_id);
    }

    const [projectsResult, invoicesResult, rfisResult, safetyResult, teamResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) as count FROM projects ${where}`, params),
      pool.query(`SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN status IN ('sent','draft','overdue') THEN amount ELSE 0 END), 0) as outstanding
        FROM invoices ${where}`, params),
      pool.query(`SELECT COUNT(*) as count FROM rfis${where ? ' ' + where + ' AND' : ' WHERE'} status = 'open'`, params),
      pool.query(`SELECT COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END), 0) as closed
        FROM safety_incidents ${where}`, params),
      pool.query(`SELECT COUNT(*) as count FROM team_members ${where}`, params),
    ]);

    const activeProjects = Number(projectsResult.rows[0]?.count ?? 0);
    const invoiceCount = Number(invoicesResult.rows[0]?.total_count ?? 0);
    const totalRevenue = Number(invoicesResult.rows[0]?.total_revenue ?? 0);
    const outstanding = Number(invoicesResult.rows[0]?.outstanding ?? 0);
    const openRfis = Number(rfisResult.rows[0]?.count ?? 0);
    const safetyTotal = Number(safetyResult.rows[0]?.total ?? 0);
    const safetyClosed = Number(safetyResult.rows[0]?.closed ?? 0);
    const hsScore = safetyTotal > 0 ? Math.round((safetyClosed / safetyTotal) * 100) : 100;
    const workforce = Number(teamResult.rows[0]?.count ?? 0);

    res.json({
      kpi: {
        activeProjects,
        invoiceCount,
        totalRevenue,
        outstanding,
        openRfis,
        hsScore,
        workforce,
        safetyIncidents: safetyTotal,
      },
    });
  } catch (err) {
    console.error('dashboard overview error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/revenue', async (req, res) => {
  try {
    const auth = req.user || {};
    const orgId = auth.organization_id;

    let params = [];
    let where = '';
    if (auth.role === 'super_admin') {
      // no filter
    } else if (auth.role === 'company_owner') {
      where = 'WHERE company_id = $1';
      params.push(auth.company_id);
    } else {
      where = 'WHERE COALESCE(organization_id, company_id) = $1';
      params.push(orgId || auth.company_id);
    }

    const result = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', due_date), 'Mon') as month,
        DATE_TRUNC('month', due_date) as sort_key,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as revenue
      FROM invoices
      ${where}
      GROUP BY DATE_TRUNC('month', due_date)
      ORDER BY sort_key
      LIMIT 12
    `, params);

    const revenueData = result.rows.map(r => ({
      month: r.month,
      revenue: Number(r.revenue),
    }));

    res.json(revenueData);
  } catch (err) {
    console.error('dashboard revenue error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/project-status', async (req, res) => {
  try {
    const auth = req.user || {};
    const orgId = auth.organization_id;

    let params = [];
    let where = '';
    if (auth.role === 'super_admin') {
      // no filter
    } else if (auth.role === 'company_owner') {
      where = 'WHERE company_id = $1';
      params.push(auth.company_id);
    } else {
      where = 'WHERE COALESCE(organization_id, company_id) = $1';
      params.push(orgId || auth.company_id);
    }

    const result = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM projects
      ${where}
      GROUP BY status
    `, params);

    const statusMap = {
      ACTIVE:    { name: 'Active',    fill: '#10b981' },
      PLANNING:  { name: 'Planning',  fill: '#3b82f6' },
      ON_HOLD:   { name: 'On Hold',   fill: '#f59e0b' },
      COMPLETED: { name: 'Completed', fill: '#8b5cf6' },
      CANCELLED: { name: 'Cancelled', fill: '#ef4444' },
      ARCHIVED:  { name: 'Archived',  fill: '#64748b' },
    };

    const statuses = result.rows.map(r => ({
      name:  statusMap[r.status.toUpperCase()]?.name  || r.status,
      value: Number(r.count),
      fill:  statusMap[r.status.toUpperCase()]?.fill  || '#64748b',
    }));

    res.json({ statuses });
  } catch (err) {
    console.error('dashboard project-status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/safety-chart', async (req, res) => {
  try {
    const auth = req.user || {};
    const orgId = auth.organization_id;

    // Build org join/filter for multi-tenancy
    let join = '';
    let params = [];
    let where = '';
    if (auth.role === 'super_admin') {
      // no filter
    } else if (auth.role === 'company_owner') {
      join = 'JOIN projects p ON si.project_id = p.id';
      where = 'WHERE p.company_id = $1';
      params.push(auth.company_id);
    } else {
      join = 'JOIN projects p ON si.project_id = p.id';
      where = 'WHERE COALESCE(p.organization_id, p.company_id) = $1';
      params.push(orgId || auth.company_id);
    }

    const result = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', date), 'Mon') as month,
        DATE_TRUNC('month', date) as sort_key,
        COUNT(*) as incidents
      FROM safety_incidents si
      ${join}
      ${where}
      GROUP BY DATE_TRUNC('month', date)
      ORDER BY sort_key
      LIMIT 12
    `, params);

    // Also get total/closed per month for a health score
    const healthResult = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', date), 'Mon') as month,
        DATE_TRUNC('month', date) as sort_key,
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN si.status = 'closed' THEN 1 ELSE 0 END), 0) as closed
      FROM safety_incidents si
      ${join}
      ${where}
      GROUP BY DATE_TRUNC('month', date)
      ORDER BY sort_key
      LIMIT 12
    `, params);

    const healthMap = {};
    for (const r of healthResult.rows) {
      healthMap[r.month] = { total: Number(r.total), closed: Number(r.closed) };
    }

    const data = result.rows.map(r => {
      const h = healthMap[r.month];
      const score = h && h.total > 0 ? Math.round((h.closed / h.total) * 100) : 100;
      return {
        month:     r.month,
        incidents: Number(r.incidents),
        score,
      };
    });

    res.json(data);
  } catch (err) {
    console.error('dashboard safety-chart error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
