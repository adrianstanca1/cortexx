const pool = require('../../db');

/**
 * Format currency for display.
 */
function fmt(n) {
  if (n == null) return '£0';
  return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Handle change orders intent - return variation/CO summaries.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleChangeOrders(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT number, project, title, value, status, date FROM change_orders WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No change orders found.',
      data: { count: 0 },
      suggestions: ['Show me all projects', 'Show me valuations', 'Check project budgets']
    };
  }
  const approved  = rows.filter(r => r.status === 'approved' || r.status === 'signed');
  const pending   = rows.filter(r => r.status === 'pending' || r.status === 'submitted');
  const rejected  = rows.filter(r => r.status === 'rejected');
  const totalValue = rows.reduce((s, r) => s + (parseFloat(r.value) || 0), 0);
  const approvedValue = approved.reduce((s, r) => s + (parseFloat(r.value) || 0), 0);

  let reply = `You have **${rows.length} change orders** — ${approved.length} approved, ${pending.length} pending, ${rejected.length} rejected.\n`;
  reply += `Total CO value: ${fmt(totalValue)} | Approved: ${fmt(approvedValue)}.\n\n`;
  if (pending.length) {
    reply += 'Pending change orders:\n';
    pending.slice(0, 5).forEach(co => {
      reply += `• ${co.number} — ${co.project}: ${co.title} (${fmt(co.value)})\n`;
    });
  }

  return {
    reply,
    data: { count: rows.length, approved: approved.length, pending: pending.length, rejected: rejected.length, totalValue, approvedValue, changeOrders: rows },
    suggestions: [
      'Show me approved change orders',
      'What is the total variation value?',
      'Show me project budgets'
    ]
  };
}

module.exports = {
  handleChangeOrders,
  fmt,
};
