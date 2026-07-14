function ObservabilityScreen({
  accent
}) {
  const O = window.CortexObs;
  if (!O) return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
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
  }) => React.createElement("div", {
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
  }) => React.createElement("div", {
    style: {
      flex: 1,
      padding: 10,
      borderRadius: 8,
      background: T.bg1,
      textAlign: 'center',
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 9,
      color: T.t2,
      marginBottom: 4,
      letterSpacing: 0.4
    }
  }, l), React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 800,
      color: c || T.t1,
      fontFamily: SFMono,
      letterSpacing: -0.4
    }
  }, v == null ? '—' : v), sub && React.createElement("div", {
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
  }) => React.createElement("span", {
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
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement(MobileHeader, {
    title: "Observability",
    subtitle: "Live breadcrumbs \xB7 vitals \xB7 spans"
  }), React.createElement("div", {
    style: {
      padding: '0 18px 110px',
      fontFamily: SF
    }
  }, React.createElement("div", {
    style: {
      marginTop: 14,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "WEB VITALS"), React.createElement("div", {
    style: {
      marginTop: 8,
      display: 'flex',
      gap: 6
    }
  }, React.createElement(Stat, {
    l: "TTFB",
    v: v.ttfb != null ? v.ttfb + 'ms' : null,
    c: vitalsBucket('ttfb')
  }), React.createElement(Stat, {
    l: "FCP",
    v: v.fcp != null ? v.fcp + 'ms' : null,
    c: vitalsBucket('fcp')
  }), React.createElement(Stat, {
    l: "LCP",
    v: v.lcp != null ? v.lcp + 'ms' : null,
    c: vitalsBucket('lcp')
  }), React.createElement(Stat, {
    l: "INP",
    v: v.inp != null ? v.inp + 'ms' : null,
    c: vitalsBucket('inp')
  })), React.createElement("div", {
    style: {
      marginTop: 8,
      display: 'flex',
      gap: 6
    }
  }, React.createElement(Stat, {
    l: "CLS",
    v: v.cls
  }), React.createElement(Stat, {
    l: "LONG TASKS",
    v: v.longTasks,
    c: v.longTasks > 5 ? T.amber : T.t1
  }), React.createElement(Stat, {
    l: "HEAP",
    v: v.heapMB != null ? v.heapMB + 'mb' : null,
    sub: v.heapLimitMB ? 'of ' + v.heapLimitMB + 'mb' : ''
  })), React.createElement("div", {
    style: {
      marginTop: 18,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "SESSION COUNTERS"), React.createElement("div", {
    style: {
      marginTop: 8,
      display: 'flex',
      gap: 6
    }
  }, React.createElement(Stat, {
    l: "CLICKS",
    v: counters.click
  }), React.createElement(Stat, {
    l: "NAV",
    v: counters.nav
  }), React.createElement(Stat, {
    l: "FETCH",
    v: counters.fetch
  }), React.createElement(Stat, {
    l: "ERRORS",
    v: counters.error,
    c: counters.error > 0 ? T.red : T.t1
  })), React.createElement("div", {
    style: {
      marginTop: 8,
      display: 'flex',
      gap: 6
    }
  }, React.createElement(Stat, {
    l: "SPANS",
    v: counters.txTotal
  }), React.createElement(Stat, {
    l: "SLOW (>1.5s)",
    v: counters.txSlow,
    c: counters.txSlow > 0 ? T.amber : T.t1
  })), events.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      marginTop: 18,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "RECENT SPANS \xB7 ", events.length), React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, events.slice(0, 12).map((e, i) => React.createElement("div", {
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
  }, React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 12,
      color: T.t1,
      fontFamily: SFMono,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, e.name), React.createElement("span", {
    style: {
      fontSize: 11,
      fontFamily: SFMono,
      color: e.slow ? T.amber : e.ok === false ? T.red : T.t2,
      marginLeft: 8
    }
  }, e.ms, "ms"), e.ok === false && React.createElement(Pill, {
    level: "error"
  }, "FAIL"))))), React.createElement("div", {
    style: {
      marginTop: 18,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6,
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, React.createElement("span", null, "BREADCRUMBS \xB7 ", crumbs.length), React.createElement("button", {
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
  }, "Clear")), React.createElement("div", {
    style: {
      marginTop: 6,
      padding: 10,
      borderRadius: 12,
      background: T.bg2,
      border: '1px solid ' + T.hair,
      maxHeight: 380,
      overflow: 'auto'
    }
  }, crumbs.map((c, i) => React.createElement("div", {
    key: i,
    style: {
      padding: '6px 0',
      borderBottom: i < crumbs.length - 1 ? '1px solid ' + T.hair : 'none',
      display: 'flex',
      gap: 8,
      alignItems: 'flex-start'
    }
  }, React.createElement("span", {
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
  })), React.createElement("span", {
    style: {
      width: 110,
      flexShrink: 0
    }
  }, React.createElement(Pill, {
    level: c.level
  }, c.category)), React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 11,
      color: T.t1,
      lineHeight: 1.4,
      wordBreak: 'break-word'
    }
  }, c.message))), crumbs.length === 0 && React.createElement("div", {
    style: {
      padding: 14,
      textAlign: 'center',
      color: T.t2,
      fontSize: 12
    }
  }, "No breadcrumbs yet \u2014 interact with the app.")), React.createElement("div", {
    style: {
      marginTop: 16,
      padding: 12,
      fontSize: 11,
      color: T.t2,
      lineHeight: 1.5
    }
  }, "All in-memory \xB7 auto-attached to error reports when CortexCrash has a DSN. Use ", React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "CortexObs.span(name, fn)"), " to time critical paths.")));
}
Object.assign(window, {
  ObservabilityScreen
});