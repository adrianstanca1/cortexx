(function () {
  if (!window.Backend) return;
  const snap = Backend.db.snapshot();
  const SEED = {
    drawings: [{
      id: 1,
      name: 'Camden ground floor plan',
      projectId: 1,
      version: 'v3',
      updated: '2026-05-15',
      markups: 4,
      type: 'plan'
    }, {
      id: 2,
      name: 'Camden first floor plan',
      projectId: 1,
      version: 'v2',
      updated: '2026-04-22',
      markups: 1,
      type: 'plan'
    }, {
      id: 3,
      name: 'Camden elevation east',
      projectId: 1,
      version: 'v1',
      updated: '2026-04-08',
      markups: 0,
      type: 'elevation'
    }, {
      id: 4,
      name: 'Hackney loft section',
      projectId: 2,
      version: 'v2',
      updated: '2026-04-30',
      markups: 3,
      type: 'section'
    }, {
      id: 5,
      name: 'Brixton shopfront detail',
      projectId: 3,
      version: 'v1',
      updated: '2026-03-12',
      markups: 2,
      type: 'detail'
    }],
    permits: [{
      id: 1,
      kind: 'Hot work',
      projectId: 1,
      issued: '2026-05-22',
      expires: '2026-05-22',
      issuer: 'Adrian',
      signed: true,
      area: 'Roof'
    }, {
      id: 2,
      kind: 'Working at height',
      projectId: 1,
      issued: '2026-05-20',
      expires: '2026-05-27',
      issuer: 'Adrian',
      signed: true,
      area: 'Scaffold 2nd floor'
    }, {
      id: 3,
      kind: 'Confined space',
      projectId: 2,
      issued: '2026-05-22',
      expires: '2026-05-22',
      issuer: 'Adrian',
      signed: false,
      area: 'Basement plumbing'
    }, {
      id: 4,
      kind: 'Electrical isolation',
      projectId: 1,
      issued: '2026-05-21',
      expires: '2026-05-23',
      issuer: 'Aisha',
      signed: true,
      area: 'Main distribution'
    }],
    goals: [{
      id: 1,
      label: 'Monthly revenue',
      target: 80000,
      current: 67200,
      unit: '£',
      period: 'May',
      c: '#10b981'
    }, {
      id: 2,
      label: 'Average margin',
      target: 26,
      current: 24.5,
      unit: '%',
      period: 'Q2',
      c: '#2563eb'
    }, {
      id: 3,
      label: 'Safety score',
      target: 95,
      current: 92,
      unit: '',
      period: '30d',
      c: '#f59e0b'
    }, {
      id: 4,
      label: 'On-time delivery',
      target: 95,
      current: 88,
      unit: '%',
      period: 'Q2',
      c: '#8b5cf6'
    }, {
      id: 5,
      label: 'Quote conversion',
      target: 35,
      current: 42,
      unit: '%',
      period: 'Q2',
      c: '#06b6d4'
    }]
  };
  let _sd6 = false;
  for (const k of Object.keys(SEED)) { if (!snap[k]) { snap[k] = SEED[k]; _sd6 = true; } }
  if (_sd6) {
    try {
      localStorage.setItem('cortexx_db_v1', JSON.stringify(snap));
    } catch (e) {}
  }
  const arr6 = n => { const s = Backend.db.snapshot(); if (!Array.isArray(s[n])) s[n] = []; return s[n]; };
  const mk = n => ({
    listSync: () => [...arr6(n)],
    getSync: id => arr6(n).find(x => x.id == id),
    list: async () => [...arr6(n)],
    get: async id => arr6(n).find(x => x.id == id),
    create: async d => {
      const s = Backend.db.snapshot();
      const ids = arr6(n).map(x => typeof x.id === 'number' ? x.id : 0);
      const item = {
        ...d,
        id: d.id ?? Math.max(0, ...ids) + 1
      };
      s[n] = [item, ...arr6(n)];
      try {
        localStorage.setItem('cortexx_db_v1', JSON.stringify(s));
      } catch (e) {}
      Backend.db.user.update({});
      return item;
    },
    update: async (id, p) => {
      const s = Backend.db.snapshot();
      s[n] = arr6(n).map(x => x.id == id ? {
        ...x,
        ...p
      } : x);
      try {
        localStorage.setItem('cortexx_db_v1', JSON.stringify(s));
      } catch (e) {}
      Backend.db.user.update({});
      return s[n].find(x => x.id == id);
    },
    remove: async id => {
      const s = Backend.db.snapshot();
      s[n] = arr6(n).filter(x => x.id != id);
      try {
        localStorage.setItem('cortexx_db_v1', JSON.stringify(s));
      } catch (e) {}
      Backend.db.user.update({});
    }
  });
  Backend.db.drawings = mk('drawings');
  Backend.db.permits = mk('permits');
  Backend.db.goals = mk('goals');
  Backend.computed.permitsActive = () => (Backend.db.snapshot().permits || []).filter(p => p.signed).length;
})();
function DrawingsScreen({
  accent,
  onOpen
}) {
  const drawings = useDB('drawings');
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
    title: "Drawings",
    subtitle: `${drawings.length} drawings · ${drawings.reduce((s, d) => s + d.markups, 0)} markups`,
    right: React.createElement(HeaderBtn, {
      icon: Ic.upload,
      accent: accent,
      onClick: async () => {
        await Backend.db.drawings.create({
          name: 'Untitled drawing',
          projectId: 1,
          version: 'v1',
          updated: '2026-05-22',
          markups: 0,
          type: 'plan'
        });
        toast('Drawing uploaded', 'success');
      }
    })
  }), React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, drawings.map(d => {
    const proj = projects.find(p => p.id === d.projectId);
    return React.createElement("div", {
      key: d.id,
      onClick: () => onOpen && onOpen(d),
      style: {
        background: T.bg2,
        borderRadius: 14,
        overflow: 'hidden',
        border: `0.5px solid ${T.hair}`,
        cursor: 'pointer'
      }
    }, React.createElement("div", {
      style: {
        height: 110,
        background: '#0a1830',
        position: 'relative',
        overflow: 'hidden'
      }
    }, React.createElement("svg", {
      width: "100%",
      height: "100%",
      viewBox: "0 0 320 110",
      preserveAspectRatio: "xMidYMid slice"
    }, React.createElement("defs", null, React.createElement("pattern", {
      id: `bp${d.id}`,
      width: "20",
      height: "20",
      patternUnits: "userSpaceOnUse"
    }, React.createElement("path", {
      d: "M 20 0 L 0 0 0 20",
      fill: "none",
      stroke: accent,
      strokeWidth: "0.3",
      opacity: "0.4"
    }))), React.createElement("rect", {
      width: "100%",
      height: "100%",
      fill: `url(#bp${d.id})`
    }), React.createElement("g", {
      stroke: accent,
      strokeWidth: "1.2",
      fill: "none",
      opacity: "0.7",
      transform: "translate(60,18)"
    }, React.createElement("rect", {
      x: "0",
      y: "0",
      width: "200",
      height: "70"
    }), React.createElement("line", {
      x1: "80",
      y1: "0",
      x2: "80",
      y2: "36"
    }), React.createElement("line", {
      x1: "80",
      y1: "36",
      x2: "200",
      y2: "36"
    }), React.createElement("line", {
      x1: "0",
      y1: "48",
      x2: "80",
      y2: "48"
    }), React.createElement("rect", {
      x: "60",
      y: "48",
      width: "20",
      height: "22"
    })), Array.from({
      length: d.markups
    }).map((_, i) => React.createElement("g", {
      key: i,
      transform: `translate(${80 + i * 40},${30 + i * 8})`
    }, React.createElement("circle", {
      r: "6",
      fill: T.amber
    }), React.createElement("text", {
      y: "3",
      textAnchor: "middle",
      fontFamily: SFMono,
      fontSize: "7",
      fontWeight: "700",
      fill: "#fff"
    }, i + 1))))), React.createElement("div", {
      style: {
        padding: '10px 14px'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }
    }, React.createElement("div", null, React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 13,
        fontWeight: 600,
        color: T.t1
      }
    }, d.name), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.t2,
        marginTop: 2
      }
    }, proj?.name?.split(' ').slice(0, 2).join(' '), " \xB7 ", d.type, " \xB7 ", _formatRelDate(d.updated))), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4
      }
    }, React.createElement(Pill, {
      c: T.cyan,
      size: "xs"
    }, d.version), d.markups > 0 && React.createElement(Pill, {
      c: T.amber,
      size: "xs"
    }, d.markups, " marks")))));
  }))));
}
function DrawingViewerSheet({
  drawing,
  onClose,
  accent
}) {
  const [pins, setPins] = React.useState(Array.from({
    length: drawing?.markups || 0
  }, (_, i) => ({
    x: 80 + i * 40,
    y: 80 + i * 30,
    note: 'Markup pin'
  })));
  const [addingPin, setAddingPin] = React.useState(false);
  if (!drawing) return null;
  const handleClick = e => {
    if (!addingPin) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * 320;
    const y = (e.clientY - rect.top) / rect.height * 400;
    setPins([...pins, {
      x,
      y,
      note: 'New pin'
    }]);
    setAddingPin(false);
    toast('Pin added', 'success');
  };
  return React.createElement(Sheet, {
    onClose: onClose,
    fullscreen: true
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '12px 16px',
      borderBottom: `0.5px solid ${T.hair}`
    }
  }, React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: accent,
      fontFamily: SF,
      fontSize: 15,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 2
    }
  }, Ic.chevL, " ", React.createElement("span", null, "Back")), React.createElement("div", {
    style: {
      flex: 1,
      textAlign: 'center'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      color: T.t1
    }
  }, drawing.name), React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t3,
      marginTop: 1
    }
  }, drawing.version, " \xB7 ", pins.length, " pins")), React.createElement("button", {
    onClick: () => toast('Drawing exported', 'success'),
    style: {
      background: 'none',
      border: 'none',
      color: accent,
      fontFamily: SF,
      fontSize: 14,
      cursor: 'pointer'
    }
  }, "Share")), React.createElement("div", {
    style: {
      flex: 1,
      background: '#0a1830',
      position: 'relative',
      overflow: 'auto'
    },
    onClick: handleClick
  }, React.createElement("svg", {
    width: "100%",
    height: "400",
    viewBox: "0 0 320 400",
    preserveAspectRatio: "xMidYMid meet",
    style: {
      display: 'block',
      cursor: addingPin ? 'crosshair' : 'default'
    }
  }, React.createElement("defs", null, React.createElement("pattern", {
    id: "bigbp",
    width: "24",
    height: "24",
    patternUnits: "userSpaceOnUse"
  }, React.createElement("path", {
    d: "M 24 0 L 0 0 0 24",
    fill: "none",
    stroke: accent,
    strokeWidth: "0.3",
    opacity: "0.35"
  }))), React.createElement("rect", {
    width: "100%",
    height: "100%",
    fill: "url(#bigbp)"
  }), React.createElement("g", {
    stroke: accent,
    strokeWidth: "1.5",
    fill: "none",
    opacity: "0.75",
    transform: "translate(40,40)"
  }, React.createElement("rect", {
    x: "0",
    y: "0",
    width: "240",
    height: "320"
  }), React.createElement("line", {
    x1: "100",
    y1: "0",
    x2: "100",
    y2: "160"
  }), React.createElement("line", {
    x1: "100",
    y1: "160",
    x2: "240",
    y2: "160"
  }), React.createElement("line", {
    x1: "0",
    y1: "210",
    x2: "100",
    y2: "210"
  }), React.createElement("rect", {
    x: "75",
    y: "210",
    width: "25",
    height: "35"
  }), React.createElement("text", {
    x: "50",
    y: "90",
    fontFamily: SFMono,
    fontSize: "6",
    fill: accent
  }, "LOUNGE"), React.createElement("text", {
    x: "170",
    y: "80",
    fontFamily: SFMono,
    fontSize: "6",
    fill: accent
  }, "KITCHEN"), React.createElement("text", {
    x: "50",
    y: "270",
    fontFamily: SFMono,
    fontSize: "6",
    fill: accent
  }, "HALL"), React.createElement("text", {
    x: "170",
    y: "240",
    fontFamily: SFMono,
    fontSize: "6",
    fill: accent
  }, "WC")), pins.map((p, i) => React.createElement("g", {
    key: i,
    transform: `translate(${p.x},${p.y})`
  }, React.createElement("circle", {
    r: "11",
    fill: T.amber,
    opacity: "0.3"
  }), React.createElement("circle", {
    r: "8",
    fill: T.amber,
    stroke: "#fff",
    strokeWidth: "1.5"
  }), React.createElement("text", {
    y: "3",
    textAnchor: "middle",
    fontFamily: SFMono,
    fontSize: "9",
    fontWeight: "700",
    fill: "#fff"
  }, i + 1)))), addingPin && React.createElement("div", {
    style: {
      position: 'absolute',
      top: 14,
      left: 14,
      right: 14,
      background: 'rgba(245,158,11,0.18)',
      border: `0.5px solid ${T.amber}66`,
      borderRadius: 10,
      padding: '8px 12px',
      fontFamily: SF,
      fontSize: 12,
      color: T.t1,
      textAlign: 'center'
    }
  }, "Tap anywhere on the drawing to place a pin")), React.createElement("div", {
    style: {
      padding: '10px 12px 30px',
      borderTop: `0.5px solid ${T.hair}`,
      display: 'flex',
      gap: 8,
      background: T.bg0
    }
  }, React.createElement("button", {
    onClick: () => setAddingPin(!addingPin),
    style: {
      flex: 1,
      background: addingPin ? T.amber : T.bg2,
      color: addingPin ? '#0a1830' : T.t1,
      border: addingPin ? 'none' : `0.5px solid ${T.hairMid}`,
      borderRadius: 12,
      padding: '12px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6
    }
  }, React.cloneElement(Ic.pin, {
    size: 14
  }), " ", addingPin ? 'Tap drawing…' : 'Add pin'), React.createElement("button", {
    onClick: () => {
      setPins([]);
      toast('Pins cleared', 'info');
    },
    style: {
      background: 'transparent',
      color: T.t2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 12,
      padding: '12px 14px',
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, "Clear")));
}
function PermitsScreen({
  accent
}) {
  const permits = useDB('permits');
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
    title: "Permits to work",
    subtitle: `${permits.filter(p => p.signed).length} signed · ${permits.filter(p => !p.signed).length} pending`,
    right: React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('addpermit')
    })
  }), React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, permits.map(p => {
    const proj = projects.find(pr => pr.id === p.projectId);
    const expiresToday = p.expires === '2026-05-22';
    return React.createElement("div", {
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
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }
    }, React.createElement("div", null, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, React.createElement(Pill, {
      c: p.signed ? T.green : T.amber
    }, p.signed ? '✓ signed' : 'pending sign-off'), expiresToday && React.createElement(Pill, {
      c: T.red,
      size: "xs"
    }, "EXPIRES TODAY")), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 14,
        fontWeight: 600,
        color: T.t1,
        marginTop: 6
      }
    }, p.kind), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.t2,
        marginTop: 2
      }
    }, proj?.name?.split(' ').slice(0, 2).join(' '), " \xB7 ", p.area, " \xB7 Issued by ", p.issuer)), !p.signed && React.createElement("button", {
      onClick: () => window.cortexxNav('signature', {
        subject: `${p.kind} · ${p.area}`,
        signerName: 'You',
        onSigned: async () => {
          await Backend.db.permits.update(p.id, {
            signed: true
          });
        }
      }),
      style: {
        background: T.green,
        color: '#fff',
        border: 'none',
        borderRadius: 18,
        padding: '7px 12px',
        cursor: 'pointer',
        fontFamily: SF,
        fontSize: 11,
        fontWeight: 700
      }
    }, "Sign")));
  }))));
}
function GoalsScreen({
  accent
}) {
  const goals = useDB('goals');
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Goals",
    subtitle: `${goals.length} active KPIs`,
    right: React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('addgoal')
    })
  }), React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, goals.map(g => {
    const pct = Math.min(g.current / g.target, 1);
    const ahead = g.current >= g.target;
    return React.createElement("div", {
      key: g.id,
      style: {
        background: T.bg2,
        borderRadius: 14,
        padding: 14,
        border: `0.5px solid ${T.hair}`
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }
    }, React.createElement("div", null, React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 13,
        fontWeight: 600,
        color: T.t1
      }
    }, g.label), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.t2,
        marginTop: 2
      }
    }, g.period)), React.createElement(Pill, {
      c: ahead ? T.green : pct > 0.7 ? T.amber : T.red,
      size: "xs"
    }, ahead ? '✓ ON TARGET' : `${(pct * 100).toFixed(0)}%`)), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        marginTop: 12
      }
    }, React.createElement("span", {
      style: {
        fontFamily: SFMono,
        fontSize: 26,
        color: g.c,
        fontWeight: 700,
        letterSpacing: -0.5
      }
    }, g.unit === '£' ? '£' : '', g.current.toLocaleString(), g.unit !== '£' ? g.unit : ''), React.createElement("span", {
      style: {
        fontFamily: SF,
        fontSize: 13,
        color: T.t3
      }
    }, "/ ", g.unit === '£' ? '£' : '', g.target.toLocaleString(), g.unit !== '£' ? g.unit : '')), React.createElement("div", {
      style: {
        marginTop: 10
      }
    }, React.createElement(Bar, {
      pct: pct * 100,
      c: g.c,
      h: 6
    })));
  }))));
}
function VoiceMemoSheet({
  onClose,
  accent
}) {
  const [recording, setRecording] = React.useState(false);
  const [duration, setDuration] = React.useState(0);
  const [transcript, setTranscript] = React.useState(null);
  const [transcribing, setTranscribing] = React.useState(false);
  React.useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);
  const stop = async () => {
    setRecording(false);
    setTranscribing(true);
    let text;
    try {
      const prompt = `You're a UK construction site manager dictating a voice memo on the way out of site. Generate ONE realistic 2-3 sentence note about today (UK English, conversational, mention specific trades/materials/people). Reply with just the memo text, no quotes.`;
      text = await window.claude.complete({
        messages: [{
          role: 'user',
          content: prompt
        }]
      });
      text = text.trim().replace(/^["']|["']$/g, '');
    } catch (e) {
      text = "Quick site note. Plasterboard delivery delayed until Friday. Aisha confirmed first-fix electrics complete in the kitchen. Need to chase the supplier about second-fix timeline.";
    }
    setTranscript(text);
    setTranscribing(false);
    toast('Transcribed by Cortex', 'ai');
  };
  const save = async () => {
    toast('Voice memo saved', 'success');
    onClose();
  };
  return React.createElement(Sheet, {
    onClose: onClose
  }, React.createElement("div", {
    style: {
      padding: '8px 20px 14px',
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 17,
      fontWeight: 600,
      color: T.t1
    }
  }, "Voice memo"), React.createElement("div", {
    style: {
      padding: '0 24px 30px',
      textAlign: 'center'
    }
  }, !recording && !transcript && !transcribing && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t2,
      marginBottom: 30,
      lineHeight: 1.5
    }
  }, "Record a voice note. Cortex will transcribe it automatically."), React.createElement("button", {
    onClick: () => {
      setRecording(true);
      setDuration(0);
    },
    style: {
      width: 120,
      height: 120,
      borderRadius: 60,
      background: `linear-gradient(135deg, ${T.red}, ${T.red}cc)`,
      border: 'none',
      color: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 12px 30px ${T.red}66`
    }
  }, React.cloneElement(Ic.mic, {
    size: 50
  })), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t3,
      marginTop: 16
    }
  }, "Tap to start recording")), recording && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 36,
      color: T.red,
      fontWeight: 700,
      marginBottom: 24,
      letterSpacing: -1
    }
  }, Math.floor(duration / 60).toString().padStart(2, '0'), ":", (duration % 60).toString().padStart(2, '0')), React.createElement("div", {
    style: {
      width: 140,
      height: 140,
      margin: '0 auto',
      borderRadius: 70,
      background: `linear-gradient(135deg, ${T.red}, ${T.red}cc)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      animation: 'pulse-rec 1.4s infinite'
    }
  }, React.cloneElement(Ic.mic, {
    size: 56
  })), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.red,
      marginTop: 16,
      fontWeight: 600
    }
  }, "\u25CF RECORDING"), React.createElement("button", {
    onClick: stop,
    style: {
      marginTop: 26,
      background: T.bg2,
      color: T.t1,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 12,
      padding: '12px 24px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Stop & transcribe"), React.createElement("style", null, `@keyframes pulse-rec { 0%, 100% { transform: scale(1); box-shadow: 0 12px 30px rgba(239,68,68,0.4) } 50% { transform: scale(1.05); box-shadow: 0 16px 40px rgba(239,68,68,0.6) } }`)), transcribing && React.createElement("div", {
    style: {
      padding: '30px 0'
    }
  }, React.createElement("div", {
    style: {
      width: 60,
      height: 60,
      margin: '0 auto',
      borderRadius: 14,
      background: `linear-gradient(135deg, ${T.purple}, ${accent})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      animation: 'pulse-scale 1.2s infinite'
    }
  }, React.cloneElement(Ic.spark, {
    size: 30
  })), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      color: T.t1,
      fontWeight: 600,
      marginTop: 16
    }
  }, "Transcribing\u2026"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t2,
      marginTop: 6
    }
  }, "Cortex AI is processing your audio"), React.createElement("style", null, `@keyframes pulse-scale { 0%, 100% { transform: scale(1); opacity: 1 } 50% { transform: scale(0.9); opacity: 0.7 } }`)), transcript && React.createElement("div", {
    style: {
      textAlign: 'left'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8
    }
  }, React.createElement("span", {
    style: {
      color: T.purple
    }
  }, React.cloneElement(Ic.spark, {
    size: 13
  })), React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.purple,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    }
  }, "Cortex transcript")), React.createElement("div", {
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 12,
      padding: 14,
      fontFamily: SF,
      fontSize: 14,
      color: T.t1,
      lineHeight: 1.6
    }
  }, transcript), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 14
    }
  }, React.createElement("button", {
    onClick: save,
    style: {
      flex: 1,
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 12,
      padding: '12px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Save memo"), React.createElement("button", {
    onClick: () => {
      setTranscript(null);
      setDuration(0);
    },
    style: {
      background: 'transparent',
      color: T.t2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 12,
      padding: '12px 16px',
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, "Re-record")))));
}
Object.assign(window, {
  DrawingsScreen,
  DrawingViewerSheet,
  PermitsScreen,
  GoalsScreen,
  VoiceMemoSheet
});