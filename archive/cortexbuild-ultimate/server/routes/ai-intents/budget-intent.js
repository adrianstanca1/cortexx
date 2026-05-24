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
 * Handle budget intent - return budget summaries across projects.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleBudget(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT name, client, budget, spent, status FROM projects WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No project budget data found.',
      data: {},
      suggestions: ['Show me all projects', 'Show me invoices', 'Show me tenders']
    };
  }
  const totalBudget = rows.reduce((s, r) => s + (parseFloat(r.budget) || 0), 0);
  const totalSpent  = rows.reduce((s, r) => s + (parseFloat(r.spent)  || 0), 0);
  const remaining   = totalBudget - totalSpent;
  const overBudget  = rows.filter(r => parseFloat(r.spent) > parseFloat(r.budget));

  let reply = `**Budget Overview across ${rows.length} projects:**\n`;
  reply += `• Total budget: ${fmt(totalBudget)}\n`;
  reply += `• Total spent: ${fmt(totalSpent)} (${pct(totalSpent, totalBudget)}%)\n`;
  reply += `• Remaining: ${fmt(remaining)}\n`;
  if (overBudget.length) {
    reply += `\n⚠️ ${overBudget.length} project(s) are over budget:\n`;
    overBudget.forEach(p => {
      reply += `• ${p.name} (${p.client}) — budget ${fmt(p.budget)}, spent ${fmt(p.spent)}, overspend ${fmt(parseFloat(p.spent) - parseFloat(p.budget))}\n`;
    });
  } else {
    reply += '\nAll projects are within budget.';
  }

  return {
    reply,
    data: { totalBudget, totalSpent, remaining, overBudgetCount: overBudget.length, projects: rows },
    suggestions: [
      'Show me overdue invoices',
      'What is our cash position?',
      'Show me all projects'
    ]
  };
}

module.exports = {
  handleBudget,
  fmt,
  pct,
};
