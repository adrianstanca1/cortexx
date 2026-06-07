// Cortexx — Phase 72: Service & Process Improvement
// "Enhance and improve all our services and processes"
//
// Three threads:
//   • Service catalog — what the business actually sells, with live KPIs
//   • Process library — the SOPs that produce each service, with cycle time / owner / version
//   • Kaizen board — improvement initiatives with before/after metrics
// A hub screen rolls these up into one Improve dashboard.

(function () {
  if (!window.Backend) return;
  const s = Backend.db.snapshot();
  if (!s.services || !s._phase72v) {
    s._phase72v = 2;
    s.services = [{
      id: 1,
      name: 'Loft conversion',
      icon: 'box',
      lane: 'Build',
      margin: 28,
      marginTarget: 32,
      cycleDays: 64,
      cycleTarget: 56,
      nps: 72,
      lastQ: 9,
      pipeline: 184000,
      owner: 'Marcus Webb',
      trend: [22, 23, 25, 24, 26, 27, 28]
    }, {
      id: 2,
      name: 'Kitchen renovation',
      icon: 'wrench',
      lane: 'Build',
      margin: 31,
      marginTarget: 34,
      cycleDays: 28,
      cycleTarget: 24,
      nps: 81,
      lastQ: 14,
      pipeline: 142000,
      owner: 'Aisha Begum',
      trend: [26, 28, 28, 29, 30, 31, 31]
    }, {
      id: 3,
      name: 'Side return extension',
      icon: 'projects',
      lane: 'Build',
      margin: 24,
      marginTarget: 30,
      cycleDays: 92,
      cycleTarget: 80,
      nps: 64,
      lastQ: 6,
      pipeline: 412000,
      owner: 'Tom Reilly',
      trend: [21, 22, 22, 23, 23, 24, 24]
    }, {
      id: 4,
      name: 'Bathroom fit-out',
      icon: 'box',
      lane: 'Build',
      margin: 36,
      marginTarget: 36,
      cycleDays: 14,
      cycleTarget: 12,
      nps: 88,
      lastQ: 18,
      pipeline: 64000,
      owner: 'Sara Khan',
      trend: [32, 33, 34, 34, 35, 36, 36]
    }, {
      id: 5,
      name: 'Snag inspection',
      icon: 'shield',
      lane: 'Service',
      margin: 62,
      marginTarget: 60,
      cycleDays: 3,
      cycleTarget: 3,
      nps: 91,
      lastQ: 24,
      pipeline: 18400,
      owner: 'Vera (auto)',
      trend: [55, 57, 59, 60, 61, 62, 62]
    }, {
      id: 6,
      name: 'Maintenance contracts',
      icon: 'cog',
      lane: 'Service',
      margin: 44,
      marginTarget: 48,
      cycleDays: 7,
      cycleTarget: 5,
      nps: 78,
      lastQ: 11,
      pipeline: 92000,
      owner: 'Aisha Begum',
      trend: [40, 41, 42, 43, 43, 44, 44]
    }];
    s.processes = [{
      id: 1,
      name: 'Lead → quote',
      steps: 8,
      owner: 'Vera',
      version: 'v3.2',
      updated: '2026-05-04',
      cycleHrs: 38,
      cycleTarget: 24,
      passRate: 94,
      runs: 142,
      area: 'Sales',
      linkedSvc: [1, 2, 3, 4]
    }, {
      id: 2,
      name: 'Quote → contract',
      steps: 6,
      owner: 'Aisha Begum',
      version: 'v2.8',
      updated: '2026-04-22',
      cycleHrs: 96,
      cycleTarget: 72,
      passRate: 88,
      runs: 64,
      area: 'Sales',
      linkedSvc: [1, 2, 3, 4]
    }, {
      id: 3,
      name: 'Site mobilisation',
      steps: 12,
      owner: 'Tom Reilly',
      version: 'v4.0',
      updated: '2026-05-12',
      cycleHrs: 18,
      cycleTarget: 12,
      passRate: 76,
      runs: 38,
      area: 'Build',
      linkedSvc: [1, 2, 3]
    }, {
      id: 4,
      name: 'Daily site log',
      steps: 4,
      owner: 'Foremen',
      version: 'v5.1',
      updated: '2026-05-20',
      cycleHrs: 0.2,
      cycleTarget: 0.2,
      passRate: 81,
      runs: 1240,
      area: 'Build',
      linkedSvc: [1, 2, 3, 4]
    }, {
      id: 5,
      name: 'Variation order',
      steps: 7,
      owner: 'Marcus Webb',
      version: 'v2.4',
      updated: '2026-03-30',
      cycleHrs: 48,
      cycleTarget: 24,
      passRate: 71,
      runs: 86,
      area: 'Build',
      linkedSvc: [1, 2, 3]
    }, {
      id: 6,
      name: 'Snag → sign-off',
      steps: 9,
      owner: 'Aisha Begum',
      version: 'v3.0',
      updated: '2026-05-18',
      cycleHrs: 48,
      cycleTarget: 48,
      passRate: 84,
      runs: 124,
      area: 'Handover',
      linkedSvc: [1, 2, 3, 4]
    }, {
      id: 7,
      name: 'Invoice → cash',
      steps: 5,
      owner: 'Vera',
      version: 'v4.5',
      updated: '2026-05-22',
      cycleHrs: 504,
      cycleTarget: 336,
      passRate: 67,
      runs: 218,
      area: 'Finance',
      linkedSvc: [1, 2, 3, 4, 6]
    }, {
      id: 8,
      name: 'Sub onboarding',
      steps: 11,
      owner: 'Sara Khan',
      version: 'v1.9',
      updated: '2026-02-14',
      cycleHrs: 56,
      cycleTarget: 24,
      passRate: 79,
      runs: 22,
      area: 'People',
      linkedSvc: [1, 2, 3]
    }];
    s.improvements = [{
      id: 1,
      title: 'Switch to digital snag sign-off',
      lane: 'live',
      owner: 'Aisha Begum',
      procId: 6,
      metric: 'cycle hrs',
      before: 96,
      after: 72,
      unit: 'h',
      delta: -25,
      impact: '+£14k/yr',
      started: '2026-03-04',
      wins: 3
    }, {
      id: 2,
      title: 'Standardise mobilisation checklist',
      lane: 'testing',
      owner: 'Tom Reilly',
      procId: 3,
      metric: 'pass rate',
      before: 64,
      after: 81,
      unit: '%',
      delta: +17,
      impact: '−2 days/job',
      started: '2026-04-18',
      wins: 2
    }, {
      id: 3,
      title: 'Auto-chase overdue invoices (Vera)',
      lane: 'live',
      owner: 'Vera',
      procId: 7,
      metric: 'days to pay',
      before: 32,
      after: 21,
      unit: 'd',
      delta: -11,
      impact: '+£42k cashflow',
      started: '2026-02-02',
      wins: 5
    }, {
      id: 4,
      title: 'Quote response < 24h SLA',
      lane: 'doing',
      owner: 'Vera',
      procId: 1,
      metric: 'cycle hrs',
      before: 38,
      after: null,
      unit: 'h',
      delta: null,
      impact: 'tgt +12% win rate',
      started: '2026-05-12',
      wins: 0
    }, {
      id: 5,
      title: 'Pre-built loft-conversion template',
      lane: 'doing',
      owner: 'Marcus Webb',
      procId: 2,
      metric: 'cycle hrs',
      before: 96,
      after: null,
      unit: 'h',
      delta: null,
      impact: 'tgt −24h',
      started: '2026-05-19',
      wins: 0
    }, {
      id: 6,
      title: 'Photo-driven daily log (1-tap)',
      lane: 'testing',
      owner: 'Foremen',
      procId: 4,
      metric: 'pass rate',
      before: 73,
      after: 81,
      unit: '%',
      delta: +8,
      impact: '+11% adoption',
      started: '2026-05-01',
      wins: 1
    }, {
      id: 7,
      title: 'Variation order in-app signature',
      lane: 'idea',
      owner: 'Marcus Webb',
      procId: 5,
      metric: 'cycle hrs',
      before: 48,
      after: null,
      unit: 'h',
      delta: null,
      impact: 'tgt −24h',
      started: '2026-05-21',
      wins: 0
    }, {
      id: 8,
      title: 'Sub onboarding self-serve portal',
      lane: 'idea',
      owner: 'Sara Khan',
      procId: 8,
      metric: 'cycle hrs',
      before: 56,
      after: null,
      unit: 'h',
      delta: null,
      impact: 'tgt −32h',
      started: '2026-05-22',
      wins: 0
    }, {
      id: 9,
      title: 'NPS survey at handover',
      lane: 'live',
      owner: 'Aisha Begum',
      procId: 6,
      metric: 'response',
      before: 22,
      after: 64,
      unit: '%',
      delta: +42,
      impact: '3× signal',
      started: '2026-01-14',
      wins: 4
    }];
    try {
      localStorage.setItem('cortexx_db_v1', JSON.stringify(s));
    } catch (e) {}
  }
  const mk = n => ({
    listSync: () => [...Backend.db.snapshot()[n]],
    list: async () => [...Backend.db.snapshot()[n]],
    getSync: id => Backend.db.snapshot()[n].find(x => x.id == id),
    get: async id => Backend.db.snapshot()[n].find(x => x.id == id),
    create: async d => {
      const s = Backend.db.snapshot();
      const ids = s[n].map(x => typeof x.id === 'number' ? x.id : 0);
      s[n] = [{
        ...d,
        id: Math.max(0, ...ids) + 1
      }, ...s[n]];
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
  ['services', 'processes', 'improvements'].forEach(n => {
    Backend.db[n] = mk(n);
  });
})();

// ── tiny inline sparkline ──────────────────────────────────
function Spark({
  data,
  color,
  w = 60,
  h = 22
}) {
  if (!data?.length) return null;
  const min = Math.min(...data),
    max = Math.max(...data),
    range = max - min || 1;
  const pts = data.map((v, i) => `${i / (data.length - 1) * w},${h - (v - min) / range * (h - 2) - 1}`).join(' ');
  return /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: h,
    style: {
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("polyline", {
    points: pts,
    fill: "none",
    stroke: color,
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    opacity: "0.9"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: pts.split(' ').pop().split(',')[0],
    cy: pts.split(' ').pop().split(',')[1],
    r: "2",
    fill: color
  }));
}

// ── stat tile used in the improve hub ──────────────────────
function ImproveStat({
  label,
  value,
  sub,
  delta,
  color
}) {
  const positive = delta != null && delta > 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 12,
      padding: '10px 12px',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10,
      color: T.t3,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 22,
      fontWeight: 700,
      color: color || T.t1,
      letterSpacing: -0.4,
      lineHeight: 1
    }
  }, value), delta != null && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 10,
      fontWeight: 600,
      color: positive ? T.green : T.red
    }
  }, positive ? '▲' : '▼', " ", Math.abs(delta), "%")), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10.5,
      color: T.t2,
      marginTop: 3
    }
  }, sub));
}

