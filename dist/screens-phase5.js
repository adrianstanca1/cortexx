// Cortexx — Phase 5: Activity log, Job templates, Forms library, Tour overlay, Quote→Project conversion

(function () {
  if (!window.Backend) return;
  const snap = Backend.db.snapshot();
  const SEED = {
    auditLog: [{
      id: 1,
      who: 'You',
      what: 'approved CO-001',
      where: 'Camden Mews',
      when: '2026-05-22T09:15',
      icon: 'check',
      color: '#10b981'
    }, {
      id: 2,
      who: 'Tom Reilly',
      what: 'uploaded 4 site photos',
      where: 'Camden Mews',
      when: '2026-05-22T07:35',
      icon: 'camera',
      color: '#2563eb'
    }, {
      id: 3,
      who: 'Cortex AI',
      what: 'drafted chase for INV-2039',
      where: 'Tonic Café',
      when: '2026-05-22T07:00',
      icon: 'spark',
      color: '#8b5cf6'
    }, {
      id: 4,
      who: 'Aisha Begum',
      what: 'completed first-fix electrics',
      where: 'Camden',
      when: '2026-05-22T06:45',
      icon: 'check',
      color: '#f59e0b'
    }, {
      id: 5,
      who: 'You',
      what: 'created Q-2118',
      where: 'M. Ortiz',
      when: '2026-05-20T16:20',
      icon: 'calc',
      color: '#06b6d4'
    }, {
      id: 6,
      who: 'You',
      what: 'logged 4.2mi to Camden',
      where: 'Mileage',
      when: '2026-05-22T07:30',
      icon: 'pin',
      color: '#06b6d4'
    }, {
      id: 7,
      who: 'Cortex AI',
      what: 'flagged margin slip',
      where: 'Brixton',
      when: '2026-05-22T06:00',
      icon: 'spark',
      color: '#8b5cf6'
    }, {
      id: 8,
      who: 'Sara Khan',
      what: 'checked in',
      where: 'Camden Mews',
      when: '2026-05-22T07:32',
      icon: 'pin',
      color: '#10b981'
    }, {
      id: 9,
      who: 'You',
      what: 'sent INV-2042 to client',
      where: 'Camden',
      when: '2026-05-19T11:00',
      icon: 'mail',
      color: '#2563eb'
    }, {
      id: 10,
      who: 'Jack Mitchell',
      what: 'started plasterboard run',
      where: 'Camden',
      when: '2026-05-22T08:30',
      icon: 'check',
      color: '#f59e0b'
    }],
    jobTemplates: [{
      id: 1,
      name: 'Loft conversion (typical)',
      stages: 6,
      milestones: ['Strip-out', 'Steels', 'Joists', '1st fix', 'Plaster', '2nd fix'],
      typical_value: 50000,
      typical_weeks: 10
    }, {
      id: 2,
      name: 'Kitchen refit',
      stages: 4,
      milestones: ['Strip-out', '1st fix', 'Cabinets', 'Finishes'],
      typical_value: 18000,
      typical_weeks: 4
    }, {
      id: 3,
      name: 'Bathroom refit',
      stages: 4,
      milestones: ['Strip-out', 'Plumbing', 'Tiling', 'Finishes'],
      typical_value: 8000,
      typical_weeks: 2
    }, {
      id: 4,
      name: 'Single-storey extension',
      stages: 7,
      milestones: ['Foundations', 'Walls', 'Roof', '1st fix', 'Plaster', '2nd fix', 'Snag'],
      typical_value: 65000,
      typical_weeks: 16
    }, {
      id: 5,
      name: 'Re-roof terraced',
      stages: 3,
      milestones: ['Strip', 'Membrane & felt', 'Tile & finish'],
      typical_value: 16000,
      typical_weeks: 1
    }],
    forms: [{
      id: 1,
      kind: 'Sign-in sheet',
      submitted: 23,
      latest: '2026-05-22',
      icon: 'team'
    }, {
      id: 2,
      kind: 'Toolbox talk',
      submitted: 8,
      latest: '2026-05-22',
      icon: 'shield'
    }, {
      id: 3,
      kind: 'Method statement',
      submitted: 4,
      latest: '2026-05-15',
      icon: 'doc'
    }, {
      id: 4,
      kind: 'Permit to work',
      submitted: 2,
      latest: '2026-05-10',
      icon: 'check'
    }, {
      id: 5,
      kind: 'Daily health check',
      submitted: 28,
      latest: '2026-05-22',
      icon: 'shield'
    }, {
      id: 6,
      kind: 'Near-miss report',
      submitted: 1,
      latest: '2026-05-08',
      icon: 'alert'
    }, {
      id: 7,
      kind: 'Customer satisfaction',
      submitted: 5,
      latest: '2026-05-19',
      icon: 'star'
    }]
  };
  if (!snap.auditLog) {
    Object.assign(snap, SEED);
    try {
      localStorage.setItem('cortexx_db_v1', JSON.stringify(snap));
    } catch (e) {}
  }
  const makeT = name => ({
    listSync: () => [...Backend.db.snapshot()[name]],
    getSync: id => Backend.db.snapshot()[name].find(x => x.id == id),
    list: async () => [...Backend.db.snapshot()[name]],
    get: async id => Backend.db.snapshot()[name].find(x => x.id == id),
    create: async data => {
      const s = Backend.db.snapshot();
      const ids = s[name].map(x => typeof x.id === 'number' ? x.id : 0);
      const id = data.id ?? Math.max(0, ...ids) + 1;
      s[name] = [{
        ...data,
        id
      }, ...s[name]];
      try {
        localStorage.setItem('cortexx_db_v1', JSON.stringify(s));
      } catch (e) {}
      Backend.db.user.update({});
    },
    update: async (id, patch) => {
      const s = Backend.db.snapshot();
      s[name] = s[name].map(x => x.id == id ? {
        ...x,
        ...patch
      } : x);
      try {
        localStorage.setItem('cortexx_db_v1', JSON.stringify(s));
      } catch (e) {}
      Backend.db.user.update({});
    },
    remove: async () => {}
  });
  Backend.db.auditLog = makeT('auditLog');
  Backend.db.jobTemplates = makeT('jobTemplates');
  Backend.db.forms = makeT('forms');
})();

