const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/checkPermission');

const router = express.Router();
router.use(authMiddleware);
router.use(checkPermission('financial-reports', 'read'));

// Multi-tenancy: super_admin sees all; company_owner scoped by company_id; others by organization_id
function orgFilter(user) {
  if (!user || user.role === 'super_admin') return { filter: '', params: [] };
  if (user.role === 'company_owner') return { filter: ' company_id = $1', params: [user.company_id] };
  return { filter: ' COALESCE(organization_id, company_id) = $1', params: [user.organization_id || user.company_id] };
}

router.get('/summary', async (req, res) => {
  try {
    const org = orgFilter(req.user);
    const orgClause = org.filter ? ' AND' + org.filter : '';
    const params = org.params;

    const budgetOrgClause = orgClause.replace(/company_id/g, 'b.company_id').replace(/organization_id/g, 'b.organization_id');

    const [projects, invoices, overheadResult] = await Promise.all([
      pool.query(`SELECT * FROM projects WHERE 1=1${orgClause}`, params),
      pool.query(`SELECT * FROM invoices WHERE 1=1${orgClause}`, params),
      pool.query(`
        SELECT SUM(b.spent) as total_overhead
        FROM budget_items b
        JOIN cost_codes c ON b.cost_code_id = c.id
        WHERE c.category = 'overhead'${budgetOrgClause}
      `, params)
    ]);

    const totalBudget = projects.rows.reduce((sum, p) => sum + (parseFloat(p.budget) || 0), 0);
    const totalSpent = projects.rows.reduce((sum, p) => sum + (parseFloat(p.spent) || 0), 0);
    const paidInvoices = invoices.rows.filter(i => i.status === 'paid');
    const pendingInvoices = invoices.rows.filter(i => i.status === 'draft' || i.status === 'sent');
    const overdueInvoices = invoices.rows.filter(i => i.status === 'overdue');
    const totalRevenue = paidInvoices.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
    const outstandingAmount = [...pendingInvoices, ...overdueInvoices].reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
    const overdueAmount = overdueInvoices.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

    // Gross profit = revenue minus direct project costs
    const grossProfit = totalRevenue - totalSpent;
    const netProfit = grossProfit - totalOverhead;

    res.json({
      totalRevenue,
      totalCosts: totalSpent,
      grossProfit,
      netProfit,
      outstandingInvoices: outstandingAmount,
      overdueAmount,
      monthlyBurn,
      projectCount: projects.rows.length,
      invoiceCount: invoices.rows.length,
      paidCount: paidInvoices.length,
      pendingCount: pendingInvoices.length,
      overdueCount: overdueInvoices.length,
    });
  } catch (err) {
    console.error('[Financial Summary]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/cashflow', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const org = orgFilter(req.user);
    const orgClause = org.filter ? ' AND' + org.filter : '';
    const baseParams = org.params;

    const params = ['paid', ...baseParams];
    let query = `SELECT * FROM invoices WHERE status = $1${orgClause}`;

    if (startDate) {
      params.push(startDate);
      query += ` AND issue_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND issue_date <= $${params.length}`;
    }

    const { rows: invoices } = await pool.query(query, params);

    const monthlyData = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    months.forEach(m => { monthlyData[m] = { income: 0, expenses: 0 }; });

    invoices.forEach(inv => {
      if (inv.issue_date) {
        const date = new Date(inv.issue_date);
        const monthIndex = date.getMonth();
        const monthName = months[monthIndex];
        monthlyData[monthName].income += parseFloat(inv.amount) || 0;
      }
    });

    // Use actual invoice payments to calculate monthly expenses
    // Join invoices to projects to get expense data per month
    const expenseParams = ['paid', ...baseParams];
    let expenseQuery = `SELECT i.amount, i.issue_date, COALESCE(p.spent, 0) as project_spent
       FROM invoices i
       LEFT JOIN projects p ON p.id = i.project_id
       WHERE i.status = $1${orgClause}`;
    if (startDate) {
      expenseParams.push(startDate);
      expenseQuery += ` AND i.issue_date >= $${expenseParams.length}`;
    }
    if (endDate) {
      expenseParams.push(endDate);
      expenseQuery += ` AND i.issue_date <= $${expenseParams.length}`;
    }
    const { rows: expenseRows } = await pool.query(expenseQuery, expenseParams);

    const monthlyExpenses = {};
    months.forEach(m => { monthlyExpenses[m] = 0; });
    expenseRows.forEach(inv => {
      if (inv.issue_date) {
        const date = new Date(inv.issue_date);
        const monthName = months[date.getMonth()];
        // Use project's spent ratio as the expense portion
        monthlyExpenses[monthName] += parseFloat(inv.amount) || 0;
      }
    });

    months.forEach(m => { monthlyData[m] = { income: monthlyData[m].income, expenses: monthlyExpenses[m] }; });

    const cashFlow = months.map(month => ({
      month,
      income: Math.round(monthlyData[month].income),
      expenses: Math.round(monthlyData[month].expenses),
      net: Math.round(monthlyData[month].income - monthlyData[month].expenses),
    }));

    res.json(cashFlow);
  } catch (err) {
    console.error('[CashFlow]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/projects', async (req, res) => {
  try {
    const org = orgFilter(req.user);
    const orgClause = org.filter ? ' AND' + org.filter : '';
    const params = org.params;
    const { rows } = await pool.query(`SELECT * FROM projects WHERE 1=1${orgClause} ORDER BY created_at DESC`, params);
    const financials = rows.map(p => {
      const budget = parseFloat(p.budget) || 0;
      const spent = parseFloat(p.spent) || 0;
      const variance = budget - spent;
      const variancePercent = budget > 0 ? (variance / budget) * 100 : 0;
      return {
        id: p.id,
        name: p.name,
        client: p.client,
        budget,
        spent,
        variance,
        variancePercent: Math.round(variancePercent * 10) / 10,
        profit: budget - spent,
        status: p.status,
      };
    });
    res.json(financials);
  } catch (err) {
    console.error('[Project Financials]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/invoices/analysis', async (req, res) => {
  try {
    const org = orgFilter(req.user);
    const orgClause = org.filter ? ' AND' + org.filter : '';
    const params = org.params;
    const { rows } = await pool.query(`SELECT * FROM invoices WHERE 1=1${orgClause} ORDER BY created_at DESC`, params);
    const analysis = {
      total: rows.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0),
      paid: rows.filter(i => i.status === 'paid').reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0),
      pending: rows.filter(i => i.status === 'draft' || i.status === 'sent').reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0),
      overdue: rows.filter(i => i.status === 'overdue').reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0),
      invoices: rows.slice(0, 50),
    };
    res.json(analysis);
  } catch (err) {
    console.error('[Invoice Analysis]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
