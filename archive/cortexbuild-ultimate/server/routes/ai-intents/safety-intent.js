const pool = require('../../db');

/**
 * Handle safety intent - return safety incident summaries.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleSafety(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT type, title, severity, status, project, date FROM safety_incidents WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No safety incidents recorded — great news!',
      data: { count: 0 },
      suggestions: ['Show me all projects', 'Show RFIs', 'Check team members']
    };
  }
  const open     = rows.filter(r => r.status === 'open' || r.status === 'investigating');
  const closed   = rows.filter(r => r.status === 'closed' || r.status === 'resolved');
  const high     = rows.filter(r => r.severity === 'high' || r.severity === 'critical');

  let reply = `There are **${rows.length} safety incidents** on record — ${open.length} open/investigating, ${closed.length} resolved.\n`;
  reply += `High/critical severity: ${high.length}.\n\n`;
  if (open.length) {
    reply += 'Open incidents:\n';
    open.slice(0, 6).forEach(i => {
      reply += `• [${i.severity?.toUpperCase()}] ${i.title} — ${i.project}, ${i.date ? new Date(i.date).toLocaleDateString('en-GB') : 'N/A'}\n`;
    });
  }

  return {
    reply,
    data: { count: rows.length, open: open.length, closed: closed.length, highSeverity: high.length, incidents: rows },
    suggestions: [
      'Show me open safety incidents',
      'Which projects have the most incidents?',
      'Generate a safety summary report'
    ]
  };
}

module.exports = {
  handleSafety,
};
