// Cortexx — additional screens and flows
// Money screen, Safety, Profile/Settings; AI-powered Add Task and Receipt scanner

// ═══════════════════════════════════════════════════════════════════
// MONEY SCREEN (replaces Tasks tab when activated? actually a new tab)
// We'll show this via the project sheet's Money tab AND from header link.
// ═══════════════════════════════════════════════════════════════════
function MoneyScreen({
  accent,
  onChase
}) {
  const invoices = useDB('invoices');
  const cash = useComputed('cashBalance');
  const outstanding = useComputed('outstanding');
  const due = invoices.filter(i => ['due', 'overdue'].includes(i.status));
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 150
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Money",
    subtitle: "CIS-aware \xB7 Live cash",
    right: /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.money,
      accent: accent,
      onClick: () => window.cortexxNav('payments')
    }), /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('estimator')
    }))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      borderRadius: 18,
      padding: 18,
      border: `0.5px solid ${T.hair}`,
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.8
    }
  }, "Cash balance"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 32,
      fontWeight: 700,
      color: T.t1,
      marginTop: 4,
      letterSpacing: -0.8,
      lineHeight: 1
    }
  }, "\xA3", cash.toLocaleString('en-GB', {
    maximumFractionDigits: 0
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      marginTop: 6,
      fontFamily: SF,
      fontSize: 12,
      color: T.green,
      fontWeight: 500
    }
  }, React.cloneElement(Ic.trend, {
    size: 13
  }), " ", /*#__PURE__*/React.createElement("span", null, "+\xA38,420 this week"))), /*#__PURE__*/React.createElement("svg", {
    width: "84",
    height: "48",
    viewBox: "0 0 84 48"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "mfill",
    x1: "0",
    x2: "0",
    y1: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: T.green,
    stopOpacity: "0.4"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: T.green,
    stopOpacity: "0"
  }))), /*#__PURE__*/React.createElement("polyline", {
    points: "0,38 12,32 24,34 36,22 48,26 60,14 72,18 84,8",
    fill: "none",
    stroke: T.green,
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "0,38 12,32 24,34 36,22 48,26 60,14 72,18 84,8 84,48 0,48",
    fill: "url(#mfill)"
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 20px 8px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 700,
      color: T.t2,
      textTransform: 'uppercase',
      letterSpacing: 0.6
    }
  }, "Outstanding"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 12,
      color: T.amber,
      fontWeight: 700
    }
  }, "\xA3", outstanding.toLocaleString())), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, due.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px',
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 13,
      color: T.t3
    }
  }, "Nothing outstanding \uD83C\uDF89"), due.map(iv => {
    const isOverdue = iv.status === 'overdue';
    const c = isOverdue ? T.red : T.amber;
    return /*#__PURE__*/React.createElement("div", {
      key: iv.id,
      onClick: () => onChase && onChase(iv),
      style: {
        background: T.bg2,
        borderRadius: 12,
        padding: '12px 14px',
        border: `0.5px solid ${T.hair}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 4,
        alignSelf: 'stretch',
        borderRadius: 2,
        background: c,
        marginRight: -2
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 36,
        height: 36,
        borderRadius: 9,
        background: `${c}22`,
        color: c,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, React.cloneElement(Ic.doc, {
      size: 18
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 14,
        fontWeight: 600,
        color: T.t1
      }
    }, iv.client), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 11,
        color: T.t2
      }
    }, iv.id, " \xB7 ", isOverdue ? `${Math.abs(daysUntil(iv.due))}d late` : `due ${formatTaskWhen(iv.due)}`)), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 16,
        color: c,
        fontWeight: 700
      }
    }, fmt(iv.amount)), isOverdue && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 10,
        color: T.purple,
        fontWeight: 600,
        marginTop: 2
      }
    }, "AI chase \u2192")));
  })), /*#__PURE__*/React.createElement(Section, {
    title: "Recently paid"
  }, /*#__PURE__*/React.createElement(GroupedList, null, invoices.filter(i => i.status === 'paid').slice(0, 3).map((iv, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: iv.id,
    icon: Ic.check,
    iconBg: T.green,
    title: `${iv.client} · ${fmt(iv.amount)}`,
    sub: `${iv.id} · paid ${formatTaskWhen(iv.paid)}`,
    isLast: i === a.length - 1
  }))))));
}

// ═══════════════════════════════════════════════════════════════════
// SAFETY SCREEN
// ═══════════════════════════════════════════════════════════════════
function SafetyScreen({
  accent
}) {
  const user = useDB('user');
  const team = useDB('team');
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 150
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Safety",
    subtitle: "H&S, RAMS, CSCS \xB7 UK",
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('incident')
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(135deg, ${T.green}33, ${T.green}0a)`,
      border: `0.5px solid ${T.green}55`,
      borderRadius: 18,
      padding: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: 14,
      background: T.green,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 4px 16px ${T.green}55`
    }
  }, React.cloneElement(Ic.shield, {
    size: 28
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 36,
      fontWeight: 700,
      color: T.t1,
      letterSpacing: -1,
      lineHeight: 1
    }
  }, user.safetyScore, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      color: T.t2
    }
  }, "/100")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t2,
      marginTop: 4
    }
  }, "Safety score \xB7 last 30 days")))), /*#__PURE__*/React.createElement(Section, {
    title: "Action needed"
  }, /*#__PURE__*/React.createElement(GroupedList, null, /*#__PURE__*/React.createElement(Row, {
    icon: Ic.alert,
    iconBg: T.amber,
    title: "Camden RAMS expires",
    sub: "Saturday \xB7 sign-off required",
    onClick: () => window.cortexxNav('docgen', 'rams')
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.alert,
    iconBg: T.amber,
    title: "Sara Khan CSCS expires",
    sub: "6 weeks \xB7 book renewal",
    isLast: true,
    onClick: () => window.cortexxNav('training')
  }))), /*#__PURE__*/React.createElement(Section, {
    title: "Quick actions"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    }
  }, [{
    l: 'Report incident',
    i: Ic.alert,
    c: T.red,
    sub: 'HSE-ready'
  }, {
    l: 'New RAMS',
    i: Ic.doc,
    c: T.blue,
    sub: 'From template'
  }, {
    l: 'Toolbox talk',
    i: Ic.team,
    c: T.amber,
    sub: 'Today\'s topic'
  }, {
    l: 'Site induction',
    i: Ic.hardhat,
    c: T.green,
    sub: 'New starter'
  }].map((a, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 12,
      padding: '12px',
      cursor: 'pointer',
      textAlign: 'left',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 8,
      background: `${a.c}22`,
      color: a.c,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, React.cloneElement(a.i, {
    size: 17
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      color: T.t1
    }
  }, a.l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 1
    }
  }, a.sub)))))), /*#__PURE__*/React.createElement(Section, {
    title: "CSCS \xB7 expiry watch"
  }, /*#__PURE__*/React.createElement(GroupedList, null, team.slice(0, 4).map((m, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: m.id,
    icon: Ic.hardhat,
    iconBg: m.cscs === 'Gold' ? T.amber : m.cscs === 'Blue' ? T.blue : T.green,
    title: m.n,
    sub: `CSCS ${m.cscs} · valid`,
    right: /*#__PURE__*/React.createElement(Pill, {
      c: T.green,
      size: "xs"
    }, "OK"),
    isLast: i === a.length - 1
  }))))));
}

// ═══════════════════════════════════════════════════════════════════
// PROFILE / SETTINGS
// ═══════════════════════════════════════════════════════════════════
function ProfileScreen({
  accent,
  onSignOut
}) {
  const user = useDB('user');
  const settings = useDB('settings');
  const toggle = key => Backend.db.settings.update({
    notifications: {
      ...settings.notifications,
      [key]: !settings.notifications[key]
    }
  });
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 150
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Me",
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.cog,
      onClick: () => window.cortexxNav('settings')
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      borderRadius: 18,
      padding: 16,
      border: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      alignItems: 'center',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: user.name,
    size: 60,
    c: accent
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 17,
      fontWeight: 600,
      color: T.t1
    }
  }, user.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t2,
      marginTop: 2
    }
  }, user.role, " \xB7 ", user.company), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    c: T.green,
    size: "xs"
  }, "\u25CF Verified"), /*#__PURE__*/React.createElement(Pill, {
    c: T.amber,
    size: "xs"
  }, "CSCS ", user.cscs)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 10,
      paddingTop: 14,
      borderTop: `0.5px solid ${T.hair}`
    }
  }, [{
    l: 'Hours',
    v: user.monthHours + 'h',
    s: 'this mo'
  }, {
    l: 'Sites',
    v: user.monthSites,
    s: 'visited'
  }, {
    l: 'Score',
    v: user.safetyScore,
    s: 'safety'
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 17,
      fontWeight: 700,
      color: T.t1,
      letterSpacing: -0.3
    }
  }, s.v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10,
      color: T.t2,
      marginTop: 1,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.4
    }
  }, s.l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10,
      color: T.t3,
      marginTop: 1
    }
  }, s.s)))))), /*#__PURE__*/React.createElement(Section, {
    title: "Account"
  }, /*#__PURE__*/React.createElement(GroupedList, null, /*#__PURE__*/React.createElement(Row, {
    icon: Ic.me,
    iconBg: accent,
    title: "Personal details",
    sub: user.email,
    onClick: () => window.cortexxNav('settings')
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.hardhat,
    iconBg: T.amber,
    title: "Company",
    sub: user.company,
    onClick: () => window.cortexxNav('settings')
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.money,
    iconBg: T.green,
    title: "Plan",
    sub: user.plan,
    isLast: true,
    onClick: () => window.cortexxNav('settings')
  }))), /*#__PURE__*/React.createElement(Section, {
    title: "Notifications"
  }, /*#__PURE__*/React.createElement(GroupedList, null, [{
    k: 'safety',
    l: 'Safety alerts',
    sub: 'RAMS, CSCS, incidents'
  }, {
    k: 'money',
    l: 'Money',
    sub: 'Invoices, receipts, chase'
  }, {
    k: 'mentions',
    l: '@mentions',
    sub: 'When someone tags you'
  }, {
    k: 'daily',
    l: 'Daily briefing',
    sub: '07:30 each morning'
  }].map((n, i, a) => /*#__PURE__*/React.createElement("div", {
    key: n.k,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      borderBottom: i === a.length - 1 ? 'none' : `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t1,
      fontWeight: 500
    }
  }, n.l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 1
    }
  }, n.sub)), /*#__PURE__*/React.createElement(Toggle, {
    on: settings.notifications[n.k],
    onChange: () => toggle(n.k),
    accent: accent
  }))))), /*#__PURE__*/React.createElement(Section, {
    title: "App"
  }, /*#__PURE__*/React.createElement(GroupedList, null, /*#__PURE__*/React.createElement(Row, {
    icon: Ic.bell,
    iconBg: T.purple,
    title: "Reset demo data",
    sub: "Restore seed projects/tasks",
    onClick: () => {
      Backend.db.reset();
      toast('Demo data restored', 'success');
    }
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.signOut,
    title: "Sign out",
    danger: true,
    isLast: true,
    onClick: () => window.cortexxSignOut && window.cortexxSignOut()
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t3,
      padding: '14px 0'
    }
  }, "CortexBuild Pro \xB7 v2.0 (build 247) \xB7 ", user.company)));
}
const Toggle = ({
  on,
  onChange,
  accent
}) => /*#__PURE__*/React.createElement("button", {
  onClick: onChange,
  style: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 2,
    background: on ? accent : T.bg3,
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    flexShrink: 0,
    transition: 'background 0.2s'
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    width: 22,
    height: 22,
    borderRadius: 11,
    background: '#fff',
    transform: `translateX(${on ? 18 : 0}px)`,
    transition: 'transform 0.2s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
  }
}));

