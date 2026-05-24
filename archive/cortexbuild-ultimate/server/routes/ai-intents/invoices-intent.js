const pool = require('../../db');

/**
 * Format currency for display.
 */
function fmt(n) {
  if (n == null) return '£0';
  return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Handle invoices intent - return invoice summaries.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleInvoices(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT number, client, project, amount, status, due_date FROM invoices WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No invoices found.',
      data: { count: 0 },
      suggestions: ['Show me all projects', 'What is our current budget?', 'Show me team members']
    };
  }
  const overdue  = rows.filter(r => r.status === 'overdue');
  const paid     = rows.filter(r => r.status === 'paid');
  const pending  = rows.filter(r => r.status === 'draft' || r.status === 'sent');
  const totalAmt  = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const overdueAmt = overdue.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  let reply = `You have **${rows.length} invoices** — ${paid.length} paid, ${pending.length} pending, ${overdue.length} overdue.\n`;
  reply += `Total invoiced: ${fmt(totalAmt)} | Overdue amount: ${fmt(overdueAmt)}.\n\n`;
  if (overdue.length) {
    reply += 'Overdue invoices:\n';
    overdue.slice(0, 5).forEach(i => {
      reply += `• ${i.number} — ${i.client} (${i.project}) ${fmt(i.amount)}, due ${i.due_date ? new Date(i.due_date).toLocaleDateString('en-GB') : 'N/A'}\n`;
    });
  }

  return {
    reply,
    data: { count: rows.length, paid: paid.length, pending: pending.length, overdue: overdue.length, totalAmt, overdueAmt, invoices: rows },
    suggestions: [
      'Show me only overdue invoices',
      'What is the total amount outstanding?',
      'Show me all projects'
    ]
  };
}

/**
 * Handle overdue intent - return only overdue invoices.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleOverdue(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT number, client, project, amount, due_date FROM invoices WHERE status = 'overdue' AND COALESCE(organization_id, company_id) = $1 ORDER BY due_date ASC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'Great news — there are no overdue invoices at the moment.',
      data: { count: 0 },
      suggestions: ['Show all invoices', 'Show me project summaries', 'Check team members']
    };
  }
  const total = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  let reply = `There are **${rows.length} overdue invoices** totalling ${fmt(total)}:\n\n`;
  rows.forEach(i => {
    reply += `• ${i.number} — ${i.client} (${i.project}) ${fmt(i.amount)}, was due ${i.due_date ? new Date(i.due_date).toLocaleDateString('en-GB') : 'N/A'}\n`;
  });
  reply += `\nRecommended action: send payment reminders to all clients with overdue balances.`;

  return {
    reply,
    data: { count: rows.length, total, invoices: rows },
    suggestions: [
      'Show all invoices',
      'Show me project cash positions',
      'How is our overall budget tracking?'
    ]
  };
}

module.exports = {
  handleInvoices,
  handleOverdue,
  fmt,
};
