// Cortexx — Phase 12: Unified "My day" + Workspace switcher

// ═══════════════════════════════════════════════════════════════════
// MY DAY — everything personal across schedule, clock, tasks, messages
// ═══════════════════════════════════════════════════════════════════
function MyDayScreen({
  accent
}) {
  const tasks = useDB('tasks');
  const entries = useDB('clockEntries');
  const messages = useDB('messages');
  const rfis = useDB('rfis');
  const myTasks = tasks.filter(t => !t.done && t.assignee === 'You').slice(0, 5);
  const todayClock = entries.filter(e => (e.name === 'You' || e.userId === 0) && e.time.startsWith('2026-05-22'));
  const onSite = todayClock.length > 0 && ['in', 'break-in'].includes(todayClock[0].action);
  const unreadMsg = messages.reduce((s, m) => s + (m.unread || 0), 0);
  const openRFIs = rfis.filter(r => r.status === 'open').length;
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "My day",
    subtitle: `Thu 30 Apr · ${myTasks.length + openRFIs} action${myTasks.length + openRFIs !== 1 ? 's' : ''} for you`
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 14px',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => window.cortexxNav('clock'),
    style: {
      background: onSite ? `linear-gradient(135deg, ${T.green}33, ${T.green}11)` : T.bg2,
      border: `0.5px solid ${onSite ? T.green + '55' : T.hair}`,
      borderRadius: 12,
      padding: 12,
      cursor: 'pointer',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 4,
      background: onSite ? T.green : T.t3
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 10,
      color: onSite ? T.green : T.t3,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    }
  }, onSite ? 'On site' : 'Off site')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      fontWeight: 600,
      marginTop: 6
    }
  }, onSite ? todayClock[0].location : 'Tap to check in')), /*#__PURE__*/React.createElement("button", {
    onClick: () => window.cortexxNav('inbox'),
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 12,
      padding: 12,
      cursor: 'pointer',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: unreadMsg + openRFIs > 0 ? T.amber : T.t3
    }
  }, React.cloneElement(Ic.bell, {
    size: 12
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 10,
      color: unreadMsg + openRFIs > 0 ? T.amber : T.t3,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    }
  }, "Inbox")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      fontWeight: 600,
      marginTop: 6
    }
  }, unreadMsg + openRFIs, " unread"))), /*#__PURE__*/React.createElement(Section, {
    title: `Your queue · ${myTasks.length}`
  }, /*#__PURE__*/React.createElement(GroupedList, null, myTasks.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 13,
      color: T.t3
    }
  }, "Nothing on your plate"), myTasks.map((t, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: t.id,
    icon: Ic.tasks,
    iconBg: PRIO_C[t.prio],
    title: t.t,
    sub: formatTaskWhen(t.due),
    right: /*#__PURE__*/React.createElement(Pill, {
      c: PRIO_C[t.prio],
      size: "xs"
    }, t.prio),
    isLast: i === a.length - 1,
    onClick: () => Backend.db.tasks.update(t.id, {
      done: !t.done
    })
  })))), /*#__PURE__*/React.createElement(Section, {
    title: "Quick capture"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 8
    }
  }, [{
    k: 'task',
    l: 'Task',
    i: Ic.tasks,
    c: T.purple
  }, {
    k: 'voice',
    l: 'Voice',
    i: Ic.mic,
    c: T.red
  }, {
    k: 'receipt',
    l: 'Receipt',
    i: Ic.receipt,
    c: T.amber
  }].map(o => /*#__PURE__*/React.createElement("button", {
    key: o.k,
    onClick: () => window.cortexxNav(o.k === 'task' ? 'addtask' : o.k === 'voice' ? 'voice' : 'scan'),
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 12,
      padding: '14px 8px',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 8,
      background: `${o.c}22`,
      color: o.c,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.cloneElement(o.i, {
    size: 17
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 600,
      color: T.t1
    }
  }, o.l)))))));
}

// ═══════════════════════════════════════════════════════════════════
// WORKSPACE SWITCHER
// ═══════════════════════════════════════════════════════════════════
function WorkspaceSheet({
  onClose,
  accent
}) {
  const user = useDB('user');
  const ws = [{
    name: 'CortexBuild Ltd',
    sub: 'Director · 7 staff · Pro',
    current: true,
    c: accent
  }, {
    name: 'Camden Joinery',
    sub: 'Co-owner · 2 staff · Free',
    current: false,
    c: T.amber
  }, {
    name: 'Hackney Refurb',
    sub: 'Contractor · 4 staff · Free',
    current: false,
    c: T.green
  }];
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
  }, "Switch workspace"), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 28px'
    }
  }, /*#__PURE__*/React.createElement(GroupedList, null, ws.map((w, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: w.name,
    icon: Ic.briefcase,
    iconBg: w.c,
    title: w.name,
    sub: w.sub,
    right: w.current ? /*#__PURE__*/React.createElement(Pill, {
      c: T.green,
      size: "xs"
    }, "CURRENT") : null,
    isLast: i === a.length - 1,
    onClick: () => {
      toast(w.current ? 'Already in this workspace' : `Switched to ${w.name}`, w.current ? 'info' : 'success');
      if (!w.current) onClose();
    }
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => toast('Workspace creation needs server side — add via Settings → Workspace', 'info'),
    style: {
      width: '100%',
      marginTop: 12,
      background: 'transparent',
      color: accent,
      border: `0.5px dashed ${T.hairMid}`,
      borderRadius: 12,
      padding: '12px',
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5
    }
  }, React.cloneElement(Ic.plus, {
    size: 14
  }), " Create new workspace")));
}
Object.assign(window, {
  MyDayScreen,
  WorkspaceSheet
});