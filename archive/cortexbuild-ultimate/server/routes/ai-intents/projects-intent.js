const pool = require('../../db');

/**
 * Format currency for display.
 */
function fmt(n) {
  if (n == null) return '£0';
  return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Calculate percentage.
 */
function pct(spent, budget) {
  if (!budget || budget == 0) return '0';
  return ((spent / budget) * 100).toFixed(1);
}

/**
 * Handle projects intent - return project summaries scoped to user's organization.
 * @param {object} user - Authenticated user context
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleProjects(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const where = orgId ? `WHERE COALESCE(organization_id, company_id) = $1` : '';
  const params = orgId ? [orgId || companyId] : [];
  const { rows } = await pool.query(
    `SELECT name, client, status, progress, budget, spent, manager, location FROM projects ${where} ORDER BY created_at DESC`,
    params
  );
  if (!rows.length) {
    return {
      reply: 'No projects found in the database.',
      data: { count: 0 },
      suggestions: [
        'Show me overdue invoices',
        'How many team members do we have?',
        'Show me open RFIs'
      ]
    };
  }
  const active     = rows.filter(r => r.status === 'active' || r.status === 'in_progress').length;
  const completed  = rows.filter(r => r.status === 'completed').length;
  const totalBudget = rows.reduce((s, r) => s + (parseFloat(r.budget) || 0), 0);
  const totalSpent  = rows.reduce((s, r) => s + (parseFloat(r.spent)  || 0), 0);

  let reply = `You have **${rows.length} projects** in total — ${active} active, ${completed} completed.\n`;
  reply += `Combined budget: ${fmt(totalBudget)} | Spent so far: ${fmt(totalSpent)} (${pct(totalSpent, totalBudget)}%).\n\n`;
  reply += 'Projects:\n';
  rows.slice(0, 8).forEach(p => {
    reply += `• ${p.name} (${p.client}) — ${p.status}, ${p.progress ?? 0}% complete, budget ${fmt(p.budget)}\n`;
  });
  if (rows.length > 8) reply += `…and ${rows.length - 8} more.\n`;

  return {
    reply,
    data: { count: rows.length, active, completed, totalBudget, totalSpent, projects: rows },
    suggestions: [
      'Show me the budget breakdown across projects',
      'Which projects are over budget?',
      'Show me overdue invoices'
    ]
  };
}

module.exports = {
  handleProjects,
  fmt,
  pct,
};
