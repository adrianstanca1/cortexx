const pool = require('../../db');

/**
 * Format currency for display.
 */
function fmt(n) {
  if (n == null) return '£0';
  return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Handle subcontractors intent - return subcontractor summaries.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleSubcontractors(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT name, trade, company, email, phone, status, cis_verified FROM subcontractors WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No subcontractors found.',
      data: { count: 0 },
      suggestions: ['Show me team members', 'Show me all projects', 'Check CIS compliance']
    };
  }
  const active    = rows.filter(r => r.status === 'active');
  const cisVer    = rows.filter(r => r.cis_verified === true || r.cis_verified === 'verified');
  const trades    = {};
  rows.forEach(r => { if (r.trade) trades[r.trade] = (trades[r.trade] || 0) + 1; });

  let reply = `You have **${rows.length} subcontractors** — ${active.length} active.\n`;
  reply += `CIS verified: ${cisVer.length}.\n\n`;
  const topTrades = Object.entries(trades).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topTrades.length) {
    reply += 'Trade breakdown:\n';
    topTrades.forEach(([t, n]) => { reply += `• ${t}: ${n}\n`; });
  }

  return {
    reply,
    data: { count: rows.length, active: active.length, cisVerified: cisVer.length, byTrade: trades, subcontractors: rows },
    suggestions: [
      'Which subcontractors are not CIS verified?',
      'Show me subcontractor costs',
      'Show me all projects'
    ]
  };
}

module.exports = {
  handleSubcontractors,
  fmt,
};
