// Cortexx API — Server-side accounting ledger CSV
// Mirrors lib/screens-phase93.jsx so the export is identical whether the
// client builds it locally or the server streams it. Mounted at /api/ledger.

const express = require('express');

const VAT = 0.20;
const esc = (v) => { const s = (v == null ? '' : String(v)); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const row = (arr) => arr.map(esc).join(',');
const money = (n) => (Math.round(n * 100) / 100).toFixed(2);
const ddmmyyyy = (iso) => { const d = new Date(iso); return isNaN(d) ? (iso || '') : `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; };

function splitVat(gross, treatment) {
  if (treatment === 'zero' || treatment === 'cis') return { net: gross, vat: 0 };
  const net = gross / (1 + VAT);
  return { net, vat: gross - net };
}
const taxCode = {
  xero: { standard: '20% (VAT on Income)', zero: 'Zero Rated', cis: 'Domestic Reverse Charge' },
  xeroExp: { standard: '20% (VAT on Expenses)', zero: 'Zero Rated Expenses', cis: 'Domestic Reverse Charge' },
  sage: { standard: 'T1', zero: 'T0', cis: 'T21' },
  qb: { standard: 'Standard 20%', zero: 'Zero Rated 0%', cis: 'Reverse Charge CIS' },
};

module.exports = function ledgerRoutes(pool, auth) {
  const router = express.Router();

  // GET /api/ledger.csv?format=xero&vat=standard&from=ISO&to=ISO&sales=1&purchases=1
  router.get('/ledger.csv', auth, async (req, res) => {
    const ws = req.user.ws;
    const format = ['xero', 'qb', 'sage', 'generic'].includes(req.query.format) ? req.query.format : 'generic';
    const vat = ['standard', 'zero', 'cis'].includes(req.query.vat) ? req.query.vat : 'standard';
    const wantSales = req.query.sales !== '0';
    const wantPurch = req.query.purchases !== '0';
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    const inRange = (iso) => { if (!iso) return true; const d = new Date(iso); if (from && d < from) return false; if (to && d > to) return false; return true; };

    const projs = await pool.query('SELECT id, name FROM projects WHERE workspace_id=$1', [ws]);
    const projName = (id) => (projs.rows.find(p => String(p.id) === String(id)) || {}).name || '';

    const L = [];
    if (wantSales) {
      const invs = await pool.query('SELECT id, project_id, client, amount, status, issued, due FROM invoices WHERE workspace_id=$1', [ws]);
      for (const inv of invs.rows) {
        if (!inRange(inv.issued)) continue;
        const { net, vat: v } = splitVat(Number(inv.amount), vat);
        L.push({ kind: 'sale', date: inv.issued, due: inv.due, ref: inv.id, contact: inv.client, desc: `${projName(inv.project_id) || 'Project'} — works`, net, vat: v, gross: Number(inv.amount), status: inv.status, project: projName(inv.project_id) });
      }
    }
    if (wantPurch) {
      const rcts = await pool.query(`SELECT doc_id, data FROM documents_store WHERE workspace_id=$1 AND collection='receipts'`, [ws]);
      for (const r of rcts.rows) {
        const d = r.data;
        if (!inRange(d.date)) continue;
        const { net, vat: v } = splitVat(Number(d.amount), vat);
        L.push({ kind: 'purchase', date: d.date, due: d.date, ref: 'RCT-' + r.doc_id, contact: d.vendor, desc: `${d.category || 'expense'}`, net, vat: v, gross: Number(d.amount), status: d.assigned ? 'assigned' : 'unassigned', project: projName(d.projectId) });
      }
    }
    L.sort((a, b) => new Date(a.date) - new Date(b.date));

    let header, body;
    if (format === 'xero') {
      header = ['*ContactName','*InvoiceNumber','*InvoiceDate','*DueDate','Description','*Quantity','*UnitAmount','*AccountCode','*TaxType','Currency'];
      body = L.map(l => row([l.contact, l.ref, ddmmyyyy(l.date), ddmmyyyy(l.due), l.desc, '1', money(l.net), l.kind === 'sale' ? '200' : '300', (l.kind === 'sale' ? taxCode.xero : taxCode.xeroExp)[vat], 'GBP']));
    } else if (format === 'qb') {
      header = ['Date','Transaction Type','No.','Customer/Vendor','Description','Net','VAT','Total','VAT Code','Project'];
      body = L.map(l => row([ddmmyyyy(l.date), l.kind === 'sale' ? 'Invoice' : 'Expense', l.ref, l.contact, l.desc, money(l.net), money(l.vat), money(l.gross), taxCode.qb[vat], l.project]));
    } else if (format === 'sage') {
      header = ['Type','Account Reference','Nominal A/C Ref','Date','Reference','Details','Net Amount','Tax Code','Tax Amount'];
      body = L.map(l => row([l.kind === 'sale' ? 'SI' : 'PI', (l.contact || '').slice(0,8).toUpperCase().replace(/\s/g,''), l.kind === 'sale' ? '4000' : '5000', ddmmyyyy(l.date), l.ref, l.desc, money(l.net), taxCode.sage[vat], money(l.vat)]));
    } else {
      header = ['Date','Type','Reference','Name','Description','Net','VAT','Gross','Status','Project'];
      body = L.map(l => row([ddmmyyyy(l.date), l.kind === 'sale' ? 'Sales' : 'Purchase', l.ref, l.contact, l.desc, money(l.net), money(l.vat), money(l.gross), l.status, l.project]));
    }
    const csv = '\uFEFF' + [row(header)].concat(body).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cortexx-ledger-${format}-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  });

  return router;
};
