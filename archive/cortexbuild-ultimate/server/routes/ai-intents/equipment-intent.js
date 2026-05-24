const pool = require('../../db');

/**
 * Handle equipment intent - return equipment/plant summaries.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleEquipment(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT name, type, status, location, project, last_service FROM equipment WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No equipment records found.',
      data: { count: 0 },
      suggestions: ['Show me all projects', 'Show me materials', 'Check site resources']
    };
  }
  const active    = rows.filter(r => r.status === 'active' || r.status === 'in_use');
  const available = rows.filter(r => r.status === 'available');
  const maint     = rows.filter(r => r.status === 'maintenance' || r.status === 'repair');
  const dueService = rows.filter(r => r.last_service && new Date(r.last_service) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));

  let reply = `You have **${rows.length} equipment items** — ${active.length} in use, ${available.length} available, ${maint.length} under maintenance.\n`;
  if (dueService.length) {
    reply += `⚠️ ${dueService.length} items overdue for service.\n\n`;
    reply += 'Equipment needing service:\n';
    dueService.slice(0, 5).forEach(e => {
      reply += `• ${e.name} (${e.type}) — ${e.location || e.project || 'Unknown location'}, last serviced ${e.last_service ? new Date(e.last_service).toLocaleDateString('en-GB') : 'N/A'}\n`;
    });
  } else {
    reply += '\nAll equipment is properly maintained.';
  }

  return {
    reply,
    data: { count: rows.length, active, available: available.length, maintenance: maint.length, overdueService: dueService.length, equipment: rows },
    suggestions: [
      'Show me equipment needing service',
      'What equipment is available?',
      'Show me equipment costs'
    ]
  };
}

module.exports = {
  handleEquipment,
};
