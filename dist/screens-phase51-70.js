// Cortexx — Phases 51-70 batched: operations/finance/people/compliance

(function () {
  if (!window.Backend) return;
  const s = Backend.db.snapshot();

  // P51 pour scheduler · P52 snag vision (via AI) · P53 drawing diff · P54 bid library
  // P55-60 finance · P61-64 people · P65-70 compliance

  // P55: bank accounts (mock for Open Banking)
  if (!s.bankAccounts) {
    s.bankAccounts = [{
      id: 1,
      name: 'Business current',
      balance: 28450,
      currency: 'GBP',
      provider: 'Lloyds',
      last4: '4421',
      txCount: 47
    }, {
      id: 2,
      name: 'Savings',
      balance: 12000,
      currency: 'GBP',
      provider: 'Lloyds',
      last4: '4439',
      txCount: 3
    }, {
      id: 3,
      name: 'CIS reserve',
      balance: 1700,
      currency: 'GBP',
      provider: 'Starling',
      last4: '8821',
      txCount: 12
    }];
    s.payroll = [{
      id: 1,
      period: '2026-04',
      gross: 18420,
      netPaid: 14736,
      cisDeducted: 1842,
      tax: 1842,
      status: 'submitted'
    }, {
      id: 2,
      period: '2026-03',
      gross: 17800,
      netPaid: 14240,
      cisDeducted: 1780,
      tax: 1780,
      status: 'submitted'
    }, {
      id: 3,
      period: '2026-05',
      gross: 0,
      netPaid: 0,
      cisDeducted: 0,
      tax: 0,
      status: 'draft'
    }];
    s.holidays = [{
      id: 1,
      userId: 1,
      name: 'Tom Reilly',
      start: '2026-07-14',
      end: '2026-07-25',
      days: 10,
      status: 'approved'
    }, {
      id: 2,
      userId: 2,
      name: 'Aisha Begum',
      start: '2026-06-02',
      end: '2026-06-09',
      days: 5,
      status: 'pending'
    }, {
      id: 3,
      userId: 5,
      name: 'Marcus Webb',
      start: '2026-08-04',
      end: '2026-08-18',
      days: 11,
      status: 'pending'
    }];
    s.apprentices = [{
      id: 1,
      userId: 4,
      name: 'Sara Khan',
      year: 2,
      course: 'NVQ Level 2 Joinery',
      progress: 65,
      nextReview: '2026-06-30',
      hours: 1284,
      target: 1900
    }];
    s.carbon = [{
      id: 1,
      projectId: 1,
      scope1: 4.2,
      scope2: 1.8,
      scope3: 12.4,
      total: 18.4,
      unit: 'tCO2e',
      period: '2026-Q2'
    }, {
      id: 2,
      projectId: 2,
      scope1: 1.1,
      scope2: 0.6,
      scope3: 3.8,
      total: 5.5,
      unit: 'tCO2e',
      period: '2026-Q2'
    }];
    s.waste = [{
      id: 1,
      projectId: 1,
      kind: 'Inert',
      tonnes: 2.4,
      recycled: 95,
      when: '2026-05-15',
      carrier: 'Tonic Skips'
    }, {
      id: 2,
      projectId: 1,
      kind: 'Wood',
      tonnes: 0.8,
      recycled: 100,
      when: '2026-05-18',
      carrier: 'Tonic Skips'
    }, {
      id: 3,
      projectId: 1,
      kind: 'Mixed C&D',
      tonnes: 1.2,
      recycled: 78,
      when: '2026-05-21',
      carrier: 'Tonic Skips'
    }];
    s.claims = [{
      id: 'CLM-001',
      when: '2026-04-12',
      projectId: 1,
      kind: 'Damage',
      amount: 1240,
      status: 'closed',
      insurer: 'Aviva'
    }, {
      id: 'CLM-002',
      when: '2026-05-08',
      projectId: 3,
      kind: 'Theft',
      amount: 850,
      status: 'in-review',
      insurer: 'Hiscox'
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
  ['bankAccounts', 'payroll', 'holidays', 'apprentices', 'carbon', 'waste', 'claims'].forEach(n => {
    Backend.db[n] = mk(n);
  });
})();

// Generic mini-screen helper
function MiniScreen({
  title,
  subtitle,
  accent,
  items,
  renderItem,
  addRoute,
  addLabel
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
    title: title,
    subtitle: subtitle,
    right: addRoute && /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => toast(addLabel || 'New item', 'info')
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, items.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 30,
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 13,
      color: T.t3
    }
  }, "Nothing yet") : items.map(renderItem))));
}

