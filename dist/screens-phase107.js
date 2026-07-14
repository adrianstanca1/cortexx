// CortexBuild Pro — Retention Ledger + per-invoice settings (Phase 107)
// Built on lib/retention.js — see that file for the core engine.

// ════════════════════════════════════════════════════════════════════
// PER-INVOICE RETENTION SHEET
// ════════════════════════════════════════════════════════════════════
function RetentionSheet({
  accent,
  invoiceId,
  onClose
}) {
  const invoices = useDB('invoices');
  const inv = invoices.find(i => i.id === invoiceId);
  const R = window.CortexRetention;
  const [pct, setPct] = React.useState(inv ? (inv.retentionPct || 0) * 100 : 5);
  const [pcDate, setPcDate] = React.useState(inv?.pcDate || '');
  const [defectsDays, setDefectsDays] = React.useState(inv?.defectsPeriodDays || 365);
  const [releaseAmt, setReleaseAmt] = React.useState('');
  if (!inv) return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: T.t2
    }
  }, "Invoice not found."));
  if (!R) return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: T.t2
    }
  }, "Retention engine not loaded."));
  const enriched = R.withRetention({
    ...inv,
    retentionPct: pct / 100,
    pcDate,
    defectsPeriodDays: defectsDays
  });
  const save = async () => {
    await R.setPct(inv.id, pct / 100, {
      pcDate,
      defectsPeriodDays: Number(defectsDays)
    });
    if (window.cortexxToast) window.cortexxToast('Retention set: ' + pct + '%', 'success');
    onClose && onClose();
  };
  const release = async kind => {
    const amt = releaseAmt ? Number(releaseAmt) : null;
    await R.release(inv.id, kind, amt);
    setReleaseAmt('');
    if (window.cortexxToast) window.cortexxToast('Released ' + (amt ? '£' + amt.toLocaleString() : 'all outstanding'), 'success');
    onClose && onClose();
  };
  const PRESET = [0, 1.5, 2.5, 3, 5, 10];
  const fmt = n => '£' + (Number(n) || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
  const Stat = ({
    l,
    v,
    c
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 10,
      borderRadius: 8,
      background: T.bg1,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: T.t2,
      marginBottom: 2
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: c || T.t1,
      fontFamily: SFMono
    }
  }, v));
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Retention",
    subtitle: inv.id + ' · ' + (inv.client || '') + ' · £' + (inv.amount || 0).toLocaleString()
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 18px 110px',
      fontFamily: SF
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    l: "INVOICE TOTAL",
    v: fmt(inv.amount)
  }), /*#__PURE__*/React.createElement(Stat, {
    l: "PAYABLE NOW",
    v: fmt(enriched.payableNow),
    c: T.green
  }), /*#__PURE__*/React.createElement(Stat, {
    l: "HELD BACK",
    v: fmt(enriched.retentionAmount),
    c: T.amber
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "RETENTION %"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 8,
      flexWrap: 'wrap'
    }
  }, PRESET.map(p => /*#__PURE__*/React.createElement("button", {
    key: p,
    onClick: () => setPct(p),
    style: {
      flex: '1 1 60px',
      padding: '10px 6px',
      borderRadius: 10,
      border: '1px solid ' + (pct === p ? accent : T.hair),
      background: pct === p ? accent + '22' : T.bg2,
      color: T.t1,
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 700
    }
  }, p, "%"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    max: "20",
    step: "0.5",
    value: pct,
    onChange: e => setPct(Number(e.target.value)),
    style: {
      width: 90,
      padding: 10,
      borderRadius: 8,
      border: '1px solid ' + T.hair,
      background: T.bg1,
      color: T.t1,
      fontFamily: SFMono,
      fontSize: 14,
      textAlign: 'center'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: T.t2
    }
  }, "Custom % (UK typical: 3\u20135%, max usually 10%)")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "RELEASE SCHEDULE"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 11,
      color: T.t2,
      marginBottom: 4
    }
  }, "Practical completion date (50% released)"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: pcDate,
    onChange: e => setPcDate(e.target.value),
    style: {
      width: '100%',
      padding: 10,
      borderRadius: 8,
      border: '1px solid ' + T.hair,
      background: T.bg1,
      color: T.t1,
      fontFamily: SFMono,
      fontSize: 13,
      boxSizing: 'border-box'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 11,
      color: T.t2,
      marginBottom: 4
    }
  }, "Defects liability period (days)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: defectsDays,
    onChange: e => setDefectsDays(e.target.value),
    style: {
      width: '100%',
      padding: 10,
      borderRadius: 8,
      border: '1px solid ' + T.hair,
      background: T.bg1,
      color: T.t1,
      fontFamily: SFMono,
      fontSize: 13,
      boxSizing: 'border-box'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.t2,
      marginTop: 4
    }
  }, pcDate && /*#__PURE__*/React.createElement(React.Fragment, null, "Final release: ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: T.t1
    }
  }, (() => {
    const d = new Date(pcDate);
    d.setDate(d.getDate() + Number(defectsDays));
    return d.toISOString().slice(0, 10);
  })())))), /*#__PURE__*/React.createElement("button", {
    onClick: save,
    style: {
      marginTop: 16,
      width: '100%',
      padding: 14,
      borderRadius: 12,
      border: 'none',
      background: accent,
      color: '#fff',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700
    }
  }, "Save retention settings"), (inv.retentionPct || 0) > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6,
      marginBottom: 8
    }
  }, "RELEASE RETENTION"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8,
      fontSize: 12,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.t2
    }
  }, "Currently released"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontFamily: SFMono
    }
  }, fmt(inv.retentionReleased || 0))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.t2
    }
  }, "Still outstanding"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontFamily: SFMono,
      color: T.amber
    }
  }, fmt(enriched.retentionOutstanding)))), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: releaseAmt,
    onChange: e => setReleaseAmt(e.target.value),
    placeholder: "Amount (blank = all outstanding)",
    style: {
      width: '100%',
      padding: 10,
      borderRadius: 8,
      border: '1px solid ' + T.hair,
      background: T.bg1,
      color: T.t1,
      fontFamily: SFMono,
      fontSize: 13,
      boxSizing: 'border-box'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => release('pc'),
    style: {
      flex: 1,
      padding: 12,
      borderRadius: 10,
      border: '1px solid ' + T.hair,
      background: T.bg1,
      color: T.t1,
      fontSize: 13,
      fontWeight: 600
    }
  }, "Release at PC"), /*#__PURE__*/React.createElement("button", {
    onClick: () => release('final'),
    style: {
      flex: 1,
      padding: 12,
      borderRadius: 10,
      border: 'none',
      background: T.green,
      color: '#fff',
      fontSize: 13,
      fontWeight: 700
    }
  }, "Release (final)")))));
}

