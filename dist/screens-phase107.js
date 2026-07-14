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
  if (!inv) return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: T.t2
    }
  }, "Invoice not found."));
  if (!R) return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
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
  }) => React.createElement("div", {
    style: {
      flex: 1,
      padding: 10,
      borderRadius: 8,
      background: T.bg1,
      textAlign: 'center'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10,
      color: T.t2,
      marginBottom: 2
    }
  }, l), React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: c || T.t1,
      fontFamily: SFMono
    }
  }, v));
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement(MobileHeader, {
    title: "Retention",
    subtitle: inv.id + ' · ' + (inv.client || '') + ' · £' + (inv.amount || 0).toLocaleString()
  }), React.createElement("div", {
    style: {
      padding: '0 18px 110px',
      fontFamily: SF
    }
  }, React.createElement("div", {
    style: {
      marginTop: 14,
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, React.createElement(Stat, {
    l: "INVOICE TOTAL",
    v: fmt(inv.amount)
  }), React.createElement(Stat, {
    l: "PAYABLE NOW",
    v: fmt(enriched.payableNow),
    c: T.green
  }), React.createElement(Stat, {
    l: "HELD BACK",
    v: fmt(enriched.retentionAmount),
    c: T.amber
  }))), React.createElement("div", {
    style: {
      marginTop: 18,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "RETENTION %"), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 8,
      flexWrap: 'wrap'
    }
  }, PRESET.map(p => React.createElement("button", {
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
  }, p, "%"))), React.createElement("div", {
    style: {
      marginTop: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement("input", {
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
  }), React.createElement("span", {
    style: {
      fontSize: 12,
      color: T.t2
    }
  }, "Custom % (UK typical: 3\u20135%, max usually 10%)")), React.createElement("div", {
    style: {
      marginTop: 18,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "RELEASE SCHEDULE"), React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 11,
      color: T.t2,
      marginBottom: 4
    }
  }, "Practical completion date (50% released)"), React.createElement("input", {
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
  })), React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 11,
      color: T.t2,
      marginBottom: 4
    }
  }, "Defects liability period (days)"), React.createElement("input", {
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
  }), React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.t2,
      marginTop: 4
    }
  }, pcDate && React.createElement(React.Fragment, null, "Final release: ", React.createElement("strong", {
    style: {
      color: T.t1
    }
  }, (() => {
    const d = new Date(pcDate);
    d.setDate(d.getDate() + Number(defectsDays));
    return d.toISOString().slice(0, 10);
  })())))), React.createElement("button", {
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
  }, "Save retention settings"), (inv.retentionPct || 0) > 0 && React.createElement("div", {
    style: {
      marginTop: 22,
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6,
      marginBottom: 8
    }
  }, "RELEASE RETENTION"), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8,
      fontSize: 12,
      marginBottom: 10
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      color: T.t2
    }
  }, "Currently released"), React.createElement("div", {
    style: {
      fontWeight: 700,
      fontFamily: SFMono
    }
  }, fmt(inv.retentionReleased || 0))), React.createElement("div", null, React.createElement("div", {
    style: {
      color: T.t2
    }
  }, "Still outstanding"), React.createElement("div", {
    style: {
      fontWeight: 700,
      fontFamily: SFMono,
      color: T.amber
    }
  }, fmt(enriched.retentionOutstanding)))), React.createElement("input", {
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
  }), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 10
    }
  }, React.createElement("button", {
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
  }, "Release at PC"), React.createElement("button", {
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
function RetentionLedgerScreen({
  accent
}) {
  const invoices = useDB('invoices');
  const projects = useDB('projects');
  const R = window.CortexRetention;
  if (!R) return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
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
  }) => React.createElement("div", {
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
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement(MobileHeader, {
    title: "Retention ledger",
    subtitle: "All held-back retention across projects"
  }), React.createElement("div", {
    style: {
      padding: '0 18px 110px',
      fontFamily: SF
    }
  }, React.createElement("div", {
    style: {
      marginTop: 14,
      padding: 16,
      borderRadius: 14,
      background: 'linear-gradient(135deg, ' + accent + '22, ' + T.bg2 + ')',
      border: '1px solid ' + T.hair
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6,
      marginBottom: 6
    }
  }, "OUTSTANDING RETENTION"), React.createElement("div", {
    style: {
      fontSize: 30,
      fontWeight: 800,
      fontFamily: SFMono,
      color: T.amber,
      letterSpacing: -0.5
    }
  }, fmt(led.totals.outstanding)), React.createElement("div", {
    style: {
      marginTop: 8,
      display: 'flex',
      gap: 16,
      fontSize: 11,
      color: T.t2
    }
  }, React.createElement("span", null, "Held: ", React.createElement("span", {
    style: {
      fontWeight: 700,
      color: T.t1
    }
  }, fmt(led.totals.held))), React.createElement("span", null, "Released: ", React.createElement("span", {
    style: {
      fontWeight: 700,
      color: T.green
    }
  }, fmt(led.totals.released))), React.createElement("span", null, led.rows.length, " invoice", led.rows.length === 1 ? '' : 's'))), led.upcoming.length === 0 && led.rows.length === 0 && React.createElement("div", {
    style: {
      marginTop: 24,
      textAlign: 'center',
      color: T.t2
    }
  }, React.createElement("div", {
    style: {
      fontSize: 40,
      marginBottom: 10
    }
  }, "\uD83E\uDE99"), React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: T.t1
    }
  }, "No retention held yet"), React.createElement("div", {
    style: {
      fontSize: 12,
      marginTop: 4
    }
  }, "Open an invoice and set a retention % to start tracking.")), led.upcoming.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 22,
      marginBottom: 8
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "UPCOMING RELEASES \xB7 ", led.upcoming.length), React.createElement("button", {
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
  }, "\uD83D\uDD14 Remind all")), led.upcoming.slice(0, 10).map((u, i) => React.createElement(RowCard, {
    key: i,
    accent: u.overdue ? T.red + '60' : null,
    onClick: () => navInv(u.invoice)
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: T.t1
    }
  }, u.invoice, " \xB7 ", u.client || '—'), React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.t2,
      marginTop: 2
    }
  }, u.kind)), React.createElement("div", {
    style: {
      textAlign: 'right',
      marginLeft: 10
    }
  }, React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: u.overdue ? T.red : T.t1,
      fontFamily: SFMono
    }
  }, fmt(u.amount)), React.createElement("div", {
    style: {
      fontSize: 11,
      color: u.overdue ? T.red : T.t2,
      fontFamily: SFMono,
      marginTop: 2
    }
  }, u.overdue ? 'OVERDUE · ' : '', u.dueDate))))), led.upcoming.length > 10 && React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 11,
      color: T.t2,
      textAlign: 'center'
    }
  }, "\u2026 and ", led.upcoming.length - 10, " more")), led.byProject.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      marginTop: 22,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "BY PROJECT"), led.byProject.map(p => React.createElement(RowCard, {
    key: p.projectId || 'unassigned'
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: T.t1
    }
  }, p.projectName || 'Project ' + p.projectId), React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.t2,
      marginTop: 2
    }
  }, p.invoiceCount, " invoice", p.invoiceCount === 1 ? '' : 's')), React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: T.amber,
      fontFamily: SFMono
    }
  }, fmt(p.totalHeld - p.totalReleased)), React.createElement("div", {
    style: {
      fontSize: 10,
      color: T.t2,
      fontFamily: SFMono,
      marginTop: 2
    }
  }, "of ", fmt(p.totalHeld))))))), led.rows.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      marginTop: 22,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "ALL INVOICES WITH RETENTION"), led.rows.map(r => React.createElement(RowCard, {
    key: r.id,
    onClick: () => navInv(r.id)
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: T.t1
    }
  }, r.id, " \xB7 ", r.client || '—'), React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.t2,
      marginTop: 2
    }
  }, (r.retentionPct * 100).toFixed(1), "% of ", fmt(r.amount), " \xB7", React.createElement("span", {
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
  }, (r.retentionStatus || 'held').toUpperCase().replace('_', ' ')))), React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, React.createElement("div", {
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