// P55: Bank accounts
function BankScreen({
  accent
}) {
  const accounts = useDB('bankAccounts');
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Banking",
    subtitle: `${accounts.length} accounts · £${total.toLocaleString()} total`,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.open('mailto:hello@cortexbuildpro.com?subject=Connect%20bank%20account%20(Open%20Banking)', '_blank')
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(135deg, ${T.green}22, ${accent}11)`,
      border: `0.5px solid ${T.green}44`,
      borderRadius: 14,
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.green,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.6
    }
  }, "Total balance"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 32,
      fontWeight: 700,
      color: T.t1,
      marginTop: 4,
      letterSpacing: -0.8
    }
  }, "\xA3", total.toLocaleString()))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, accounts.map(a => /*#__PURE__*/React.createElement("div", {
    key: a.id,
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 14,
      border: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      color: T.t1
    }
  }, a.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 11,
      color: T.t2,
      marginTop: 2
    }
  }, a.provider, " \xB7\xB7\xB7\xB7", a.last4)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 18,
      color: a.balance > 5000 ? T.green : T.amber,
      fontWeight: 700
    }
  }, "\xA3", a.balance.toLocaleString())), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t3,
      marginTop: 6
    }
  }, a.txCount, " transactions this month"))))));
}

// P61: Payroll
function PayrollScreen({
  accent
}) {
  const periods = useDB('payroll');
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Payroll",
    subtitle: "UK CIS-aware"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, periods.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 14,
      border: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Pill, {
    c: p.status === 'submitted' ? T.green : T.amber
  }, p.status), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 600,
      color: T.t1,
      marginTop: 6
    }
  }, p.period)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 18,
      color: T.t1,
      fontWeight: 700
    }
  }, "\xA3", p.gross.toLocaleString())), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 8,
      marginTop: 10,
      paddingTop: 10,
      borderTop: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 12,
      color: T.green,
      fontWeight: 600
    }
  }, "\xA3", p.netPaid.toLocaleString()), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 9,
      color: T.t2
    }
  }, "Net paid")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 12,
      color: T.purple,
      fontWeight: 600
    }
  }, "\xA3", p.cisDeducted.toLocaleString()), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 9,
      color: T.t2
    }
  }, "CIS deducted")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 12,
      color: T.amber,
      fontWeight: 600
    }
  }, "\xA3", p.tax.toLocaleString()), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 9,
      color: T.t2
    }
  }, "Tax"))))))));
}

// P62: Holiday
function HolidayScreen({
  accent
}) {
  const holidays = useDB('holidays');
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Leave & holidays",
    subtitle: `${holidays.filter(h => h.status === 'pending').length} pending approval`,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('addholiday')
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, holidays.map(h => /*#__PURE__*/React.createElement("div", {
    key: h.id,
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 14,
      border: `0.5px solid ${T.hair}`,
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: h.name,
    size: 40
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      color: T.t1
    }
  }, h.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, h.start, " \u2192 ", h.end, " \xB7 ", h.days, " days")), /*#__PURE__*/React.createElement(Pill, {
    c: h.status === 'approved' ? T.green : T.amber
  }, h.status))))));
}

// P63: Apprentice progression
function ApprenticeScreen({
  accent
}) {
  const apps = useDB('apprentices');
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Apprentices",
    subtitle: `${apps.length} on programme`
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, apps.map(a => /*#__PURE__*/React.createElement("div", {
    key: a.id,
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 14,
      border: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: a.name,
    size: 44,
    c: T.purple
  }), /*#__PURE__*/React.createElement("div", {
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
  }, a.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, a.course, " \xB7 Year ", a.year)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 18,
      color: T.green,
      fontWeight: 700
    }
  }, a.progress, "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Bar, {
    pct: a.progress,
    c: T.green,
    h: 4
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: 8,
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t3
    }
  }, /*#__PURE__*/React.createElement("span", null, a.hours, " / ", a.target, " hrs"), /*#__PURE__*/React.createElement("span", null, "Next review ", a.nextReview)))))));
}

// P67: Carbon footprint
function CarbonScreen({
  accent
}) {
  const data = useDB('carbon');
  const total = data.reduce((s, c) => s + c.total, 0);
  const projects = useDB('projects');
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Carbon footprint",
    subtitle: `${total.toFixed(1)} tCO₂e Q2 2026`
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, data.map(c => {
    const p = projects.find(pr => pr.id === c.projectId);
    return /*#__PURE__*/React.createElement("div", {
      key: c.id,
      style: {
        background: T.bg2,
        borderRadius: 14,
        padding: 14,
        border: `0.5px solid ${T.hair}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 14,
        fontWeight: 600,
        color: T.t1
      }
    }, p?.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 18,
        color: T.green,
        fontWeight: 700
      }
    }, c.total.toFixed(1), " tCO\u2082e")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8,
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 13,
        color: T.red
      }
    }, c.scope1), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 9,
        color: T.t2
      }
    }, "Scope 1 (direct)")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 13,
        color: T.amber
      }
    }, c.scope2), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 9,
        color: T.t2
      }
    }, "Scope 2 (energy)")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 13,
        color: T.cyan
      }
    }, c.scope3), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 9,
        color: T.t2
      }
    }, "Scope 3 (supply)"))));
  }))));
}

