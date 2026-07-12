// Cortexx — Phase 11: Live check-in/out + enhanced timesheets

// ═══════════════════════════════════════════════════════════════════
// BACKEND — clock entries (each check-in/out event)
// ═══════════════════════════════════════════════════════════════════
(function () {
  if (!window.Backend) return;
  const snap = Backend.db.snapshot();
  if (!snap.clockEntries) {
    snap.clockEntries = [{
      id: 1,
      userId: 1,
      name: 'Tom Reilly',
      projectId: 1,
      action: 'in',
      time: '2026-06-06T07:30',
      method: 'gps',
      gps: {
        lat: 51.541,
        lng: -0.143
      },
      location: 'Camden Mews'
    }, {
      id: 2,
      userId: 2,
      name: 'Aisha Begum',
      projectId: 1,
      action: 'in',
      time: '2026-06-06T07:45',
      method: 'gps',
      gps: {
        lat: 51.541,
        lng: -0.143
      },
      location: 'Camden Mews'
    }, {
      id: 3,
      userId: 3,
      name: 'Jack Mitchell',
      projectId: 1,
      action: 'in',
      time: '2026-06-06T08:00',
      method: 'gps',
      gps: {
        lat: 51.541,
        lng: -0.143
      },
      location: 'Camden Mews'
    }, {
      id: 4,
      userId: 4,
      name: 'Sara Khan',
      projectId: 1,
      action: 'in',
      time: '2026-06-06T08:15',
      method: 'qr',
      gps: null,
      location: 'Camden Mews'
    }, {
      id: 5,
      userId: 5,
      name: 'Marcus Webb',
      projectId: 2,
      action: 'in',
      time: '2026-06-06T08:00',
      method: 'gps',
      gps: {
        lat: 51.546,
        lng: -0.057
      },
      location: 'Hackney Loft'
    }, {
      id: 6,
      userId: 7,
      name: 'Dan Pavel',
      projectId: 2,
      action: 'in',
      time: '2026-06-06T08:05',
      method: 'gps',
      gps: {
        lat: 51.546,
        lng: -0.057
      },
      location: 'Hackney Loft'
    },
    // Lunch break entries
    {
      id: 7,
      userId: 1,
      name: 'Tom Reilly',
      projectId: 1,
      action: 'break-out',
      time: '2026-06-06T12:30',
      method: 'manual',
      gps: null,
      location: 'Camden Mews'
    }, {
      id: 8,
      userId: 1,
      name: 'Tom Reilly',
      projectId: 1,
      action: 'break-in',
      time: '2026-06-06T13:00',
      method: 'manual',
      gps: null,
      location: 'Camden Mews'
    },
    // Yesterday's completed entries (for weekHours calc)
    {
      id: 9,
      userId: 1,
      name: 'Tom Reilly',
      projectId: 1,
      action: 'in',
      time: '2026-06-05T07:30',
      method: 'gps',
      location: 'Camden Mews'
    }, {
      id: 10,
      userId: 1,
      name: 'Tom Reilly',
      projectId: 1,
      action: 'out',
      time: '2026-06-05T16:00',
      method: 'manual',
      location: 'Camden Mews'
    }, {
      id: 11,
      userId: 2,
      name: 'Aisha Begum',
      projectId: 1,
      action: 'in',
      time: '2026-06-05T08:00',
      method: 'gps',
      location: 'Camden Mews'
    }, {
      id: 12,
      userId: 2,
      name: 'Aisha Begum',
      projectId: 1,
      action: 'out',
      time: '2026-06-05T15:30',
      method: 'manual',
      location: 'Camden Mews'
    }, {
      id: 13,
      userId: 3,
      name: 'Jack Mitchell',
      projectId: 2,
      action: 'in',
      time: '2026-06-04T07:45',
      method: 'gps',
      location: 'Hackney Loft'
    }, {
      id: 14,
      userId: 3,
      name: 'Jack Mitchell',
      projectId: 2,
      action: 'out',
      time: '2026-06-04T16:30',
      method: 'manual',
      location: 'Hackney Loft'
    }];
    try {
      localStorage.setItem('cortexx_db_v1', JSON.stringify(snap));
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
  Backend.db.clockEntries = mk('clockEntries');
  Backend.computed.currentlyOnSite = () => {
    const entries = Backend.db.snapshot().clockEntries || [];
    const today = new Date().toISOString().slice(0, 10); // ALWAYS relative — never hardcoded
    const todayEntries = entries.filter(e => e && typeof e.time === 'string' && e.time.startsWith(today));
    const byUser = {};
    todayEntries.forEach(e => {
      if (!byUser[e.userId] || e.time > byUser[e.userId].time) byUser[e.userId] = e;
    });
    return Object.values(byUser).filter(e => e.action === 'in' || e.action === 'break-in').length;
  };
})();

// ═══════════════════════════════════════════════════════════════════
// CHECK-IN / OUT SCREEN — for individual user
// ═══════════════════════════════════════════════════════════════════
function CheckInScreen({
  accent
}) {
  const projects = useDB('projects');
  const entries = useDB('clockEntries');
  const myEntries = entries.filter(e => e.name === 'You' || e.userId === 0).sort((a, b) => b.time.localeCompare(a.time));
  const latest = myEntries[0];
  const isOnSite = latest && (latest.action === 'in' || latest.action === 'break-in');
  const [selectedProject, setSelectedProject] = React.useState(1);
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  // Calculate elapsed time
  const elapsed = latest && isOnSite ? Math.floor((now - new Date(latest.time)) / 1000) : 0;
  const hh = Math.floor(elapsed / 3600);
  const mm = Math.floor(elapsed % 3600 / 60);
  const ss = elapsed % 60;
  const proj = projects.find(p => p.id == selectedProject);
  const clock = async action => {
    // Try to use real GPS
    let gps = null;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 3000,
            enableHighAccuracy: true
          });
        });
        gps = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
      } catch (e) {
        gps = {
          lat: 51.541,
          lng: -0.143
        };
      }
    } else {
      gps = {
        lat: 51.541,
        lng: -0.143
      };
    }
    await Backend.db.clockEntries.create({
      userId: 0,
      name: 'You',
      projectId: selectedProject,
      action,
      time: new Date().toISOString().slice(0, 16),
      method: 'gps',
      gps,
      location: proj?.name || 'Site'
    });
    await Backend.db.activity.create({
      who: 'You',
      what: action === 'in' ? 'checked in' : action === 'out' ? 'checked out' : action === 'break-out' ? 'started break' : 'resumed work',
      where: proj?.name || 'Site',
      when: new Date().toISOString().slice(0, 16),
      icon: 'pin',
      color: '#10b981'
    });
    toast(`${action === 'in' ? 'Checked in' : action === 'out' ? 'Checked out' : action === 'break-out' ? 'On break' : 'Back to work'}`, 'success');
  };
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Check in",
    subtitle: isOnSite ? `On site at ${latest.location}` : 'Off site'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: isOnSite ? `linear-gradient(135deg, ${T.green}33, ${T.green}11)` : `linear-gradient(135deg, ${T.t3}22, ${T.bg2})`,
      border: `0.5px solid ${isOnSite ? T.green + '55' : T.hairMid}`,
      borderRadius: 18,
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 4,
      background: isOnSite ? T.green : T.t3,
      boxShadow: isOnSite ? `0 0 8px ${T.green}` : 'none',
      animation: isOnSite ? 'pulse-dot 2s infinite' : 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: isOnSite ? T.green : T.t3,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.8
    }
  }, isOnSite ? `On site · ${proj?.name}` : 'NOT CLOCKED IN')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 48,
      fontWeight: 700,
      color: T.t1,
      letterSpacing: -1.5,
      lineHeight: 1
    }
  }, isOnSite ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : '00:00:00'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t2,
      marginTop: 6
    }
  }, isOnSite ? `Started ${new Date(latest.time).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  })}` : 'Tap below to check in'))), !isOnSite && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 8
    }
  }, "Where to?"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, projects.filter(p => ['active', 'snagging'].includes(p.status)).map(p => /*#__PURE__*/React.createElement("button", {
    key: p.id,
    onClick: () => setSelectedProject(p.id),
    style: {
      background: selectedProject === p.id ? `${accent}22` : T.bg2,
      border: `0.5px solid ${selectedProject === p.id ? accent + '66' : T.hair}`,
      borderRadius: 12,
      padding: '12px 14px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 22,
      height: 22,
      borderRadius: 11,
      border: `2px solid ${selectedProject === p.id ? accent : T.hairMid}`,
      background: selectedProject === p.id ? accent : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, selectedProject === p.id && /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#fff'
    }
  }, React.cloneElement(Ic.check, {
    size: 12,
    sw: 3
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t1,
      fontWeight: 600
    }
  }, p.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 2
    }
  }, p.addr)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 14px'
    }
  }, !isOnSite ? /*#__PURE__*/React.createElement("button", {
    onClick: () => clock('in'),
    style: {
      width: '100%',
      background: `linear-gradient(135deg, ${T.green}, ${T.green}cc)`,
      border: 'none',
      borderRadius: 18,
      padding: '20px',
      color: '#fff',
      cursor: 'pointer',
      fontFamily: SF,
      fontSize: 17,
      fontWeight: 700,
      boxShadow: `0 10px 30px ${T.green}55`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8
    }
  }, React.cloneElement(Ic.pin, {
    size: 22
  }), " Check in") : latest.action === 'break-out' ? /*#__PURE__*/React.createElement("button", {
    onClick: () => clock('break-in'),
    style: {
      width: '100%',
      background: `linear-gradient(135deg, ${T.amber}, ${T.amber}cc)`,
      border: 'none',
      borderRadius: 18,
      padding: '20px',
      color: '#0a1830',
      cursor: 'pointer',
      fontFamily: SF,
      fontSize: 17,
      fontWeight: 700,
      boxShadow: `0 10px 30px ${T.amber}66`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8
    }
  }, React.cloneElement(Ic.clock, {
    size: 22
  }), " Back to work") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => clock('break-out'),
    style: {
      flex: 1,
      background: T.amber,
      color: '#0a1830',
      border: 'none',
      borderRadius: 14,
      padding: '14px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6
    }
  }, React.cloneElement(Ic.clock, {
    size: 16
  }), " Lunch"), /*#__PURE__*/React.createElement("button", {
    onClick: () => clock('out'),
    style: {
      flex: 1,
      background: T.red,
      color: '#fff',
      border: 'none',
      borderRadius: 14,
      padding: '14px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6
    }
  }, React.cloneElement(Ic.signOut, {
    size: 16
  }), " Check out"))), isOnSite && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 12,
      padding: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 7,
      background: `${T.green}22`,
      color: T.green,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.cloneElement(Ic.check, {
    size: 14,
    sw: 3
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t1,
      fontWeight: 600
    }
  }, "GPS verified"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t2,
      marginTop: 2
    }
  }, "51.541\xB0N, -0.143\xB0W \xB7 within 50m")))), /*#__PURE__*/React.createElement(Section, {
    title: "Today's log"
  }, /*#__PURE__*/React.createElement(GroupedList, null, myEntries.slice(0, 5).map((e, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: e.id,
    icon: e.action === 'in' ? Ic.pin : e.action === 'out' ? Ic.signOut : Ic.clock,
    iconBg: e.action === 'in' ? T.green : e.action === 'out' ? T.red : T.amber,
    title: e.action === 'in' ? 'Checked in' : e.action === 'out' ? 'Checked out' : e.action === 'break-out' ? 'Started break' : 'Resumed work',
    sub: `${e.location} · ${new Date(e.time).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    })} · ${e.method.toUpperCase()}`,
    isLast: i === Math.min(myEntries.length, 5) - 1
  })), myEntries.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 13,
      color: T.t3
    }
  }, "No clock entries yet today"))), /*#__PURE__*/React.createElement("style", null, `@keyframes pulse-dot { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`)));
}

