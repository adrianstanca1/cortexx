// Cortexx mobile dashboard — additional bolder variations (V7-V9)

// ═══════════════════════════════════════════════════════════════════
// V7 — TIMELINE / DAY VIEW (vertical day spine)
// ═══════════════════════════════════════════════════════════════════
function DashV7_Timeline({
  accent = T.blue
}) {
  const events = [{
    t: '07:30',
    n: 'Site arrival',
    d: 'Camden Mews',
    c: T.green,
    done: true,
    i: Ic.pin
  }, {
    t: '08:30',
    n: 'Toolbox talk',
    d: '4 attended',
    c: T.green,
    done: true,
    i: Ic.team
  }, {
    t: '10:00',
    n: 'First-fix sign-off',
    d: 'walk-through w/ Aisha',
    c: accent,
    now: true,
    i: Ic.check
  }, {
    t: '11:30',
    n: 'Approve timesheet',
    d: 'Tom · 42.5h',
    c: T.amber,
    i: Ic.clock
  }, {
    t: '13:00',
    n: 'Lunch · E. Lin',
    d: 'Hackney scope change',
    c: T.purple,
    i: Ic.team
  }, {
    t: '15:00',
    n: 'Sign Camden RAMS',
    d: 'expires Sat',
    c: T.red,
    i: Ic.alert
  }, {
    t: '17:00',
    n: 'Reconcile receipts',
    d: '3 items',
    c: T.cyan,
    i: Ic.receipt
  }];
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 150
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Today",
    subtitle: "Thu 30 Apr \xB7 7 events \xB7 1 now",
    ws: true,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.bell,
      count: window.CortexPortalMsgs && window.CortexPortalMsgs.unreadCount() || 0,
      accent: accent,
      onClick: () => window.cortexxNav && window.cortexxNav('inbox')
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 0',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 65,
      top: 6,
      bottom: 6,
      width: 1.5,
      background: T.hair
    }
  }), events.map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
      marginBottom: 12,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      paddingTop: 12,
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 12,
      fontWeight: 600,
      color: e.now ? accent : e.done ? T.t3 : T.t2,
      letterSpacing: -0.3
    }
  }, e.t)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 18,
      paddingTop: 14,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 14,
      height: 14,
      borderRadius: 7,
      background: e.now ? accent : e.done ? T.green : T.bg2,
      border: `2px solid ${e.now ? '#fff' : e.done ? T.green : T.hair}`,
      boxShadow: e.now ? `0 0 0 4px ${accent}33, 0 0 12px ${accent}` : 'none',
      margin: '0 auto',
      position: 'relative',
      zIndex: 1
    }
  }), e.now && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 14,
      left: '50%',
      width: 14,
      height: 14,
      borderRadius: 7,
      background: accent,
      transform: 'translateX(-50%)',
      opacity: 0.4,
      animation: 'pulse 2s infinite'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: e.now ? `linear-gradient(135deg, ${accent}22, ${accent}0a)` : T.bg2,
      border: e.now ? `0.5px solid ${accent}66` : `0.5px solid ${T.hair}`,
      borderRadius: 12,
      padding: '10px 12px',
      opacity: e.done ? 0.55 : 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 24,
      height: 24,
      borderRadius: 6,
      background: `${e.c}22`,
      color: e.c,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.cloneElement(e.i, {
    size: 13
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      color: T.t1,
      textDecoration: e.done ? 'line-through' : 'none',
      lineHeight: 1.2
    }
  }, e.n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 1
    }
  }, e.d)), e.now && /*#__PURE__*/React.createElement(Pill, {
    c: accent,
    solid: true,
    size: "xs"
  }, "NOW"))))))), /*#__PURE__*/React.createElement(TabBar, {
    accent: accent
  }), /*#__PURE__*/React.createElement("style", null, '@keyframes pulse{0%{transform:translateX(-50%) scale(1);opacity:0.4}100%{transform:translateX(-50%) scale(2.5);opacity:0}}'));
}

