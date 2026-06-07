// Cortexx — Accounting ledger CSV export (Phase 93)
// Real Xero / QuickBooks / Sage-compatible CSV from live invoices + receipts.
// UK VAT-aware: standard 20%, zero-rated, or CIS domestic reverse charge.
//
// Each format profile emits the exact column headers that package expects on
// import, so the file drops straight into the accountant's software.

(function () {
  if (window.CortexLedger) return;
  const VAT = 0.20;
  const esc = v => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const row = arr => arr.map(esc).join(',');
  const money = n => (Math.round(n * 100) / 100).toFixed(2);
  const ddmmyyyy = iso => {
    const d = new Date(iso);
    return isNaN(d) ? iso : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  // Split a gross (VAT-inclusive) amount into net + VAT under a treatment.
  function splitVat(gross, treatment) {
    if (treatment === 'zero' || treatment === 'cis') return {
      net: gross,
      vat: 0
    };
    const net = gross / (1 + VAT);
    return {
      net,
      vat: gross - net
    };
  }
  const taxCode = {
    xero: {
      standard: '20% (VAT on Income)',
      zero: 'Zero Rated',
      cis: 'Domestic Reverse Charge'
    },
    xeroExp: {
      standard: '20% (VAT on Expenses)',
      zero: 'Zero Rated Expenses',
      cis: 'Domestic Reverse Charge'
    },
    sage: {
      standard: 'T1',
      zero: 'T0',
      cis: 'T21'
    },
    // T21 = CIS reverse charge (Sage)
    qb: {
      standard: 'Standard 20%',
      zero: 'Zero Rated 0%',
      cis: 'Reverse Charge CIS'
    }
  };

  // Build normalised ledger lines from live state.
  function lines(opts) {
    const s = window.Backend && window.Backend.db && window.Backend.db.snapshot ? window.Backend.db.snapshot() : {};
    const projName = id => {
      const p = (s.projects || []).find(x => x.id === id);
      return p ? p.name : '';
    };
    const out = [];
    const from = opts.from ? new Date(opts.from) : null;
    const to = opts.to ? new Date(opts.to) : null;
    const inRange = iso => {
      if (!iso) return true;
      const d = new Date(iso);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    };
    if (opts.sales) {
      (s.invoices || []).forEach(inv => {
        if (!inRange(inv.issued)) return;
        const {
          net,
          vat
        } = splitVat(inv.amount, opts.vat);
        out.push({
          kind: 'sale',
          date: inv.issued,
          due: inv.due,
          ref: inv.id,
          contact: inv.client,
          desc: `${projName(inv.projectId) || 'Project'} — works`,
          net,
          vat,
          gross: inv.amount,
          status: inv.status,
          project: projName(inv.projectId)
        });
      });
    }
    if (opts.purchases) {
      (s.receipts || []).forEach(r => {
        if (!inRange(r.date)) return;
        const {
          net,
          vat
        } = splitVat(r.amount, opts.vat);
        out.push({
          kind: 'purchase',
          date: r.date,
          due: r.date,
          ref: 'RCT-' + r.id,
          contact: r.vendor,
          desc: `${r.category || 'expense'}${projName(r.projectId) ? ' — ' + projName(r.projectId) : ''}`,
          net,
          vat,
          gross: r.amount,
          status: r.assigned ? 'assigned' : 'unassigned',
          project: projName(r.projectId)
        });
      });
    }
    out.sort((a, b) => new Date(a.date) - new Date(b.date));
    return out;
  }
  function toCSV(format, opts) {
    const L = lines(opts);
    let header, body;
    if (format === 'xero') {
      header = ['*ContactName', '*InvoiceNumber', '*InvoiceDate', '*DueDate', 'Description', '*Quantity', '*UnitAmount', '*AccountCode', '*TaxType', 'Currency'];
      body = L.map(l => {
        const sale = l.kind === 'sale';
        const tt = (sale ? taxCode.xero : taxCode.xeroExp)[opts.vat] || '';
        const acct = sale ? '200' : '300'; // 200 sales, 300 cost of goods
        return row([l.contact, l.ref, ddmmyyyy(l.date), ddmmyyyy(l.due), l.desc, '1', money(l.net), acct, tt, 'GBP']);
      });
    } else if (format === 'qb') {
      header = ['Date', 'Transaction Type', 'No.', 'Customer/Vendor', 'Description', 'Net', 'VAT', 'Total', 'VAT Code', 'Project'];
      body = L.map(l => row([ddmmyyyy(l.date), l.kind === 'sale' ? 'Invoice' : 'Expense', l.ref, l.contact, l.desc, money(l.net), money(l.vat), money(l.gross), taxCode.qb[opts.vat] || '', l.project]));
    } else if (format === 'sage') {
      // Sage 50 audit-trail import layout
      header = ['Type', 'Account Reference', 'Nominal A/C Ref', 'Date', 'Reference', 'Details', 'Net Amount', 'Tax Code', 'Tax Amount'];
      body = L.map(l => {
        const sale = l.kind === 'sale';
        return row([sale ? 'SI' : 'PI', (l.contact || '').slice(0, 8).toUpperCase().replace(/\s/g, ''), sale ? '4000' : '5000', ddmmyyyy(l.date), l.ref, l.desc, money(l.net), taxCode.sage[opts.vat] || 'T1', money(l.vat)]);
      });
    } else {
      // generic
      header = ['Date', 'Type', 'Reference', 'Name', 'Description', 'Net', 'VAT', 'Gross', 'Status', 'Project'];
      body = L.map(l => row([ddmmyyyy(l.date), l.kind === 'sale' ? 'Sales' : 'Purchase', l.ref, l.contact, l.desc, money(l.net), money(l.vat), money(l.gross), l.status, l.project]));
    }
    return {
      csv: [row(header)].concat(body).join('\r\n'),
      count: L.length,
      lines: L
    };
  }
  function summary(opts) {
    const L = lines(opts);
    const sales = L.filter(l => l.kind === 'sale');
    const purch = L.filter(l => l.kind === 'purchase');
    const sum = (a, k) => a.reduce((t, x) => t + x[k], 0);
    return {
      count: L.length,
      salesCount: sales.length,
      purchCount: purch.length,
      salesNet: sum(sales, 'net'),
      salesVat: sum(sales, 'vat'),
      salesGross: sum(sales, 'gross'),
      purchNet: sum(purch, 'net'),
      purchVat: sum(purch, 'vat'),
      purchGross: sum(purch, 'gross'),
      vatDue: sum(sales, 'vat') - sum(purch, 'vat')
    };
  }
  function download(format, opts) {
    const {
      csv,
      count
    } = toCSV(format, opts);
    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cortexx-ledger-${format}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (window.CortexAudit) window.CortexAudit.log('You', `exported ${count} ledger lines as ${format.toUpperCase()} CSV`, 'Settings');
    return count;
  }
  window.CortexLedger = {
    toCSV,
    summary,
    download,
    lines
  };
})();
function LedgerExportScreen({
  accent
}) {
  const [format, setFormat] = React.useState('xero');
  const [vat, setVat] = React.useState('standard');
  const [range, setRange] = React.useState('fy');
  const [sales, setSales] = React.useState(true);
  const [purchases, setPurchases] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const rangeBounds = React.useMemo(() => {
    const now = new Date('2026-06-06');
    if (range === 'all') return {
      from: null,
      to: null
    };
    if (range === 'month') return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
      to: null
    };
    if (range === 'quarter') {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return {
        from: new Date(now.getFullYear(), q, 1).toISOString().slice(0, 10),
        to: null
      };
    }
    // UK financial year starts 6 April
    const fyStart = now.getMonth() > 3 || now.getMonth() === 3 && now.getDate() >= 6 ? new Date(now.getFullYear(), 3, 6) : new Date(now.getFullYear() - 1, 3, 6);
    return {
      from: fyStart.toISOString().slice(0, 10),
      to: null
    };
  }, [range]);
  const opts = {
    ...rangeBounds,
    vat,
    sales,
    purchases
  };
  const sum = React.useMemo(() => window.CortexLedger.summary(opts), [vat, range, sales, purchases]);
  const preview = React.useMemo(() => window.CortexLedger.toCSV(format, opts), [format, vat, range, sales, purchases]);
  const FORMATS = [{
    k: 'xero',
    l: 'Xero',
    d: 'Sales invoice import template'
  }, {
    k: 'qb',
    l: 'QuickBooks',
    d: 'Transaction list with VAT'
  }, {
    k: 'sage',
    l: 'Sage 50',
    d: 'Audit-trail import layout'
  }, {
    k: 'generic',
    l: 'Generic',
    d: 'Plain columns, any tool'
  }];
  const VATS = [{
    k: 'standard',
    l: 'Standard 20%'
  }, {
    k: 'zero',
    l: 'Zero-rated'
  }, {
    k: 'cis',
    l: 'CIS reverse charge'
  }];
  const RANGES = [{
    k: 'month',
    l: 'This month'
  }, {
    k: 'quarter',
    l: 'This quarter'
  }, {
    k: 'fy',
    l: 'This FY'
  }, {
    k: 'all',
    l: 'All time'
  }];
  const gbp = n => '£' + (n || 0).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const doExport = () => {
    if (!sales && !purchases) {
      window.cortexxToast && window.cortexxToast('Select sales or purchases', 'error');
      return;
    }
    if (sum.count === 0) {
      window.cortexxToast && window.cortexxToast('No records in this range', 'error');
      return;
    }
    setBusy(true);
    setTimeout(() => {
      const n = window.CortexLedger.download(format, opts);
      setBusy(false);
      window.cortexxToast && window.cortexxToast(`${n} lines exported — ${format.toUpperCase()} CSV`, 'success');
    }, 400);
  };
  const Chip = ({
    active,
    onClick,
    children
  }) => /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      padding: '8px 14px',
      borderRadius: 10,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      background: active ? accent : T.bg2,
      color: active ? '#fff' : T.t2,
      border: `0.5px solid ${active ? accent : T.hairMid}`,
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600
    }
  }, children);
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Ledger export",
    subtitle: "Accountant-ready CSV \xB7 Xero \xB7 QuickBooks \xB7 Sage"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700,
      color: T.t3,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      margin: '6px 2px 8px'
    }
  }, "Accounting package"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, FORMATS.map(f => /*#__PURE__*/React.createElement("button", {
    key: f.k,
    onClick: () => setFormat(f.k),
    style: {
      background: T.bg2,
      border: `0.5px solid ${format === f.k ? accent : T.hair}`,
      borderRadius: 12,
      padding: 13,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      color: T.t1
    }
  }, f.l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, f.d)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 20,
      height: 20,
      borderRadius: 10,
      border: `1.5px solid ${format === f.k ? accent : T.hairMid}`,
      background: format === f.k ? accent : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, format === f.k && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 4,
      background: '#fff'
    }
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700,
      color: T.t3,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      margin: '18px 2px 8px'
    }
  }, "Include"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, [{
    k: 'sales',
    on: sales,
    set: setSales,
    l: 'Sales invoices',
    c: sum.salesCount
  }, {
    k: 'purch',
    on: purchases,
    set: setPurchases,
    l: 'Purchase receipts',
    c: sum.purchCount
  }].map(x => /*#__PURE__*/React.createElement("button", {
    key: x.k,
    onClick: () => x.set(v => !v),
    style: {
      flex: 1,
      background: x.on ? `${accent}1a` : T.bg2,
      border: `0.5px solid ${x.on ? accent : T.hair}`,
      borderRadius: 12,
      padding: '12px 10px',
      cursor: 'pointer',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      color: x.on ? T.t1 : T.t2
    }
  }, x.l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 11,
      color: x.on ? accent : T.t3,
      marginTop: 2
    }
  }, x.c, " record", x.c === 1 ? '' : 's')))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700,
      color: T.t3,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      margin: '18px 2px 8px'
    }
  }, "VAT treatment"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      overflowX: 'auto',
      paddingBottom: 2
    }
  }, VATS.map(v => /*#__PURE__*/React.createElement(Chip, {
    key: v.k,
    active: vat === v.k,
    onClick: () => setVat(v.k)
  }, v.l))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700,
      color: T.t3,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      margin: '18px 2px 8px'
    }
  }, "Period"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      overflowX: 'auto',
      paddingBottom: 2
    }
  }, RANGES.map(r => /*#__PURE__*/React.createElement(Chip, {
    key: r.k,
    active: range === r.k,
    onClick: () => setRange(r.k)
  }, r.l))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 14,
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12
    }
  }, "Export summary"), sales && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '7px 0',
      borderBottom: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t2
    }
  }, "Sales (net / VAT)"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 13,
      color: T.t1,
      fontWeight: 600
    }
  }, gbp(sum.salesNet), " / ", gbp(sum.salesVat))), purchases && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '7px 0',
      borderBottom: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t2
    }
  }, "Purchases (net / VAT)"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 13,
      color: T.t1,
      fontWeight: 600
    }
  }, gbp(sum.purchNet), " / ", gbp(sum.purchVat))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '10px 0 2px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      fontWeight: 700
    }
  }, vat === 'cis' ? 'VAT (reverse charge)' : 'Net VAT due to HMRC'), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 14,
      color: vat === 'cis' ? T.t2 : sum.vatDue >= 0 ? T.amber : T.green,
      fontWeight: 700
    }
  }, vat === 'cis' ? '£0.00' : gbp(sum.vatDue)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      background: T.bg0,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 12,
      padding: 12,
      overflowX: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t3,
      whiteSpace: 'pre',
      lineHeight: 1.7
    }
  }, preview.csv.split('\r\n').slice(0, 4).join('\n') || 'No data', preview.count > 3 ? `\n… +${preview.count - 3} more line${preview.count - 3 === 1 ? '' : 's'}` : '')), /*#__PURE__*/React.createElement("button", {
    onClick: doExport,
    disabled: busy,
    style: {
      width: '100%',
      marginTop: 16,
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 13,
      padding: '15px',
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 700,
      cursor: busy ? 'default' : 'pointer',
      opacity: busy ? 0.6 : 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8
    }
  }, React.cloneElement(Ic.download, {
    size: 16
  }), " ", busy ? 'Generating…' : `Export ${preview.count} line${preview.count === 1 ? '' : 's'} · ${FORMATS.find(f => f.k === format).l}`), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      padding: 12,
      background: T.bg2,
      borderRadius: 10,
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      lineHeight: 1.5,
      display: 'flex',
      gap: 8
    }
  }, React.cloneElement(Ic.shield, {
    size: 14,
    color: T.green
  }), /*#__PURE__*/React.createElement("span", null, "UTF-8 BOM + CRLF so Excel and accounting tools parse columns cleanly. CIS reverse charge sets output VAT to \xA30 and tags lines with the reverse-charge code your package expects.")))));
}
Object.assign(window, {
  LedgerExportScreen
});