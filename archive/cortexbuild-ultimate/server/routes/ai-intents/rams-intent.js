const pool = require('../../db');

/**
 * Handle RAMS (Risk Assessment Method Statements) intent - return RAMS summaries.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleRams(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT title, project, type, status, review_date FROM rams WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No RAMS documents found.',
      data: { count: 0 },
      suggestions: ['Show me safety incidents', 'Show me all projects', 'Check compliance']
    };
  }
  const active    = rows.filter(r => r.status === 'active' || r.status === 'approved');
  const draft     = rows.filter(r => r.status === 'draft' || r.status === 'pending');
  const overdue   = rows.filter(r => r.review_date && new Date(r.review_date) < new Date());

  let reply = `You have **${rows.length} RAMS documents** — ${active.length} active, ${draft.length} draft/pending.\n`;
  if (overdue.length) {
    reply += `⚠️ ${overdue.length} documents overdue for review.\n\n`;
    reply += 'Overdue for review:\n';
    overdue.slice(0, 5).forEach(r => {
      reply += `• ${r.title} — ${r.project}, was due ${r.review_date ? new Date(r.review_date).toLocaleDateString('en-GB') : 'N/A'}\n`;
    });
  } else {
    reply += '\nAll RAMS documents are up to date.';
  }

  return {
    reply,
    data: { count: rows.length, active: active.length, draft: draft.length, overdue: overdue.length, rams: rows },
    suggestions: [
      'Show me RAMS due for review',
      'Which projects need RAMS?',
      'Show me safety incidents'
    ]
  };
}

module.exports = {
  handleRams,
};