// P68: Waste tracking
function WasteScreen({
  accent
}) {
  const items = useDB('waste');
  const total = items.reduce((s, w) => s + w.tonnes, 0);
  const avgRecycled = items.length ? items.reduce((s, w) => s + w.recycled, 0) / items.length : 0;
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Waste",
    subtitle: `${total.toFixed(1)}t · ${avgRecycled.toFixed(0)}% recycled`
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, items.map(w => /*#__PURE__*/React.createElement("div", {
    key: w.id,
    style: {
      background: T.bg2,
      borderRadius: 12,
      padding: 12,
      border: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      color: T.t1
    }
  }, w.kind), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, w.carrier, " \xB7 ", w.when)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 14,
      color: T.t1,
      fontWeight: 700
    }
  }, w.tonnes, "t"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 10,
      color: T.green
    }
  }, w.recycled, "% recycled"))))))));
}

// P70: Insurance claims
function ClaimsScreen({
  accent
}) {
  const claims = useDB('claims');
  const projects = useDB('projects');
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Insurance claims",
    subtitle: `${claims.filter(c => c.status !== 'closed').length} active`,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('addclaim')
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, claims.map(c => {
    const p = projects.find(pr => pr.id === c.projectId);
    return /*#__PURE__*/React.createElement("div", {
      key: c.id,
      style: {
        background: T.bg2,
        borderRadius: 14,
        padding: 14,
        border: `0.5px solid ${T.hair}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Pill, {
      c: c.status === 'closed' ? T.green : T.amber
    }, c.status), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 14,
        fontWeight: 600,
        color: T.t1,
        marginTop: 6
      }
    }, c.kind, " \xB7 ", c.id), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.t2
      }
    }, p?.name, " \xB7 ", c.insurer, " \xB7 ", c.when)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 16,
        color: T.t1,
        fontWeight: 700
      }
    }, "\xA3", c.amount.toLocaleString())));
  }))));
}
Object.assign(window, {
  BankScreen,
  PayrollScreen,
  HolidayScreen,
  ApprenticeScreen,
  CarbonScreen,
  WasteScreen,
  ClaimsScreen
});