const pool = require('../../db');

/**
 * Handle defects intent - return defect/snag summaries.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleDefects(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT number, project, title, severity, status, trade, date FROM defects WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No defects recorded — excellent quality control!',
      data: { count: 0 },
      suggestions: ['Show me all projects', 'Show safety incidents', 'Show team members']
    };
  }
  const open      = rows.filter(r => r.status === 'open' || r.status === 'pending');
  const closed    = rows.filter(r => r.status === 'closed' || r.status === 'resolved');
  const critical  = rows.filter(r => r.severity === 'critical' || r.severity === 'high');

  let reply = `There are **${rows.length} defects** — ${open.length} open, ${closed.length} resolved, ${critical.length} critical/high severity.\n\n`;
  if (critical.length) {
    reply += 'Critical/High severity defects:\n';
    critical.slice(0, 5).forEach(d => {
      reply += `• ${d.number} — ${d.project}: ${d.title} (${d.status})\n`;
    });
  }
  if (open.length && !critical.length) {
    reply += 'Open defects:\n';
    open.slice(0, 6).forEach(d => {
      reply += `• ${d.number} — ${d.project}: ${d.title} (${d.severity})\n`;
    });
  }

  return {
    reply,
    data: { count: rows.length, open: open.length, closed: closed.length, critical: critical.length, defects: rows },
    suggestions: [
      'Show me open defects by project',
      'Which trades have the most snags?',
      'Generate defects summary report'
    ]
  };
}

module.exports = {
  handleDefects,
};