// ═══════════════════════════════════════════════════════════════════
// V8 — FINANCIAL FOCUS (cash-first, money in your face)
// ═══════════════════════════════════════════════════════════════════
function DashV8_Money({
  accent = T.green
}) {
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 150
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Books",
    subtitle: "Wk 17 \xB7 CIS aware",
    ws: true,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.bell,
      count: window.CortexPortalMsgs && window.CortexPortalMsgs.unreadCount() || 0,
      accent: accent,
      onClick: () => window.cortexxNav && window.cortexxNav('inbox')
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 20px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 1
    }
  }, "Net cashflow \xB7 April"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8,
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 48,
      fontWeight: 700,
      color: T.t1,
      letterSpacing: -1.5,
      lineHeight: 1
    }
  }, "+\xA318.2k")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      fontFamily: SF,
      fontSize: 13,
      color: T.green,
      fontWeight: 500
    }
  }, React.cloneElement(Ic.trend, {
    size: 14
  }), " ", /*#__PURE__*/React.createElement("span", null, "+24% vs March"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.t3,
      marginLeft: 4
    }
  }, "\xB7 5 days left")), /*#__PURE__*/React.createElement("svg", {
    width: "100%",
    height: "80",
    viewBox: "0 0 320 80",
    style: {
      marginTop: 14
    },
    preserveAspectRatio: "none"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "sparkfill",
    x1: "0",
    x2: "0",
    y1: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: accent,
    stopOpacity: "0.4"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: accent,
    stopOpacity: "0"
  }))), [0, 20, 40, 60].map(y => /*#__PURE__*/React.createElement("line", {
    key: y,
    x1: "0",
    x2: "320",
    y1: y,
    y2: y,
    stroke: T.hair,
    strokeWidth: "0.5"
  })), /*#__PURE__*/React.createElement("polyline", {
    points: "0,55 30,50 60,52 90,40 120,45 150,30 180,35 210,22 240,28 270,15 300,18 320,8",
    fill: "none",
    stroke: accent,
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "0,55 30,50 60,52 90,40 120,45 150,30 180,35 210,22 240,28 270,15 300,18 320,8 320,80 0,80",
    fill: "url(#sparkfill)",
    stroke: "none"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "320",
    cy: "8",
    r: "4",
    fill: accent
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "320",
    cy: "8",
    r: "8",
    fill: accent,
    opacity: "0.3"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontFamily: SFMono,
      fontSize: 9,
      color: T.t3,
      marginTop: 4
    }
  }, ['Apr 1', '7', '14', '21', '28', '30'].map(d => /*#__PURE__*/React.createElement("span", {
    key: d
  }, d)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 14px',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: `${T.green}1a`,
      border: `0.5px solid ${T.green}33`,
      borderRadius: 14,
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10,
      fontWeight: 700,
      color: T.green,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    }
  }, "IN"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.green
    }
  }, React.cloneElement(Ic.arrowUp, {
    size: 14
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 22,
      fontWeight: 700,
      color: T.t1,
      marginTop: 4,
      letterSpacing: -0.5
    }
  }, "\xA342.6k"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 1
    }
  }, "4 invoices paid")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: `${T.red}1a`,
      border: `0.5px solid ${T.red}33`,
      borderRadius: 14,
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10,
      fontWeight: 700,
      color: T.red,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    }
  }, "OUT"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.red,
      transform: 'rotate(180deg)'
    }
  }, React.cloneElement(Ic.arrowUp, {
    size: 14
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 22,
      fontWeight: 700,
      color: T.t1,
      marginTop: 4,
      letterSpacing: -0.5
    }
  }, "\xA324.4k"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 1
    }
  }, "materials + wages"))), /*#__PURE__*/React.createElement("div", {
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
  }, "Outstanding \xB7 \xA314.2k"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: accent,
      fontWeight: 500
    }
  }, "Chase all")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, [{
    n: 'INV-2042',
    c: 'Camden Mews',
    a: '£8,420',
    d: '3d',
    col: T.amber
  }, {
    n: 'INV-2039',
    c: 'Tonic Café',
    a: '£3,890',
    d: '14d late',
    col: T.red
  }, {
    n: 'INV-2041',
    c: 'Hackney Loft',
    a: '£1,900',
    d: '12d',
    col: T.t1
  }].map((iv, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: T.bg2,
      borderRadius: 10,
      padding: '10px 12px',
      border: `0.5px solid ${T.hair}`,
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 4,
      alignSelf: 'stretch',
      borderRadius: 2,
      background: iv.col
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 11,
      color: T.t2,
      fontWeight: 600
    }
  }, iv.n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      fontWeight: 500,
      marginTop: 1
    }
  }, iv.c)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 14,
      color: iv.col,
      fontWeight: 700
    }
  }, iv.a), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10,
      color: T.t3,
      marginTop: 1
    }
  }, iv.d)))))), /*#__PURE__*/React.createElement(TabBar, {
    accent: accent
  }));
}

