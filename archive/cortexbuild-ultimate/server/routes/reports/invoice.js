require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

function fmt(n) {
  return '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

router.post('/invoice/:id/pdf', async (req, res) => {
  try {
    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.default;

    const invoiceId = req.params.id;
    const result = await pool.query(`
      SELECT i.*, p.name as project_name, p.address as project_address,
             c.name as client_name, c.email as client_email, c.address as client_address, c.phone as client_phone,
             co.name as company_name, co.address as company_address, co.phone as company_phone, co.email as company_email
      FROM invoices i
      LEFT JOIN projects p ON i.project_id = p.id
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN companies co ON p.company_id = co.id
      WHERE i.id = $1
    `, [invoiceId]);

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const inv = result.rows[0];
    const lineItemsResult = await pool.query(`
      SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY created_at
    `, [invoiceId]);
    const lineItems = lineItemsResult.rows;

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
    doc.text('INVOICE', 14, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(inv.company_name || 'CortexBuild Ultimate', 14, 20);

    // Invoice details top right
    doc.setFontSize(9);
    doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.text('Invoice #: ' + (inv.invoice_number || inv.id), 196, 10, { align: 'right' });
    doc.text('Date: ' + formatDate(inv.issue_date || inv.created_at), 196, 16, { align: 'right' });
    if (inv.due_date) doc.text('Due: ' + formatDate(inv.due_date), 196, 22, { align: 'right' });

    // Status badge
    const statusColors = {
      draft: [100, 100, 100],
      sent: [59, 130, 246],
      paid: [34, 197, 94],
      overdue: [239, 68, 68],
      disputed: [249, 115, 22],
    };
    const statusColor = statusColors[inv.status] || [100, 100, 100];
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(160, 27, 36, 7, 1, 1, 'F');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text((inv.status || 'draft').toUpperCase(), 178, 32, { align: 'center' });

    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);

    // Company details box
    let y = 32;
    doc.setFillColor(248, 248, 248);
    doc.rect(14, y, 90, 35, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('FROM', 16, y + 6);
    doc.setFontSize(10);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.text(inv.company_name || 'CortexBuild Ltd', 16, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    if (inv.company_address) {
      const addrLines = doc.splitTextToSize(inv.company_address, 80);
      doc.text(addrLines.slice(0, 2), 16, y + 20);
    }
    doc.text(inv.company_email || '', 16, y + 30);

    // Client details box
    doc.rect(106, y, 90, 35, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('BILL TO', 108, y + 6);
    doc.setFontSize(10);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.text(inv.client_name || '—', 108, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    if (inv.client_address) {
      const addrLines = doc.splitTextToSize(inv.client_address, 80);
      doc.text(addrLines.slice(0, 2), 108, y + 20);
    }
    doc.text(inv.client_email || '', 108, y + 30);

    // Project info
    y = 73;
    doc.setFillColor(250, 250, 250);
    doc.rect(14, y, 182, 15, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('PROJECT', 16, y + 6);
    doc.text('REFERENCE', 108, y + 6);
    doc.setFontSize(9);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.text(inv.project_name || '—', 16, y + 12);
    doc.text(inv.reference || '—', 108, y + 12);

    // Line items table
    y = 96;
    doc.setFillColor(40, 40, 40);
    doc.rect(14, y, 182, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Description', 16, y + 5.5);
    doc.text('Qty', 120, y + 5.5);
    doc.text('Unit Price', 140, y + 5.5);
    doc.text('Amount', 174, y + 5.5);
    doc.text('Tax', 192, y + 5.5);

    // Line items
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.setFont('helvetica', 'normal');

    lineItems.forEach((item, i) => {
      y += 9;
      if (i % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(14, y - 5, 182, 9, 'F'); }
      doc.setFontSize(8.5);
      const desc = item.description || '—';
      const descLines = doc.splitTextToSize(desc, 100);
      doc.text(descLines[0], 16, y + 1);
      doc.text(String(item.quantity || 1), 120, y + 1);
      doc.text(fmt(item.unit_price || 0), 140, y + 1);
      doc.text(fmt(item.amount || 0), 174, y + 1);
      doc.text(fmt(item.tax_amount || 0), 192, y + 1);
    });

    // Totals
    y += 10;
    doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
    doc.line(120, y, 196, y);
    y += 8;

    const subtotal = parseFloat(inv.subtotal || 0);
    const taxAmount = parseFloat(inv.tax_amount || 0);
    const total = parseFloat(inv.total || 0);
    const paid = parseFloat(inv.paid_amount || 0);
    const due = total - paid;

    const totalsData = [
      ['Subtotal', fmt(subtotal)],
      ['Tax (' + (inv.tax_rate || 20) + '%)', fmt(taxAmount)],
      ['Total', fmt(total)],
      ['Paid', fmt(paid)],
      ['Amount Due', fmt(due)],
    ];

    totalsData.forEach(([label, value], idx) => {
      const isLast = idx === totalsData.length - 1;
      const isDue = idx === totalsData.length - 1;
      doc.setFontSize(9);
      if (isDue) {
        doc.setFillColor(AMBER[0], AMBER[1], AMBER[2]);
        doc.roundedRect(140, y - 4, 56, 9, 1, 1, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
        doc.setFont('helvetica', 'normal');
      }
      doc.text(label, 142, y + 2);
      doc.text(value, 192, y + 2, { align: 'right' });
      doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
      y += 10;
    });

    // Payment terms
    y += 5;
    if (inv.payment_terms) {
      doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
      doc.line(14, y, 196, y);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text('PAYMENT TERMS', 16, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
      const termLines = doc.splitTextToSize(inv.payment_terms, 168);
      doc.text(termLines.slice(0, 3), 16, y);
      y += 12;
    }

    // Bank details
    if (inv.bank_details) {
      doc.setFillColor(248, 248, 248);
      doc.rect(14, y, 182, 22, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text('BANK DETAILS', 16, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
      const bankLines = doc.splitTextToSize(inv.bank_details, 168);
      doc.text(bankLines.slice(0, 3), 16, y + 13);
    }

    // Footer
    doc.setFontSize(7.5);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('Generated by CortexBuild Ultimate — AI Construction Management', 105, 290, { align: 'center' });

    const filename = 'Invoice-' + (inv.invoice_number || inv.id) + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
    doc.output('arraybuffer').then(buffer => {
      res.send(Buffer.from(buffer));
    });
  } catch (err) {
    console.error('[reports] invoice pdf error:', err);
    res.status(500).json({ message: 'Failed to generate invoice PDF' });
  }
});

module.exports = router;