require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmt(n) {
  return '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

router.post('/project/:id/summary/pdf', async (req, res) => {
  try {
    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.default;

    const projectId = req.params.id;
    const orgFilter = 'COALESCE(organization_id, company_id) = $1';
    const params = [req.user?.organization_id || req.user?.company_id || '0'];

    const projectResult = await pool.query(`
      SELECT p.*, c.name as client_name, u.name as manager_name
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN users u ON p.manager_id = u.id
      WHERE p.id = $2 AND (${orgFilter})
    `, [...params, projectId]);

    if (!projectResult.rows.length) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const project = projectResult.rows[0];

    const [invoicesResult, rfisResult, safetyResult, budgetResult, tasksResult] = await Promise.all([
      pool.query(`SELECT * FROM invoices WHERE project_id = $1 ORDER BY created_at DESC LIMIT 20`, [projectId]),
      pool.query(`SELECT COUNT(*) as open FROM rfis WHERE project_id = $1 AND status NOT IN ('closed', 'answered')`, [projectId]),
      pool.query(`SELECT COUNT(*) as open FROM safety_incidents WHERE project_id = $1 AND status NOT IN ('closed', 'resolved')`, [projectId]),
      pool.query(`SELECT COALESCE(SUM(budgeted), 0) as total_budget, COALESCE(SUM(spent), 0) as total_spent FROM budget_items WHERE project_id = $1`, [projectId]),
      pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'completed') as completed FROM tasks WHERE project_id = $1`, [projectId]),
    ]);

    const invoices = invoicesResult.rows;
    const openRfis = Number(rfisResult.rows[0]?.open || 0);
    const openIncidents = Number(safetyResult.rows[0]?.open || 0);
    const totalBudget = Number(budgetResult.rows[0]?.total_budget || 0);
    const totalSpent = Number(budgetResult.rows[0]?.total_spent || 0);
    const taskTotal = Number(tasksResult.rows[0]?.total || 0);
    const taskCompleted = Number(tasksResult.rows[0]?.completed || 0);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const BLUE = [30, 64, 175];
    const AMBER = [245, 158, 11];
    const GREEN = [34, 197, 94];
    const GRAY = [100, 100, 100];
    const LIGHTGRAY = [220, 220, 220];
    const BLACK = [30, 30, 30];
    const WHITE = [255, 255, 255];

    // Blueprint-themed header
    doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('PROJECT STATUS REPORT', 14, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('CortexBuild Ultimate', 14, 20);

    // Project name and status top right
    doc.setFontSize(9);
    doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.text('Project: ' + (project.name || '—'), 196, 10, { align: 'right' });
    doc.text('Status: ' + (project.status || 'active').toUpperCase(), 196, 16, { align: 'right' });
    doc.text('Phase: ' + (project.phase || '—'), 196, 22, { align: 'right' });

    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);

    // Project overview block
    let y = 32;
    doc.setFillColor(248, 248, 248);
    doc.rect(14, y, 182, 35, 'F');
    doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
    doc.line(14, y + 12, 196, y + 12);
    doc.line(14, y + 24, 196, y + 24);
    doc.line(105, y, 105, y + 35);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('PROJECT NAME', 16, y + 7);
    doc.text('CLIENT', 107, y + 7);
    doc.setFontSize(10);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    const projLines = doc.splitTextToSize(project.name || '—', 85);
    doc.text(projLines[0], 16, y + 18);
    doc.text(project.client_name || project.client || '—', 107, y + 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('START DATE', 16, y + 30);
    doc.text('MANAGER', 107, y + 30);
    doc.setFontSize(10);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.text(formatDate(project.start_date || project.created_at), 16, y + 35);
    doc.text(project.manager_name || project.manager || '—', 107, y + 35);

    // Financial summary
    y = 73;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.text('FINANCIAL SUMMARY', 16, y);
    y += 6;

    doc.setFillColor(250, 250, 250);
    doc.rect(14, y, 182, 25, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('CONTRACT VALUE', 16, y + 7);
    doc.text('TOTAL BUDGET', 72, y + 7);
    doc.text('TOTAL SPENT', 128, y + 7);
    doc.text('VARIANCE', 172, y + 7);
    doc.setFontSize(14);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.text(fmt(project.contract_value || 0), 16, y + 20);
    doc.text(fmt(totalBudget), 72, y + 20);
    doc.text(fmt(totalSpent), 128, y + 20);
    const variance = totalBudget - totalSpent;
    const varianceColor = variance >= 0 ? GREEN : [239, 68, 68];
    doc.setTextColor(varianceColor[0], varianceColor[1], varianceColor[2]);
    doc.text(fmt(Math.abs(variance)), 172, y + 20);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);

    // Progress section
    y = 104;
    doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.text('PROGRESS & PERFORMANCE', 16, y);
    y += 8;

    // Progress bar
    const completion = project.progress || 0;
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(14, y, 168, 10, 2, 2, 'F');
    doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
    doc.roundedRect(14, y, Math.min(168, 168 * (completion / 100)), 10, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('Completion: ' + completion + '%', 185, y + 7, { align: 'right' });
    y += 16;

    // KPIs row
    const kpis = [
      ['Open RFIs', openRfis, openRfis > 5 ? AMBER : GREEN],
      ['Open Incidents', openIncidents, openIncidents > 0 ? [239, 68, 68] : GREEN],
      ['Tasks', taskCompleted + '/' + taskTotal, GREEN],
      ['Invoices', invoices.filter(i => i.status === 'paid').length + '/' + invoices.length, GREEN],
    ];

    kpis.forEach(([label, value, color], idx) => {
      const x = 14 + idx * 45;
      doc.setFillColor(250, 250, 250);
      doc.rect(x, y, 42, 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text(String(label), x + 3, y + 7);
      doc.setFontSize(14);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(String(value), x + 3, y + 17);
    });

    y += 28;

    // Recent invoices
    if (invoices.length > 0) {
      doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
      doc.line(14, y, 196, y);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
      doc.text('RECENT INVOICES', 16, y);
      y += 6;

      doc.setFillColor(40, 40, 40);
      doc.rect(14, y, 168, 7, 'F');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Number', 16, y + 5);
      doc.text('Date', 60, y + 5);
      doc.text('Status', 100, y + 5);
      doc.text('Amount', 140, y + 5);

      doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
      doc.setFont('helvetica', 'normal');

      invoices.slice(0, 5).forEach((inv, i) => {
        y += 8;
        if (i % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(14, y - 4, 168, 8, 'F'); }
        doc.setFontSize(8);
        doc.text(inv.invoice_number || inv.id, 16, y + 2);
        doc.text(formatDate(inv.issue_date), 60, y + 2);
        doc.text((inv.status || 'draft').toUpperCase(), 100, y + 2);
        doc.text(fmt(parseFloat(inv.amount) || 0), 140, y + 2);
      });
      y += 8;
    }

    // Key risks
    y += 5;
    doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.text('KEY RISKS & NOTES', 16, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);

    const riskItems = [];
    if (variance < 0) riskItems.push('Budget overrun: ' + fmt(Math.abs(variance)));
    if (openRfis > 5) riskItems.push('High number of open RFIs: ' + openRfis);
    if (openIncidents > 0) riskItems.push('Open safety incidents: ' + openIncidents);
    if (taskTotal > 0 && taskCompleted / taskTotal < 0.5) riskItems.push('Task completion below target');

    if (riskItems.length > 0) {
      riskItems.forEach(risk => {
        doc.setFillColor(239, 68, 68);
        doc.circle(16, y - 1, 1.5, 'F');
        doc.text(risk, 22, y + 2);
        y += 7;
      });
    } else {
      doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
      doc.circle(16, y - 1, 1.5, 'F');
      doc.text('No significant risks identified.', 22, y + 2);
      y += 7;
    }

    // Upcoming milestones
    if (project.target_end_date) {
      y += 5;
      doc.setFillColor(250, 250, 250);
      doc.rect(14, y, 182, 15, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text('TARGET COMPLETION', 16, y + 6);
      doc.setFontSize(10);
      doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
      doc.text(formatDate(project.target_end_date), 16, y + 12);
    }

    // Footer
    doc.setFontSize(7.5);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('Generated by CortexBuild Ultimate — AI Construction Management', 105, 290, { align: 'center' });

    const filename = 'ProjectSummary-' + (project.name || project.id) + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
    doc.output('arraybuffer').then(buffer => {
      res.send(Buffer.from(buffer));
    });
  } catch (err) {
    console.error('[reports] project summary pdf error:', err);
    res.status(500).json({ message: 'Failed to generate project summary PDF' });
  }
});

module.exports = router;