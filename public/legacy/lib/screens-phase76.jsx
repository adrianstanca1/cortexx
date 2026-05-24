(function () {
  if (!window.Backend) return;
  const KEY = 'cortexx_db_v1';
  Backend.db.export = () => {
    const s = Backend.db.snapshot();
    return JSON.stringify({
      v: 'cortexx-export-1',
      exportedAt: new Date().toISOString(),
      data: s
    }, null, 2);
  };
  Backend.db.import = json => {
    try {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      const data = parsed?.data || parsed;
      if (!data || typeof data !== 'object') throw new Error('Invalid file');
      localStorage.setItem(KEY, JSON.stringify(data));
      location.reload();
    } catch (e) {
      toast('Import failed: ' + (e.message || e), 'error');
    }
  };
  Backend.db.table = (name, opts = {}) => {
    const idGen = opts.idGen || (rows => Math.max(0, ...rows.map(r => typeof r.id === 'number' ? r.id : 0)) + 1);
    return {
      listSync: () => [...(Backend.db.snapshot()[name] || [])],
      list: async () => [...(Backend.db.snapshot()[name] || [])],
      get: async id => (Backend.db.snapshot()[name] || []).find(x => x.id == id),
      create: async d => {
        const s = Backend.db.snapshot();
        if (!s[name]) s[name] = [];
        s[name] = [{
          ...d,
          id: idGen(s[name])
        }, ...s[name]];
        try {
          localStorage.setItem(KEY, JSON.stringify(s));
        } catch (e) {}
        Backend.db.user.update({});
      },
      update: async (id, p) => {
        const s = Backend.db.snapshot();
        if (!s[name]) return;
        s[name] = s[name].map(x => x.id == id ? {
          ...x,
          ...p
        } : x);
        try {
          localStorage.setItem(KEY, JSON.stringify(s));
        } catch (e) {}
        Backend.db.user.update({});
      },
      remove: async id => {
        const s = Backend.db.snapshot();
        if (!s[name]) return;
        s[name] = s[name].filter(x => x.id != id);
        try {
          localStorage.setItem(KEY, JSON.stringify(s));
        } catch (e) {}
        Backend.db.user.update({});
      }
    };
  };
  const s = Backend.db.snapshot();
  if (!s.tags) {
    s.tags = [{
      id: 1,
      label: 'Urgent',
      color: '#ef4444'
    }, {
      id: 2,
      label: 'On hold',
      color: '#f59e0b'
    }, {
      id: 3,
      label: 'For review',
      color: '#8b5cf6'
    }, {
      id: 4,
      label: 'Snagged',
      color: '#06b6d4'
    }];
  }
  if (!s.savedViews) {
    s.savedViews = [{
      id: 1,
      name: 'My overdue',
      icon: 'flag',
      filter: 'status:overdue assignee:me'
    }, {
      id: 2,
      name: 'This week',
      icon: 'clock',
      filter: 'due:this-week'
    }];
  }
  if (!s.templates) {
    s.templates = [{
      id: 1,
      name: 'Kitchen renovation',
      kind: 'project',
      used: 12
    }, {
      id: 2,
      name: 'Loft conversion',
      kind: 'project',
      used: 8
    }, {
      id: 3,
      name: 'Snag report',
      kind: 'doc',
      used: 22
    }];
  }
  if (!s.costItems) {
    s.costItems = [{
      id: 1,
      name: 'Plasterer',
      cat: 'Labour',
      unit: 'day',
      rate: 280
    }, {
      id: 2,
      name: 'Plasterboard 9mm',
      cat: 'Materials',
      unit: 'sheet',
      rate: 12
    }, {
      id: 3,
      name: 'Skip 6 yard',
      cat: 'Plant',
      unit: 'wk',
      rate: 180
    }];
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) {}
  if (!Backend.db.tags) Backend.db.tags = Backend.db.table('tags');
  if (!Backend.db.savedViews) Backend.db.savedViews = Backend.db.table('savedViews');
  if (!Backend.db.templates) Backend.db.templates = Backend.db.table('templates');
  if (!Backend.db.costItems) Backend.db.costItems = Backend.db.table('costItems');
})();
function EditFieldSheet({
  params,
  onClose,
  accent
}) {
  const p = params || {};
  const [val, setVal] = React.useState(p.current ?? '');
  const save = async () => {
    if (p.onSave) {
      await p.onSave(val);
    } else if (p.valuePath?.length) {
      const s = Backend.db.snapshot();
      let node = s;
      for (let i = 0; i < p.valuePath.length - 1; i++) node = node[p.valuePath[i]] = node[p.valuePath[i]] || {};
      node[p.valuePath[p.valuePath.length - 1]] = val;
      try {
        localStorage.setItem('cortexx_db_v1', JSON.stringify(s));
      } catch (e) {}
      Backend.db.user.update({});
    }
    toast(`${p.label} updated`, 'success');
    onClose();
  };
  return React.createElement(FormSheet, {
    title: `Edit ${p.label || 'value'}`,
    onClose: onClose,
    accent: accent,
    onSave: save
  }, p.kind === 'textarea' ? React.createElement(FormTextarea, {
    label: p.label || 'Value',
    v: val,
    onChange: setVal,
    placeholder: p.placeholder || ''
  }) : React.createElement(FormInput, {
    label: p.label || 'Value',
    v: val,
    onChange: setVal,
    placeholder: p.placeholder || '',
    type: p.type || 'text'
  }), p.help && React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11.5,
      color: T.t3,
      padding: '0 2px'
    }
  }, p.help));
}
function StartTripSheet({
  onClose,
  accent
}) {
  const projects = useDB('projects');
  const [tracking, setTracking] = React.useState(false);
  const [start, setStart] = React.useState(null);
  const [now, setNow] = React.useState(null);
  const [projectId, setProjectId] = React.useState(projects.find(p => p.status === 'active')?.id || projects[0]?.id || 1);
  const [purpose, setPurpose] = React.useState('Site visit');
  const watchRef = React.useRef(null);
  const km = (a, b) => {
    if (!a || !b) return 0;
    const R = 6371,
      toR = d => d * Math.PI / 180;
    const dLat = toR(b.lat - a.lat),
      dLng = toR(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  };
  const miles = start && now ? km(start, now) * 0.621371 : 0;
  const begin = () => {
    if (!navigator.geolocation) {
      toast('GPS unavailable', 'error');
      return;
    }
    setTracking(true);
    navigator.geolocation.getCurrentPosition(pos => {
      setStart({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      });
      setNow({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      });
    }, () => {
      toast('Location permission denied', 'error');
      setTracking(false);
    }, {
      enableHighAccuracy: true
    });
    watchRef.current = navigator.geolocation.watchPosition(pos => setNow({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude
    }), () => {}, {
      enableHighAccuracy: true,
      maximumAge: 5000
    });
  };
  const stop = async () => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    setTracking(false);
    const m = Math.max(0.1, miles);
    await Backend.db.mileage.create({
      from: 'Start',
      to: projects.find(p => p.id == projectId)?.name || 'Destination',
      miles: parseFloat(m.toFixed(1)),
      when: new Date().toISOString().slice(0, 10),
      projectId: parseInt(projectId),
      purpose
    });
    toast(`Trip logged: ${m.toFixed(1)} mi · £${(m * 0.45).toFixed(2)} @ HMRC rate`, 'success');
    onClose();
  };
  React.useEffect(() => () => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
  }, []);
  return React.createElement(Sheet, {
    onClose: onClose,
    fullscreen: true
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
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
      cursor: 'pointer'
    }
  }, "Close"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 600,
      color: T.t1
    }
  }, tracking ? 'Trip in progress' : 'New trip'), React.createElement("div", {
    style: {
      width: 50
    }
  })), React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '14px 16px 24px'
    }
  }, React.createElement("div", {
    style: {
      background: tracking ? `linear-gradient(135deg, ${T.green}22, transparent)` : T.bg2,
      border: `0.5px solid ${tracking ? T.green + '55' : T.hair}`,
      borderRadius: 14,
      padding: 16,
      textAlign: 'center'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 8
    }
  }, tracking ? 'Tracking GPS · live' : 'Ready to track'), React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 56,
      fontWeight: 700,
      color: tracking ? T.green : T.t1,
      letterSpacing: -2,
      lineHeight: 1
    }
  }, miles.toFixed(1), React.createElement("span", {
    style: {
      fontSize: 22,
      color: T.t3
    }
  }, " mi")), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t2,
      marginTop: 8
    }
  }, "Reimbursement @ 45p: ", React.createElement("span", {
    style: {
      color: T.green,
      fontWeight: 600
    }
  }, "\xA3", (miles * 0.45).toFixed(2)))), !tracking && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      marginTop: 18
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10.5,
      color: T.t3,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      padding: '0 2px 8px'
    }
  }, "Destination"), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      overflowX: 'auto',
      paddingBottom: 4
    }
  }, projects.map(p => React.createElement("button", {
    key: p.id,
    onClick: () => setProjectId(p.id),
    style: {
      padding: '7px 12px',
      borderRadius: 14,
      flexShrink: 0,
      border: `0.5px solid ${projectId === p.id ? accent : T.hair}`,
      background: projectId === p.id ? `${accent}22` : T.bg2,
      color: projectId === p.id ? accent : T.t2,
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      cursor: 'pointer'
    }
  }, p.name)))), React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, React.createElement(FormSelect, {
    label: "Purpose",
    v: purpose,
    onChange: setPurpose,
    options: [{
      v: 'Site visit',
      l: 'Site visit'
    }, {
      v: 'Client meeting',
      l: 'Client meeting'
    }, {
      v: 'Material run',
      l: 'Material run'
    }, {
      v: 'Inspection',
      l: 'Inspection'
    }, {
      v: 'Other business',
      l: 'Other business'
    }]
  }))), React.createElement("button", {
    onClick: tracking ? stop : begin,
    style: {
      marginTop: 20,
      width: '100%',
      background: tracking ? `linear-gradient(135deg, ${T.red}, ${T.red}cc)` : `linear-gradient(135deg, ${T.green}, ${T.green}cc)`,
      color: '#fff',
      border: 'none',
      borderRadius: 14,
      padding: '16px',
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 700,
      cursor: 'pointer',
      boxShadow: `0 10px 26px ${tracking ? T.red : T.green}55`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8
    }
  }, tracking ? '◼  Stop & log trip' : '●  Start trip'), !tracking && React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11.5,
      color: T.t3,
      textAlign: 'center',
      marginTop: 10,
      lineHeight: 1.5
    }
  }, "Uses your phone's GPS. Logs distance, calculates HMRC reimbursement at 45p/mi, saves to mileage register.")));
}
const TAG_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#2563eb', '#8b5cf6', '#ec4899', '#52749a'];
function AddTagSheet({
  onClose,
  accent
}) {
  const [label, setLabel] = React.useState('');
  const [color, setColor] = React.useState(TAG_COLORS[0]);
  const save = async () => {
    if (!label.trim()) {
      toast('Label required', 'error');
      return;
    }
    await Backend.db.tags.create({
      label: label.trim(),
      color
    });
    toast('Tag added', 'success');
    onClose();
  };
  return React.createElement(FormSheet, {
    title: "New tag",
    onClose: onClose,
    accent: accent,
    onSave: save
  }, React.createElement(FormInput, {
    label: "Label",
    v: label,
    onChange: setLabel,
    placeholder: "e.g. Phase-2"
  }), React.createElement("div", null, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      fontWeight: 600,
      marginBottom: 8
    }
  }, "Color"), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, TAG_COLORS.map(c => React.createElement("button", {
    key: c,
    onClick: () => setColor(c),
    style: {
      width: 32,
      height: 32,
      borderRadius: 16,
      background: c,
      border: color === c ? `2.5px solid #fff` : '2.5px solid transparent',
      boxShadow: color === c ? `0 0 0 1px ${c}` : 'none',
      cursor: 'pointer'
    }
  })))));
}
function AddTemplateSheet({
  onClose,
  accent
}) {
  const [name, setName] = React.useState('');
  const [kind, setKind] = React.useState('project');
  const save = async () => {
    if (!name.trim()) {
      toast('Name required', 'error');
      return;
    }
    await Backend.db.templates.create({
      name: name.trim(),
      kind,
      used: 0
    });
    toast('Template added', 'success');
    onClose();
  };
  return React.createElement(FormSheet, {
    title: "New template",
    onClose: onClose,
    accent: accent,
    onSave: save
  }, React.createElement(FormInput, {
    label: "Name",
    v: name,
    onChange: setName,
    placeholder: "e.g. Bathroom fit-out"
  }), React.createElement(FormSelect, {
    label: "Kind",
    v: kind,
    onChange: setKind,
    options: [{
      v: 'project',
      l: 'Project template'
    }, {
      v: 'doc',
      l: 'Document template'
    }, {
      v: 'task',
      l: 'Task checklist'
    }, {
      v: 'quote',
      l: 'Quote template'
    }]
  }));
}
function AddViewSheet({
  onClose,
  accent
}) {
  const [name, setName] = React.useState('');
  const [filter, setFilter] = React.useState('');
  const save = async () => {
    if (!name.trim()) {
      toast('Name required', 'error');
      return;
    }
    await Backend.db.savedViews.create({
      name: name.trim(),
      filter: filter.trim() || '*',
      icon: 'flag'
    });
    toast('View saved', 'success');
    onClose();
  };
  return React.createElement(FormSheet, {
    title: "Save current view",
    onClose: onClose,
    accent: accent,
    onSave: save
  }, React.createElement(FormInput, {
    label: "Name",
    v: name,
    onChange: setName,
    placeholder: "e.g. Overdue invoices"
  }), React.createElement(FormInput, {
    label: "Filter",
    v: filter,
    onChange: setFilter,
    placeholder: "e.g. status:overdue type:invoice"
  }));
}
function AddCostItemSheet({
  onClose,
  accent
}) {
  const [name, setName] = React.useState('');
  const [cat, setCat] = React.useState('Materials');
  const [unit, setUnit] = React.useState('each');
  const [rate, setRate] = React.useState('');
  const save = async () => {
    if (!name.trim() || !rate) {
      toast('Name and rate required', 'error');
      return;
    }
    await Backend.db.costItems.create({
      name: name.trim(),
      cat,
      unit,
      rate: parseFloat(rate)
    });
    toast('Cost item added', 'success');
    onClose();
  };
  return React.createElement(FormSheet, {
    title: "New cost item",
    onClose: onClose,
    accent: accent,
    onSave: save
  }, React.createElement(FormInput, {
    label: "Name",
    v: name,
    onChange: setName,
    placeholder: "e.g. MDF skirting"
  }), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10
    }
  }, React.createElement(FormSelect, {
    label: "Category",
    v: cat,
    onChange: setCat,
    options: [{
      v: 'Materials',
      l: 'Materials'
    }, {
      v: 'Labour',
      l: 'Labour'
    }, {
      v: 'Plant',
      l: 'Plant'
    }]
  }), React.createElement(FormInput, {
    label: "Unit",
    v: unit,
    onChange: setUnit,
    placeholder: "m / sheet / day"
  })), React.createElement(FormInput, {
    label: "Rate (\xA3)",
    type: "number",
    v: rate,
    onChange: setRate,
    placeholder: "12.50"
  }));
}
Object.assign(window, {
  EditFieldSheet,
  StartTripSheet,
  AddTagSheet,
  AddTemplateSheet,
  AddViewSheet,
  AddCostItemSheet
});