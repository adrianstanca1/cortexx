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

router.post('/rfi/:id/pdf', async (req, res) => {
  try {
    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.default;

    const rfiId = req.params.id;
    const result = await pool.query(`
      SELECT r.*, p.name as project_name, u.name as assigned_to_name, u2.name as submitted_by_name
      FROM rfis r
      LEFT JOIN projects p ON r.project_id = p.id
      LEFT JOIN users u ON r.assigned_to = u.id
      LEFT JOIN users u2 ON r.submitted_by = u2.id
      WHERE r.id = $1
    `, [rfiId]);

    if (!result.rows.length) {
      return res.status(404).json({ message: 'RFI not found' });
    }

    const rfi = result.rows[0];

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const BLUE = [30, 64, 175];
    const GRAY = [100, 100, 100];
    const LIGHTGRAY = [220, 220, 220];
    const BLACK = [30, 30, 30];
    const WHITE = [255, 255, 255];

    const priorityColors = {
      low: [34, 197, 94],
      medium: [59, 130, 246],
      high: [249, 115, 22],
      critical: [239, 68, 68],
    };
    const statusColors = {
      draft: [100, 100, 100],
      open: [59, 130, 246],
      pending: [249, 115, 22],
      answered: [34, 197, 94],
      closed: [100, 100, 100],
      overdue: [239, 68, 68],
    };

    const statusColor = statusColors[rfi.status] || [100, 100, 100];
    const priorityColor = priorityColors[rfi.priority] || [100, 100, 100];

    // Blueprint-themed header
    doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('REQUEST FOR INFORMATION', 14, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('CortexBuild Ultimate', 14, 20);

    // RFI number and status top right
    doc.setFontSize(9);
    doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.text('RFI #: ' + (rfi.number || rfi.id), 196, 10, { align: 'right' });
    doc.text('Status: ' + (rfi.status || 'draft').toUpperCase(), 196, 16, { align: 'right' });
    doc.text('Priority: ' + (rfi.priority || 'medium').toUpperCase(), 196, 22, { align: 'right' });

    // Priority badge
    doc.setFillColor(priorityColor[0], priorityColor[1], priorityColor[2]);
    doc.roundedRect(14, 27, 28, 7, 1, 1, 'F');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text((rfi.priority || 'medium').toUpperCase(), 28, 32, { align: 'center' });

    // Status badge
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(46, 27, 28, 7, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text((rfi.status || 'draft').toUpperCase(), 60, 32, { align: 'center' });

    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);

    // Project info block
    let y = 42;
    doc.setFillColor(248, 248, 248);
    doc.rect(14, y, 182, 30, 'F');
    doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
    doc.line(14, y + 10, 196, y + 10);
    doc.line(105, y, 105, y + 30);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('PROJECT', 16, y + 6);
    doc.text('SUBJECT', 107, y + 6);

    doc.setFontSize(10);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.text(rfi.project_name || '—', 16, y + 15);
    const subjectLines = doc.splitTextToSize(rfi.subject || '—', 85);
    doc.text(subjectLines[0], 107, y + 15);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('SUBMITTED', 16, y + 25);
    doc.text('ASSIGNED TO', 107, y + 25);

    doc.setFontSize(10);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.text(formatDate(rfi.submitted_date || rfi.created_at), 16, y + 30);
    doc.text(rfi.assigned_to_name || '—', 107, y + 30);

    // Due date highlight
    y = 78;
    if (rfi.due_date) {
      const dueDate = new Date(rfi.due_date);
      const now = new Date();
      const isOverdue = dueDate < now && rfi.status !== 'closed';
      doc.setFillColor(isOverdue ? [239, 68, 68] : [59, 130, 246], isOverdue ? [68, 68, 68] : [30, 64, 175], isOverdue ? [68, 68, 68] : [175, 64, 30]);
      doc.rect(14, y, 182, 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('DUE DATE: ' + formatDate(rfi.due_date) + (isOverdue ? ' — OVERDUE' : ''), 105, y + 8, { align: 'center' });
      y += 16;
    } else {
      y += 6;
    }

    // Question / Description section
    doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('QUESTION / DESCRIPTION', 16, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    const questionLines = doc.splitTextToSize(rfi.question || 'No description provided.', 168);
    doc.text(questionLines.slice(0, 8), 16, y);
    y += questionLines.slice(0, 8).length * 5 + 5;

    // Response section
    if (rfi.answer || rfi.response) {
      doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
      doc.line(14, y, 196, y);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text('RESPONSE', 16, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
      const responseLines = doc.splitTextToSize(rfi.answer || rfi.response || '', 168);
      doc.text(responseLines.slice(0, 8), 16, y);
      y += responseLines.slice(0, 8).length * 5 + 5;
    }

    // Additional details
    y += 5;
    doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
    doc.line(14, y, 196, y);
    y += 6;

    const detailsPairs = [
      ['DISCIPLINE', rfi.discipline || '—'],
      ['COST IMPACT', rfi.cost_impact || '—'],
      ['SCHEDULE IMPACT', rfi.schedule_impact || '—'],
      ['BALL IN COURT', rfi.ball_in_court || '—'],
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

    // Notes
    if (rfi.notes) {
      y += 5;
      doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
      doc.line(14, y, 196, y);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text('NOTES', 16, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
      const noteLines = doc.splitTextToSize(rfi.notes, 168);
      doc.text(noteLines.slice(0, 4), 16, y);
    }

    // Footer
    doc.setFontSize(7.5);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('Generated by CortexBuild Ultimate — AI Construction Management', 105, 290, { align: 'center' });

    const filename = 'RFI-' + (rfi.number || rfi.id) + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
    doc.output('arraybuffer').then(buffer => {
      res.send(Buffer.from(buffer));
    });
  } catch (err) {
    console.error('[reports] rfi pdf error:', err);
    res.status(500).json({ message: 'Failed to generate RFI PDF' });
  }
});

module.exports = router;