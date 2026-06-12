// CortexBuild Pro — Observability inspector screen (Phase 109)

function ObservabilityScreen({
  accent
}) {
  const O = window.CortexObs;
  if (!O) return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: T.t2
    }
  }, "Observability not loaded."));
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    const id = setInterval(force, 1500);
    return () => clearInterval(id);
  }, []);
  const counters = O.counters();
  const v = O.vitals();
  const crumbs = O.crumbs(40).reverse();
  const events = O.recent(40).filter(e => e.kind === 'span').reverse();
  const Card = ({
    children
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, children);
  const Stat = ({
    l,
    v,
    c,
    sub
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 10,
      borderRadius: 8,
      background: T.bg1,
      textAlign: 'center',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: T.t2,
      marginBottom: 4,
      letterSpacing: 0.4
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 800,
      color: c || T.t1,
      fontFamily: SFMono,
      letterSpacing: -0.4
    }
  }, v == null ? '—' : v), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: T.t2,
      marginTop: 2
    }
  }, sub));
  const vitalsBucket = k => {
    const val = v[k];
    if (val == null) return T.t2;
    const t = {
      ttfb: [800, 1800],
      fcp: [1800, 3000],
      lcp: [2500, 4000],
      inp: [200, 500]
    }[k];
    if (!t) return T.t1;
    return val <= t[0] ? T.green : val <= t[1] ? T.amber : T.red;
  };
  const Pill = ({
    level,
    children
  }) => /*#__PURE__*/React.createElement("span", {
    style: {
      padding: '2px 7px',
      borderRadius: 5,
      fontSize: 9,
      fontFamily: SFMono,
      fontWeight: 700,
      letterSpacing: 0.4,
      background: level === 'error' ? T.red + '30' : level === 'warning' ? T.amber + '30' : T.bg1,
      color: level === 'error' ? T.red : level === 'warning' ? T.amber : T.t2
    }
  }, children);
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Observability",
    subtitle: "Live breadcrumbs \xB7 vitals \xB7 spans"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 18px 110px',
      fontFamily: SF
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "WEB VITALS"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    l: "TTFB",
    v: v.ttfb != null ? v.ttfb + 'ms' : null,
    c: vitalsBucket('ttfb')
  }), /*#__PURE__*/React.createElement(Stat, {
    l: "FCP",
    v: v.fcp != null ? v.fcp + 'ms' : null,
    c: vitalsBucket('fcp')
  }), /*#__PURE__*/React.createElement(Stat, {
    l: "LCP",
    v: v.lcp != null ? v.lcp + 'ms' : null,
    c: vitalsBucket('lcp')
  }), /*#__PURE__*/React.createElement(Stat, {
    l: "INP",
    v: v.inp != null ? v.inp + 'ms' : null,
    c: vitalsBucket('inp')
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    l: "CLS",
    v: v.cls
  }), /*#__PURE__*/React.createElement(Stat, {
    l: "LONG TASKS",
    v: v.longTasks,
    c: v.longTasks > 5 ? T.amber : T.t1
  }), /*#__PURE__*/React.createElement(Stat, {
    l: "HEAP",
    v: v.heapMB != null ? v.heapMB + 'mb' : null,
    sub: v.heapLimitMB ? 'of ' + v.heapLimitMB + 'mb' : ''
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "SESSION COUNTERS"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    l: "CLICKS",
    v: counters.click
  }), /*#__PURE__*/React.createElement(Stat, {
    l: "NAV",
    v: counters.nav
  }), /*#__PURE__*/React.createElement(Stat, {
    l: "FETCH",
    v: counters.fetch
  }), /*#__PURE__*/React.createElement(Stat, {
    l: "ERRORS",
    v: counters.error,
    c: counters.error > 0 ? T.red : T.t1
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    l: "SPANS",
    v: counters.txTotal
  }), /*#__PURE__*/React.createElement(Stat, {
    l: "SLOW (>1.5s)",
    v: counters.txSlow,
    c: counters.txSlow > 0 ? T.amber : T.t1
  })), events.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "RECENT SPANS \xB7 ", events.length), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, events.slice(0, 12).map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      marginTop: 4,
      padding: 8,
      borderRadius: 8,
      background: T.bg2,
      border: '1px solid ' + (e.slow ? T.amber + '50' : T.hair),
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 12,
      color: T.t1,
      fontFamily: SFMono,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, e.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontFamily: SFMono,
      color: e.slow ? T.amber : e.ok === false ? T.red : T.t2,
      marginLeft: 8
    }
  }, e.ms, "ms"), e.ok === false && /*#__PURE__*/React.createElement(Pill, {
    level: "error"
  }, "FAIL"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6,
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", null, "BREADCRUMBS \xB7 ", crumbs.length), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      O.clear();
      force();
    },
    style: {
      padding: '2px 8px',
      borderRadius: 4,
      border: '1px solid ' + T.hair,
      background: 'transparent',
      color: T.t2,
      fontSize: 10,
      fontFamily: SF,
      cursor: 'pointer'
    }
  }, "Clear")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      padding: 10,
      borderRadius: 12,
      background: T.bg2,
      border: '1px solid ' + T.hair,
      maxHeight: 380,
      overflow: 'auto'
    }
  }, crumbs.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '6px 0',
      borderBottom: i < crumbs.length - 1 ? '1px solid ' + T.hair : 'none',
      display: 'flex',
      gap: 8,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 50,
      fontSize: 9,
      fontFamily: SFMono,
      color: T.t3,
      flexShrink: 0,
      paddingTop: 2
    }
  }, new Date(c.ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 110,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    level: c.level
  }, c.category)), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 11,
      color: T.t1,
      lineHeight: 1.4,
      wordBreak: 'break-word'
    }
  }, c.message))), crumbs.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      textAlign: 'center',
      color: T.t2,
      fontSize: 12
    }
  }, "No breadcrumbs yet \u2014 interact with the app.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      padding: 12,
      fontSize: 11,
      color: T.t2,
      lineHeight: 1.5
    }
  }, "All in-memory \xB7 auto-attached to error reports when CortexCrash has a DSN. Use ", /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "CortexObs.span(name, fn)"), " to time critical paths.")));
}
Object.assign(window, {
  ObservabilityScreen
});