function DashV10_Rings({
  accent = T.blue
}) {
  const rings = [{
    l: 'Billable',
    v: 32.5,
    max: 40,
    c: '#ff375f',
    u: 'h'
  }, {
    l: 'Margin',
    v: 24,
    max: 30,
    c: '#a8ff35',
    u: '%'
  }, {
    l: 'Sites',
    v: 3,
    max: 5,
    c: '#00d4ff',
    u: ''
  }];
  const ringSize = 220;
  const stroke = 22;
  const radii = [88, 64, 40];
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 150
    }
  }, React.createElement(MobileHeader, {
    title: "This week",
    subtitle: "Mon \u2014 Sun \xB7 Wk 17",
    ws: true,
    right: React.createElement(HeaderBtn, {
      icon: Ic.bell,
      count: window.CortexPortalMsgs && window.CortexPortalMsgs.unreadCount() || 0,
      accent: accent,
      onClick: () => window.cortexxNav && window.cortexxNav('inbox')
    })
  }), React.createElement("div", {
    style: {
      padding: '8px 0 14px',
      display: 'flex',
      justifyContent: 'center'
    }
  }, React.createElement("svg", {
    width: ringSize,
    height: ringSize,
    viewBox: `0 0 ${ringSize} ${ringSize}`
  }, rings.map((r, i) => {
    const radius = radii[i];
    const circ = 2 * Math.PI * radius;
    const pct = Math.min(r.v / r.max, 1);
    return React.createElement("g", {
      key: i,
      transform: `translate(${ringSize / 2},${ringSize / 2}) rotate(-90)`
    }, React.createElement("circle", {
      r: radius,
      fill: "none",
      stroke: `${r.c}25`,
      strokeWidth: stroke
    }), React.createElement("circle", {
      r: radius,
      fill: "none",
      stroke: r.c,
      strokeWidth: stroke,
      strokeLinecap: "round",
      strokeDasharray: `${circ * pct} ${circ}`
    }));
  }))), React.createElement("div", {
    style: {
      padding: '0 16px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, rings.map((r, i) => React.createElement("div", {
    key: i,
    style: {
      background: T.bg2,
      borderRadius: 12,
      padding: '12px 14px',
      border: `0.5px solid ${T.hair}`,
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 5,
      background: r.c,
      boxShadow: `0 0 8px ${r.c}88`
    }
  }), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t2,
      fontWeight: 600
    }
  }, r.l), React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 18,
      color: T.t1,
      fontWeight: 700,
      marginTop: 1,
      letterSpacing: -0.4
    }
  }, r.v, r.u, " ", React.createElement("span", {
    style: {
      color: T.t3,
      fontSize: 13
    }
  }, "/ ", r.max, r.u))), React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 16,
      color: r.c,
      fontWeight: 700
    }
  }, Math.round(r.v / r.max * 100), "%")))), React.createElement("div", {
    style: {
      padding: '0 16px 14px'
    }
  }, React.createElement("div", {
    style: {
      background: `linear-gradient(135deg, ${T.amber}22, ${T.red}22)`,
      border: `0.5px solid ${T.amber}44`,
      borderRadius: 14,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      color: T.amber
    }
  }, React.cloneElement(Ic.fire, {
    size: 24
  })), React.createElement("div", {
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
  }, "4-week streak"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, "Margin goal hit every week this month")), React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 22,
      color: T.amber,
      fontWeight: 700
    }
  }, "4")))), React.createElement(TabBar, {
    accent: accent
  }));
}
function DashV11_Map({
  accent = T.blue
}) {
  const sites = [{
    n: 'Camden',
    x: 145,
    y: 90,
    c: T.green,
    sz: 12,
    pct: 68
  }, {
    n: 'Hackney',
    x: 230,
    y: 110,
    c: T.green,
    sz: 10,
    pct: 22
  }, {
    n: 'Brixton',
    x: 165,
    y: 220,
    c: T.amber,
    sz: 11,
    pct: 90
  }, {
    n: 'Islington',
    x: 175,
    y: 75,
    c: T.purple,
    sz: 8,
    pct: 0
  }, {
    n: 'Streatham',
    x: 175,
    y: 270,
    c: T.t3,
    sz: 7,
    pct: 100
  }];
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 150
    }
  }, React.createElement(MobileHeader, {
    title: "Sites",
    subtitle: "Greater London \xB7 5 active",
    ws: true,
    right: React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, React.createElement(HeaderBtn, {
      icon: Ic.filter
    }), React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent
    }))
  }), React.createElement("div", {
    style: {
      padding: '0 16px 14px'
    }
  }, React.createElement("div", {
    style: {
      position: 'relative',
      borderRadius: 16,
      overflow: 'hidden',
      background: '#0d1a2e',
      border: `0.5px solid ${T.hair}`,
      height: 320
    }
  }, React.createElement("svg", {
    width: "100%",
    height: "100%",
    viewBox: "0 0 360 320",
    preserveAspectRatio: "xMidYMid slice"
  }, React.createElement("defs", null, React.createElement("pattern", {
    id: "mapgrid",
    width: "32",
    height: "32",
    patternUnits: "userSpaceOnUse"
  }, React.createElement("path", {
    d: "M 32 0 L 0 0 0 32",
    fill: "none",
    stroke: T.hair,
    strokeWidth: "0.5"
  }))), React.createElement("rect", {
    width: "100%",
    height: "100%",
    fill: "url(#mapgrid)"
  }), React.createElement("path", {
    d: "M -10 200 Q 80 180 140 200 T 280 195 Q 340 200 380 185",
    fill: "none",
    stroke: `${T.cyan}55`,
    strokeWidth: "14",
    strokeLinecap: "round"
  }), React.createElement("path", {
    d: "M -10 200 Q 80 180 140 200 T 280 195 Q 340 200 380 185",
    fill: "none",
    stroke: `${T.cyan}88`,
    strokeWidth: "2",
    strokeLinecap: "round"
  }), ['M 60 0 L 80 320', 'M 200 0 L 220 320', 'M 0 60 L 360 80', 'M 0 140 L 360 130', 'M 0 260 L 360 270'].map((d, i) => React.createElement("path", {
    key: i,
    d: d,
    stroke: T.hair,
    strokeWidth: "0.8",
    fill: "none"
  })), sites.map((s, i) => React.createElement("g", {
    key: i,
    transform: `translate(${s.x},${s.y})`
  }, React.createElement("circle", {
    r: s.sz + 8,
    fill: s.c,
    opacity: "0.15"
  }), React.createElement("circle", {
    r: s.sz,
    fill: s.c,
    opacity: "0.4"
  }), React.createElement("circle", {
    r: s.sz - 4,
    fill: s.c
  }), s.c === T.green && React.createElement("circle", {
    r: s.sz + 4,
    fill: "none",
    stroke: s.c,
    strokeWidth: "1"
  }, React.createElement("animate", {
    attributeName: "r",
    values: `${s.sz};${s.sz + 12}`,
    dur: "2s",
    repeatCount: "indefinite"
  }), React.createElement("animate", {
    attributeName: "opacity",
    values: "1;0",
    dur: "2s",
    repeatCount: "indefinite"
  })), React.createElement("text", {
    x: "0",
    y: -s.sz - 6,
    fontSize: "10",
    fontFamily: SF,
    fontWeight: "600",
    fill: T.t1,
    textAnchor: "middle"
  }, s.n), React.createElement("text", {
    x: "0",
    y: -s.sz - 17,
    fontSize: "8",
    fontFamily: SFMono,
    fill: s.c,
    textAnchor: "middle"
  }, s.pct, "%"))), React.createElement("g", {
    transform: "translate(145,90)"
  }, React.createElement("circle", {
    r: "6",
    fill: accent,
    stroke: "#fff",
    strokeWidth: "2"
  }), React.createElement("circle", {
    r: "14",
    fill: accent,
    opacity: "0.25"
  }, React.createElement("animate", {
    attributeName: "r",
    values: "6;20",
    dur: "2.5s",
    repeatCount: "indefinite"
  }), React.createElement("animate", {
    attributeName: "opacity",
    values: "0.4;0",
    dur: "2.5s",
    repeatCount: "indefinite"
  })))), React.createElement("div", {
    style: {
      position: 'absolute',
      top: 10,
      left: 10,
      background: 'rgba(6,16,30,0.7)',
      backdropFilter: 'blur(12px)',
      borderRadius: 8,
      padding: '6px 10px',
      border: `0.5px solid ${T.hair}`,
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t2,
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }
  }, React.createElement("div", null, React.createElement("span", {
    style: {
      color: T.green
    }
  }, "\u25CF"), " active"), React.createElement("div", null, React.createElement("span", {
    style: {
      color: T.amber
    }
  }, "\u25CF"), " snagging"), React.createElement("div", null, React.createElement("span", {
    style: {
      color: T.purple
    }
  }, "\u25CF"), " quoting")), React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 10,
      right: 10,
      background: 'rgba(6,16,30,0.7)',
      backdropFilter: 'blur(12px)',
      borderRadius: 8,
      padding: '6px 10px',
      border: `0.5px solid ${T.hair}`,
      fontFamily: SFMono,
      fontSize: 10,
      color: T.blueL,
      fontWeight: 600
    }
  }, "You \xB7 Camden"))), React.createElement("div", {
    style: {
      padding: '0 20px 8px'
    }
  }, React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 700,
      color: T.t2,
      textTransform: 'uppercase',
      letterSpacing: 0.6
    }
  }, "Nearest to you")), React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, [{
    n: 'Camden Mews',
    d: '0 m · you are here',
    c: T.green,
    t: 'Now'
  }, {
    n: 'Islington Ext.',
    d: '1.2 mi · 8 min',
    c: T.purple,
    t: 'Quote due'
  }, {
    n: 'Hackney Loft',
    d: '3.4 mi · 14 min',
    c: T.green,
    t: '2 on site'
  }].map((s, i) => React.createElement("div", {
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
  }, React.createElement("div", {
    style: {
      color: s.c
    }
  }, React.cloneElement(Ic.pin, {
    size: 18
  })), React.createElement("div", {
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
  }, s.n), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, s.d)), React.createElement(Pill, {
    c: s.c,
    size: "xs"
  }, s.t))))), React.createElement(TabBar, {
    accent: accent
  }));
}
function DashV12_Focus({
  accent = T.green
}) {
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 150,
      display: 'flex',
      flexDirection: 'column'
    }
  }, React.createElement("div", {
    style: {
      padding: '14px 24px 0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 11,
      color: T.t3,
      letterSpacing: 1
    }
  }, "09:41 \xB7 THU 30 APR"), React.createElement("div", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 3,
      background: accent,
      boxShadow: `0 0 8px ${accent}`
    }
  })), React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '0 28px'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: accent,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 2,
      marginBottom: 14
    }
  }, "\u25C7 Focus on"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 38,
      fontWeight: 600,
      color: T.t1,
      letterSpacing: -1,
      lineHeight: 1.05
    }
  }, "First-fix sign-off at Camden."), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 16,
      color: T.t2,
      marginTop: 16,
      lineHeight: 1.5
    }
  }, "Walk through with Aisha. Confirm electrics OK to plaster. ", React.createElement("span", {
    style: {
      color: T.t3
    }
  }, "Should take 30 min.")), React.createElement("div", {
    style: {
      marginTop: 36,
      display: 'flex',
      gap: 10
    }
  }, React.createElement("button", {
    onClick: () => window.cortexxNav && window.cortexxNav('capture'),
    style: {
      flex: 1,
      background: accent,
      color: '#06101e',
      border: 'none',
      borderRadius: 14,
      padding: '16px 18px',
      fontFamily: SF,
      fontSize: 16,
      fontWeight: 700,
      cursor: 'pointer',
      boxShadow: `0 8px 24px ${accent}55`
    }
  }, "Start now"), React.createElement("button", {
    onClick: () => window.cortexxNav && window.cortexxNav('capture'),
    style: {
      background: 'transparent',
      color: T.t2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 14,
      padding: '16px 20px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, "Snooze")), React.createElement("div", {
    style: {
      marginTop: 40,
      paddingTop: 20,
      borderTop: `0.5px solid ${T.hair}`
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 10
    }
  }, "After this"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t2,
      lineHeight: 1.6
    }
  }, React.createElement("span", {
    style: {
      color: T.t1
    }
  }, "Approve Tom's timesheet"), " at 11:30,", React.createElement("br", null), React.createElement("span", {
    style: {
      color: T.t1
    }
  }, "lunch with E. Lin"), " at 13:00."))), React.createElement("div", {
    style: {
      padding: '0 24px 20px',
      textAlign: 'center'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t3,
      letterSpacing: 0.5
    }
  }, "+4 hidden \xB7 tap to expand"))), React.createElement(TabBar, {
    accent: accent
  }));
}
Object.assign(window, {
  DashV10_Rings,
  DashV11_Map,
  DashV12_Focus
});