// ════════════════════════════════════════════════════════════════════
// RETENTION LEDGER — aggregate view of ALL held-back retention
// ════════════════════════════════════════════════════════════════════
function RetentionLedgerScreen({
  accent
}) {
  const invoices = useDB('invoices');
  const projects = useDB('projects');
  const R = window.CortexRetention;
  if (!R) return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: T.t2
    }
  }, "Retention engine not loaded."));
  const led = R.ledger(invoices, projects);
  const fmt = n => '£' + (Number(n) || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0
  });
  const remindAll = () => {
    // Push a notification + activity entry per upcoming release
    const upcoming = led.upcoming.filter(u => !u.overdue || u.overdue);
    let n = 0;
    upcoming.forEach(u => {
      try {
        if (window.Backend.db.activity && window.Backend.db.activity.create) {
          window.Backend.db.activity.create({
            id: 'act-rmnd-' + u.invoice + '-' + Date.now() + '-' + n,
            t: 'Retention reminder',
            sub: fmt(u.amount) + ' due from ' + (u.client || u.invoice) + ' on ' + u.dueDate + ' (' + u.kind + ')',
            when: 'now',
            icon: '🔔',
            kind: 'reminder'
          });
        }
        if (window.Backend.db.notifications && window.Backend.db.notifications.create) {
          window.Backend.db.notifications.create({
            id: 'notif-rmnd-' + u.invoice + '-' + Date.now() + '-' + n,
            title: 'Retention ' + (u.overdue ? 'OVERDUE' : 'reminder'),
            body: fmt(u.amount) + ' due from ' + (u.client || u.invoice) + ' on ' + u.dueDate,
            kind: 'reminder',
            read: false
          });
        }
        n++;
      } catch (e) {}
    });
    if (window.cortexxToast) window.cortexxToast('Reminded all ' + n + ' upcoming release' + (n === 1 ? '' : 's'), 'success');
  };
  const navInv = id => {
    window.__cortexxRetentionInv = id;
    if (window.cortexxNav) window.cortexxNav('retentioninv');
  };
  const RowCard = ({
    children,
    onClick,
    accent: accentCol
  }) => /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      marginTop: 8,
      padding: 12,
      borderRadius: 10,
      background: T.bg2,
      border: '1px solid ' + (accentCol || T.hair),
      cursor: onClick ? 'pointer' : 'default'
    }
  }, children);
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Retention ledger",
    subtitle: "All held-back retention across projects"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 18px 110px',
      fontFamily: SF
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      padding: 16,
      borderRadius: 14,
      background: 'linear-gradient(135deg, ' + accent + '22, ' + T.bg2 + ')',
      border: '1px solid ' + T.hair
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6,
      marginBottom: 6
    }
  }, "OUTSTANDING RETENTION"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 30,
      fontWeight: 800,
      fontFamily: SFMono,
      color: T.amber,
      letterSpacing: -0.5
    }
  }, fmt(led.totals.outstanding)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      display: 'flex',
      gap: 16,
      fontSize: 11,
      color: T.t2
    }
  }, /*#__PURE__*/React.createElement("span", null, "Held: ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      color: T.t1
    }
  }, fmt(led.totals.held))), /*#__PURE__*/React.createElement("span", null, "Released: ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      color: T.green
    }
  }, fmt(led.totals.released))), /*#__PURE__*/React.createElement("span", null, led.rows.length, " invoice", led.rows.length === 1 ? '' : 's'))), led.upcoming.length === 0 && led.rows.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      textAlign: 'center',
      color: T.t2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 40,
      marginBottom: 10
    }
  }, "\uD83E\uDE99"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: T.t1
    }
  }, "No retention held yet"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      marginTop: 4
    }
  }, "Open an invoice and set a retention % to start tracking.")), led.upcoming.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 22,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "UPCOMING RELEASES \xB7 ", led.upcoming.length), /*#__PURE__*/React.createElement("button", {
    onClick: remindAll,
    style: {
      padding: '6px 12px',
      borderRadius: 8,
      border: '1px solid ' + T.hair,
      background: accent,
      color: '#fff',
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.4,
      textTransform: 'uppercase'
    }
  }, "\uD83D\uDD14 Remind all")), led.upcoming.slice(0, 10).map((u, i) => /*#__PURE__*/React.createElement(RowCard, {
    key: i,
    accent: u.overdue ? T.red + '60' : null,
    onClick: () => navInv(u.invoice)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: T.t1
    }
  }, u.invoice, " \xB7 ", u.client || '—'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.t2,
      marginTop: 2
    }
  }, u.kind)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right',
      marginLeft: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: u.overdue ? T.red : T.t1,
      fontFamily: SFMono
    }
  }, fmt(u.amount)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: u.overdue ? T.red : T.t2,
      fontFamily: SFMono,
      marginTop: 2
    }
  }, u.overdue ? 'OVERDUE · ' : '', u.dueDate))))), led.upcoming.length > 10 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 11,
      color: T.t2,
      textAlign: 'center'
    }
  }, "\u2026 and ", led.upcoming.length - 10, " more")), led.byProject.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "BY PROJECT"), led.byProject.map(p => /*#__PURE__*/React.createElement(RowCard, {
    key: p.projectId || 'unassigned'
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: T.t1
    }
  }, p.projectName || 'Project ' + p.projectId), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.t2,
      marginTop: 2
    }
  }, p.invoiceCount, " invoice", p.invoiceCount === 1 ? '' : 's')), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: T.amber,
      fontFamily: SFMono
    }
  }, fmt(p.totalHeld - p.totalReleased)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: T.t2,
      fontFamily: SFMono,
      marginTop: 2
    }
  }, "of ", fmt(p.totalHeld))))))), led.rows.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "ALL INVOICES WITH RETENTION"), led.rows.map(r => /*#__PURE__*/React.createElement(RowCard, {
    key: r.id,
    onClick: () => navInv(r.id)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: T.t1
    }
  }, r.id, " \xB7 ", r.client || '—'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.t2,
      marginTop: 2
    }
  }, (r.retentionPct * 100).toFixed(1), "% of ", fmt(r.amount), " \xB7", /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 6,
      padding: '1px 6px',
      borderRadius: 4,
      background: r.retentionStatus === 'final_released' ? T.green + '30' : r.retentionStatus === 'pc_released' ? T.amber + '30' : T.bg1,
      color: r.retentionStatus === 'final_released' ? T.green : r.retentionStatus === 'pc_released' ? T.amber : T.t2,
      fontFamily: SFMono,
      fontSize: 9,
      letterSpacing: 0.4
    }
  }, (r.retentionStatus || 'held').toUpperCase().replace('_', ' ')))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: T.amber,
      fontFamily: SFMono
    }
  }, fmt(r.retentionOutstanding)))))))));
}
Object.assign(window, {
  RetentionSheet,
  RetentionLedgerScreen
});