// ═══════════════════════════════════════════════════════════════════
// ADD TASK FLOW — AI parses natural language
// ═══════════════════════════════════════════════════════════════════
function AddTaskSheet({
  onClose,
  accent
}) {
  const projects = useDB('projects');
  const [input, setInput] = React.useState('');
  const [parsing, setParsing] = React.useState(false);
  const [parsed, setParsed] = React.useState(null);
  const examples = ['Order more plasterboard for Camden by Friday', 'High priority: sign Brixton snag list Monday', 'Aisha to check kitchen sockets tomorrow'];
  const parse = async text => {
    if (!text.trim() || parsing) return;
    setParsing(true);
    const result = await Backend.ai.parseTask(text);
    setParsed(result);
    setParsing(false);
  };
  const save = async () => {
    await Backend.db.tasks.create({
      t: parsed.title,
      projectId: parsed.projectId,
      assignee: parsed.assignee,
      prio: parsed.prio,
      due: parsed.due,
      done: false
    });
    onClose();
  };
  return /*#__PURE__*/React.createElement(Sheet, {
    onClose: onClose,
    height: "auto"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 20px 14px',
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 17,
      fontWeight: 600,
      color: T.t1
    }
  }, "New task ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.purple,
      fontSize: 12,
      fontWeight: 600,
      marginLeft: 4
    }
  }, "\xB7 AI-assisted")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 14,
      padding: '12px 14px',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("textarea", {
    value: input,
    onChange: e => {
      setInput(e.target.value);
      setParsed(null);
    },
    placeholder: "Describe a task in plain English\u2026",
    rows: 3,
    style: {
      width: '100%',
      background: 'transparent',
      border: 'none',
      color: T.t1,
      fontFamily: SF,
      fontSize: 14,
      lineHeight: 1.5,
      outline: 'none',
      resize: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3
    }
  }, parsing ? 'Cortex parsing…' : parsed ? 'Parsed below' : 'Try natural language'), /*#__PURE__*/React.createElement("button", {
    onClick: () => parse(input),
    disabled: !input.trim() || parsing,
    style: {
      background: input.trim() && !parsing ? T.purple : T.bg3,
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      padding: '6px 14px',
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600,
      cursor: input.trim() && !parsing ? 'pointer' : 'default',
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, React.cloneElement(Ic.spark, {
    size: 12
  }), " Parse"))), !parsed && !parsing && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6
    }
  }, "Examples"), examples.map((ex, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => setInput(ex),
    style: {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      background: 'transparent',
      border: 'none',
      color: T.blueL,
      fontFamily: SF,
      fontSize: 13,
      padding: '6px 0',
      cursor: 'pointer'
    }
  }, "\"", ex, "\""))), parsed && /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(135deg, ${T.purple}1a, ${accent}0a)`,
      border: `0.5px solid ${T.purple}44`,
      borderRadius: 14,
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.purple,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8
    }
  }, "Cortex understood"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 600,
      color: T.t1,
      marginBottom: 10
    }
  }, parsed.title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, parsed.projectId && /*#__PURE__*/React.createElement(Pill, {
    c: accent
  }, projects.find(p => p.id == parsed.projectId)?.name || 'project'), /*#__PURE__*/React.createElement(Pill, {
    c: T.cyan
  }, "\u2192 ", parsed.assignee), /*#__PURE__*/React.createElement(Pill, {
    c: PRIO_C[parsed.prio]
  }, parsed.prio), parsed.due && /*#__PURE__*/React.createElement(Pill, {
    c: T.amber
  }, formatTaskWhen(parsed.due))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: save,
    style: {
      flex: 1,
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 10,
      padding: '10px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Save task"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setParsed(null),
    style: {
      background: 'transparent',
      color: T.t2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 10,
      padding: '10px 14px',
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, "Edit")))));
}

// ═══════════════════════════════════════════════════════════════════
// RECEIPT SCANNER FLOW — mock OCR + AI categorization
// ═══════════════════════════════════════════════════════════════════
const MOCK_RECEIPTS = [{
  vendor: 'Travis Perkins',
  amount: 142.80
}, {
  vendor: 'Wickes',
  amount: 67.40
}, {
  vendor: 'Selco',
  amount: 234.50
}, {
  vendor: 'B&Q',
  amount: 18.99
}, {
  vendor: 'Toolstation',
  amount: 89.20
}, {
  vendor: 'Screwfix',
  amount: 45.75
}];
function ReceiptScanSheet({
  onClose,
  accent
}) {
  const projects = useDB('projects');
  const [stage, setStage] = React.useState('camera'); // camera -> scanning -> result
  const [receipt, setReceipt] = React.useState(null);
  const [ai, setAi] = React.useState(null);
  const scan = async () => {
    setStage('scanning');
    // Generate a unique realistic receipt via AI
    let mock;
    try {
      const prompt = `Generate a realistic UK construction trade receipt as JSON only: {"vendor":"...","amount":000.00}. Use UK trade vendors like Travis Perkins, Selco, Wickes, Toolstation, Screwfix, Jewson, B&Q. Amount £20-£500.`;
      const raw = await window.claude.complete({
        messages: [{
          role: 'user',
          content: prompt
        }]
      });
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      const parsed = JSON.parse(json);
      mock = {
        ...parsed,
        date: new Date().toISOString().slice(0, 10)
      };
    } catch (e) {
      mock = {
        vendor: 'Travis Perkins',
        amount: 142.80,
        date: new Date().toISOString().slice(0, 10)
      };
    }
    setReceipt(mock);
    // AI categorize
    const result = await Backend.ai.categorizeReceipt(mock);
    setAi(result);
    setStage('result');
  };
  const save = async () => {
    await Backend.db.receipts.create({
      vendor: receipt.vendor,
      amount: receipt.amount,
      date: receipt.date,
      category: ai.category,
      projectId: ai.projectId,
      assigned: true
    });
    onClose();
  };
  return /*#__PURE__*/React.createElement(Sheet, {
    onClose: onClose,
    height: "auto"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 20px 14px',
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 17,
      fontWeight: 600,
      color: T.t1
    }
  }, "Scan receipt"), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 24px'
    }
  }, stage === 'camera' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 220,
      borderRadius: 14,
      background: '#0a1830',
      border: `0.5px dashed ${T.hairMid}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "100%",
    height: "100%",
    style: {
      position: 'absolute',
      inset: 0
    }
  }, /*#__PURE__*/React.createElement("rect", {
    x: "20",
    y: "40",
    width: "80%",
    height: "140",
    fill: "none",
    stroke: accent,
    strokeWidth: "2",
    strokeDasharray: "8 6",
    opacity: "0.6"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      color: T.t3
    }
  }, React.cloneElement(Ic.camera, {
    size: 48,
    sw: 1.2
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      fontFamily: SF,
      fontSize: 13,
      color: T.t2,
      marginTop: 10
    }
  }, "Point camera at receipt")), /*#__PURE__*/React.createElement("button", {
    onClick: scan,
    style: {
      width: '100%',
      marginTop: 14,
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 14,
      padding: '14px',
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Tap to scan receipt")), stage === 'scanning' && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '50px 20px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      margin: '0 auto 18px',
      borderRadius: 14,
      background: `linear-gradient(135deg, ${T.purple}, ${accent})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      animation: 'pulse-scale 1.4s infinite'
    }
  }, React.cloneElement(Ic.spark, {
    size: 28
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 600,
      color: T.t1
    }
  }, "Reading receipt\u2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t2,
      marginTop: 6
    }
  }, "OCR + Cortex AI categorising"), /*#__PURE__*/React.createElement("style", null, `@keyframes pulse-scale {0%,100%{transform:scale(1);opacity:1}50%{transform:scale(0.92);opacity:0.7}}`)), stage === 'result' && receipt && ai && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 14,
      border: `0.5px solid ${T.hair}`,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10,
      color: T.t2,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    }
  }, "Vendor"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 17,
      fontWeight: 600,
      color: T.t1,
      marginTop: 2
    }
  }, receipt.vendor)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 22,
      color: T.t1,
      fontWeight: 700,
      letterSpacing: -0.5
    }
  }, "\xA3", receipt.amount.toFixed(2)))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(135deg, ${T.purple}1a, ${accent}0a)`,
      border: `0.5px solid ${T.purple}44`,
      borderRadius: 14,
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.purple,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    }
  }, "Cortex suggests"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t2
    }
  }, (ai.confidence * 100).toFixed(0), "% sure")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t2,
      width: 70
    }
  }, "Category"), /*#__PURE__*/React.createElement(Pill, {
    c: accent
  }, ai.category)), ai.projectId && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t2,
      width: 70
    }
  }, "Project"), /*#__PURE__*/React.createElement(Pill, {
    c: T.cyan
  }, projects.find(p => p.id == ai.projectId)?.name || 'unknown'))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: save,
    style: {
      flex: 1,
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 10,
      padding: '10px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Save & file"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setStage('camera'),
    style: {
      background: 'transparent',
      color: T.t2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 10,
      padding: '10px 14px',
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, "Edit"))))));
}

