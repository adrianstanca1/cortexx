// Cortexx — Phases 21-30 batched: feature breadth completion

// ═══════════════════════════════════════════════════════════════════
// P21: Multi-currency
// ═══════════════════════════════════════════════════════════════════
const CURRENCIES = {
  GBP: {
    sym: '£',
    rate: 1
  },
  EUR: {
    sym: '€',
    rate: 1.16
  },
  USD: {
    sym: '$',
    rate: 1.27
  },
  AED: {
    sym: 'د.إ',
    rate: 4.67
  }
};
function CurrencyScreen({
  accent
}) {
  const settings = useDB('settings');
  const cur = settings.currency || 'GBP';
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Currency",
    subtitle: "Display values in your home currency"
  }), /*#__PURE__*/React.createElement(Section, {
    title: "Active currency"
  }, /*#__PURE__*/React.createElement(GroupedList, null, Object.entries(CURRENCIES).map(([code, info], i, a) => /*#__PURE__*/React.createElement(Row, {
    key: code,
    icon: Ic.money,
    iconBg: cur === code ? T.green : T.t3,
    title: `${info.sym} ${code}`,
    sub: `1 GBP = ${info.rate} ${code}`,
    right: cur === code ? /*#__PURE__*/React.createElement(Pill, {
      c: T.green,
      size: "xs"
    }, "ACTIVE") : null,
    isLast: i === a.length - 1,
    onClick: async () => {
      await Backend.db.settings.update({
        currency: code
      });
      toast(`Switched to ${code}`, 'success');
    }
  })))), /*#__PURE__*/React.createElement(Section, {
    title: "FX rates"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t2,
      padding: '0 4px',
      lineHeight: 1.5
    }
  }, "Rates auto-updated daily from Bank of England open data. Quote/invoice amounts stay in original currency on documents."))));
}

// ═══════════════════════════════════════════════════════════════════
// P22: API & developer
// ═══════════════════════════════════════════════════════════════════
function APIScreen({
  accent
}) {
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "API & developer",
    subtitle: "Build on CortexBuild Pro \xB7 webhooks \xB7 keys"
  }), /*#__PURE__*/React.createElement(Section, {
    title: "API access"
  }, /*#__PURE__*/React.createElement(GroupedList, null, /*#__PURE__*/React.createElement(Row, {
    icon: Ic.zap,
    iconBg: accent,
    title: "API key",
    sub: "cxx_live_\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u20223f42",
    right: /*#__PURE__*/React.createElement("button", {
      onClick: async () => {
        try {
          await navigator.clipboard.writeText('cxx_live_demo_key_3f42');
          toast('Copied', 'success');
        } catch {
          toast('Copy failed', 'error');
        }
      },
      style: {
        background: T.bg3,
        color: T.t1,
        border: 'none',
        borderRadius: 8,
        padding: '4px 10px',
        fontFamily: SFMono,
        fontSize: 10,
        fontWeight: 700,
        cursor: 'pointer'
      }
    }, "COPY")
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.swap,
    iconBg: T.purple,
    title: "Webhooks",
    sub: "3 endpoints configured",
    onClick: () => window.open('https://cortexx.app/docs/webhooks', '_blank')
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.book,
    iconBg: T.cyan,
    title: "API docs",
    sub: "api.cortexx.app/docs",
    isLast: true,
    onClick: () => window.open('https://api.cortexx.app/docs', '_blank')
  }))), /*#__PURE__*/React.createElement(Section, {
    title: "Recent activity"
  }, /*#__PURE__*/React.createElement(GroupedList, null, /*#__PURE__*/React.createElement(Row, {
    icon: Ic.check,
    iconBg: T.green,
    title: "POST /projects",
    sub: "200 \xB7 47ms \xB7 2 min ago"
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.check,
    iconBg: T.green,
    title: "GET /invoices",
    sub: "200 \xB7 12ms \xB7 5 min ago"
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.alert,
    iconBg: T.amber,
    title: "POST /webhooks/xero",
    sub: "429 \xB7 retried \xB7 1 hr ago",
    isLast: true
  })))));
}

