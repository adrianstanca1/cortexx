const pool = require('../../db');

/**
 * Format currency for display.
 */
function fmt(n) {
  if (n == null) return '£0';
  return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Handle materials intent - return material order/inventory summaries.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleMaterials(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT name, category, quantity, unit, cost, status, supplier, delivery_date FROM materials WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No materials data found.',
      data: { count: 0 },
      suggestions: ['Show me all projects', 'Show me purchase orders', 'Show me suppliers']
    };
  }
  const delivered = rows.filter(r => r.status === 'delivered');
  const pending   = rows.filter(r => r.status === 'pending' || r.status === 'ordered');
  const overdue   = rows.filter(r => r.status === 'overdue');
  const totalCost = rows.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);

  let reply = `You have **${rows.length} material orders** — ${delivered.length} delivered, ${pending.length} pending, ${overdue.length} overdue.\n`;
  reply += `Total material cost: ${fmt(totalCost)}.\n\n`;
  if (overdue.length) {
    reply += '⚠️ Overdue deliveries:\n';
    overdue.slice(0, 5).forEach(m => {
      reply += `• ${m.name} — ${m.supplier || 'Unknown supplier'} (${m.quantity} ${m.unit}), ${m.delivery_date ? new Date(m.delivery_date).toLocaleDateString('en-GB') : 'N/A'}\n`;
    });
  }

  return {
    reply,
    data: { count: rows.length, delivered: delivered.length, pending: pending.length, overdue: overdue.length, totalCost, materials: rows },
    suggestions: [
      'Show me overdue materials',
      'What materials are pending delivery?',
      'Show me supplier performance'
    ]
  };
}

module.exports = {
  handleMaterials,
  fmt,
};
