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

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

router.post('/safety-incident/:id/pdf', async (req, res) => {
  try {
    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.default;

    const incidentId = req.params.id;
    const result = await pool.query(`
      SELECT si.*, p.name as project_name, u.name as reported_by_name, u2.name as assigned_to_name
      FROM safety_incidents si
      LEFT JOIN projects p ON si.project_id = p.id
      LEFT JOIN users u ON si.reported_by = u.id
      LEFT JOIN users u2 ON si.assigned_to = u2.id
      WHERE si.id = $1
    `, [incidentId]);

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Safety incident not found' });
    }

    const incident = result.rows[0];

    // Parse JSON fields
    let witnesses = [];
    let correctiveActions = [];
    let rootCause = null;

    try { witnesses = typeof incident.witnesses === 'string' ? JSON.parse(incident.witnesses) : (incident.witnesses || []); } catch {}
    try { correctiveActions = typeof incident.corrective_actions === 'string' ? JSON.parse(incident.corrective_actions) : (incident.corrective_actions || []); } catch {}
    try { rootCause = incident.root_cause_analysis || null; } catch {}

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const RED = [239, 68, 68];
    const AMBER = [245, 158, 11];
    const BLUE = [30, 64, 175];
    const GRAY = [100, 100, 100];
    const LIGHTGRAY = [220, 220, 220];
    const BLACK = [30, 30, 30];
    const WHITE = [255, 255, 255];

    const severityColors = {
      minor: [34, 197, 94],
      moderate: [249, 115, 22],
      major: [239, 68, 68],
      critical: [127, 29, 29],
    };
    const statusColors = {
      open: [239, 68, 68],
      investigating: [249, 115, 22],
      resolved: [34, 197, 94],
      closed: [100, 100, 100],
    };

    const severityColor = severityColors[incident.severity] || [100, 100, 100];
    const statusColor = statusColors[incident.status] || [100, 100, 100];

    // Blueprint-themed header with red accent for safety
    doc.setFillColor(RED[0], RED[1], RED[2]);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setFillColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.rect(0, 25, 210, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('SAFETY INCIDENT REPORT', 14, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('CortexBuild Ultimate', 14, 20);

    // Incident ref and status top right
    doc.setFontSize(9);
    doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.text('Ref #: ' + (incident.incident_number || incident.id), 196, 10, { align: 'right' });
    doc.text('Status: ' + (incident.status || 'open').toUpperCase(), 196, 16, { align: 'right' });
    doc.text('Severity: ' + (incident.severity || 'unknown').toUpperCase(), 196, 22, { align: 'right' });

    // Severity badge
    doc.setFillColor(severityColor[0], severityColor[1], severityColor[2]);
    doc.roundedRect(14, 30, 32, 8, 1, 1, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('SEVERITY: ' + (incident.severity || 'UNKNOWN').toUpperCase(), 30, 36, { align: 'center' });

    // Status badge
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(50, 30, 36, 8, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text((incident.status || 'open').toUpperCase(), 68, 36, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);

    // Project info block
    let y = 44;
    doc.setFillColor(248, 248, 248);
    doc.rect(14, y, 182, 25, 'F');
    doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
    doc.line(14, y + 12.5, 196, y + 12.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('PROJECT', 16, y + 7);
    doc.text('LOCATION', 108, y + 7);
    doc.setFontSize(10);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.text(incident.project_name || '—', 16, y + 17);
    doc.text(incident.location || '—', 108, y + 17);

    // Date/time of incident
    y = 75;
    doc.setFillColor(250, 250, 250);
    doc.rect(14, y, 182, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('DATE & TIME OF INCIDENT', 16, y + 7);
    doc.text('DATE REPORTED', 108, y + 7);
    doc.setFontSize(10);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.text(formatDateTime(incident.incident_date), 16, y + 15);
    doc.text(formatDate(incident.reported_date || incident.created_at), 108, y + 15);

    // Incident description
    y = 101;
    doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('INCIDENT DESCRIPTION', 16, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    const descLines = doc.splitTextToSize(incident.description || 'No description provided.', 168);
    doc.text(descLines.slice(0, 8), 16, y);
    y += descLines.slice(0, 8).length * 5 + 8;

    // Immediate actions taken
    if (incident.immediate_actions) {
      doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
      doc.line(14, y, 196, y);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text('IMMEDIATE ACTIONS TAKEN', 16, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
      const actionLines = doc.splitTextToSize(incident.immediate_actions, 168);
      doc.text(actionLines.slice(0, 4), 16, y);
      y += actionLines.slice(0, 4).length * 5 + 8;
    }

    // Witnesses
    if (witnesses.length > 0) {
      doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
      doc.line(14, y, 196, y);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text('WITNESSES', 16, y);
      y += 5;

      witnesses.forEach((w, i) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
        const witnessLine = (i + 1) + '. ' + (w.name || 'Unknown') + (w.testimony ? ' — ' + w.testimony : '');
        const lines = doc.splitTextToSize(witnessLine, 168);
        doc.text(lines[0], 16, y);
        y += lines.length * 5 + 2;
      });
      y += 5;
    }

    // Root cause analysis
    if (rootCause) {
      doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
      doc.line(14, y, 196, y);
      y += 6;
      doc.setFillColor(AMBER[0], AMBER[1], AMBER[2]);
      doc.roundedRect(14, y - 4, 50, 7, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text('ROOT CAUSE ANALYSIS', 39, y + 1, { align: 'center' });
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
      const causeLines = doc.splitTextToSize(rootCause, 168);
      doc.text(causeLines.slice(0, 5), 16, y);
      y += causeLines.slice(0, 5).length * 5 + 8;
    }

    // Corrective actions
    if (correctiveActions.length > 0) {
      doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
      doc.line(14, y, 196, y);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text('CORRECTIVE ACTIONS', 16, y);
      y += 5;

      correctiveActions.forEach((action, i) => {
        doc.setFillColor(250, 250, 250);
        doc.rect(14, y - 3, 182, 9, 'F');
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
        const actionText = (i + 1) + '. ' + (action.description || action.action || '—') + (action.assigned_to ? ' [Assigned: ' + action.assigned_to + ']' : '') + (action.due_date ? ' Due: ' + action.due_date : '');
        const lines = doc.splitTextToSize(actionText, 168);
        doc.text(lines[0], 16, y + 3);
        y += 9;
      });
      y += 5;
    }

    // Additional details
    y += 3;
    const detailsPairs = [
      ['REPORTED BY', incident.reported_by_name || '—'],
      ['ASSIGNED TO', incident.assigned_to_name || '—'],
    ];

    detailsPairs.forEach(([label, value], idx) => {
      doc.setFillColor(idx % 2 === 0 ? 250 : 248, idx % 2 === 0 ? 250 : 248, idx % 2 === 0 ? 250 : 248);
      doc.rect(14, y, 182, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text(label, 16, y + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
      doc.text(value, 60, y + 5.5);
      y += 8;
    });

    // Sign-off section
    y += 8;
    doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('AUTHORISATION & SIGN-OFF', 16, y);
    y += 10;

    doc.setFillColor(248, 248, 248);
    doc.rect(14, y, 85, 25, 'F');
    doc.rect(105, y, 91, 25, 'F');

    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('Reported by signature:', 16, y + 5);
    doc.text('________________________', 16, y + 15);
    doc.text('Date: ______________', 16, y + 22);

    doc.text('Supervisor signature:', 107, y + 5);
    doc.text('________________________', 107, y + 15);
    doc.text('Date: ______________', 107, y + 22);

    // Footer
    doc.setFontSize(7.5);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('Generated by CortexBuild Ultimate — AI Construction Management', 105, 290, { align: 'center' });

    const filename = 'SafetyIncident-' + (incident.incident_number || incident.id) + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
    doc.output('arraybuffer').then(buffer => {
      res.send(Buffer.from(buffer));
    });
  } catch (err) {
    console.error('[reports] safety incident pdf error:', err);
    res.status(500).json({ message: 'Failed to generate safety incident PDF' });
  }
});

module.exports = router;