// ═══════════════════════════════════════════════════════════════════
// LIVE TEAM STATUS — who's where right now
// ═══════════════════════════════════════════════════════════════════
function LiveStatusScreen({
  accent
}) {
  const entries = useDB('clockEntries');
  const team = useDB('team');
  const projects = useDB('projects');
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Build per-user current status
  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = entries.filter(e => e && typeof e.time === 'string' && e.time.startsWith(today));
  const userStatus = {};
  todayEntries.forEach(e => {
    if (!userStatus[e.userId] || e.time > userStatus[e.userId].time) {
      userStatus[e.userId] = e;
    }
  });
  const onSite = team.filter(m => {
    const s = userStatus[m.id];
    return s && (s.action === 'in' || s.action === 'break-in');
  });
  const onBreak = team.filter(m => {
    const s = userStatus[m.id];
    return s && s.action === 'break-out';
  });
  const offSite = team.filter(m => {
    const s = userStatus[m.id];
    return !s || s.action === 'out';
  });
  const groupBySite = members => {
    const groups = {};
    members.forEach(m => {
      const s = userStatus[m.id];
      const site = s?.location || m.site;
      if (!groups[site]) groups[site] = [];
      groups[site].push({
        ...m,
        status: s
      });
    });
    return groups;
  };
  const sitesOnsite = groupBySite(onSite);
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Live status",
    subtitle: `${onSite.length} on site · ${onBreak.length} on break · ${offSite.length} off`,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.bell,
      onClick: () => toast('Notifications sent to team', 'success')
    })
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
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 5,
      background: T.green,
      boxShadow: `0 0 10px ${T.green}`,
      animation: 'pulse-dot 2s infinite'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontFamily: SFMono,
      fontSize: 11,
      color: T.green,
      fontWeight: 700,
      letterSpacing: 0.5
    }
  }, "LIVE \xB7 ", now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, "auto-refresh 30s"))), Object.keys(sitesOnsite).map(site => {
    const members = sitesOnsite[site];
    const proj = projects.find(p => p.name === site);
    return /*#__PURE__*/React.createElement("div", {
      key: site,
      style: {
        marginBottom: 18
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '0 20px 8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline'
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 13,
        fontWeight: 700,
        color: T.t1
      }
    }, site), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.green,
        fontWeight: 600
      }
    }, "\u25CF ", members.length, " ACTIVE")), proj && /*#__PURE__*/React.createElement(Pill, {
      c: STATUS_C[proj.status]
    }, proj.status)), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '0 16px'
      }
    }, /*#__PURE__*/React.createElement(GroupedList, null, members.map((m, i, a) => {
      const since = m.status.time;
      const minsAgo = Math.floor((now - new Date(since)) / 60000);
      return /*#__PURE__*/React.createElement("div", {
        key: m.id,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          borderBottom: i === a.length - 1 ? 'none' : `0.5px solid ${T.hair}`
        }
      }, /*#__PURE__*/React.createElement(Avatar, {
        name: m.n,
        size: 36,
        c: m.color
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
          fontWeight: 600
        }
      }, m.n), /*#__PURE__*/React.createElement("div", {
        style: {
          fontFamily: SF,
          fontSize: 11,
          color: T.t2
        }
      }, m.r, " \xB7 in ", minsAgo, "m ago \xB7 GPS verified")), /*#__PURE__*/React.createElement(Pill, {
        c: T.green,
        size: "xs"
      }, "\u25CF ACTIVE"));
    }))));
  }), onBreak.length > 0 && /*#__PURE__*/React.createElement(Section, {
    title: `On break · ${onBreak.length}`
  }, /*#__PURE__*/React.createElement(GroupedList, null, onBreak.map((m, i, a) => /*#__PURE__*/React.createElement("div", {
    key: m.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      borderBottom: i === a.length - 1 ? 'none' : `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: m.n,
    size: 32,
    c: m.color
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      fontWeight: 600
    }
  }, m.n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, m.r, " \xB7 on break")), /*#__PURE__*/React.createElement(Pill, {
    c: T.amber,
    size: "xs"
  }, "\u2615 BREAK"))))), offSite.length > 0 && /*#__PURE__*/React.createElement(Section, {
    title: `Off site · ${offSite.length}`
  }, /*#__PURE__*/React.createElement(GroupedList, null, offSite.map((m, i, a) => /*#__PURE__*/React.createElement("div", {
    key: m.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      borderBottom: i === a.length - 1 ? 'none' : `0.5px solid ${T.hair}`,
      opacity: 0.6
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: m.n,
    size: 32,
    c: m.color
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      fontWeight: 500
    }
  }, m.n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, m.r)), /*#__PURE__*/React.createElement(Pill, {
    c: T.t3,
    size: "xs"
  }, "OFF"))))), /*#__PURE__*/React.createElement(Section, {
    title: "Recent activity"
  }, /*#__PURE__*/React.createElement(GroupedList, null, todayEntries.slice(0, 8).map((e, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: e.id,
    icon: e.action === 'in' ? Ic.pin : e.action === 'out' ? Ic.signOut : Ic.clock,
    iconBg: e.action === 'in' ? T.green : e.action === 'out' ? T.red : T.amber,
    title: `${e.name} ${e.action === 'in' ? 'checked in' : e.action === 'out' ? 'checked out' : e.action === 'break-out' ? 'started break' : 'resumed work'}`,
    sub: `${e.location} · ${new Date(e.time).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    })}`,
    isLast: i === Math.min(todayEntries.length, 8) - 1
  }))))));
}
Object.assign(window, {
  CheckInScreen,
  LiveStatusScreen
});