// ═══════════════════════════════════════════════════════════════════
// ACTIVITY / AUDIT LOG
// ═══════════════════════════════════════════════════════════════════
const NOTIF_ICON_MAP = {
  check: Ic.check,
  camera: Ic.camera,
  spark: Ic.spark,
  calc: Ic.calc,
  pin: Ic.pin,
  mail: Ic.mail,
  alert: Ic.alert
};
function ActivityScreen({
  accent
}) {
  const log = useDB('auditLog');
  const [filter, setFilter] = React.useState('all');
  const filtered = filter === 'all' ? log : filter === 'me' ? log.filter(l => l.who === 'You') : filter === 'ai' ? log.filter(l => l.who === 'Cortex AI') : log.filter(l => !['You', 'Cortex AI'].includes(l.who));
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Activity",
    subtitle: `${log.length} events · last 7 days`,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.download,
      onClick: () => toast('Activity log exported', 'success')
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
    }
  }, /*#__PURE__*/React.createElement(SegControl, {
    value: filter,
    onChange: setFilter,
    options: [{
      k: 'all',
      l: 'All',
      n: log.length
    }, {
      k: 'me',
      l: 'Me',
      n: log.filter(l => l.who === 'You').length
    }, {
      k: 'team',
      l: 'Team',
      n: log.filter(l => !['You', 'Cortex AI'].includes(l.who)).length
    }, {
      k: 'ai',
      l: 'AI',
      n: log.filter(l => l.who === 'Cortex AI').length
    }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 32,
      top: 14,
      bottom: 14,
      width: 1.5,
      background: T.hair
    }
  }), filtered.map((ev, i) => {
    const Icon = NOTIF_ICON_MAP[ev.icon] || Ic.bell;
    return /*#__PURE__*/React.createElement("div", {
      key: ev.id,
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '12px 0',
        position: 'relative'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 34,
        height: 34,
        borderRadius: 17,
        background: T.bg0,
        border: `2px solid ${ev.color}`,
        color: ev.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        zIndex: 1
      }
    }, React.cloneElement(Icon, {
      size: 15
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        paddingTop: 4
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 13,
        color: T.t1,
        lineHeight: 1.4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600
      }
    }, ev.who), /*#__PURE__*/React.createElement("span", {
      style: {
        color: T.t2
      }
    }, " ", ev.what)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 10,
        color: T.t3,
        marginTop: 3
      }
    }, ev.where, " \xB7 ", new Date(ev.when).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    }), " \xB7 ", _formatRelDate(ev.when.slice(0, 10)))));
  }))));
}

