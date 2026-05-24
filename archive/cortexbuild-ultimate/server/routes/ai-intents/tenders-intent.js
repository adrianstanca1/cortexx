const pool = require('../../db');

/**
 * Handle tenders intent - return tender summaries.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleTenders(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT title, client, value, status, submission_date, award_date FROM tenders WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No tenders found.',
      data: { count: 0 },
      suggestions: ['Show me all projects', 'Show me RFIs', 'Show me change orders']
    };
  }
  const won       = rows.filter(r => r.status === 'won' || r.status === 'awarded');
  const pending   = rows.filter(r => r.status === 'pending' || r.status === 'submitted');
  const lost      = rows.filter(r => r.status === 'lost' || r.status === 'declined');
  const totalValue = rows.reduce((s, r) => s + (parseFloat(r.value) || 0), 0);
  const wonValue   = won.reduce((s, r) => s + (parseFloat(r.value) || 0), 0);

  let reply = `You have **${rows.length} tenders** — ${pending.length} pending, ${won.length} won, ${lost.length} lost.\n`;
  reply += `Total tender value: £${totalValue.toLocaleString('en-GB')} | Won: £${wonValue.toLocaleString('en-GB')}.\n\n`;
  if (pending.length) {
    reply += 'Pending tenders:\n';
    pending.slice(0, 5).forEach(t => {
      reply += `• ${t.title} — ${t.client} (£${parseFloat(t.value || 0).toLocaleString('en-GB')}), due ${t.submission_date ? new Date(t.submission_date).toLocaleDateString('en-GB') : 'N/A'}\n`;
    });
  }

  return {
    reply,
    data: { count: rows.length, pending: pending.length, won: won.length, lost: lost.length, totalValue, wonValue, tenders: rows },
    suggestions: [
      'Show me won tenders',
      'What is our tender success rate?',
      'Show me all projects'
    ]
  };
}

module.exports = {
  handleTenders,
};