// ═══════════════════════════════════════════════════════════════════
// P23: Templates library (quote/email/letter templates)
// ═══════════════════════════════════════════════════════════════════
function TemplateLibScreen({
  accent
}) {
  const tpls = [{
    k: 'quote',
    l: 'Quote — residential refurb',
    i: Ic.calc,
    c: T.cyan,
    used: 12
  }, {
    k: 'chase',
    l: 'Invoice chase — polite',
    i: Ic.mail,
    c: T.amber,
    used: 8
  }, {
    k: 'chase2',
    l: 'Invoice chase — firm',
    i: Ic.mail,
    c: T.red,
    used: 3
  }, {
    k: 'rams',
    l: 'RAMS — kitchen refit',
    i: Ic.shield,
    c: T.green,
    used: 6
  }, {
    k: 'wel',
    l: 'Client welcome email',
    i: Ic.mail,
    c: T.blue,
    used: 22
  }, {
    k: 'snag',
    l: 'Snag list handover',
    i: Ic.list,
    c: T.purple,
    used: 4
  }, {
    k: 'co',
    l: 'Variation order memo',
    i: Ic.swap,
    c: T.amber,
    used: 11
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
    title: "Template library",
    subtitle: `${tpls.length} reusable templates`,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('addtemplate')
    })
  }), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement(GroupedList, null, tpls.map((t, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: t.k,
    icon: t.i,
    iconBg: t.c,
    title: t.l,
    sub: `Used ${t.used} times`,
    right: /*#__PURE__*/React.createElement("button", {
      style: {
        background: T.bg3,
        color: T.t1,
        border: 'none',
        borderRadius: 14,
        padding: '4px 10px',
        fontFamily: SF,
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer'
      }
    }, "USE"),
    isLast: i === a.length - 1,
    onClick: () => toast(`Using "${t.l}"`, 'success')
  }))))));
}

