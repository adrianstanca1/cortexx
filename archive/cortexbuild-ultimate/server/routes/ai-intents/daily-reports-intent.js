const pool = require('../../db');

/**
 * Handle daily reports intent - return daily site report summaries.
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleDailyReports(user) {
  const orgId = user?.organization_id;
  const companyId = user?.company_id;
  const { rows } = await pool.query(
    `SELECT project, date, weather, workers_on_site, progress_notes FROM daily_reports WHERE COALESCE(organization_id, company_id) = $1 ORDER BY created_at DESC`,
    [orgId || companyId]
  );
  if (!rows.length) {
    return {
      reply: 'No daily reports found.',
      data: { count: 0 },
      suggestions: ['Show me all projects', 'Show me team members', 'Create a daily report']
    };
  }
  const today = new Date().toISOString().split('T')[0];
  const todayReports = rows.filter(r => r.date && r.date.startsWith(today));
  const thisWeek = rows.filter(r => {
    const d = new Date(r.date);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  });
  const avgWorkers = thisWeek.length > 0
    ? (thisWeek.reduce((s, r) => s + (parseFloat(r.workers_on_site) || 0), 0) / thisWeek.length).toFixed(1)
    : '0';

  let reply = `You have **${rows.length} daily reports** — ${todayReports.length} today, ${thisWeek.length} this week.\n`;
  reply += `Average workers on site this week: ${avgWorkers}.\n\n`;
  if (todayReports.length) {
    reply += "Today's reports:\n";
    todayReports.forEach(r => {
      reply += `• ${r.project}: ${r.weather || 'No weather'}, ${r.workers_on_site || 0} workers\n`;
    });
  }

  return {
    reply,
    data: { count: rows.length, today: todayReports.length, thisWeek: thisWeek.length, avgWorkersThisWeek: avgWorkers, reports: rows },
    suggestions: [
      'Show me this week reports',
      'Generate daily summary report',
      'Show me project progress'
    ]
  };
}

module.exports = {
  handleDailyReports,
};
