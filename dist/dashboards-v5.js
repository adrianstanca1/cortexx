(function () {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('v15-fonts')) {
    const pre = document.createElement('link');
    pre.rel = 'preconnect';
    pre.href = 'https://fonts.googleapis.com';
    const pre2 = document.createElement('link');
    pre2.rel = 'preconnect';
    pre2.href = 'https://fonts.gstatic.com';
    pre2.crossOrigin = 'anonymous';
    const l = document.createElement('link');
    l.id = 'v15-fonts';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter+Tight:wght@400;600;800;900&family=JetBrains+Mono:wght@400;500;700;800&display=swap';
    document.head.append(pre, pre2, l);
  }
})();
const V15 = {
  bg: '#0e0e10',
  bg2: '#1a1a1e',
  hi: '#ffd60a',
  hi2: '#fbe34a',
  hiDk: '#a98700',
  fg: '#fafafa',
  mute: '#9b9b9f',
  ink: '#0a0a0c',
  green: '#33d17a',
  red: '#ff3b30',
  rule: 'rgba(255,255,255,0.12)'
};
const TITLE = '"Archivo Black", "Anton", Impact, sans-serif';
const SANS = '"Inter Tight", -apple-system, system-ui, sans-serif';
const MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';
const HAZARD = `repeating-linear-gradient(45deg, ${V15.hi} 0 14px, ${V15.ink} 14px 28px)`;
function DashV15_SiteNotice({
  accent,
  dashboardId,
  setDashboardId
}) {
  const projects = useDB('projects');
  const tasks = useDB('tasks');
  const team = useDB('team');
  const activity = useDB('activity');
  const incidents = useDB('incidents') || [];
  const outstanding = useComputed('outstanding');
  const pipeline = useComputed('pipelineValue');
  const todo = tasks.filter(t => !t.done);
  const high = todo.filter(t => t.prio === 'high');
  const onSite = team.filter(t => t.status === 'on-site').length;
  const active = projects.filter(p => p.status === 'active');
  const focus = todo.sort((a, b) => ({
    high: 0,
    med: 1,
    low: 2
  })[a.prio] - {
    high: 0,
    med: 1,
    low: 2
  }[b.prio])[0];
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const timeStr = today.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });
  const dayNo = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  const setNav = (k, p) => window.cortexxNav && window.cortexxNav(k, p);
  return React.createElement("div", {
    style: {
      background: V15.bg,
      color: V15.fg,
      height: '100%',
      overflowY: 'auto',
      fontFamily: SANS,
      paddingBottom: 150
    }
  }, React.createElement("div", {
    style: {
      height: 14,
      background: HAZARD
    }
  }), React.createElement("div", {
    style: {
      background: V15.hi,
      color: V15.ink,
      padding: '14px 16px 16px'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
      fontFamily: MONO,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 1.4
    }
  }, React.createElement("span", null, "FORM 01 / DAILY SITE NOTICE"), React.createElement("span", null, dateStr, " \xB7 DAY ", dayNo)), React.createElement("h1", {
    style: {
      fontFamily: TITLE,
      fontWeight: 900,
      color: V15.ink,
      fontSize: 64,
      lineHeight: 0.86,
      letterSpacing: -3.5,
      margin: 0,
      textTransform: 'uppercase'
    }
  }, "Site", React.createElement("br", null), "Notice"), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 10,
      paddingTop: 8,
      borderTop: `2px solid ${V15.ink}`,
      fontFamily: MONO,
      fontSize: 11,
      fontWeight: 700
    }
  }, React.createElement("span", {
    style: {
      background: V15.ink,
      color: V15.hi,
      padding: '2px 7px',
      letterSpacing: 1
    }
  }, "POSTED"), React.createElement("span", null, timeStr), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    onClick: () => setNav('switchworkspace'),
    title: "Switch workspace",
    style: {
      background: V15.ink,
      color: V15.hi,
      border: 'none',
      cursor: 'pointer',
      fontFamily: MONO,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 1,
      padding: '3px 8px',
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      textTransform: 'uppercase'
    }
  }, (window.CortexTenant ? window.CortexTenant.activeRecord().name : 'CortexBuild Pro').slice(0, 14), " \u25BE"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("span", null, onSite, "/", team.length, " ON SITE"))), React.createElement(SectionLabel15, {
    num: "01",
    label: "Action Required",
    extra: `${high.length} ITEM${high.length === 1 ? '' : 'S'}`
  }), focus ? React.createElement("button", {
    onClick: () => setNav('tab', 'tasks'),
    style: {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      background: focus.prio === 'high' ? V15.red : V15.bg2,
      border: 'none',
      borderBottom: `1px solid ${V15.rule}`,
      color: V15.fg,
      padding: '14px 16px',
      cursor: 'pointer',
      fontFamily: SANS
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6
    }
  }, React.createElement("span", {
    style: {
      background: focus.prio === 'high' ? V15.fg : V15.hi,
      color: focus.prio === 'high' ? V15.red : V15.ink,
      padding: '2px 6px',
      fontFamily: MONO,
      fontSize: 9.5,
      fontWeight: 800,
      letterSpacing: 1.2
    }
  }, (focus.prio || 'MED').toUpperCase()), React.createElement("span", {
    style: {
      fontFamily: MONO,
      fontSize: 10,
      color: V15.mute,
      letterSpacing: 1
    }
  }, focus.due ? `DUE ${new Date(focus.due).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short'
  }).toUpperCase()}` : 'UNDATED')), React.createElement("div", {
    style: {
      fontFamily: TITLE,
      fontSize: 26,
      lineHeight: 1.0,
      letterSpacing: -1,
      textTransform: 'uppercase',
      color: focus.prio === 'high' ? V15.fg : V15.hi
    }
  }, focus.t), React.createElement("div", {
    style: {
      marginTop: 8,
      fontFamily: MONO,
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: 1.2,
      color: focus.prio === 'high' ? V15.fg : V15.fg
    }
  }, "TAKE ACTION \u25B8")) : React.createElement("div", {
    style: {
      padding: '20px 16px',
      fontFamily: MONO,
      fontSize: 12,
      color: V15.mute
    }
  }, "NO ACTION ITEMS \u2014 BACKLOG CLEAR"), React.createElement(SectionLabel15, {
    num: "02",
    label: "Hands on Site"
  }), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      background: V15.bg2,
      borderBottom: `1px solid ${V15.rule}`
    }
  }, React.createElement(StatBlock15, {
    big: `${onSite}`,
    label: "ON SITE NOW",
    sub: `OF ${team.length} ON ROLL`,
    accent: V15.green
  }), React.createElement(StatBlock15, {
    big: `${active.length}`,
    label: "ACTIVE PROJECTS",
    sub: "PORTFOLIO",
    accent: V15.hi
  })), React.createElement(SectionLabel15, {
    num: "03",
    label: "The Ledger"
  }), React.createElement("div", {
    style: {
      borderBottom: `1px solid ${V15.rule}`,
      background: V15.bg2
    }
  }, React.createElement(Bar15, {
    label: "LIVE PIPELINE",
    value: `£${(pipeline / 1000).toFixed(0)}K`,
    fill: 1,
    color: V15.hi,
    rightLabel: `${active.length} ACTIVE`,
    onClick: () => setNav('quotes')
  }), React.createElement(Bar15, {
    label: "OUTSTANDING",
    value: `£${(outstanding / 1000).toFixed(1)}K`,
    fill: Math.min(1, outstanding / Math.max(pipeline, 1)),
    color: V15.red,
    rightLabel: "ON LEDGER",
    onClick: () => setNav('tab', 'money')
  })), React.createElement(SectionLabel15, {
    num: "04",
    label: "Today's Jobs",
    extra: `${active.length}`
  }), active.slice(0, 4).map((p, i) => React.createElement("button", {
    key: p.id,
    onClick: () => setNav('project', p),
    style: {
      display: 'flex',
      alignItems: 'stretch',
      gap: 0,
      width: '100%',
      textAlign: 'left',
      background: i % 2 === 0 ? V15.bg2 : V15.bg,
      color: V15.fg,
      border: 'none',
      borderBottom: `1px solid ${V15.rule}`,
      cursor: 'pointer',
      padding: 0
    }
  }, React.createElement("div", {
    style: {
      width: 56,
      background: V15.hi,
      color: V15.ink,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: TITLE,
      fontSize: 30,
      letterSpacing: -1
    }
  }, (i + 1).toString().padStart(2, '0')), React.createElement("div", {
    style: {
      flex: 1,
      padding: '12px 14px',
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontFamily: TITLE,
      fontSize: 18,
      lineHeight: 1.1,
      letterSpacing: -0.5,
      textTransform: 'uppercase',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, p.name), React.createElement("div", {
    style: {
      fontFamily: MONO,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: 1,
      color: V15.mute,
      marginTop: 4
    }
  }, React.createElement("span", {
    style: {
      color: V15.hi
    }
  }, p.pct ?? 0, "%"), React.createElement("span", {
    style: {
      margin: '0 6px'
    }
  }, "\xB7"), "MARGIN ", p.margin ?? 0, "%", React.createElement("span", {
    style: {
      margin: '0 6px'
    }
  }, "\xB7"), p.team || 0, " CREW")), React.createElement("div", {
    style: {
      width: 14,
      background: (p.margin ?? 0) >= 25 ? V15.green : (p.margin ?? 0) >= 15 ? V15.hi : V15.red
    }
  }))), React.createElement(SectionLabel15, {
    num: "05",
    label: "Wire",
    extra: `${activity.length}`
  }), React.createElement("div", {
    style: {
      padding: '10px 16px 16px'
    }
  }, activity.slice(0, 4).map((a, i) => React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 10,
      padding: '7px 0',
      borderBottom: i < 3 ? `1px solid ${V15.rule}` : 'none',
      fontFamily: MONO,
      fontSize: 11,
      color: V15.fg,
      letterSpacing: 0.3
    }
  }, React.createElement("span", {
    style: {
      color: V15.hi,
      minWidth: 38,
      fontWeight: 700
    }
  }, new Date(a.when).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  })), React.createElement("span", {
    style: {
      flex: 1,
      lineHeight: 1.4
    }
  }, React.createElement("span", {
    style: {
      fontWeight: 700
    }
  }, a.who.toUpperCase()), ' ', React.createElement("span", {
    style: {
      color: V15.mute
    }
  }, a.what), a.where && React.createElement("span", {
    style: {
      color: V15.fg
    }
  }, " \xB7 ", a.where.toUpperCase()))))), incidents.length > 0 && React.createElement(React.Fragment, null, React.createElement(SectionLabel15, {
    num: "06",
    label: "Safety log",
    extra: `${incidents.length}`,
    alert: true
  }), React.createElement("div", {
    style: {
      padding: '0 16px 14px'
    }
  }, incidents.slice(0, 3).map((inc, i) => React.createElement("div", {
    key: i,
    style: {
      background: V15.bg2,
      borderLeft: `4px solid ${V15.red}`,
      padding: '10px 12px',
      marginBottom: 6,
      fontFamily: MONO,
      fontSize: 11
    }
  }, React.createElement("span", {
    style: {
      color: V15.red,
      fontWeight: 700,
      letterSpacing: 1
    }
  }, (inc.severity || 'NEAR-MISS').toUpperCase()), React.createElement("span", {
    style: {
      color: V15.mute,
      marginLeft: 6
    }
  }, inc.project), React.createElement("div", {
    style: {
      color: V15.fg,
      marginTop: 4,
      lineHeight: 1.4
    }
  }, inc.what))))), React.createElement(SectionLabel15, {
    num: "07",
    label: "Desk"
  }), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 0,
      background: V15.bg2
    }
  }, React.createElement(DeskBtn15, {
    label: "Tasks",
    sub: `${todo.length} OPEN`,
    onClick: () => setNav('tab', 'tasks')
  }), React.createElement(DeskBtn15, {
    label: "Quotes",
    sub: "LEDGER",
    onClick: () => setNav('quotes'),
    rightCol: true
  }), React.createElement(DeskBtn15, {
    label: "Money",
    sub: "P&L",
    onClick: () => setNav('tab', 'money'),
    bottomRow: true
  }), React.createElement(DeskBtn15, {
    label: "Cortex",
    sub: "AI DESK",
    onClick: () => setNav('ai'),
    rightCol: true,
    bottomRow: true
  })), React.createElement("div", {
    style: {
      marginTop: 18,
      padding: '12px 16px',
      background: V15.hi,
      color: V15.ink
    }
  }, React.createElement("div", {
    style: {
      fontFamily: MONO,
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: 1.4,
      marginBottom: 4
    }
  }, "SIGNED OFF BY"), React.createElement("div", {
    style: {
      fontFamily: TITLE,
      fontSize: 22,
      letterSpacing: -1,
      textTransform: 'uppercase',
      color: V15.ink,
      lineHeight: 1
    }
  }, "SITE MANAGER"), React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginTop: 8,
      fontFamily: MONO,
      fontSize: 9.5,
      color: V15.ink,
      fontWeight: 700,
      letterSpacing: 1
    }
  }, React.createElement("span", null, "FORM-01 \xB7 REV.", dayNo), React.createElement("span", null, "CORTEXX"))), React.createElement("div", {
    style: {
      height: 14,
      background: HAZARD
    }
  }));
}
function SectionLabel15({
  num,
  label,
  extra,
  alert
}) {
  return React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '14px 16px 8px',
      background: V15.bg
    }
  }, React.createElement("span", {
    style: {
      fontFamily: MONO,
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: 1.5,
      background: alert ? V15.red : V15.hi,
      color: V15.ink,
      padding: '2px 7px'
    }
  }, num), React.createElement("span", {
    style: {
      fontFamily: TITLE,
      fontSize: 16,
      color: V15.fg,
      letterSpacing: -0.4,
      textTransform: 'uppercase'
    }
  }, label), React.createElement("span", {
    style: {
      flex: 1,
      height: 1,
      background: V15.rule
    }
  }), extra && React.createElement("span", {
    style: {
      fontFamily: MONO,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 1.3,
      color: V15.mute
    }
  }, extra));
}
function StatBlock15({
  big,
  label,
  sub,
  accent
}) {
  return React.createElement("div", {
    style: {
      padding: '14px 16px',
      borderRight: `1px solid ${V15.rule}`
    }
  }, React.createElement("div", {
    style: {
      fontFamily: MONO,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 1.4,
      color: V15.mute,
      marginBottom: 4
    }
  }, label), React.createElement("div", {
    style: {
      fontFamily: TITLE,
      fontSize: 48,
      lineHeight: 0.9,
      letterSpacing: -2,
      color: accent
    }
  }, big), React.createElement("div", {
    style: {
      fontFamily: MONO,
      fontSize: 10,
      color: V15.mute,
      marginTop: 4,
      letterSpacing: 1
    }
  }, sub));
}
function Bar15({
  label,
  value,
  fill,
  color,
  rightLabel,
  onClick
}) {
  return React.createElement("button", {
    onClick: onClick,
    style: {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      background: 'transparent',
      border: 'none',
      borderBottom: `1px solid ${V15.rule}`,
      padding: '12px 16px',
      cursor: 'pointer'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 6
    }
  }, React.createElement("span", {
    style: {
      fontFamily: MONO,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 1.4,
      color: V15.mute
    }
  }, label), React.createElement("span", {
    style: {
      fontFamily: MONO,
      fontSize: 9.5,
      color: V15.mute,
      letterSpacing: 1.2
    }
  }, rightLabel)), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 10
    }
  }, React.createElement("span", {
    style: {
      fontFamily: TITLE,
      fontSize: 32,
      color: V15.fg,
      letterSpacing: -1.5,
      lineHeight: 1
    }
  }, value)), React.createElement("div", {
    style: {
      marginTop: 8,
      position: 'relative',
      height: 6,
      background: V15.bg,
      border: `1px solid ${V15.rule}`
    }
  }, React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: `${fill * 100}%`,
      background: color
    }
  })));
}
function DeskBtn15({
  label,
  sub,
  onClick,
  rightCol,
  bottomRow
}) {
  return React.createElement("button", {
    onClick: onClick,
    style: {
      background: 'transparent',
      color: V15.fg,
      border: 'none',
      borderLeft: rightCol ? `1px solid ${V15.rule}` : 'none',
      borderBottom: bottomRow ? 'none' : `1px solid ${V15.rule}`,
      padding: '16px',
      textAlign: 'left',
      cursor: 'pointer'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: TITLE,
      fontSize: 26,
      letterSpacing: -1,
      lineHeight: 1,
      textTransform: 'uppercase'
    }
  }, label), React.createElement("div", {
    style: {
      fontFamily: MONO,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 1.4,
      color: V15.hi,
      marginTop: 6
    }
  }, sub, " \u25B8"));
}
Object.assign(window, {
  DashV15_SiteNotice
});