const pool = require('../../db');

/**
 * Handle risk register intent - return risk summaries.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleRisk(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT title, project, category, likelihood, impact, status, owner FROM risk_register WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No risks registered — remember to maintain your risk register!',
      data: { count: 0 },
      suggestions: ['Show me all projects', 'Show me safety incidents', 'Create a risk entry']
    };
  }
  const open      = rows.filter(r => r.status === 'open' || r.status === 'active');
  const closed    = rows.filter(r => r.status === 'closed' || r.status === 'mitigated');
  const highRisk  = rows.filter(r =>
    (r.likelihood >= 4 && r.impact >= 4) ||
    r.likelihood === 'high' || r.likelihood === 'critical' ||
    r.impact === 'high' || r.impact === 'critical'
  );

  let reply = `You have **${rows.length} risks** — ${open.length} open, ${closed.length} closed/mitigated, ${highRisk.length} high/critical.\n\n`;
  if (highRisk.length) {
    reply += 'High/Critical risks:\n';
    highRisk.slice(0, 5).forEach(r => {
      reply += `• ${r.title} — ${r.project} (L: ${r.likelihood}, I: ${r.impact}), Owner: ${r.owner || 'Unassigned'}\n`;
    });
  }

  return {
    reply,
    data: { count: rows.length, open: open.length, closed: closed.length, highRisk: highRisk.length, risks: rows },
    suggestions: [
      'Show me all open risks',
      'Which projects have the most risks?',
      'Show me risk mitigation actions'
    ]
  };
}

module.exports = {
  handleRisk,
};
