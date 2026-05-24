const pool = require('../../db');

/**
 * Format currency for display.
 */
function fmt(n) {
  if (n == null) return '£0';
  return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Handle valuations intent - return project valuation summaries.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleValuations(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT project, valuation_number, amount, status, date, certified_amount FROM valuations WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No valuations found.',
      data: { count: 0 },
      suggestions: ['Show me all projects', 'Show me invoices', 'Show me budgets']
    };
  }
  const approved  = rows.filter(r => r.status === 'approved' || r.status === 'certified');
  const pending   = rows.filter(r => r.status === 'pending' || r.status === 'submitted');
  const rejected  = rows.filter(r => r.status === 'rejected');
  const totalAmt  = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const certifiedAmt = approved.reduce((s, r) => s + (parseFloat(r.certified_amount) || r.amount || 0), 0);

  let reply = `You have **${rows.length} valuations** — ${approved.length} approved, ${pending.length} pending, ${rejected.length} rejected.\n`;
  reply += `Total claimed: ${fmt(totalAmt)} | Certified: ${fmt(certifiedAmt)}.\n\n`;
  if (pending.length) {
    reply += 'Pending valuations:\n';
    pending.slice(0, 5).forEach(v => {
      reply += `• Valuation ${v.valuation_number} — ${v.project} ${fmt(v.amount)}, ${v.date ? new Date(v.date).toLocaleDateString('en-GB') : 'N/A'}\n`;
    });
  }

  return {
    reply,
    data: { count: rows.length, approved: approved.length, pending: pending.length, rejected: rejected.length, totalAmt, certifiedAmt, valuations: rows },
    suggestions: [
      'Show me approved valuations',
      'What is our certification rate?',
      'Show me project cash positions'
    ]
  };
}

module.exports = {
  handleValuations,
  fmt,
};
