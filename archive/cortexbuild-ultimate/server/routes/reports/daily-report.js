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
  return Number(n || 0).toLocaleString('en-GB');
}

router.post('/daily-report/:id/pdf', async (req, res) => {
  try {
    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.default;

    const reportId = req.params.id;
    const result = await pool.query(`
      SELECT dr.*, p.name as project_name, p.site_address
      FROM daily_reports dr
      LEFT JOIN projects p ON dr.project_id = p.id
      WHERE dr.id = $1
    `, [reportId]);

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Daily report not found' });
    }

    const dr = result.rows[0];

    // Parse JSON fields
    let weather = {};
    let workforce = [];
    let workDone = [];
    let delays = [];
    let equipment = [];

    try { weather = typeof dr.weather === 'string' ? JSON.parse(dr.weather) : (dr.weather || {}); } catch {}
    try { workforce = typeof dr.workforce === 'string' ? JSON.parse(dr.workforce) : (dr.workforce || []); } catch {}
    try { workDone = typeof dr.work_completed === 'string' ? JSON.parse(dr.work_completed) : (dr.work_completed || []); } catch {}
    try { delays = typeof dr.delays === 'string' ? JSON.parse(dr.delays) : (dr.delays || []); } catch {}
    try { equipment = typeof dr.equipment_used === 'string' ? JSON.parse(dr.equipment_used) : (dr.equipment_used || []); } catch {}

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const BLUE = [30, 64, 175];
    const AMBER = [245, 158, 11];
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
    doc.text('DAILY REPORT', 14, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('CortexBuild Ultimate', 14, 20);

    // Date and site info top right
    doc.setFontSize(9);
    doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.text('Date: ' + formatDate(dr.report_date || dr.created_at), 196, 10, { align: 'right' });
    doc.text('Ref: ' + (dr.report_number || dr.id), 196, 16, { align: 'right' });
    doc.text('Project: ' + (dr.project_name || '—'), 196, 22, { align: 'right' });

    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);

    // Project info block
    let y = 32;
    doc.setFillColor(248, 248, 248);
    doc.rect(14, y, 182, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('PROJECT', 16, y + 7);
    doc.text('SITE ADDRESS', 108, y + 7);
    doc.setFontSize(10);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.text(dr.project_name || '—', 16, y + 14);
    const addrLines = doc.splitTextToSize(dr.site_address || '—', 80);
    doc.text(addrLines[0], 108, y + 14);

    // Weather and conditions
    y = 58;
    doc.setFillColor(250, 250, 250);
    doc.rect(14, y, 182, 25, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('WEATHER CONDITIONS', 16, y + 6);
    doc.setFontSize(18);
    doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.text(weather.condition || dr.weather_condition || 'Not recorded', 16, y + 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('Temperature: ' + (weather.temperature || '—') + '  |  Wind: ' + (weather.wind || '—') + '  |  Humidity: ' + (weather.humidity || '—'), 108, y + 18);

    // Workforce breakdown
    y = 89;
    doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('WORKFORCE BREAKDOWN', 16, y);
    y += 6;

    if (workforce.length > 0) {
      doc.setFillColor(40, 40, 40);
      doc.rect(14, y, 168, 7, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Trade / Role', 16, y + 5);
      doc.text('Count', 120, y + 5);
      doc.text('Hours', 150, y + 5);

      doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
      doc.setFont('helvetica', 'normal');

      workforce.slice(0, 10).forEach((w, i) => {
        y += 7;
        if (i % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(14, y - 3, 168, 7, 'F'); }
        doc.setFontSize(8.5);
        doc.text(w.trade || w.role || '—', 16, y + 3);
        doc.text(String(w.count || 0), 120, y + 3);
        doc.text(String(w.hours || 0), 150, y + 3);
      });
    } else {
      doc.setFontSize(9);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text('No workforce data recorded.', 16, y);
    }

    y += 10;

    // Work completed
    doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('WORK COMPLETED TODAY', 16, y);
    y += 5;

    if (workDone.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
      workDone.slice(0, 6).forEach((item, i) => {
        const text = (i + 1) + '. ' + (item.description || item.task || item.activity || '—');
        const lines = doc.splitTextToSize(text, 168);
        doc.text(lines[0], 16, y);
        y += lines.length * 5 + 2;
      });
    } else {
      doc.setFontSize(9);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text('No work completed recorded.', 16, y);
      y += 10;
    }

    y += 5;

    // Delays section
    if (delays.length > 0) {
      doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
      doc.line(14, y, 196, y);
      y += 6;
      doc.setFillColor(239, 68, 68);
      doc.roundedRect(14, y - 4, 40, 7, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('DELAYS', 34, y + 1, { align: 'center' });
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
      delays.slice(0, 4).forEach((delay, i) => {
        const text = '• ' + (delay.reason || delay.description || '—') + ' — ' + (delay.duration || 'Duration unknown');
        const lines = doc.splitTextToSize(text, 168);
        doc.text(lines[0], 16, y);
        y += lines.length * 5 + 2;
      });
      y += 5;
    }

    // Equipment used
    if (equipment.length > 0) {
      doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
      doc.line(14, y, 196, y);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text('EQUIPMENT ON SITE', 16, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
      const equipText = equipment.map(e => e.name || e.equipment || e.type || 'Unknown').join(', ');
      const equipLines = doc.splitTextToSize(equipText, 168);
      doc.text(equipLines.slice(0, 3), 16, y);
      y += equipLines.slice(0, 3).length * 5 + 5;
    }

    // Tomorrow's plan / notes
    if (dr.notes || dr.tomorrow_plan) {
      doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
      doc.line(14, y, 196, y);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text('NOTES / TOMORROW\'S PLAN', 16, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
      const noteLines = doc.splitTextToSize(dr.notes || dr.tomorrow_plan || '', 168);
      doc.text(noteLines.slice(0, 6), 16, y);
    }

    // Footer
    doc.setFontSize(7.5);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('Generated by CortexBuild Ultimate — AI Construction Management', 105, 290, { align: 'center' });

    const filename = 'DailyReport-' + (dr.report_number || dr.id) + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
    doc.output('arraybuffer').then(buffer => {
      res.send(Buffer.from(buffer));
    });
  } catch (err) {
    console.error('[reports] daily report pdf error:', err);
    res.status(500).json({ message: 'Failed to generate daily report PDF' });
  }
});

module.exports = router;