// ── horizontal progress bar (current vs target) ────────────
function GoalBar({
  value,
  target,
  lower = false,
  color
}) {
  // lower=true means "lower is better" (e.g. cycle days)
  const ratio = lower ? Math.min(1, target / Math.max(value, target)) // closer to 1 = on target
  : Math.min(1, value / Math.max(target, 1));
  const c = ratio >= 0.95 ? T.green : ratio >= 0.8 ? color || T.blue : T.amber;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 4,
      background: 'rgba(255,255,255,0.06)',
      borderRadius: 2,
      overflow: 'hidden',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      width: `${ratio * 100}%`,
      background: c,
      borderRadius: 2
    }
  }));
}

// ╭───────────────────────────────────────────────────────────╮
// │ HUB — landing screen                                      │
// ╰───────────────────────────────────────────────────────────╯
function ImproveHubScreen({
  accent
}) {
  const services = useDB('services');
  const processes = useDB('processes');
  const improvements = useDB('improvements');
  const live = improvements.filter(i => i.lane === 'live');
  const doing = improvements.filter(i => i.lane === 'doing' || i.lane === 'testing');
  const ideas = improvements.filter(i => i.lane === 'idea');

  // roll-ups
  const avgMargin = services.length ? Math.round(services.reduce((s, x) => s + x.margin, 0) / services.length) : 0;
  const marginTgt = services.length ? Math.round(services.reduce((s, x) => s + x.marginTarget, 0) / services.length) : 0;
  const marginDelta = marginTgt ? Math.round((avgMargin - marginTgt) / marginTgt * 100) : 0;
  const avgNPS = services.length ? Math.round(services.reduce((s, x) => s + x.nps, 0) / services.length) : 0;
  const onTarget = processes.filter(p => p.cycleHrs <= p.cycleTarget * 1.05).length;
  // Parse "£14k/yr", "£42k cashflow", "£8.4k", etc. — recognise k/m suffix, skip non-money strings.
  const cashImpactNum = live.reduce((s, i) => {
    const m = (i.impact || '').match(/£(-?[\d,.]+)(k|m)?/i);
    if (!m) return s;
    const n = parseFloat(m[1].replace(/,/g, '')) || 0;
    const mult = m[2]?.toLowerCase() === 'm' ? 1_000_000 : m[2]?.toLowerCase() === 'k' ? 1_000 : 1;
    return s + n * mult;
  }, 0);
  const cashImpact = cashImpactNum >= 1_000_000 ? `£${(cashImpactNum / 1_000_000).toFixed(1)}m` : cashImpactNum >= 1000 ? `£${Math.round(cashImpactNum / 1000)}k` : `£${cashImpactNum.toFixed(0)}`;
  const go = k => () => window.cortexxNav && window.cortexxNav(k);
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Improve",
    subtitle: `${doing.length} active · ${live.length} live · ${ideas.length} backlog`,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('addimprovement')
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(135deg, ${accent}22, ${T.purple}18)`,
      border: `0.5px solid ${accent}44`,
      borderRadius: 14,
      padding: '14px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: accent
    }
  }, React.cloneElement(Ic.spark, {
    size: 14
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: accent,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.6
    }
  }, "Running impact \xB7 YTD")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 30,
      fontWeight: 700,
      color: T.t1,
      marginTop: 6,
      letterSpacing: -0.8
    }
  }, cashImpact, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.t3,
      fontSize: 14,
      fontWeight: 500
    }
  }, "realised")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t2,
      marginTop: 4
    }
  }, live.length, " initiatives in production \xB7 ", live.reduce((s, i) => s + i.wins, 0), " wins logged \xB7 Vera proposed ", ideas.length, " more this week."))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 14px',
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(ImproveStat, {
    label: "Avg margin",
    value: `${avgMargin}%`,
    sub: `target ${marginTgt}%`,
    delta: marginDelta,
    color: accent
  }), /*#__PURE__*/React.createElement(ImproveStat, {
    label: "Process SLA",
    value: `${onTarget}/${processes.length}`,
    sub: "on target",
    color: T.green
  }), /*#__PURE__*/React.createElement(ImproveStat, {
    label: "NPS",
    value: avgNPS,
    sub: avgNPS >= 70 ? 'excellent' : 'good',
    color: avgNPS >= 70 ? T.green : T.amber
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 14px'
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, null, "Improve across"), /*#__PURE__*/React.createElement(GroupedList, null, /*#__PURE__*/React.createElement(Row, {
    icon: Ic.layers,
    iconBg: accent,
    title: `Services · ${services.length}`,
    sub: `${services.filter(x => x.margin < x.marginTarget).length} below margin target`,
    right: Ic.chevR,
    onClick: go('services')
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.book,
    iconBg: T.cyan,
    title: `Processes · ${processes.length}`,
    sub: `${processes.length - onTarget} above cycle-time target`,
    right: Ic.chevR,
    onClick: go('processes')
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.spark,
    iconBg: T.purple,
    title: `Kaizen board · ${improvements.length}`,
    sub: `${doing.length} in-flight · ${ideas.length} backlog`,
    right: Ic.chevR,
    onClick: go('kaizen'),
    isLast: true
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 14px'
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, null, "Recent wins"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, live.slice(0, 3).map(w => /*#__PURE__*/React.createElement("div", {
    key: w.id,
    onClick: () => window.cortexxNav('improvement', w),
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.green}33`,
      borderRadius: 12,
      padding: '12px 14px',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      color: T.t1,
      marginBottom: 4
    }
  }, w.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3
    }
  }, w.owner, " \xB7 ", w.wins, " wins logged")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right',
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 13,
      fontWeight: 700,
      color: T.green
    }
  }, w.impact), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t3,
      marginTop: 2
    }
  }, w.before, w.unit, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.t2
    }
  }, "\u2192"), " ", w.after, w.unit))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 30px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(135deg, ${T.purple}1c, transparent)`,
      border: `0.5px dashed ${T.purple}55`,
      borderRadius: 12,
      padding: '12px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.purple
    }
  }, React.cloneElement(Ic.bot, {
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 700,
      color: T.purple,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    }
  }, "Vera proposes")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      lineHeight: 1.4
    }
  }, "Variation orders are your slowest process at 48h vs 24h target. In-app signature would close ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.green,
      fontFamily: SFMono
    }
  }, "~24h"), " per job and unlock ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.green,
      fontFamily: SFMono
    }
  }, "\xA38.4k"), " faster cash."), /*#__PURE__*/React.createElement("button", {
    onClick: () => toast('Promoted to backlog', 'success'),
    style: {
      marginTop: 8,
      background: 'transparent',
      border: `0.5px solid ${T.purple}66`,
      color: T.purple,
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600,
      padding: '6px 12px',
      borderRadius: 16,
      cursor: 'pointer'
    }
  }, "Add to backlog \u2192")))));
}
function SectionLabel({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10.5,
      color: T.t3,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      padding: '0 4px 8px'
    }
  }, children);
}

// ╭───────────────────────────────────────────────────────────╮
// │ SERVICES CATALOG                                          │
// ╰───────────────────────────────────────────────────────────╯
function ServiceCatalogScreen({
  accent
}) {
  const services = useDB('services');
  const [sortBy, setSortBy] = React.useState('margin');
  const sorted = [...services].sort((a, b) => {
    if (sortBy === 'margin') return a.margin - b.margin; // worst first → "where to improve"
    if (sortBy === 'nps') return a.nps - b.nps;
    if (sortBy === 'cycle') return b.cycleDays - b.cycleTarget - (a.cycleDays - a.cycleTarget);
    return b.pipeline - a.pipeline;
  });
  const tabs = [{
    k: 'margin',
    l: 'Margin'
  }, {
    k: 'nps',
    l: 'NPS'
  }, {
    k: 'cycle',
    l: 'Cycle'
  }, {
    k: 'pipeline',
    l: 'Pipeline'
  }];
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Services",
    subtitle: `${services.length} offered · sorted by ${sortBy}`
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 14px',
      display: 'flex',
      gap: 6
    }
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.k,
    onClick: () => setSortBy(t.k),
    style: {
      flex: 1,
      padding: '7px 0',
      borderRadius: 10,
      border: `0.5px solid ${sortBy === t.k ? accent : T.hair}`,
      background: sortBy === t.k ? `${accent}22` : T.bg2,
      color: sortBy === t.k ? accent : T.t2,
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, t.l))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, sorted.map(svc => {
    const marginGap = svc.margin - svc.marginTarget;
    const onMargin = marginGap >= 0;
    const cycleGap = svc.cycleDays - svc.cycleTarget;
    const onCycle = cycleGap <= 0;
    return /*#__PURE__*/React.createElement("div", {
      key: svc.id,
      onClick: () => toast(`Open ${svc.name}`, 'info'),
      style: {
        background: T.bg2,
        border: `0.5px solid ${T.hair}`,
        borderRadius: 14,
        padding: 14,
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 28,
        height: 28,
        borderRadius: 8,
        background: `${accent}22`,
        color: accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, React.cloneElement(Ic[svc.icon] || Ic.box, {
      size: 15
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 15,
        fontWeight: 600,
        color: T.t1
      }
    }, svc.name)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.t3,
        marginLeft: 36
      }
    }, /*#__PURE__*/React.createElement(Pill, {
      c: svc.lane === 'Service' ? T.cyan : T.amber
    }, svc.lane), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 6
      }
    }, svc.owner, " \xB7 ", svc.lastQ, " sold last quarter"))), /*#__PURE__*/React.createElement(Spark, {
      data: svc.trend,
      color: onMargin ? T.green : T.amber
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 12,
        marginTop: 4
      }
    }, /*#__PURE__*/React.createElement(MetricBlock, {
      label: "Margin",
      value: `${svc.margin}%`,
      targetLine: `tgt ${svc.marginTarget}%`,
      barValue: svc.margin,
      barTarget: svc.marginTarget,
      color: onMargin ? T.green : T.amber
    }), /*#__PURE__*/React.createElement(MetricBlock, {
      label: "Cycle",
      value: `${svc.cycleDays}d`,
      targetLine: `tgt ${svc.cycleTarget}d`,
      barValue: svc.cycleDays,
      barTarget: svc.cycleTarget,
      lower: true,
      color: onCycle ? T.green : T.amber
    }), /*#__PURE__*/React.createElement(MetricBlock, {
      label: "NPS",
      value: svc.nps,
      targetLine: svc.nps >= 70 ? 'excellent' : svc.nps >= 50 ? 'good' : 'work',
      barValue: svc.nps,
      barTarget: 70,
      color: svc.nps >= 70 ? T.green : svc.nps >= 50 ? accent : T.amber
    })));
  }))));
}
function MetricBlock({
  label,
  value,
  targetLine,
  barValue,
  barTarget,
  lower,
  color
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10,
      color: T.t3,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 18,
      fontWeight: 700,
      color: T.t1,
      letterSpacing: -0.4,
      marginTop: 3
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10,
      color: T.t3,
      marginBottom: 4
    }
  }, targetLine), /*#__PURE__*/React.createElement(GoalBar, {
    value: barValue,
    target: barTarget,
    lower: lower,
    color: color
  }));
}

// ╭───────────────────────────────────────────────────────────╮
// │ PROCESS LIBRARY                                           │
// ╰───────────────────────────────────────────────────────────╯
function ProcessLibraryScreen({
  accent
}) {
  const processes = useDB('processes');
  const [area, setArea] = React.useState('All');
  const areas = ['All', ...new Set(processes.map(p => p.area))];
  const filtered = area === 'All' ? processes : processes.filter(p => p.area === area);
  const fmtHrs = h => h < 1 ? `${(h * 60).toFixed(0)}m` : h < 24 ? `${h}h` : `${(h / 24).toFixed(1)}d`;
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Processes",
    subtitle: `${processes.length} SOPs · ${processes.filter(p => p.cycleHrs > p.cycleTarget).length} over target`,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.open('mailto:hello@cortexbuildpro.com?subject=Process%20definition%20request', '_blank')
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 14px',
      display: 'flex',
      gap: 6,
      overflowX: 'auto'
    }
  }, areas.map(a => /*#__PURE__*/React.createElement("button", {
    key: a,
    onClick: () => setArea(a),
    style: {
      padding: '6px 12px',
      borderRadius: 14,
      flexShrink: 0,
      border: `0.5px solid ${area === a ? accent : T.hair}`,
      background: area === a ? `${accent}22` : T.bg2,
      color: area === a ? accent : T.t2,
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, a))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, filtered.map(p => {
    const overTarget = p.cycleHrs > p.cycleTarget;
    const slipPct = Math.round((p.cycleHrs - p.cycleTarget) / p.cycleTarget * 100);
    const passColor = p.passRate >= 90 ? T.green : p.passRate >= 75 ? accent : T.amber;
    return /*#__PURE__*/React.createElement("div", {
      key: p.id,
      onClick: () => toast(`Open ${p.name}`, 'info'),
      style: {
        background: T.bg2,
        border: `0.5px solid ${T.hair}`,
        borderRadius: 12,
        padding: '12px 14px',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 3
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 14,
        fontWeight: 600,
        color: T.t1
      }
    }, p.name), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: SFMono,
        fontSize: 10,
        color: T.t3
      }
    }, p.version)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.t3
      }
    }, p.steps, " steps \xB7 ", p.owner, " \xB7 ", p.runs, " runs \xB7 last edit ", p.updated)), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: 'right',
        whiteSpace: 'nowrap'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 14,
        fontWeight: 700,
        color: overTarget ? T.amber : T.green
      }
    }, fmtHrs(p.cycleHrs)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 10,
        color: T.t3
      }
    }, "vs ", fmtHrs(p.cycleTarget), overTarget ? ` · +${slipPct}%` : ''))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(GoalBar, {
      value: p.passRate,
      target: 90,
      color: passColor
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 11,
        fontWeight: 600,
        color: passColor,
        minWidth: 56,
        textAlign: 'right'
      }
    }, p.passRate, "% pass")));
  }))));
}

// ╭───────────────────────────────────────────────────────────╮
// │ KAIZEN BOARD                                              │
// ╰───────────────────────────────────────────────────────────╯
function KaizenBoardScreen({
  accent
}) {
  const improvements = useDB('improvements');
  const lanes = [{
    k: 'idea',
    l: 'Idea',
    c: T.t3
  }, {
    k: 'doing',
    l: 'Doing',
    c: accent
  }, {
    k: 'testing',
    l: 'Testing',
    c: T.amber
  }, {
    k: 'live',
    l: 'Live',
    c: T.green
  }];
  const [activeLane, setActiveLane] = React.useState('doing');
  const items = improvements.filter(i => i.lane === activeLane);
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Kaizen board",
    subtitle: "Continuous improvement",
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('addimprovement')
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 14px',
      display: 'flex',
      gap: 6
    }
  }, lanes.map(L => {
    const n = improvements.filter(i => i.lane === L.k).length;
    const active = activeLane === L.k;
    return /*#__PURE__*/React.createElement("button", {
      key: L.k,
      onClick: () => setActiveLane(L.k),
      style: {
        flex: 1,
        padding: '8px 0',
        borderRadius: 10,
        position: 'relative',
        border: `0.5px solid ${active ? L.c : T.hair}`,
        background: active ? `${L.c}22` : T.bg2,
        color: active ? L.c : T.t2,
        fontFamily: SF,
        fontSize: 11.5,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2
      }
    }, /*#__PURE__*/React.createElement("span", null, L.l), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: SFMono,
        fontSize: 13,
        fontWeight: 700
      }
    }, n));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, items.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 30,
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 13,
      color: T.t3
    }
  }, "No initiatives in this lane.") : items.map(it => {
    const laneColor = lanes.find(l => l.k === it.lane).c;
    const positive = it.delta != null && (it.metric === 'pass rate' || it.metric === 'response') ? it.delta > 0 : it.delta != null ? it.delta < 0 : null;
    return /*#__PURE__*/React.createElement("div", {
      key: it.id,
      onClick: () => window.cortexxNav('improvement', it),
      style: {
        background: T.bg2,
        border: `0.5px solid ${T.hair}`,
        borderRadius: 12,
        padding: '12px 14px',
        borderLeft: `3px solid ${laneColor}`,
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 14,
        fontWeight: 600,
        color: T.t1,
        marginBottom: 6,
        lineHeight: 1.3
      }
    }, it.title), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.t3
      }
    }, it.owner, " \xB7 started ", it.started, it.wins > 0 ? ` · ${it.wins} wins` : ''), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 11,
        fontWeight: 700,
        color: positive ? T.green : positive === false ? T.red : T.t2
      }
    }, it.impact)), it.after != null && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        padding: '8px 10px',
        background: T.bg1,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 10,
        color: T.t3,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        minWidth: 64
      }
    }, it.metric), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: SFMono,
        fontSize: 13,
        color: T.t3,
        textDecoration: 'line-through'
      }
    }, it.before, it.unit), /*#__PURE__*/React.createElement("span", {
      style: {
        color: T.t3
      }
    }, React.cloneElement(Ic.arrowRight, {
      size: 12
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: SFMono,
        fontSize: 14,
        fontWeight: 700,
        color: positive ? T.green : T.t1
      }
    }, it.after, it.unit), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: SFMono,
        fontSize: 11,
        fontWeight: 600,
        color: positive ? T.green : T.red,
        marginLeft: 'auto'
      }
    }, it.delta > 0 ? '+' : '', it.delta, it.unit === '%' || it.unit === 'd' || it.unit === 'h' ? it.unit : ''))), it.after == null && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        padding: '8px 10px',
        background: T.bg1,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: laneColor
      }
    }, React.cloneElement(Ic.clock, {
      size: 13
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.t2,
        flex: 1
      }
    }, "Baseline: ", /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: SFMono,
        color: T.t1
      }
    }, it.before, it.unit), " \xB7 awaiting first measurement")));
  }))));
}
Object.assign(window, {
  ImproveHubScreen,
  ServiceCatalogScreen,
  ProcessLibraryScreen,
  KaizenBoardScreen
});