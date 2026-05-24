const pool = require('../../db');

/**
 * Handle CIS (Construction Industry Scheme) intent - return CIS compliance summaries.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleCIS(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT name, ni_number, utr_number as utr, cis_status FROM team_members WHERE COALESCE(organization_id, company_id) = $1 AND cis_status IS NOT NULL ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No CIS worker records found.',
      data: { count: 0 },
      suggestions: ['Show me team members', 'Show me subcontractors', 'Check compliance']
    };
  }
  const verified  = rows.filter(r => r.cis_status === 'verified');
  const pending   = rows.filter(r => r.cis_status === 'pending' || r.cis_status === 'unverified');

  let reply = `You have **${rows.length} workers/contractors with CIS status** — ${verified.length} verified, ${pending.length} pending/unverified.\n`;
  if (pending.length) {
    reply += `\n⚠️ ${pending.length} awaiting CIS verification:\n`;
    pending.slice(0, 5).forEach(w => {
      reply += `• ${w.name || w.company} (UTR: ${w.utr || 'N/A'}) — Status: ${w.cis_status}\n`;
    });
  } else {
    reply += '\nAll CIS-tracked workers are verified.';
  }

  return {
    reply,
    data: { count: rows.length, verified: verified.length, pending: pending.length, workers: rows },
    suggestions: [
      'Show me unverified workers',
      'Show me team members',
      'Show me subcontractors'
    ]
  };
}

module.exports = {
  handleCIS,
};