// ═══════════════════════════════════════════════════════════════════
// INVOICE CHASE — AI drafts email
// ═══════════════════════════════════════════════════════════════════
function ChaseSheet({
  invoice,
  onClose,
  accent
}) {
  const [draft, setDraft] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [sent, setSent] = React.useState(false);
  React.useEffect(() => {
    (async () => {
      const txt = await Backend.ai.draftChase(invoice.id);
      setDraft(txt);
      setLoading(false);
    })();
  }, [invoice.id]);
  const send = () => {
    setSent(true);
    setTimeout(onClose, 1000);
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
  }, "Cancel"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 600,
      color: T.t1
    }
  }, "Chase ", invoice.id), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 50
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '0 16px 20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 14,
      border: `0.5px solid ${T.hair}`,
      marginBottom: 12,
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      fontWeight: 600
    }
  }, invoice.client), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 11,
      color: T.t2,
      marginTop: 2
    }
  }, invoice.id, " \xB7 ", Math.abs(daysUntil(invoice.due)), "d overdue")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 18,
      color: T.red,
      fontWeight: 700
    }
  }, fmt(invoice.amount))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.purple,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, React.cloneElement(Ic.spark, {
    size: 12
  }), " Cortex draft"), loading ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: '40px 20px',
      border: `0.5px solid ${T.hair}`,
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 13,
      color: T.t2
    }
  }, "Drafting a polite chase\u2026") : /*#__PURE__*/React.createElement("textarea", {
    value: draft || '',
    onChange: e => setDraft(e.target.value),
    rows: 12,
    style: {
      width: '100%',
      boxSizing: 'border-box',
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 14,
      padding: 14,
      color: T.t1,
      fontFamily: SF,
      fontSize: 13,
      lineHeight: 1.5,
      outline: 'none',
      resize: 'vertical'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: send,
    disabled: loading || sent,
    style: {
      flex: 1,
      background: sent ? T.green : loading ? T.bg3 : accent,
      color: '#fff',
      border: 'none',
      borderRadius: 12,
      padding: '12px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: loading || sent ? 'default' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6
    }
  }, sent ? /*#__PURE__*/React.createElement(React.Fragment, null, Ic.check, " Sent") : React.cloneElement(Ic.send, {
    size: 15
  }), " ", !sent && 'Send email'), /*#__PURE__*/React.createElement("button", {
    onClick: () => window.cortexxInvoicePDF && window.cortexxInvoicePDF(invoice),
    title: "Export PDF",
    style: {
      background: 'transparent',
      color: T.t1,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 12,
      padding: '12px 14px',
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.cloneElement(Ic.download, {
    size: 15
  }), " PDF"))));
}
Object.assign(window, {
  MoneyScreen,
  SafetyScreen,
  ProfileScreen,
  Toggle,
  AddTaskSheet,
  ReceiptScanSheet,
  ChaseSheet
});