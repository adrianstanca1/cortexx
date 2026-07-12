// Cortexx — Invoice / document PDF generator (Phase 89)
// Opens a print-ready window with a professional invoice; user saves as PDF.
(function () {
  if (window.cortexxInvoicePDF) return;
  const money = n => '£' + Number(n || 0).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  window.cortexxInvoicePDF = function (invoice) {
    const t = (window.CortexTenant ? window.CortexTenant.activeRecord() : null) || {
      name: 'CortexBuild Ltd',
      color: '#2563eb'
    };
    const accent = t.color || '#2563eb';
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    const due = invoice.due ? new Date(invoice.due).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }) : '—';
    const doctype = invoice.__doctype || 'INVOICE';
    const isQuote = doctype === 'QUOTATION';
    const dueLabel = isQuote ? 'Valid until' : 'Due';
    const net = Number(invoice.amount || 0);
    const vat = +(net * 0.20).toFixed(2);
    const gross = +(net + vat).toFixed(2);
    // line items — use invoice.items if present, else a single line
    const items = invoice.items && invoice.items.length ? invoice.items : [{
      desc: invoice.desc || `Construction works — ${invoice.client || 'client'}`,
      qty: 1,
      rate: net
    }];
    const rows = items.map(it => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee">${it.desc}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center">${it.qty || 1}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right">${money(it.rate)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right">${money((it.qty || 1) * it.rate)}</td>
      </tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${invoice.id || ''}</title>
    <style>
      @page { size: A4; margin: 18mm; }
      * { box-sizing: border-box; }
      body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; }
      .accent { color: ${accent}; }
      h1 { font-size: 34px; letter-spacing: -1px; margin: 0; }
      table { width: 100%; border-collapse: collapse; }
      .muted { color: #777; font-size: 12px; }
      .label { text-transform: uppercase; letter-spacing: 1px; font-size: 10px; color: #999; font-weight: 700; }
    </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${accent};padding-bottom:18px">
        <div>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:40px;height:40px;border-radius:9px;background:${accent};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px">${t.name[0]}</div>
            <h1>${t.name}</h1>
          </div>
          <div class="muted" style="margin-top:8px">Construction & Build · UK<br/>VAT Reg · CIS registered</div>
        </div>
        <div style="text-align:right">
          <div class="accent" style="font-size:26px;font-weight:800;letter-spacing:-0.5px">${doctype}</div>
          <div class="muted" style="margin-top:4px">${invoice.id || ''}</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;margin-top:24px">
        <div>
          <div class="label">Bill to</div>
          <div style="font-size:16px;font-weight:700;margin-top:4px">${invoice.client || 'Client'}</div>
          <div class="muted" style="margin-top:2px">${invoice.project || ''}</div>
        </div>
        <div style="text-align:right">
          <div class="label">Issued</div><div style="margin:2px 0 8px">${today}</div>
          <div class="label">${dueLabel}</div><div style="margin-top:2px">${due}</div>
        </div>
      </div>

      <table style="margin-top:28px">
        <thead>
          <tr style="background:#f7f7f7">
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#666">Description</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#666">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#666">Rate</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#666">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="display:flex;justify-content:flex-end;margin-top:20px">
        <table style="width:280px">
          <tr><td style="padding:6px 12px;color:#777">Subtotal</td><td style="padding:6px 12px;text-align:right">${money(net)}</td></tr>
          <tr><td style="padding:6px 12px;color:#777">VAT (20%)</td><td style="padding:6px 12px;text-align:right">${money(vat)}</td></tr>
          <tr style="border-top:2px solid ${accent}"><td style="padding:10px 12px;font-weight:800;font-size:16px">${isQuote ? 'Total' : 'Total due'}</td><td style="padding:10px 12px;text-align:right;font-weight:800;font-size:16px" class="accent">${money(gross)}</td></tr>
        </table>
      </div>

      <div style="margin-top:40px;padding-top:18px;border-top:1px solid #eee" class="muted">
        ${isQuote ? `<strong>Acceptance:</strong> This quotation is valid until the date shown. Prices exclude unforeseen works. To accept, reply confirming and we will schedule a start date.` : `<strong>Payment terms:</strong> Net 30 days. Please quote ${doctype.toLowerCase()} ${invoice.id || ''} with payment.<br/>Bank: ${t.name} · Sort 00-00-00 · Acc 00000000 · CIS deductions applied where applicable.`}
        <div style="margin-top:10px;color:#bbb">Generated by CortexBuild Pro · ${today}</div>
      </div>
      <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
    </body></html>`;
    const w = window.open('', '_blank');
    if (!w) {
      if (window.cortexxToast) window.cortexxToast('Allow pop-ups to export PDF', 'error');
      return;
    }
    w.document.write(html);
    w.document.close();
    if (window.CortexAudit) window.CortexAudit.log('You', `exported ${doctype.toLowerCase()} ${invoice.id || ''} as PDF`, 'Money');
  };

  // Quote PDF — reuses the same branded shell, "QUOTATION" + validity
  window.cortexxQuotePDF = function (quote) {
    const items = (quote.items || []).map(it => ({
      desc: it.d || it.desc || 'Item',
      qty: it.qty || 1,
      rate: it.rate || 0
    }));
    const net = items.length ? items.reduce((s, it) => s + it.qty * it.rate, 0) : Number(quote.total || 0);
    window.cortexxInvoicePDF({
      id: quote.id,
      client: quote.client,
      project: quote.title,
      amount: net,
      due: quote.validUntil,
      items,
      __doctype: 'QUOTATION'
    });
  };

  // Report PDF — KPI grid + AI narrative, branded A4
  window.cortexxReportPDF = function (report) {
    const t = (window.CortexTenant ? window.CortexTenant.activeRecord() : null) || {
      name: 'CortexBuild Ltd',
      color: '#2563eb'
    };
    const accent = t.color || '#2563eb';
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    const kpis = (report.kpis || []).map(k => `
      <div style="border:1px solid #eee;border-radius:10px;padding:14px 16px">
        <div style="text-transform:uppercase;letter-spacing:1px;font-size:10px;color:#999;font-weight:700">${k.l}</div>
        <div style="font-size:24px;font-weight:800;margin-top:4px;color:${accent}">${k.v}</div>
      </div>`).join('');
    const paras = (report.narrative || 'No narrative generated.').split('\n').filter(Boolean).map(p => `<p style="margin:0 0 12px;line-height:1.6;color:#333">${p}</p>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${report.title || 'Report'}</title>
    <style>
      @page { size: A4; margin: 18mm; }
      * { box-sizing: border-box; }
      body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; }
    </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${accent};padding-bottom:18px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:40px;height:40px;border-radius:9px;background:${accent};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px">${t.name[0]}</div>
          <div>
            <div style="font-size:24px;font-weight:800;letter-spacing:-0.5px">${t.name}</div>
            <div style="color:#777;font-size:12px;margin-top:2px">${report.title || 'Business report'} · ${today}</div>
          </div>
        </div>
        <div style="color:${accent};font-size:20px;font-weight:800;letter-spacing:-0.5px">REPORT</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:24px">${kpis}</div>

      <div style="margin-top:28px">
        <div style="text-transform:uppercase;letter-spacing:1px;font-size:11px;color:${accent};font-weight:800;margin-bottom:10px">Analysis</div>
        ${paras}
      </div>

      <div style="margin-top:40px;padding-top:18px;border-top:1px solid #eee;color:#bbb;font-size:11px">
        Generated by CortexBuild Pro · ${today} · ${t.name}
      </div>
      <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
    </body></html>`;
    const w = window.open('', '_blank');
    if (!w) {
      if (window.cortexxToast) window.cortexxToast('Allow pop-ups to export PDF', 'error');
      return;
    }
    w.document.write(html);
    w.document.close();
    if (window.CortexAudit) window.CortexAudit.log('You', `exported ${report.title || 'report'} as PDF`, 'Reports');
  };

  // Receipt PDF — issued after a payment is recorded. Green PAID stamp.
  window.cortexxReceiptPDF = function (payment) {
    const t = (window.CortexTenant ? window.CortexTenant.activeRecord() : null) || {
      name: 'CortexBuild Ltd',
      color: '#2563eb'
    };
    const accent = t.color || '#2563eb';
    const green = '#1f8a5b';
    const paid = new Date(payment.date || Date.now()).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    const methods = {
      transfer: 'Bank transfer',
      card: 'Card',
      cash: 'Cash',
      cheque: 'Cheque'
    };
    const receiptNo = 'RCP-' + String(payment.id || Date.now()).slice(-6);
    const amt = money(payment.amount);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${receiptNo}</title>
    <style>
      @page { size: A4; margin: 18mm; }
      * { box-sizing: border-box; }
      body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; }
      .label { text-transform: uppercase; letter-spacing: 1px; font-size: 10px; color: #999; font-weight: 700; }
    </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${accent};padding-bottom:18px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:40px;height:40px;border-radius:9px;background:${accent};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px">${t.name[0]}</div>
          <div>
            <div style="font-size:24px;font-weight:800;letter-spacing:-0.5px">${t.name}</div>
            <div style="color:#777;font-size:12px;margin-top:2px">Payment receipt · ${receiptNo}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="display:inline-block;border:3px solid ${green};color:${green};font-size:22px;font-weight:900;letter-spacing:2px;padding:6px 14px;border-radius:8px;transform:rotate(-6deg)">PAID</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;margin-top:28px">
        <div>
          <div class="label">Received from</div>
          <div style="font-size:18px;font-weight:700;margin-top:4px">${payment.client || 'Client'}</div>
          ${payment.invoiceId ? `<div style="color:#777;font-size:13px;margin-top:2px">Against ${payment.invoiceId}${payment.full ? '' : ' (part payment)'}</div>` : ''}
        </div>
        <div style="text-align:right">
          <div class="label">Date paid</div><div style="margin:2px 0 8px">${paid}</div>
          <div class="label">Method</div><div style="margin-top:2px">${methods[payment.method] || payment.method || '—'}${payment.ref ? ` · ${payment.ref}` : ''}</div>
        </div>
      </div>

      <div style="margin-top:32px;background:#f5fbf8;border:1px solid ${green}33;border-radius:14px;padding:22px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:15px;font-weight:700;color:#333">Amount received</div>
        <div style="font-size:30px;font-weight:900;color:${green};letter-spacing:-0.8px">${amt}</div>
      </div>

      <div style="margin-top:40px;padding-top:18px;border-top:1px solid #eee" class="label" >
        <span style="color:#aaa">Thank you. This receipt confirms payment in full as stated above. ${t.name} · Generated by CortexBuild Pro · ${paid}</span>
      </div>
      <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
    </body></html>`;
    const w = window.open('', '_blank');
    if (!w) {
      if (window.cortexxToast) window.cortexxToast('Allow pop-ups to export PDF', 'error');
      return;
    }
    w.document.write(html);
    w.document.close();
    if (window.CortexAudit) window.CortexAudit.log('You', `issued receipt ${receiptNo} (${amt})`, 'Money');
  };
})();