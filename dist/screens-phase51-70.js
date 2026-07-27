(function () {
  if (!window.Backend) return;
  const s = Backend.db.snapshot();
  if (!s.bankAccounts) {
    s.bankAccounts = [];
    s.payroll = [];
    s.holidays = [];
    s.apprentices = [];
    s.carbon = [];
    s.waste = [];
    s.claims = [];
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
function BankScreen({
  accent
}) {
  const accounts = useDB('bankAccounts');
  const total = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const connectBank = () => {
    window.location.href = '/api/banking/connect';
  };
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Banking",
    subtitle: `${accounts.length} accounts · £${total.toLocaleString()} total`,
    right: React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: connectBank
    })
  }), accounts.length === 0 ? React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      color: T.t2,
      marginBottom: 20
    }
  }, "Connect your business bank account via TrueLayer Open Banking to automatically import transactions."), React.createElement("button", {
    onClick: connectBank,
    style: {
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 14,
      padding: '14px 24px',
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Connect Bank Account"), React.createElement("div", {
    style: {
      marginTop: 16,
      fontFamily: SF,
      fontSize: 13,
      color: T.t3
    }
  }, "Or ", React.createElement("span", {
    style: {
      color: accent,
      cursor: 'pointer'
    },
    onClick: () => toast('Manual upload coming soon', 'info')
  }, "upload statements manually"))) : React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
    }
  }, React.createElement("div", {
    style: {
      background: `linear-gradient(135deg, ${T.green}22, ${accent}11)`,
      border: `0.5px solid ${T.green}44`,
      borderRadius: 14,
      padding: 14
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.green,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.6
    }
  }, "Total balance"), React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 32,
      fontWeight: 700,
      color: T.t1,
      marginTop: 4,
      letterSpacing: -0.8
    }
  }, "\xA3", total.toLocaleString()))), React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, accounts.map(a => React.createElement("div", {
    key: a.id,
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 14,
      border: `0.5px solid ${T.hair}`
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      color: T.t1
    }
  }, a.name), React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 11,
      color: T.t2,
      marginTop: 2
    }
  }, a.provider, " \xB7\xB7\xB7\xB7", a.last4)), React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 18,
      color: (a.balance || 0) > 5000 ? T.green : T.amber,
      fontWeight: 700
    }
  }, "\xA3", (a.balance || 0).toLocaleString())), React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t3,
      marginTop: 6
    }
  }, a.txCount || 0, " transactions this month")))))));
}
function PayrollScreen({
  accent
}) {
  const periods = useDB('payroll');
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Payroll",
    subtitle: "UK CIS-aware"
  }), React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, periods.map(p => React.createElement("div", {
    key: p.id,
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 14,
      border: `0.5px solid ${T.hair}`
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, React.createElement("div", null, React.createElement(Pill, {
    c: p.status === 'submitted' ? T.green : T.amber
  }, p.status), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 600,
      color: T.t1,
      marginTop: 6
    }
  }, p.period)), React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 18,
      color: T.t1,
      fontWeight: 700
    }
  }, "\xA3", p.gross.toLocaleString())), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 8,
      marginTop: 10,
      paddingTop: 10,
      borderTop: `0.5px solid ${T.hair}`
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 12,
      color: T.green,
      fontWeight: 600
    }
  }, "\xA3", p.netPaid.toLocaleString()), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 9,
      color: T.t2
    }
  }, "Net paid")), React.createElement("div", null, React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 12,
      color: T.purple,
      fontWeight: 600
    }
  }, "\xA3", p.cisDeducted.toLocaleString()), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 9,
      color: T.t2
    }
  }, "CIS deducted")), React.createElement("div", null, React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 12,
      color: T.amber,
      fontWeight: 600
    }
  }, "\xA3", p.tax.toLocaleString()), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 9,
      color: T.t2
    }
  }, "Tax"))))))));
}
function HolidayScreen({
  accent
}) {
  const holidays = useDB('holidays');
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Leave & holidays",
    subtitle: `${holidays.filter(h => h.status === 'pending').length} pending approval`,
    right: React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('addholiday')
    })
  }), React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, holidays.map(h => React.createElement("div", {
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
  }, React.createElement(Avatar, {
    name: h.name,
    size: 40
  }), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      color: T.t1
    }
  }, h.name), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, h.start, " \u2192 ", h.end, " \xB7 ", h.days, " days")), React.createElement(Pill, {
    c: h.status === 'approved' ? T.green : T.amber
  }, h.status))))));
}
function ApprenticeScreen({
  accent
}) {
  const apps = useDB('apprentices');
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Apprentices",
    subtitle: `${apps.length} on programme`
  }), React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, apps.map(a => React.createElement("div", {
    key: a.id,
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 14,
      border: `0.5px solid ${T.hair}`
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, React.createElement(Avatar, {
    name: a.name,
    size: 44,
    c: T.purple
  }), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      color: T.t1
    }
  }, a.name), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, a.course, " \xB7 Year ", a.year)), React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 18,
      color: T.green,
      fontWeight: 700
    }
  }, a.progress, "%")), React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, React.createElement(Bar, {
    pct: a.progress,
    c: T.green,
    h: 4
  })), React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: 8,
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t3
    }
  }, React.createElement("span", null, a.hours, " / ", a.target, " hrs"), React.createElement("span", null, "Next review ", a.nextReview)))))));
}
function CarbonScreen({
  accent
}) {
  const data = useDB('carbon');
  const total = data.reduce((s, c) => s + c.total, 0);
  const projects = useDB('projects');
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Carbon footprint",
    subtitle: `${total.toFixed(1)} tCO₂e Q2 2026`
  }), React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, data.map(c => {
    const p = projects.find(pr => pr.id === c.projectId);
    return React.createElement("div", {
      key: c.id,
      style: {
        background: T.bg2,
        borderRadius: 14,
        padding: 14,
        border: `0.5px solid ${T.hair}`
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between'
      }
    }, React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 14,
        fontWeight: 600,
        color: T.t1
      }
    }, p?.name), React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 18,
        color: T.green,
        fontWeight: 700
      }
    }, c.total.toFixed(1), " tCO\u2082e")), React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8,
        marginTop: 10
      }
    }, React.createElement("div", null, React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 13,
        color: T.red
      }
    }, c.scope1), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 9,
        color: T.t2
      }
    }, "Scope 1 (direct)")), React.createElement("div", null, React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 13,
        color: T.amber
      }
    }, c.scope2), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 9,
        color: T.t2
      }
    }, "Scope 2 (energy)")), React.createElement("div", null, React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 13,
        color: T.cyan
      }
    }, c.scope3), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 9,
        color: T.t2
      }
    }, "Scope 3 (supply)"))));
  }))));
}
function WasteScreen({
  accent
}) {
  const items = useDB('waste');
  const total = items.reduce((s, w) => s + w.tonnes, 0);
  const avgRecycled = items.length ? items.reduce((s, w) => s + w.recycled, 0) / items.length : 0;
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Waste",
    subtitle: `${total.toFixed(1)}t · ${avgRecycled.toFixed(0)}% recycled`
  }), React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, items.map(w => React.createElement("div", {
    key: w.id,
    style: {
      background: T.bg2,
      borderRadius: 12,
      padding: 12,
      border: `0.5px solid ${T.hair}`
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      color: T.t1
    }
  }, w.kind), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, w.carrier, " \xB7 ", w.when)), React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 14,
      color: T.t1,
      fontWeight: 700
    }
  }, w.tonnes, "t"), React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 10,
      color: T.green
    }
  }, w.recycled, "% recycled"))))))));
}
function ClaimsScreen({
  accent
}) {
  const claims = useDB('claims');
  const projects = useDB('projects');
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Insurance claims",
    subtitle: `${claims.filter(c => c.status !== 'closed').length} active`,
    right: React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('addclaim')
    })
  }), React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, claims.map(c => {
    const p = projects.find(pr => pr.id === c.projectId);
    return React.createElement("div", {
      key: c.id,
      style: {
        background: T.bg2,
        borderRadius: 14,
        padding: 14,
        border: `0.5px solid ${T.hair}`
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between'
      }
    }, React.createElement("div", null, React.createElement(Pill, {
      c: c.status === 'closed' ? T.green : T.amber
    }, c.status), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 14,
        fontWeight: 600,
        color: T.t1,
        marginTop: 6
      }
    }, c.kind, " \xB7 ", c.id), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.t2
      }
    }, p?.name, " \xB7 ", c.insurer, " \xB7 ", c.when)), React.createElement("div", {
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