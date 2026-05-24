const pool = require('../../db');

/**
 * Format hours for display.
 */
function fmtHrs(n) {
  if (n == null) return '0';
  return Number(n).toFixed(1);
}

/**
 * Handle timesheets intent - return timesheet summaries.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleTimesheets(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT member_name, project, hours, date, status, overtime_hours FROM timesheets WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No timesheets found.',
      data: { count: 0 },
      suggestions: ['Show me team members', 'Show me all projects', 'Show me labour costs']
    };
  }
  const approved  = rows.filter(r => r.status === 'approved');
  const pending   = rows.filter(r => r.status === 'pending' || r.status === 'submitted');
  const rejected  = rows.filter(r => r.status === 'rejected');
  const totalHrs  = rows.reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
  const otHrs     = rows.reduce((s, r) => s + (parseFloat(r.overtime_hours) || 0), 0);

  let reply = `You have **${rows.length} timesheets** — ${approved.length} approved, ${pending.length} pending, ${rejected.length} rejected.\n`;
  reply += `Total hours: ${fmtHrs(totalHrs)} | Overtime: ${fmtHrs(otHrs)}.\n\n`;
  if (pending.length) {
    reply += 'Pending approval:\n';
    pending.slice(0, 5).forEach(t => {
      reply += `• ${t.member_name} — ${t.project}: ${fmtHrs(t.hours)}hrs, ${t.date ? new Date(t.date).toLocaleDateString('en-GB') : 'N/A'}\n`;
    });
  }

  return {
    reply,
    data: { count: rows.length, approved: approved.length, pending: pending.length, rejected: rejected.length, totalHours: totalHrs, overtimeHours: otHrs, timesheets: rows },
    suggestions: [
      'Show me pending timesheets',
      'Calculate labour costs this week',
      'Show me team members'
    ]
  };
}

module.exports = {
  handleTimesheets,
  fmtHrs,
};