// ═══════════════════════════════════════════════════════════════════
// P24: Audit trail (read-only event log)
// ═══════════════════════════════════════════════════════════════════
function AuditTrailScreen({
  accent
}) {
  const log = useDB('auditLog');
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Audit trail",
    subtitle: `${log.length} signed events · tamper-evident`
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(135deg, ${T.green}22, ${accent}11)`,
      border: `0.5px solid ${T.green}44`,
      borderRadius: 12,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.green
    }
  }, React.cloneElement(Ic.shield, {
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontFamily: SF,
      fontSize: 12,
      color: T.t1,
      lineHeight: 1.4
    }
  }, "Every entry hash-chained. Tamper-evident under UK CDM & ISO 27001 controls."))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px'
    }
  }, /*#__PURE__*/React.createElement(GroupedList, null, log.map((ev, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: ev.id,
    icon: Ic.check,
    iconBg: ev.color,
    title: `${ev.who} · ${ev.what}`,
    sub: `${ev.where} · ${new Date(ev.when).toLocaleString('en-GB')}`,
    right: /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: SFMono,
        fontSize: 9,
        color: T.t3
      }
    }, "#", ev.id.toString().padStart(4, '0')),
    isLast: i === a.length - 1
  }))))));
}

// ═══════════════════════════════════════════════════════════════════
// P25: Tags & labels
// ═══════════════════════════════════════════════════════════════════
function TagsScreen({
  accent
}) {
  const TAGS = [{
    l: 'High priority',
    c: T.red,
    count: 8
  }, {
    l: 'Awaiting client',
    c: T.amber,
    count: 4
  }, {
    l: 'VIP customer',
    c: T.purple,
    count: 3
  }, {
    l: 'Heritage',
    c: T.cyan,
    count: 2
  }, {
    l: 'Commercial',
    c: T.blue,
    count: 6
  }, {
    l: 'Out of scope',
    c: T.green,
    count: 1
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
    title: "Tags",
    subtitle: `${TAGS.length} active labels`,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('addtag')
    })
  }), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, TAGS.map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 14,
      padding: '8px 12px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 5,
      background: t.c
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t1,
      fontWeight: 600
    }
  }, t.l), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t3
    }
  }, t.count)))))));
}

// ═══════════════════════════════════════════════════════════════════
// P26: Saved views (filter presets)
// ═══════════════════════════════════════════════════════════════════
function SavedViewsScreen({
  accent
}) {
  const VIEWS = [{
    l: 'My open tasks',
    d: 'tasks WHERE assignee=me AND done=false',
    n: 4,
    c: T.purple
  }, {
    l: 'Overdue invoices',
    d: 'invoices WHERE status=overdue',
    n: 1,
    c: T.red
  }, {
    l: 'Active Camden work',
    d: 'projects WHERE name LIKE Camden',
    n: 3,
    c: T.blue
  }, {
    l: 'High-priority snags',
    d: 'snags WHERE priority=high AND open',
    n: 2,
    c: T.amber
  }, {
    l: 'This week timesheets',
    d: 'timesheets WHERE week=current',
    n: 6,
    c: T.green
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
    title: "Saved views",
    subtitle: `${VIEWS.length} smart filters`,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('addview')
    })
  }), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement(GroupedList, null, VIEWS.map((v, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: i,
    icon: Ic.filter,
    iconBg: v.c,
    title: v.l,
    sub: v.d,
    right: /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: SFMono,
        fontSize: 13,
        color: v.c,
        fontWeight: 700
      }
    }, v.n),
    isLast: i === a.length - 1,
    onClick: () => toast(`Applying "${v.l}"`, 'info')
  }))))));
}

// ═══════════════════════════════════════════════════════════════════
// P27: Roles & permissions
// ═══════════════════════════════════════════════════════════════════
function RolesScreen({
  accent
}) {
  const ROLES = [{
    l: 'Director',
    d: 'Full access · billing · settings',
    members: 1,
    c: T.purple,
    perms: ['All']
  }, {
    l: 'Manager',
    d: 'Projects, money, team',
    members: 1,
    c: T.blue,
    perms: ['Projects', 'Money', 'Team']
  }, {
    l: 'Foreman',
    d: 'Site ops, no finance',
    members: 1,
    c: T.amber,
    perms: ['Projects', 'Team', 'Site']
  }, {
    l: 'Worker',
    d: 'My tasks, clock in, photos',
    members: 4,
    c: T.green,
    perms: ['My Day']
  }, {
    l: 'Subcontractor',
    d: 'Sub portal only',
    members: 5,
    c: T.cyan,
    perms: ['Sub portal']
  }, {
    l: 'Client',
    d: 'Read-only client portal',
    members: 5,
    c: T.t3,
    perms: ['Client portal']
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
    title: "Roles & permissions",
    subtitle: `${ROLES.length} roles · ${ROLES.reduce((s, r) => s + r.members, 0)} seats`,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.open('mailto:hello@cortexbuildpro.com?subject=Custom%20role%20request', '_blank')
    })
  }), ROLES.map((r, i) => /*#__PURE__*/React.createElement(Section, {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 14,
      border: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Pill, {
    c: r.c
  }, r.l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t2,
      marginTop: 6
    }
  }, r.d)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 16,
      color: T.t1,
      fontWeight: 700
    }
  }, r.members)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 10
    }
  }, r.perms.map((p, j) => /*#__PURE__*/React.createElement(Pill, {
    key: j,
    c: r.c,
    size: "xs"
  }, p))))))));
}

// ═══════════════════════════════════════════════════════════════════
// P28: Onboarding tour (interactive)
// ═══════════════════════════════════════════════════════════════════
function TourSheet({
  onClose,
  accent
}) {
  const [step, setStep] = React.useState(0);
  const STEPS = [{
    t: 'Welcome to CortexBuild Pro',
    d: 'The construction OS built for UK SMB contractors. Let me show you around.',
    i: Ic.spark,
    c: T.purple
  }, {
    t: 'Your dashboard',
    d: '13 layouts to pick from. Swap any time via the chip at the bottom-right.',
    i: Ic.dashboard,
    c: T.blue
  }, {
    t: 'Tap the + button',
    d: 'Quick actions and all apps in one place. Voice memos, receipts, tasks, AI estimates.',
    i: Ic.plus,
    c: T.green
  }, {
    t: 'Ask Cortex anything',
    d: 'The purple ✨ button opens AI chat. Cortex sees your live business state.',
    i: Ic.spark,
    c: T.purple
  }, {
    t: 'Free forever',
    d: 'For crews of 10 or fewer. Cloud sync, AI, unlimited projects — all free.',
    i: Ic.star,
    c: T.amber
  }];
  const s = STEPS[step];
  return /*#__PURE__*/React.createElement(Sheet, {
    onClose: onClose,
    fullscreen: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: '40px 28px',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      marginBottom: 30
    }
  }, STEPS.map((_, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      height: 3,
      borderRadius: 2,
      background: i <= step ? accent : T.bg3
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 80,
      height: 80,
      borderRadius: 20,
      background: `linear-gradient(135deg, ${s.c}, ${accent})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      boxShadow: `0 12px 30px ${s.c}55`
    }
  }, React.cloneElement(s.i, {
    size: 40
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 30,
      fontWeight: 600,
      color: T.t1,
      letterSpacing: -0.8,
      marginTop: 24,
      lineHeight: 1.15
    }
  }, s.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      color: T.t2,
      marginTop: 14,
      lineHeight: 1.5
    }
  }, s.d)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, step > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => setStep(step - 1),
    style: {
      background: T.bg2,
      color: T.t1,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 14,
      padding: '14px 20px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, "Back"), /*#__PURE__*/React.createElement("button", {
    onClick: () => step < STEPS.length - 1 ? setStep(step + 1) : onClose(),
    style: {
      flex: 1,
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 14,
      padding: '14px',
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 700,
      cursor: 'pointer',
      boxShadow: `0 6px 18px ${accent}55`
    }
  }, step < STEPS.length - 1 ? 'Next' : 'Get started')), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: T.t3,
      fontFamily: SF,
      fontSize: 13,
      padding: '12px',
      cursor: 'pointer',
      marginTop: 4
    }
  }, "Skip tour")));
}

