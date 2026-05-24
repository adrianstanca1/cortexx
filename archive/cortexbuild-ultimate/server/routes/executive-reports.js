const express = require('express');
const authMiddleware = require('../middleware/auth');
const pool = require('../db');
const { checkPermission } = require('../middleware/checkPermission');
const { buildTenantFilter } = require('../middleware/tenantFilter');

const router = express.Router();
router.use(authMiddleware);
router.use(checkPermission('executive-reports', 'read'));

async function buildRagStatusMap(projectIds) {
  if (projectIds.length === 0) return {};
  const { rows } = await pool.query(`
    SELECT project_id,
      SUM(COALESCE(budgeted, 0)) AS total_budgeted,
      SUM(COALESCE(spent, 0)) AS total_spent
    FROM budget_items
    WHERE project_id = ANY($1)
    GROUP BY project_id
  `, [projectIds]);
  const map = {};
  for (const row of rows) {
    const totalBudgeted = Number(row.total_budgeted || 0);
    const totalSpent = Number(row.total_spent || 0);
    const costVariance = totalBudgeted > 0 ? ((totalSpent - totalBudgeted) / totalBudgeted) * 100 : 0;
    let costStatus = 'green';
    if (costVariance > 10) costStatus = 'red';
    else if (costVariance > 0) costStatus = 'amber';
    map[row.project_id] = { programme: 'green', cost: costStatus, quality: 'green', safety: 'green' };
  }
  for (const id of projectIds) {
    if (!map[id]) map[id] = { programme: 'green', cost: 'green', quality: 'green', safety: 'green' };
  }
  return map;
}

/**
 * GET /executive/summary
 * Returns KPIs, active projects, and trends for executive dashboard
 */
