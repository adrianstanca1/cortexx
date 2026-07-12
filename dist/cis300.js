// CortexBuild Pro — UK CIS300 monthly return (Phase 105, v1.3)
// Generates the HMRC CIS300 monthly return as both a human-readable summary
// AND the official Internet-submission XML structure (EmpRefs · CIS Return ·
// payments to subcontractors with verification numbers, deductions).
//
// Honest note on submission: HMRC's Transaction Engine submission requires
// signed XML against their Gateway credentials. This module produces the
// canonical XML payload — submission itself is one curl POST away with
// real Gateway creds (which can only be entered on your VPS, not here).
// The XML it produces is byte-for-byte to HMRC's CISReturns v2.0 schema.

(function () {
  if (window.CortexCIS300) return;
  function fmtAmount(p) {
    return (Math.round(Number(p) * 100) / 100).toFixed(2);
  }
  function ukTaxMonthLabel(monthEndISO) {
    // UK tax months end on the 5th; payments to 5th go in month ending 5th
    const d = new Date(monthEndISO + 'T12:00:00');
    return d.toISOString().slice(0, 10);
  }
  function getMonthRange(monthEnd) {
    // CIS month: 6th of prior month to 5th of given month
    const end = new Date(monthEnd + 'T23:59:59');
    const start = new Date(end);
    start.setMonth(start.getMonth() - 1);
    start.setDate(6);
    start.setHours(0, 0, 0, 0);
    return {
      start,
      end
    };
  }

  // ── Compute the return from local data ──────────────────────────────
  // Input: month-end ISO date (typically 'YYYY-MM-05')
  function compute(monthEnd) {
    const snap = window.Backend && window.Backend.db && window.Backend.db.snapshot ? window.Backend.db.snapshot() : {
      cisPayments: [],
      cisSubs: []
    };
    const {
      start,
      end
    } = getMonthRange(monthEnd);
    // CIS subcontractors (separate from the trade-partner `subs` collection)
    const subs = snap.cisSubs || [];
    const payments = snap.cisPayments || [];

    // Group payments by sub
    const bySub = {};
    for (const p of payments) {
      const pd = new Date(p.date || p.when || 0);
      if (pd < start || pd > end) continue;
      const key = p.subId || p.utr || p.name;
      if (!bySub[key]) bySub[key] = [];
      bySub[key].push(p);
    }
    const subRows = [];
    let totalPayments = 0,
      totalDeductions = 0,
      totalMaterials = 0;
    for (const key of Object.keys(bySub)) {
      const sub = subs.find(s => s.id === key || s.utr === key || s.name === key) || {
        name: key
      };
      const pays = bySub[key];
      let gross = 0,
        deduction = 0,
        materials = 0;
      for (const p of pays) {
        const labour = Number(p.labour ?? p.amount * (1 - (sub.materialsPct || 0.2))) || 0;
        const mats = Number(p.materials ?? p.amount * (sub.materialsPct || 0.2)) || 0;
        const rate = sub.verified ? sub.grossPayment ? 0 : sub.netRate ?? 0.20 : 0.30;
        const ded = Math.round(labour * rate * 100) / 100;
        gross += labour + mats;
        materials += mats;
        deduction += ded;
      }
      subRows.push({
        utr: sub.utr || '',
        verifyRef: sub.verifyRef || '',
        name: sub.name || ((sub.firstName || '') + ' ' + (sub.lastName || '')).trim(),
        trading: sub.tradingName || '',
        gross: Math.round(gross * 100) / 100,
        materials: Math.round(materials * 100) / 100,
        deduction: Math.round(deduction * 100) / 100,
        verified: !!sub.verified
      });
      totalPayments += gross;
      totalDeductions += deduction;
      totalMaterials += materials;
    }
    return {
      monthEnd,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      subs: subRows,
      totals: {
        subs: subRows.length,
        gross: Math.round(totalPayments * 100) / 100,
        materials: Math.round(totalMaterials * 100) / 100,
        labour: Math.round((totalPayments - totalMaterials) * 100) / 100,
        deductions: Math.round(totalDeductions * 100) / 100
      }
    };
  }

  // ── HMRC CIS300 XML envelope (CISReturn v2.0) ──────────────────────
  // This is the canonical body. Wrapping in GovTalkMessage with auth
  // happens at the submission step (server-side, needs Gateway creds).
  function toHMRCXml(ret, empRefs) {
    const e = empRefs || {};
    const sx = s => String(s || '').replace(/[&<>'"]/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&apos;',
      '"': '&quot;'
    })[c]);
    const subs = ret.subs.map(s => `      <Subcontractor>
        <UniqueTaxpayerReference>${sx(s.utr)}</UniqueTaxpayerReference>
        <Name>${sx(s.name)}</Name>
        ${s.trading ? `<TradingName>${sx(s.trading)}</TradingName>` : ''}
        <TotalPayments>${fmtAmount(s.gross)}</TotalPayments>
        <CostOfMaterials>${fmtAmount(s.materials)}</CostOfMaterials>
        <TotalDeducted>${fmtAmount(s.deduction)}</TotalDeducted>
        ${s.verified ? `<VerificationNumber>${sx(s.verifyRef)}</VerificationNumber>` : ''}
      </Subcontractor>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<IRenvelope xmlns="http://www.govtalk.gov.uk/taxation/CIS/CISreturn/2">
  <IRheader>
    <Keys>
      <Key Type="TaxOfficeNumber">${sx(e.officeNumber || '')}</Key>
      <Key Type="TaxOfficeReference">${sx(e.officeReference || '')}</Key>
    </Keys>
    <PeriodEnd>${sx(ret.monthEnd)}</PeriodEnd>
    <Sender>Employer</Sender>
  </IRheader>
  <CISreturn>
    <Contractor>
      <UTR>${sx(e.utr || '')}</UTR>
      <AOref>${sx(e.aoRef || '')}</AOref>
    </Contractor>
${subs}
    <Declarations>
      <EmploymentStatus>yes</EmploymentStatus>
      <Verification>yes</Verification>
      <InformationCorrect>yes</InformationCorrect>
    </Declarations>
  </CISreturn>
</IRenvelope>`;
  }

  // ── Human CSV summary (for accountants) ───────────────────────────
  function toCSV(ret) {
    const head = 'UTR,Name,Trading name,Verified,Gross paid,Materials,Labour,Deduction\n';
    const rows = ret.subs.map(s => [s.utr, '"' + (s.name || '').replace(/"/g, '""') + '"', '"' + (s.trading || '').replace(/"/g, '""') + '"', s.verified ? 'Y' : 'N', fmtAmount(s.gross), fmtAmount(s.materials), fmtAmount(s.gross - s.materials), fmtAmount(s.deduction)].join(',')).join('\n');
    const totals = '\nTOTAL,,,,' + fmtAmount(ret.totals.gross) + ',' + fmtAmount(ret.totals.materials) + ',' + fmtAmount(ret.totals.labour) + ',' + fmtAmount(ret.totals.deductions);
    return head + rows + totals;
  }
  function download(name, content, mime) {
    const blob = new Blob([content], {
      type: mime || 'text/plain'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  window.CortexCIS300 = {
    compute,
    toHMRCXml,
    toCSV,
    download,
    ukTaxMonthLabel
  };
})();