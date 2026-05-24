const pool = require('../../db');
const { buildTenantFilter } = require('../../middleware/tenantFilter');

/**
 * HTML escape helper to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Format currency for display.
 * @param {number} n - Value to format
 * @returns {string} Formatted currency string
 */
function fmt(n) {
  if (n == null) return '£0';
  return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Calculate percentage.
 * @param {number} spent - Spent amount
 * @param {number} budget - Budget amount
 * @returns {string} Percentage string
 */
function pct(spent, budget) {
  if (!budget || budget == 0) return '0';
  return ((spent / budget) * 100).toFixed(1);
}

/**
 * Generate a report based on requested type.
 * @param {string} message - User request message
 * @returns {Promise<{reply: string, data: object, suggestions: string[]}>}
 */
async function handleGenerateReport(message, req) {
  const m = message.toLowerCase();
  let reportType = 'daily';
  if (/safety|incident|hazard/.test(m)) reportType = 'safety';
  else if (/financial|finance|invoice|payment|cost|budget/.test(m)) reportType = 'financial';
  else if (/executive|summary|overview|portfolio|board/.test(m)) reportType = 'executive';

  const now = new Date();
  let title = `CortexBuild ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report — ${now.toLocaleDateString('en-GB')}`;

  const htmlSections = [];
  const sections = [];
  const orgId = req?.user?.organization_id;
  const companyId = req?.user?.company_id;
  const { clause: orgFilter, params: queryParams } = buildTenantFilter(req, 'WHERE');

  if (reportType === 'daily' || reportType === 'executive') {
    const { rows: projects } = await pool.query(
      `SELECT name, client, status, progress, budget, spent, manager, location
       FROM projects ${orgFilter} ORDER BY created_at DESC LIMIT 20`,
      queryParams
    );
    const { rows: dailyReports } = await pool.query(
      `SELECT project, date, prepared_by, weather, workers_on_site, progress
       FROM daily_reports ${orgFilter} ORDER BY date DESC LIMIT 14`,
      queryParams
    );
    const active = projects.filter(r => r.status === 'active' || r.status === 'in_progress');
    const totalBudget = projects.reduce((s, r) => s + parseFloat(r.budget || 0), 0);
    const totalSpent  = projects.reduce((s, r) => s + parseFloat(r.spent  || 0), 0);

    htmlSections.push(`<h2>📋 Projects Overview</h2>
<p><strong>Total Projects:</strong> ${projects.length} | <strong>Active:</strong> ${active.length} | <strong>Budget:</strong> ${fmt(totalBudget)} | <strong>Spent:</strong> ${fmt(totalSpent)} (${pct(totalSpent, totalBudget)}%)</p>
<table><thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Progress</th><th>Budget</th><th>Spent</th></tr></thead><tbody>
${projects.slice(0, 10).map(p => `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.client) || 'N/A'}</td><td>${escapeHtml(p.status)}</td><td>${p.progress ?? 0}%</td><td>${fmt(p.budget)}</td><td>${fmt(p.spent)}</td></tr>`).join('')}
</tbody></table>`);

    sections.push({
      title: 'Projects Overview',
      count: projects.length,
      active,
      totalBudget,
      totalSpent,
      pct: pct(totalSpent, totalBudget),
      projects: projects.slice(0, 10)
    });
  }

  if (reportType === 'safety' || reportType === 'executive') {
    const { rows: incidents } = await pool.query(
      `SELECT type, title, severity, status, project, date FROM safety_incidents ${orgFilter} ORDER BY created_at DESC`,
      queryParams
    );
    const open = incidents.filter(r => r.status === 'open' || r.status === 'investigating');
    const high = incidents.filter(r => r.severity === 'high' || r.severity === 'critical');

    htmlSections.push(`<h2>🛡️ Safety Incidents</h2>
<p><strong>Total:</strong> ${incidents.length} | <strong>Open:</strong> ${open.length} | <strong>High/Critical:</strong> ${high.length}</p>
${open.length ? `<table><thead><tr><th>Title</th><th>Project</th><th>Severity</th><th>Status</th><th>Date</th></tr></thead><tbody>
${open.slice(0, 8).map(i => `<tr><td>${escapeHtml(i.title)}</td><td>${escapeHtml(i.project)}</td><td>${escapeHtml(i.severity)}</td><td>${escapeHtml(i.status)}</td><td>${i.date ? new Date(i.date).toLocaleDateString('en-GB') : 'N/A'}</td></tr>`).join('')}
</tbody></table>` : '<p>No open incidents — great news!</p>'}`);

    sections.push({
      title: 'Safety',
      count: incidents.length,
      open: open.length,
      highSeverity: high.length,
      incidents: open.slice(0, 8)
    });
  }

  if (reportType === 'financial' || reportType === 'executive') {
    const { rows: invoices } = await pool.query(
      `SELECT number, client, project, amount, status, due_date FROM invoices ${orgFilter} ORDER BY created_at DESC`,
      queryParams
    );
    const overdue = invoices.filter(r => r.status === 'overdue');
    const paid    = invoices.filter(r => r.status === 'paid');
    const pending = invoices.filter(r => r.status === 'draft' || r.status === 'sent');
    const totalAmt = invoices.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const overdueAmt = overdue.reduce((s, r) => s + parseFloat(r.amount || 0), 0);

    htmlSections.push(`<h2>💰 Financial Summary</h2>
<p><strong>Total Invoiced:</strong> ${fmt(totalAmt)} | <strong>Paid:</strong> ${paid.length} | <strong>Pending:</strong> ${pending.length} | <strong>Overdue:</strong> ${overdue.length} (${fmt(overdueAmt)})</p>
${overdue.length ? `<table><thead><tr><th>Invoice</th><th>Client</th><th>Project</th><th>Amount</th><th>Due Date</th></tr></thead><tbody>
${overdue.slice(0, 8).map(i => `<tr><td>${escapeHtml(i.number)}</td><td>${escapeHtml(i.client)}</td><td>${escapeHtml(i.project)}</td><td>${fmt(i.amount)}</td><td>${i.due_date ? new Date(i.due_date).toLocaleDateString('en-GB') : 'N/A'}</td></tr>`).join('')}
</tbody></table>` : '<p>No overdue invoices!</p>'}`);

    sections.push({
      title: 'Financial',
      totalInvoiced: totalAmt,
      overdueCount: overdue.length,
      overdueAmount: overdueAmt,
      paidCount: paid.length,
      pendingCount: pending.length,
      invoices: overdue.slice(0, 8)
    });
  }

  if (reportType === 'daily') {
    const { rows: dailyReports } = await pool.query(
      `SELECT project, date, prepared_by, weather, workers_on_site, progress
       FROM daily_reports ${orgFilter} ORDER BY date DESC LIMIT 7`,
      queryParams
    );
    const avgWorkers = dailyReports.length
      ? (dailyReports.reduce((s, r) => s + parseFloat(r.workers_on_site || 0), 0) / dailyReports.length).toFixed(1)
      : 0;

    htmlSections.push(`<h2>📅 Daily Reports (Last 7 Days)</h2>
<p><strong>Average Workers on Site:</strong> ${avgWorkers}</p>
<table><thead><tr><th>Project</th><th>Date</th><th>Weather</th><th>Workers</th><th>Progress</th><th>Prepared By</th></tr></thead><tbody>
${dailyReports.map(d => `<tr><td>${escapeHtml(d.project)}</td><td>${d.date ? new Date(d.date).toLocaleDateString('en-GB') : 'N/A'}</td><td>${escapeHtml(d.weather) || 'N/A'}</td><td>${d.workers_on_site || 0}</td><td>${d.progress || 0}%</td><td>${escapeHtml(d.prepared_by)}</td></tr>`).join('')}
</tbody></table>`);
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #222; }
  h1 { color: #1a3a6b; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
  h2 { color: #1e40af; margin-top: 30px; border-left: 4px solid #3b82f6; padding-left: 10px; }
  table { border-collapse: collapse; width: 100%; margin-top: 10px; }
  th { background: #1e3a6b; color: white; padding: 8px 12px; text-align: left; }
  td { padding: 7px 12px; border-bottom: 1px solid #e5e7eb; }
  tr:hover { background: #f9fafb; }
  p { margin: 8px 0; }
  .footer { margin-top: 40px; font-size: 11px; color: #888; border-top: 1px solid #e5e7eb; padding-top: 10px; }
</style></head>
<body>
<h1>${escapeHtml(title)}</h1>
<p><strong>Generated:</strong> ${now.toLocaleString('en-GB')} | <strong>Report Type:</strong> ${reportType.toUpperCase()}</p>
${htmlSections.join('\n')}
<div class="footer">CortexBuild Ultimate — Construction Management Platform — Confidential</div>
</body></html>`;

  // Strip HTML for plain-text reply
  const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  let reply = `📊 I've generated a **${reportType} report** for you. `;
  if (sections.find(s => s.title === 'Projects Overview')) {
    const p = sections.find(s => s.title === 'Projects Overview');
    reply += `${p.count} projects, ${p.active?.length ?? 0} active, budget ${fmt(p.totalBudget)}, ${p.pct}% spent.\n`;
  }
  if (sections.find(s => s.title === 'Safety')) {
    const s = sections.find(s => s.title === 'Safety');
    reply += `${s.count} safety incidents, ${s.open} open, ${s.highSeverity} high/critical.\n`;
  }
  if (sections.find(s => s.title === 'Financial')) {
    const f = sections.find(s => s.title === 'Financial');
    reply += `${f.totalInvoiced ? `Financial: ${fmt(f.totalInvoiced)} invoiced, ${f.overdueCount} overdue (${fmt(f.overdueAmount)}).\n` : ''}`;
  }
  reply += `\n*Print this page to PDF (Ctrl+P / Cmd+P) or the report HTML will open in your browser.*`;

  return {
    reply,
    data: {
      reportType,
      title,
      generatedAt: now.toISOString(),
      sections,
      html
    },
    suggestions: [
      'Show me overdue invoices',
      'Show me safety incidents',
      'Show me all projects'
    ]
  };
}

module.exports = {
  handleGenerateReport,
  fmt,
  pct,
};
