const pool = require('../../db');

/**
 * Handle RFIs intent - return RFI summaries.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleRfis(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT number, project, subject, priority, status, submitted_date, due_date FROM rfis WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No RFIs found.',
      data: { count: 0 },
      suggestions: ['Show me all projects', 'Show safety incidents', 'Show team members']
    };
  }
  const open      = rows.filter(r => r.status === 'open' || r.status === 'pending');
  const overdue   = rows.filter(r => r.status === 'overdue');
  const high      = rows.filter(r => r.priority === 'high' || r.priority === 'critical');

  let reply = `There are **${rows.length} RFIs** — ${open.length} open, ${overdue.length} overdue, ${high.length} high priority.\n\n`;
  if (high.length) {
    reply += 'High priority RFIs:\n';
    high.slice(0, 5).forEach(r => {
      reply += `• ${r.number} — ${r.project}: ${r.subject} (${r.status})\n`;
    });
  }

  return {
    reply,
    data: { count: rows.length, open: open.length, overdue: overdue.length, highPriority: high.length, rfis: rows },
    suggestions: [
      'Show me all open RFIs',
      'Which projects have the most RFIs?',
      'Show me change orders'
    ]
  };
}

module.exports = {
  handleRfis,
};
