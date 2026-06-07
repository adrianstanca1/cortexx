// Cortexx — Phase 40: Vera autonomous actions + scheduled execution

(function () {
  if (!window.Backend?.vera) return;

  // Vera's action log — what she's done autonomously
  const snap = Backend.db.snapshot();
  if (!snap.veraActions) {
    snap.veraActions = [{
      id: 1,
      when: '2026-05-22T06:30',
      action: 'Drafted Camden chase email',
      impact: '£8,420',
      status: 'pending-review'
    }, {
      id: 2,
      when: '2026-05-22T05:00',
      action: 'Flagged margin slip on Brixton',
      impact: '−1.2%',
      status: 'completed'
    }, {
      id: 3,
      when: '2026-05-21T22:00',
      action: 'Generated 2 leads from local data',
      impact: '£24k pipeline',
      status: 'completed'
    }, {
      id: 4,
      when: '2026-05-21T16:00',
      action: 'Suggested crew reallocation',
      impact: '+3 days saved',
      status: 'pending-review'
    }];
    try {
      localStorage.setItem('cortexx_db_v1', JSON.stringify(snap));
    } catch (e) {}
  }
  const mk = n => ({
    listSync: () => [...Backend.db.snapshot()[n]],
    list: async () => [...Backend.db.snapshot()[n]],
    create: async d => {
      const s = Backend.db.snapshot();
      const ids = s[n].map(x => typeof x.id === 'number' ? x.id : 0);
      s[n] = [{
        ...d,
        id: Math.max(0, ...ids) + 1
      }, ...s[n]].slice(0, 100);
      try {
        localStorage.setItem('cortexx_db_v1', JSON.stringify(s));
      } catch (e) {}
      Backend.db.user.update({});
    },
    update: async (id, p) => {
      const s = Backend.db.snapshot();
      s[n] = s[n].map(x => x.id == id ? {
        ...x,
        ...p
      } : x);
      try {
        localStorage.setItem('cortexx_db_v1', JSON.stringify(s));
      } catch (e) {}
      Backend.db.user.update({});
    },
    remove: async () => {}
  });
  Backend.db.veraActions = mk('veraActions');

  // Autonomous action — find leads
  Backend.vera.autoHuntLeads = async (count = 3) => {
    const found = [];
    for (let i = 0; i < count; i++) {
      const lead = await Backend.vera.generateLead();
      if (lead) found.push(lead);
    }
    await Backend.db.veraActions.create({
      when: new Date().toISOString().slice(0, 16),
      action: `Hunted ${found.length} new leads`,
      impact: '£' + found.reduce((s, l) => s + (l.value || 0), 0).toLocaleString() + ' pipeline',
      status: 'completed'
    });
    return found;
  };

  // Autonomous action — chase overdue invoices
  Backend.vera.autoChaseOverdue = async () => {
    const invs = Backend.db.snapshot().invoices.filter(i => i.status === 'overdue');
    const drafted = [];
    for (const inv of invs) {
      const draft = await Backend.ai.draftChase(inv.id);
      drafted.push({
        inv,
        draft
      });
    }
    if (drafted.length > 0) {
      await Backend.db.veraActions.create({
        when: new Date().toISOString().slice(0, 16),
        action: `Drafted ${drafted.length} chase emails`,
        impact: '£' + drafted.reduce((s, d) => s + d.inv.amount, 0).toLocaleString(),
        status: 'pending-review'
      });
    }
    return drafted;
  };

  // Autonomous action — health-check all active projects
  Backend.vera.autoHealthCheck = async () => {
    const projects = Backend.db.snapshot().projects.filter(p => ['active', 'snagging'].includes(p.status));
    const results = [];
    for (const p of projects) {
      const r = await Backend.ai.healthCheck(p);
      results.push({
        project: p,
        ...r
      });
    }
    const risky = results.filter(r => r.risk === 'high' || r.risk === 'medium');
    await Backend.db.veraActions.create({
      when: new Date().toISOString().slice(0, 16),
      action: `Reviewed ${projects.length} projects · ${risky.length} flagged`,
      impact: risky.length > 0 ? 'review needed' : 'all healthy',
      status: 'completed'
    });
    return results;
  };

  // Autonomous action — flag low stock for ordering
  Backend.vera.autoOrderMaterials = async () => {
    const lowStock = Backend.db.snapshot().materials.filter(m => m.stock < m.min);
    if (lowStock.length === 0) return null;
    const forecast = await Backend.ai.forecastMaterials();
    await Backend.db.veraActions.create({
      when: new Date().toISOString().slice(0, 16),
      action: `Flagged ${lowStock.length} materials for reorder`,
      impact: '£' + (lowStock.length * 280).toLocaleString() + ' est',
      status: 'pending-review'
    });
    return {
      items: lowStock,
      forecast
    };
  };

  // Run all autonomous tasks
  Backend.vera.runAll = async () => {
    const results = {};
    results.healthCheck = await Backend.vera.autoHealthCheck();
    results.leads = await Backend.vera.autoHuntLeads(2);
    results.chases = await Backend.vera.autoChaseOverdue();
    results.materials = await Backend.vera.autoOrderMaterials();
    await Backend.db.veraActions.create({
      when: new Date().toISOString().slice(0, 16),
      action: 'Completed full autonomous sweep',
      impact: 'check action log',
      status: 'completed'
    });
    return results;
  };
})();
function VeraActionsScreen({
  accent
}) {
  const actions = useDB('veraActions');
  const [running, setRunning] = React.useState(null);
  const run = async (kind, label) => {
    setRunning(kind);
    try {
      if (kind === 'leads') await Backend.vera.autoHuntLeads(3);else if (kind === 'chase') await Backend.vera.autoChaseOverdue();else if (kind === 'health') await Backend.vera.autoHealthCheck();else if (kind === 'materials') await Backend.vera.autoOrderMaterials();else if (kind === 'all') await Backend.vera.runAll();
      toast(`Vera ran: ${label}`, 'ai');
    } catch (e) {
      toast('Vera hit an issue — see log', 'error');
    }
    setRunning(null);
  };
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Vera \xB7 autopilot",
    subtitle: "Autonomous actions on your business"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(135deg, ${T.purple}33, ${accent}11)`,
      border: `0.5px solid ${T.purple}44`,
      borderRadius: 16,
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 4,
      background: T.green,
      boxShadow: `0 0 8px ${T.green}`,
      animation: 'pulse-dot 2s infinite'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 11,
      color: T.green,
      fontWeight: 700
    }
  }, "AUTOPILOT ACTIVE")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t1,
      lineHeight: 1.5
    }
  }, "Vera runs these autonomously. Tap to trigger now, or schedule recurring runs."), /*#__PURE__*/React.createElement("button", {
    onClick: () => run('all', 'full sweep'),
    disabled: running,
    style: {
      marginTop: 12,
      width: '100%',
      background: `linear-gradient(135deg, ${T.purple}, ${accent})`,
      color: '#fff',
      border: 'none',
      borderRadius: 12,
      padding: '12px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6
    }
  }, React.cloneElement(Ic.spark, {
    size: 16
  }), " ", running === 'all' ? 'Vera working…' : 'Run full sweep now'))), /*#__PURE__*/React.createElement(Section, {
    title: "\u25C6 Individual jobs"
  }, /*#__PURE__*/React.createElement(GroupedList, null, [{
    k: 'leads',
    l: 'Hunt new leads',
    d: '3 AI-generated qualified leads',
    i: Ic.trend
  }, {
    k: 'chase',
    l: 'Chase overdue invoices',
    d: 'Draft polite chase emails',
    i: Ic.mail
  }, {
    k: 'health',
    l: 'Health-check projects',
    d: 'AI risk scoring on every active job',
    i: Ic.shield
  }, {
    k: 'materials',
    l: 'Forecast material orders',
    d: 'Flag low stock with AI advice',
    i: Ic.box
  }].map((a, i, arr) => /*#__PURE__*/React.createElement(Row, {
    key: a.k,
    icon: a.i,
    iconBg: accent,
    title: a.l,
    sub: a.d,
    right: /*#__PURE__*/React.createElement("button", {
      onClick: e => {
        e.stopPropagation();
        run(a.k, a.l);
      },
      disabled: running === a.k,
      style: {
        background: running === a.k ? T.bg3 : T.purple,
        color: '#fff',
        border: 'none',
        borderRadius: 14,
        padding: '5px 12px',
        cursor: running === a.k ? 'default' : 'pointer',
        fontFamily: SF,
        fontSize: 11,
        fontWeight: 700
      }
    }, running === a.k ? '…' : 'Run'),
    isLast: i === arr.length - 1
  })))), /*#__PURE__*/React.createElement(Section, {
    title: "\u25C6 Vera's action log"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, actions.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 13,
      color: T.t3
    }
  }, "No actions yet \xB7 trigger one above") : actions.map(a => {
    const sc = a.status === 'completed' ? T.green : a.status === 'pending-review' ? T.amber : T.t3;
    return /*#__PURE__*/React.createElement("div", {
      key: a.id,
      style: {
        background: T.bg2,
        border: `0.5px solid ${T.hair}`,
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 32,
        height: 32,
        borderRadius: 8,
        background: `${T.purple}22`,
        color: T.purple,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, React.cloneElement(Ic.spark, {
      size: 16
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 13,
        color: T.t1,
        fontWeight: 600
      }
    }, a.action), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 10,
        color: T.t3,
        marginTop: 2
      }
    }, new Date(a.when).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement(Pill, {
      c: sc,
      size: "xs"
    }, a.status), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 11,
        color: T.t1,
        fontWeight: 700,
        marginTop: 4
      }
    }, a.impact)));
  }))), /*#__PURE__*/React.createElement(Section, {
    title: "\u25C6 Scheduled runs"
  }, /*#__PURE__*/React.createElement(GroupedList, null, /*#__PURE__*/React.createElement(Row, {
    icon: Ic.sun,
    iconBg: T.amber,
    title: "Morning briefing",
    sub: "Every weekday 06:30",
    right: /*#__PURE__*/React.createElement(Pill, {
      c: T.green,
      size: "xs"
    }, "ON")
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.trend,
    iconBg: T.cyan,
    title: "Lead hunt",
    sub: "Every Mon/Thu 09:00",
    right: /*#__PURE__*/React.createElement(Pill, {
      c: T.green,
      size: "xs"
    }, "ON")
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.mail,
    iconBg: T.red,
    title: "Overdue chase sweep",
    sub: "Daily 16:00",
    right: /*#__PURE__*/React.createElement(Pill, {
      c: T.green,
      size: "xs"
    }, "ON")
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.shield,
    iconBg: T.blue,
    title: "Project health check",
    sub: "Every Friday 14:00",
    right: /*#__PURE__*/React.createElement(Pill, {
      c: T.green,
      size: "xs"
    }, "ON"),
    isLast: true
  }))), /*#__PURE__*/React.createElement("style", null, `@keyframes pulse-dot { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`)));
}
Object.assign(window, {
  VeraActionsScreen
});