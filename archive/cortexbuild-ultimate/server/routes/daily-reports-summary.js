const express = require('express');
const authMiddleware = require('../middleware/auth');
const pool = require('../db');

const router = express.Router();
router.use(authMiddleware);

// HTML escape helper to prevent XSS
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
 * POST /daily-reports/summary
 * AI-powered summary of daily reports for a given week
 */
router.post('/summary', async (req, res) => {
  try {
    const { reports = [], projectName = '' } = req.body;
    if (!reports.length) {
      return res.status(400).json({ message: 'No reports provided' });
    }

    const totalWorkers = reports.reduce((s, r) => s + Number(r.workers_on_site ?? 0), 0);
    const totalIssues = reports.filter(r => r.issues?.length || r.delays?.length).length;
    const projectNames = [...new Set(reports.map(r => r.project || projectName).filter(Boolean))];
    const dates = reports.map(r => r.report_date).filter(Boolean).sort();

    const summary = `Weekly Report Summary (${projectNames.join(', ') || 'All Projects'})
${dates.length ? `${new Date(dates[0]).toLocaleDateString()} – ${new Date(dates[dates.length - 1]).toLocaleDateString()}` : ''}

Reports Submitted: ${reports.length}
Total Worker Days: ${totalWorkers}
Average Workers/Day: ${reports.length ? Math.round(totalWorkers / reports.length) : 0}
Issues Reported: ${totalIssues}
${totalIssues > 0 ? '⚠️ Action may be required on ' + totalIssues + ' day(s)' : '✅ No major issues reported'}

Key Highlights:
${reports.map(r => {
  const d = r.report_date ? new Date(String(r.report_date)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Unknown';
  const workers = r.workers_on_site ?? 0;
  const weather = r.weather || 'N/A';
  const activities = Array.isArray(r.activities) ? r.activities.map((a) => a.description || a.title || '').filter(Boolean).slice(0, 2) : [];
  const issues = (r.issues || r.delays) ? String(r.issues || r.delays).substring(0, 60) : '';
  return `[${d}] ${workers} workers | ${weather}${activities.length ? ' | ' + activities.join(', ') : ''}${issues ? ' | ⚠️ ' + String(issues).substring(0, 60) : ''}`;
}).join('\n')}`;

    res.json({ summary });
  } catch (err) {
    console.error('[POST /daily-reports/summary]', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /daily-reports/weekly-pdf
 * Generate a printable weekly PDF summary (returns HTML for now, browser handles print-to-PDF)
 */
router.post('/weekly-pdf', async (req, res) => {
  try {
    const { reports = [], projectName = 'All Projects' } = req.body;
    if (!reports.length) {
      return res.status(400).json({ message: 'No reports provided' });
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Weekly Report – ${escapeHtml(projectName)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
    h1 { font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
    th { background: #333; color: #fff; padding: 8px 6px; text-align: left; }
    td { padding: 7px 6px; border-bottom: 1px solid #ddd; vertical-align: top; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .meta { color: #666; font-size: 12px; }
    .issues { color: #c00; }
    .footer { margin-top: 30px; font-size: 11px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <h1>📋 Weekly Site Report — ${escapeHtml(projectName)}</h1>
  <p class="meta">Generated: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Weather</th>
        <th>Workers</th>
        <th>Work Carried Out</th>
        <th>Issues/Delays</th>
      </tr>
    </thead>
    <tbody>
      ${reports.map((r) => {
        const date = r.report_date ? new Date(String(r.report_date)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'N/A';
        const activities = Array.isArray(r.activities) ? r.activities.map((a) => escapeHtml(a.description) || '').filter(Boolean).join('; ') : '';
        const issues = (r.issues || r.delays) ? escapeHtml(String(r.issues || r.delays)) : '';
        return `<tr>
          <td><strong>${date}</strong></td>
          <td>${escapeHtml(r.weather || 'N/A')}</td>
          <td>${r.workers_on_site ?? 0}</td>
          <td>${activities.substring(0, 120)}${activities.length > 120 ? '…' : ''}</td>
          <td class="${issues ? 'issues' : ''}">${issues ? '⚠️ ' + issues.substring(0, 80) : '—'}</td>
        </tr>`;
      }).join('\n')}
    </tbody>
  </table>
  <div class="footer">CortexBuild Ultimate — Generated automatically</div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="weekly-report-${new Date().toISOString().slice(0,10)}.html"`);
    res.send(Buffer.from(html));
  } catch (err) {
    console.error('[POST /daily-reports/weekly-pdf]', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