router.get('/summary', async (req, res) => {
  try {
    const { clause: invoicesFilter, params: tenantParams } = buildTenantFilter(req, 'AND');
    // projectsFilter uses same $1 param index as invoicesFilter — both reference tenantParams[0]
    const { clause: projectsFilter } = buildTenantFilter(req, 'AND', 'p');
    const pIdx = tenantParams.length + 1;

    const [invoicesResult, projectsCountResult, projectsListResult, teamResult, budgetResult] = await Promise.all([
      pool.query(
        `SELECT
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as portfolio_value,
          COALESCE(SUM(CASE WHEN status = 'paid' AND EXTRACT(YEAR FROM issue_date) = EXTRACT(YEAR FROM CURRENT_DATE) THEN amount ELSE 0 END), 0) as revenue_ytd
        FROM invoices
        WHERE 1=1${invoicesFilter}`,
        tenantParams,
      ),
      pool.query(
        `SELECT COUNT(*) as count FROM projects WHERE status = 'active'${invoicesFilter}`,
        tenantParams,
      ),
      pool.query(
        `SELECT
          p.id,
          p.name,
          p.client,
          p.contract_value as value,
          p.phase,
          p.progress as completion,
          p.manager as pm,
          p.status
        FROM projects p
        WHERE p.status = 'active'${projectsFilter}
        ORDER BY p.created_at DESC
        LIMIT 50`,
        tenantParams,
      ),
      pool.query(
        `SELECT COUNT(*) as count FROM team_members WHERE 1=1${invoicesFilter}`,
        tenantParams,
      ),
      pool.query(
        `SELECT
          COALESCE(SUM(bi.budgeted), 0) as total_budgeted,
          COALESCE(SUM(bi.spent), 0) as total_spent
        FROM budget_items bi
        JOIN projects p ON p.id = bi.project_id
        WHERE p.status = 'active'${projectsFilter}`,
        tenantParams,
      ),
    ]);

    const portfolioValue = Number(invoicesResult.rows[0]?.portfolio_value || 0);
    const revenueYtd = Number(invoicesResult.rows[0]?.revenue_ytd || 0);
    const projectsActive = Number(projectsCountResult.rows[0]?.count || 0);
    const workforce = Number(teamResult.rows[0]?.count || 0);

    // Calculate margin from budget data (profit margin = (budget - spent) / budget)
    const totalBudgeted = Number(budgetResult.rows[0]?.total_budgeted || 0);
    const totalSpent = Number(budgetResult.rows[0]?.total_spent || 0);
    const margin = totalBudgeted > 0
      ? Math.round(((totalBudgeted - totalSpent) / totalBudgeted) * 100)
      : 25;

    const ragMap = await buildRagStatusMap(projectsListResult.rows.map(p => p.id));

    const projects = projectsListResult.rows.map((project) => ({
      id: project.id,
      name: project.name,
      client: project.client,
      value: project.value != null ? Number(project.value) : 0,
      phase: project.phase || 'Pre-Construction',
      completion: project.completion != null ? Number(project.completion) : 0,
      nextMilestone: 'TBC',
      pm: project.pm || 'Unassigned',
      ...(ragMap[project.id] || { programme: 'green', cost: 'green', quality: 'green', safety: 'green' }),
    }));

    res.json({
      kpis: {
        portfolioValue,
        projectsActive,
        revenueYtd,
        margin,
        workforce,
      },
      projects,
    });
  } catch (err) {
    console.error('[Executive Summary]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /executive/trends
 * Returns 6 months of { month, revenue, margin, headcount }
 */
router.get('/trends', async (req, res) => {
  try {
    const { clause: invoicesFilter, params: tenantParams } = buildTenantFilter(req, 'AND');
    // projectsFilter uses same $1 param index as invoicesFilter — both reference tenantParams[0]
    const { clause: projectsFilter } = buildTenantFilter(req, 'AND', 'p');

    const revenueWhere = `status = 'paid' AND issue_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'${invoicesFilter}`;
    const revenueQuery = `
      SELECT 
        DATE_TRUNC('month', issue_date) as month,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as revenue
      FROM invoices
      WHERE ${revenueWhere}
      GROUP BY DATE_TRUNC('month', issue_date)
      ORDER BY DATE_TRUNC('month', issue_date)
    `;

    const headcountQuery = `
      SELECT COUNT(*) as count FROM team_members
      WHERE 1=1${invoicesFilter}
    `;

    const budgetQuery = `
      SELECT
        COALESCE(SUM(bi.budgeted), 0) as total_budgeted,
        COALESCE(SUM(bi.spent), 0) as total_spent
      FROM budget_items bi
      JOIN projects p ON p.id = bi.project_id
      WHERE p.status = 'active'${projectsFilter}
    `;

    const [revenueResult, headcountResult, budgetData] = await Promise.all([
      pool.query(revenueQuery, tenantParams),
      pool.query(headcountQuery, tenantParams),
      pool.query(budgetQuery, tenantParams),
    ]);

    const months = [];
    const now = new Date();
    const currentHeadcount = Number(headcountResult.rows[0]?.count || 0);
    const trendTotalBudgeted = Number(budgetData.rows[0]?.total_budgeted || 0);
    const trendTotalSpent = Number(budgetData.rows[0]?.total_spent || 0);
    const trendMargin = trendTotalBudgeted > 0
      ? Math.round(((trendTotalBudgeted - trendTotalSpent) / trendTotalBudgeted) * 100)
      : 25;

    for (let i = 5; i >= 0; i -= 1) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const revenueRow = revenueResult.rows.find((row) => {
        const rowDate = new Date(row.month);
        return (
          rowDate.getFullYear() === monthStart.getFullYear() &&
          rowDate.getMonth() === monthStart.getMonth()
        );
      });

      months.push({
        month: monthStart.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        revenue: Number(revenueRow?.revenue || 0),
        margin: trendMargin,
        headcount: currentHeadcount,
      });
    }

    res.json(months);
  } catch (err) {
    console.error('[Executive Trends]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
