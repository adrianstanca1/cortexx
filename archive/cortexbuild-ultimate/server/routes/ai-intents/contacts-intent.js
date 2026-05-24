const pool = require('../../db');

/**
 * Handle contacts intent - return contact summaries.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleContacts(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT name, company, email, phone, role, type FROM contacts WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No contacts found.',
      data: { count: 0 },
      suggestions: ['Show me all projects', 'Show me clients', 'Add a new contact']
    };
  }
  const byType = {};
  rows.forEach(r => { byType[r.type] = (byType[r.type] || 0) + 1; });
  const clients = rows.filter(r => r.type === 'client');
  const suppliers = rows.filter(r => r.type === 'supplier');
  const subcontractors = rows.filter(r => r.type === 'subcontractor');

  let reply = `You have **${rows.length} contacts**.\n\n`;
  reply += 'By type:\n';
  if (clients.length) reply += `• Clients: ${clients.length}\n`;
  if (suppliers.length) reply += `• Suppliers: ${suppliers.length}\n`;
  if (subcontractors.length) reply += `• Subcontractors: ${subcontractors.length}\n`;

  const topCompanies = {};
  rows.forEach(r => { if (r.company) topCompanies[r.company] = (topCompanies[r.company] || 0) + 1; });
  const companies = Object.entries(topCompanies).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (companies.length) {
    reply += '\nTop companies:\n';
    companies.forEach(([c, n]) => { reply += `• ${c}: ${n} contacts\n`; });
  }

  return {
    reply,
    data: { count: rows.length, byType, clients: clients.length, suppliers: suppliers.length, subcontractors: subcontractors.length, contacts: rows },
    suggestions: [
      'Show me client contacts',
      'Show me supplier contacts',
      'Add a new contact'
    ]
  };
}

module.exports = {
  handleContacts,
};
