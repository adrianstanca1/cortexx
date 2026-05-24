const pool = require('../../db');

/**
 * Format currency for display.
 */
function fmt(n) {
  if (n == null) return '£0';
  return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Handle purchase orders intent - return PO summaries.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handlePurchaseOrders(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT number, supplier, project, amount, status, delivery_date FROM purchase_orders WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No purchase orders found.',
      data: { count: 0 },
      suggestions: ['Show me materials', 'Show me suppliers', 'Check project costs']
    };
  }
  const delivered = rows.filter(r => r.status === 'delivered' || r.status === 'completed');
  const pending   = rows.filter(r => r.status === 'pending' || r.status === 'ordered');
  const overdue   = rows.filter(r => r.status === 'overdue');
  const totalAmt  = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  let reply = `You have **${rows.length} purchase orders** — ${delivered.length} delivered, ${pending.length} pending, ${overdue.length} overdue.\n`;
  reply += `Total PO value: ${fmt(totalAmt)}.\n\n`;
  if (overdue.length) {
    reply += '⚠️ Overdue purchase orders:\n';
    overdue.slice(0, 5).forEach(po => {
      reply += `• ${po.number} — ${po.supplier} (${po.project}) ${fmt(po.amount)}, due ${po.delivery_date ? new Date(po.delivery_date).toLocaleDateString('en-GB') : 'N/A'}\n`;
    });
  }

  return {
    reply,
    data: { count: rows.length, delivered: delivered.length, pending: pending.length, overdue: overdue.length, totalAmt, purchaseOrders: rows },
    suggestions: [
      'Show me overdue purchase orders',
      'What is our spend by supplier?',
      'Show me materials'
    ]
  };
}

module.exports = {
  handlePurchaseOrders,
  fmt,
};
