const pool = require('../../db');

/**
 * Handle team intent - return team member summaries.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleTeam(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT name, role, trade, status, cis_status, hours_this_week FROM team_members WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No team members found.',
      data: { count: 0 },
      suggestions: ['Show me all projects', 'Show invoices', 'Show safety incidents']
    };
  }
  const active    = rows.filter(r => r.status === 'active');
  const cisVer    = rows.filter(r => r.cis_status === 'verified');
  const totalHrs  = rows.reduce((s, r) => s + (parseFloat(r.hours_this_week) || 0), 0);

  let reply = `You have **${rows.length} team members** — ${active.length} active.\n`;
  reply += `CIS verified: ${cisVer.length} | Total hours this week: ${totalHrs.toFixed(0)}.\n\n`;
  const trades = {};
  rows.forEach(r => { if (r.trade) trades[r.trade] = (trades[r.trade] || 0) + 1; });
  const topTrades = Object.entries(trades).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topTrades.length) {
    reply += 'Trades breakdown:\n';
    topTrades.forEach(([t, n]) => { reply += `• ${t}: ${n}\n`; });
  }

  return {
    reply,
    data: { count: rows.length, active: active.length, cisVerified: cisVer.length, totalHoursThisWeek: totalHrs, members: rows },
    suggestions: [
      'Which workers are not CIS verified?',
      'Show me timesheets this week',
      'Show subcontractors'
    ]
  };
}

module.exports = {
  handleTeam,
};