// ═══════════════════════════════════════════════════════════════════
// JOB TEMPLATES
// ═══════════════════════════════════════════════════════════════════
function TemplatesScreen({
  accent
}) {
  const templates = useDB('jobTemplates');
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Job templates",
    subtitle: "Reusable project blueprints",
    right: /*#__PURE__*/React.createElement("button", {
      onClick: async () => {
        await Backend.db.jobTemplates.create({
          name: 'Untitled template',
          stages: 1,
          milestones: ['Stage 1'],
          typical_value: 0,
          typical_weeks: 1
        });
        toast('Template created', 'success');
      },
      style: {
        width: 36,
        height: 36,
        borderRadius: 18,
        background: accent,
        border: 'none',
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, React.cloneElement(Ic.plus, {
      size: 20
    }))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, templates.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 14,
      border: `0.5px solid ${T.hair}`
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
      fontSize: 15,
      fontWeight: 600,
      color: T.t1
    }
  }, t.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 4
    }
  }, t.stages, " stages \xB7 ~", t.typical_weeks, " wks \xB7 ~\xA3", (t.typical_value / 1000).toFixed(0), "k")), /*#__PURE__*/React.createElement("button", {
    onClick: async () => {
      await Backend.db.projects.create({
        name: `New ${t.name}`,
        client: 'TBC',
        value: t.typical_value,
        pct: 0,
        status: 'quoting',
        addr: 'TBC',
        team: 0,
        due: null,
        margin: 0,
        createdAt: '2026-05-22'
      });
      toast(`Project created from "${t.name}"`, 'success');
    },
    style: {
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 18,
      padding: '6px 12px',
      cursor: 'pointer',
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700
    }
  }, "Use")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 10,
      paddingTop: 10,
      borderTop: `0.5px solid ${T.hair}`
    }
  }, t.milestones.map((m, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontFamily: SFMono,
      fontSize: 9,
      color: T.t2,
      background: T.bg3,
      padding: '3px 7px',
      borderRadius: 4,
      border: `0.5px solid ${T.hair}`
    }
  }, i + 1, ". ", m))))))));
}

// ═══════════════════════════════════════════════════════════════════
// FORMS LIBRARY
// ═══════════════════════════════════════════════════════════════════
const FORM_ICON_MAP = {
  team: Ic.team,
  shield: Ic.shield,
  doc: Ic.doc,
  check: Ic.check,
  alert: Ic.alert,
  star: Ic.star
};
function FormsScreen({
  accent
}) {
  const forms = useDB('forms');
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Forms",
    subtitle: `${forms.length} templates · ${forms.reduce((s, f) => s + f.submitted, 0)} submitted`,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: async () => {
        await Backend.db.forms.create({
          kind: 'Untitled form',
          submitted: 0,
          latest: '2026-05-22',
          icon: 'doc'
        });
        toast('Form created', 'success');
      }
    })
  }), /*#__PURE__*/React.createElement(Section, {
    title: "Available forms"
  }, /*#__PURE__*/React.createElement(GroupedList, null, forms.map((f, i, a) => {
    const I = FORM_ICON_MAP[f.icon] || Ic.doc;
    return /*#__PURE__*/React.createElement(Row, {
      key: f.id,
      icon: I,
      iconBg: [T.blue, T.amber, T.purple, T.green, T.red, T.cyan][i % 6],
      title: f.kind,
      sub: `${f.submitted} submitted · last ${_formatRelDate(f.latest)}`,
      isLast: i === a.length - 1,
      onClick: () => toast(`Opening ${f.kind}…`, 'info')
    });
  }))), /*#__PURE__*/React.createElement(Section, {
    title: "AI"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(135deg, ${T.purple}22, ${accent}0a)`,
      border: `0.5px solid ${T.purple}44`,
      borderRadius: 14,
      padding: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.purple
    }
  }, React.cloneElement(Ic.spark, {
    size: 22
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      color: T.t1
    }
  }, "Generate a custom form"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 2
    }
  }, "Describe what you need; Cortex builds the template")), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.t3
    }
  }, Ic.chevR)))));
}
Object.assign(window, {
  ActivityScreen,
  TemplatesScreen,
  FormsScreen
});