// ═══════════════════════════════════════════════════════════════════
// V9 — STORIES (horizontal swipeable site cards, IG-style)
// ═══════════════════════════════════════════════════════════════════
function DashV9_Stories({
  accent = T.purple
}) {
  const stories = [{
    n: 'Camden',
    sub: '68%',
    c: accent,
    ring: true
  }, {
    n: 'Hackney',
    sub: '22%',
    c: T.blue
  }, {
    n: 'Brixton',
    sub: '90%',
    c: T.amber,
    ring: true
  }, {
    n: 'Islington',
    sub: 'quote',
    c: T.cyan
  }, {
    n: 'New',
    sub: '+',
    c: T.t3,
    plus: true
  }];
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 150
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Sites",
    subtitle: "Swipe through \xB7 5 active",
    ws: true,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.bell,
      count: window.CortexPortalMsgs && window.CortexPortalMsgs.unreadCount() || 0,
      accent: accent,
      onClick: () => window.cortexxNav && window.cortexxNav('inbox')
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 16px',
      display: 'flex',
      gap: 14,
      overflowX: 'auto',
      scrollbarWidth: 'none'
    }
  }, stories.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flexShrink: 0,
      textAlign: 'center',
      width: 64
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 60,
      height: 60,
      borderRadius: 30,
      padding: 2.5,
      background: s.ring ? `conic-gradient(from 0deg, ${s.c}, ${T.purple}, ${s.c})` : s.plus ? 'transparent' : T.hair,
      border: s.plus ? `1.5px dashed ${T.t3}` : 'none',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      background: s.plus ? 'transparent' : `linear-gradient(135deg, ${s.c}, ${s.c}88)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: SF,
      fontSize: s.plus ? 24 : 16,
      fontWeight: 700,
      color: s.plus ? T.t3 : '#fff'
    }
  }, s.plus ? '+' : s.n[0])), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t1,
      fontWeight: 500,
      marginTop: 5
    }
  }, s.n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 9,
      color: T.t3
    }
  }, s.sub)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(160deg, ${accent}33, ${T.bg2} 60%)`,
      borderRadius: 18,
      padding: 16,
      border: `0.5px solid ${accent}44`,
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Pill, {
    c: accent,
    solid: true,
    size: "xs"
  }, "FEATURED"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 20,
      fontWeight: 700,
      color: T.t1,
      marginTop: 8,
      letterSpacing: -0.4
    }
  }, "Camden Mews Refurb"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t2,
      marginTop: 2
    }
  }, "J. Patterson \xB7 NW1")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 28,
      fontWeight: 700,
      color: accent,
      letterSpacing: -1
    }
  }, "68", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      color: T.t2
    }
  }, "%"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 4,
      marginTop: 14
    }
  }, [1, 1, 1, 0.5, 0].map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      height: 4,
      borderRadius: 2,
      background: p === 0 ? T.hair : T.green,
      opacity: p === 0.5 ? 0.5 : 1
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontFamily: SFMono,
      fontSize: 9,
      color: T.t3,
      marginTop: 6
    }
  }, ['Strip', '1st fix', 'Plaster', '2nd fix', 'Snag'].map(s => /*#__PURE__*/React.createElement("span", {
    key: s
  }, s))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 14,
      paddingTop: 12,
      borderTop: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex'
    }
  }, ['Tom Reilly', 'Aisha B', 'Jack M', 'Sara K'].map((n, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      marginLeft: i ? -8 : 0,
      border: `2px solid ${T.bg0}`,
      borderRadius: '50%'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: n,
    size: 26,
    c: [T.blue, T.amber, T.green, T.purple][i]
  })))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, "4 on site now"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => window.cortexxNav && window.cortexxNav('capture'),
    style: {
      background: '#fff',
      color: T.bg0,
      border: 'none',
      borderRadius: 10,
      padding: '7px 14px',
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Open")))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 20px 8px'
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
  }, "Activity feed")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, [{
    who: 'Tom Reilly',
    act: 'uploaded 4 photos',
    loc: 'Camden Mews',
    t: '12 min',
    c: T.blue,
    i: Ic.camera
  }, {
    who: 'Cortex AI',
    act: 'flagged margin slip on Brixton',
    loc: '−1.2% vs quote',
    t: '1 hr',
    c: T.purple,
    i: Ic.spark
  }, {
    who: 'Aisha Begum',
    act: 'completed first-fix electrics',
    loc: 'Camden · kitchen',
    t: '2 hr',
    c: T.amber,
    i: Ic.check
  }].map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: T.bg2,
      borderRadius: 12,
      padding: '10px 12px',
      border: `0.5px solid ${T.hair}`,
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: a.who,
    size: 32,
    c: a.c
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      lineHeight: 1.3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600
    }
  }, a.who), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.t2
    }
  }, a.act)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3,
      marginTop: 1
    }
  }, a.loc, " \xB7 ", a.t, " ago")), /*#__PURE__*/React.createElement("div", {
    style: {
      color: a.c,
      opacity: 0.7
    }
  }, React.cloneElement(a.i, {
    size: 14
  })))))), /*#__PURE__*/React.createElement(TabBar, {
    accent: accent
  }));
}
Object.assign(window, {
  DashV7_Timeline,
  DashV8_Money,
  DashV9_Stories
});