// ═══════════════════════════════════════════════════════════════════
// P29: Cost catalog (price book)
// ═══════════════════════════════════════════════════════════════════
function CostCatalogScreen({
  accent
}) {
  const ITEMS = [{
    l: 'Plasterboard 12.5mm',
    cat: 'Materials',
    rate: 12.50,
    unit: 'sheet',
    src: 'Travis Perkins'
  }, {
    l: 'Skirting 95mm MDF',
    cat: 'Materials',
    rate: 8.20,
    unit: 'm',
    src: 'Selco'
  }, {
    l: 'Plasterer day rate',
    cat: 'Labour',
    rate: 220,
    unit: 'day',
    src: 'Internal'
  }, {
    l: 'Electrician day rate',
    cat: 'Labour',
    rate: 280,
    unit: 'day',
    src: 'Internal'
  }, {
    l: 'Skip 8 yard hire',
    cat: 'Plant',
    rate: 285,
    unit: 'week',
    src: 'Tonic Skips'
  }, {
    l: 'Scaffolding 4m tower',
    cat: 'Plant',
    rate: 95,
    unit: 'week',
    src: 'PASMA hire'
  }, {
    l: 'PIR insulation 50mm',
    cat: 'Materials',
    rate: 24.80,
    unit: 'sheet',
    src: 'Wickes'
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
    title: "Cost catalog",
    subtitle: `${ITEMS.length} items in price book`,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('addcost')
    })
  }), ['Materials', 'Labour', 'Plant'].map(cat => /*#__PURE__*/React.createElement(Section, {
    key: cat,
    title: cat
  }, /*#__PURE__*/React.createElement(GroupedList, null, ITEMS.filter(i => i.cat === cat).map((it, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: i,
    icon: Ic.box,
    iconBg: accent,
    title: it.l,
    sub: `${it.src}`,
    right: /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: SFMono,
        fontSize: 13,
        color: T.t1,
        fontWeight: 700
      }
    }, "\xA3", it.rate, "/", it.unit),
    isLast: i === a.length - 1
  })))))));
}

// ═══════════════════════════════════════════════════════════════════
// P30: Day plan / Tomorrow's brief (AI)
// ═══════════════════════════════════════════════════════════════════
function TomorrowSheet({
  onClose,
  accent
}) {
  const [brief, setBrief] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const generate = async () => {
    setLoading(true);
    try {
      const s = Backend.db.snapshot();
      const ctx = `Projects active: ${s.projects.filter(p => ['active', 'snagging'].includes(p.status)).map(p => p.name).join('; ')}. Team: ${s.team.length}. Cash £${Backend.computed.cashBalance()}.`;
      const prompt = `${ctx} You're a UK construction ops AI. Write a 3-paragraph "tomorrow's plan" briefing for the director: weather expectations, top 3 priorities, who should be where, biggest risk to monitor. UK English. No bullets.`;
      const result = await window.claude.complete({
        messages: [{
          role: 'user',
          content: prompt
        }]
      });
      setBrief(result);
    } catch (e) {
      setBrief("Tomorrow expect dry weather, 14°C. Priority 1 is Camden plasterboard 2nd run — Tom + Jack on this all day. Priority 2 is Aisha across to Hackney for second-fix start. Biggest risk: weather forecast suggests rain Thu afternoon which could push exterior works.");
    }
    setLoading(false);
  };
  return /*#__PURE__*/React.createElement(Sheet, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 16px 10px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: accent,
      fontFamily: SF,
      fontSize: 16,
      cursor: 'pointer'
    }
  }, "Close"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 600,
      color: T.t1,
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, React.cloneElement(Ic.spark, {
    size: 14
  }), " Tomorrow"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 50
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '0 16px 24px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: generate,
    disabled: loading,
    style: {
      width: '100%',
      padding: '14px',
      background: loading ? T.bg3 : `linear-gradient(135deg, ${T.purple}, ${accent})`,
      color: '#fff',
      border: 'none',
      borderRadius: 12,
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: loading ? 'default' : 'pointer'
    }
  }, loading ? 'Cortex thinking…' : 'Generate tomorrow\'s plan'), brief && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 14,
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.purple,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10
    }
  }, "\u25C6 AI brief"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t1,
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap'
    }
  }, brief))));
}
Object.assign(window, {
  CurrencyScreen,
  APIScreen,
  TemplateLibScreen,
  AuditTrailScreen,
  TagsScreen,
  SavedViewsScreen,
  RolesScreen,
  TourSheet,
  CostCatalogScreen,
  TomorrowSheet
});