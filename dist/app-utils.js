// Cortexx — Toast system + add-item flows + global Search overlay
// Brings every dead button to life.

// ═══════════════════════════════════════════════════════════════════
// TOAST — global ephemeral feedback
// ═══════════════════════════════════════════════════════════════════
const ToastContext = React.createContext({
  push: () => {}
});
function ToastProvider({
  children
}) {
  const [toasts, setToasts] = React.useState([]);
  const push = React.useCallback((msg, kind = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, {
      id,
      msg,
      kind
    }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2400);
  }, []);
  // expose globally
  React.useEffect(() => {
    window.cortexxToast = push;
  }, [push]);
  return /*#__PURE__*/React.createElement(ToastContext.Provider, {
    value: {
      push
    }
  }, children, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 110,
      left: 0,
      right: 0,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      pointerEvents: 'none'
    }
  }, toasts.map(t => {
    const c = t.kind === 'success' ? T.green : t.kind === 'error' ? T.red : t.kind === 'ai' ? T.purple : T.blue;
    const I = t.kind === 'success' ? Ic.check : t.kind === 'error' ? Ic.alert : t.kind === 'ai' ? Ic.spark : Ic.bell;
    return /*#__PURE__*/React.createElement("div", {
      key: t.id,
      style: {
        background: 'rgba(6,16,30,0.95)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: `0.5px solid ${c}66`,
        borderRadius: 12,
        padding: '10px 14px',
        maxWidth: '85%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: `0 10px 24px rgba(0,0,0,0.5), 0 0 0 1px ${c}33`,
        animation: 'toast-in 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
        pointerEvents: 'auto'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: c
      }
    }, React.cloneElement(I, {
      size: 16
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 13,
        color: T.t1,
        fontWeight: 500
      }
    }, t.msg));
  })), /*#__PURE__*/React.createElement("style", null, `@keyframes toast-in { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`));
}
const toast = (msg, kind) => window.cortexxToast?.(msg, kind);

// ═══════════════════════════════════════════════════════════════════
// SEARCH OVERLAY — global, searches everything
// ═══════════════════════════════════════════════════════════════════
function SearchSheet({
  onClose,
  accent,
  onNavigate
}) {
  const [q, setQ] = React.useState('');
  const projects = useDB('projects');
  const tasks = useDB('tasks');
  const team = useDB('team');
  const subs = useDB('subs');
  const quotes = useDB('quotes');
  const docs = useDB('documents');
  const query = q.toLowerCase().trim();
  const customers = useDB('customers');
  const invoices = useDB('invoices');
  const services = useDB('services');
  const improvements = useDB('improvements');
  const results = query.length < 2 ? null : {
    projects: projects.filter(p => p.name.toLowerCase().includes(query) || p.client.toLowerCase().includes(query)),
    tasks: tasks.filter(t => t.t.toLowerCase().includes(query)),
    team: team.filter(m => m.n.toLowerCase().includes(query)),
    subs: subs.filter(s => s.name.toLowerCase().includes(query) || s.trade.toLowerCase().includes(query)),
    quotes: quotes.filter(qu => qu.title.toLowerCase().includes(query) || qu.client.toLowerCase().includes(query)),
    docs: docs.filter(d => d.name.toLowerCase().includes(query)),
    customers: customers.filter(c => (c.name + ' ' + (c.email || '') + ' ' + (c.address || '')).toLowerCase().includes(query)),
    invoices: invoices.filter(inv => ((inv.number || '') + ' ' + (inv.client || '')).toLowerCase().includes(query)),
    services: services.filter(sv => (sv.name || '').toLowerCase().includes(query)),
    improvements: improvements.filter(i => (i.title || '').toLowerCase().includes(query))
  };
  const has = results && Object.values(results).some(arr => arr.length > 0);
  return /*#__PURE__*/React.createElement(Sheet, {
    onClose: onClose,
    fullscreen: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '12px 16px',
      borderBottom: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.t2
    }
  }, React.cloneElement(Ic.search, {
    size: 18
  })), /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search projects, tasks, people, docs\u2026",
    style: {
      flex: 1,
      background: 'transparent',
      border: 'none',
      color: T.t1,
      fontFamily: SF,
      fontSize: 16,
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: accent,
      fontFamily: SF,
      fontSize: 15,
      cursor: 'pointer'
    }
  }, "Cancel")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '12px 0'
    }
  }, !results && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8
    }
  }, "Suggestions"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, ['Camden', 'Tom', 'Plasterboard', 'Q-2117', 'Brixton snags'].map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    onClick: () => setQ(s),
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.hairMid}`,
      color: T.blueL,
      padding: '6px 12px',
      borderRadius: 14,
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 500,
      cursor: 'pointer'
    }
  }, s)))), results && !has && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '40px 20px',
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 13,
      color: T.t3
    }
  }, "Nothing matches \"", q, "\""), results && has && /*#__PURE__*/React.createElement(React.Fragment, null, results.projects.length > 0 && /*#__PURE__*/React.createElement(Section, {
    title: `Projects · ${results.projects.length}`
  }, /*#__PURE__*/React.createElement(GroupedList, null, results.projects.map((p, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: p.id,
    icon: Ic.projects,
    iconBg: T.blue,
    title: p.name,
    sub: `${p.client} · ${p.status}`,
    isLast: i === a.length - 1,
    onClick: () => {
      onNavigate && onNavigate('project', p);
      onClose();
    }
  })))), results.quotes.length > 0 && /*#__PURE__*/React.createElement(Section, {
    title: `Quotes · ${results.quotes.length}`
  }, /*#__PURE__*/React.createElement(GroupedList, null, results.quotes.map((q, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: q.id,
    icon: Ic.calc,
    iconBg: T.cyan,
    title: q.title,
    sub: `${q.client} · £${q.total.toLocaleString()}`,
    isLast: i === a.length - 1,
    onClick: () => {
      onNavigate && onNavigate('quote', q);
      onClose();
    }
  })))), results.tasks.length > 0 && /*#__PURE__*/React.createElement(Section, {
    title: `Tasks · ${results.tasks.length}`
  }, /*#__PURE__*/React.createElement(GroupedList, null, results.tasks.slice(0, 5).map((t, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: t.id,
    icon: Ic.tasks,
    iconBg: T.purple,
    title: t.t,
    sub: `${t.assignee} · ${formatTaskWhen(t.due)}`,
    isLast: i === Math.min(results.tasks.length, 5) - 1
  })))), results.team.length > 0 && /*#__PURE__*/React.createElement(Section, {
    title: `Team · ${results.team.length}`
  }, /*#__PURE__*/React.createElement(GroupedList, null, results.team.map((m, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: m.id,
    icon: Ic.team,
    iconBg: m.color,
    title: m.n,
    sub: `${m.r} · ${m.site}`,
    isLast: i === a.length - 1
  })))), results.subs.length > 0 && /*#__PURE__*/React.createElement(Section, {
    title: `Subs · ${results.subs.length}`
  }, /*#__PURE__*/React.createElement(GroupedList, null, results.subs.map((s, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: s.id,
    icon: Ic.briefcase,
    iconBg: T.blue,
    title: s.name,
    sub: `${s.trade} · ${s.contact}`,
    isLast: i === a.length - 1
  })))), results.docs.length > 0 && /*#__PURE__*/React.createElement(Section, {
    title: `Documents · ${results.docs.length}`
  }, /*#__PURE__*/React.createElement(GroupedList, null, results.docs.map((d, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: d.id,
    icon: Ic.doc,
    iconBg: T.red,
    title: d.name,
    sub: `${(d.size / 1000).toFixed(1)} MB · ${d.folder}`,
    isLast: i === a.length - 1
  })))), results.customers?.length > 0 && /*#__PURE__*/React.createElement(Section, {
    title: `Customers · ${results.customers.length}`
  }, /*#__PURE__*/React.createElement(GroupedList, null, results.customers.map((c, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: c.id,
    icon: Ic.me,
    iconBg: T.cyan,
    title: c.name,
    sub: `${c.email || ''} · ${c.phone || ''}`,
    isLast: i === a.length - 1,
    onClick: () => {
      onNavigate && onNavigate('customer', c);
      onClose();
    }
  })))), results.invoices?.length > 0 && /*#__PURE__*/React.createElement(Section, {
    title: `Invoices · ${results.invoices.length}`
  }, /*#__PURE__*/React.createElement(GroupedList, null, results.invoices.map((inv, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: inv.id || inv.number,
    icon: Ic.money,
    iconBg: T.green,
    title: inv.client,
    sub: `${inv.number} · £${(inv.amount || 0).toLocaleString()} · ${inv.status}`,
    isLast: i === a.length - 1
  })))), results.services?.length > 0 && /*#__PURE__*/React.createElement(Section, {
    title: `Services · ${results.services.length}`
  }, /*#__PURE__*/React.createElement(GroupedList, null, results.services.map((s, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: s.id,
    icon: Ic.layers,
    iconBg: T.amber,
    title: s.name,
    sub: `${s.margin}% margin · ${s.cycleDays}d cycle`,
    isLast: i === a.length - 1,
    onClick: () => {
      onNavigate && onNavigate('services');
      onClose();
    }
  })))), results.improvements?.length > 0 && /*#__PURE__*/React.createElement(Section, {
    title: `Improvements · ${results.improvements.length}`
  }, /*#__PURE__*/React.createElement(GroupedList, null, results.improvements.map((it, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: it.id,
    icon: Ic.spark,
    iconBg: T.purple,
    title: it.title,
    sub: `${it.lane} · ${it.owner}`,
    isLast: i === a.length - 1,
    onClick: () => {
      onNavigate && onNavigate('improvement', it);
      onClose();
    }
  })))))));
}

// ═══════════════════════════════════════════════════════════════════
// GENERIC INLINE-ADD SHEETS — small, focused
// ═══════════════════════════════════════════════════════════════════

// Project create
function AddProjectSheet({
  onClose,
  accent
}) {
  const [form, setForm] = React.useState({
    name: '',
    client: '',
    addr: '',
    value: '',
    status: 'quoting'
  });
  const save = async () => {
    if (!form.name || !form.client) {
      toast('Name and client required', 'error');
      return;
    }
    await Backend.db.projects.create({
      ...form,
      value: parseInt(form.value) || 0,
      pct: 0,
      margin: 0,
      team: 0,
      due: null,
      createdAt: '2026-05-22'
    });
    toast(`Project "${form.name}" created`, 'success');
    onClose();
  };
  return /*#__PURE__*/React.createElement(FormSheet, {
    title: "New project",
    onClose: onClose,
    accent: accent,
    onSave: save
  }, /*#__PURE__*/React.createElement(FormInput, {
    label: "Project name",
    v: form.name,
    onChange: v => setForm(f => ({
      ...f,
      name: v
    })),
    placeholder: "Camden Loft Refurb"
  }), /*#__PURE__*/React.createElement(FormInput, {
    label: "Client",
    v: form.client,
    onChange: v => setForm(f => ({
      ...f,
      client: v
    })),
    placeholder: "J. Patterson"
  }), /*#__PURE__*/React.createElement(FormInput, {
    label: "Address",
    v: form.addr,
    onChange: v => setForm(f => ({
      ...f,
      addr: v
    })),
    placeholder: "Camden, NW1"
  }), /*#__PURE__*/React.createElement(FormInput, {
    label: "Value (\xA3)",
    v: form.value,
    onChange: v => setForm(f => ({
      ...f,
      value: v
    })),
    placeholder: "185000",
    type: "number"
  }), /*#__PURE__*/React.createElement(FormSelect, {
    label: "Status",
    v: form.status,
    onChange: v => setForm(f => ({
      ...f,
      status: v
    })),
    options: [{
      v: 'quoting',
      l: 'Quoting'
    }, {
      v: 'active',
      l: 'Active'
    }, {
      v: 'snagging',
      l: 'Snagging'
    }, {
      v: 'complete',
      l: 'Complete'
    }]
  }));
}

// Material create
function AddMaterialSheet({
  onClose,
  accent
}) {
  const [form, setForm] = React.useState({
    name: '',
    sku: '',
    stock: '',
    unit: 'pcs',
    min: ''
  });
  const save = async () => {
    if (!form.name) {
      toast('Name required', 'error');
      return;
    }
    await Backend.db.materials.create({
      ...form,
      stock: parseInt(form.stock) || 0,
      min: parseInt(form.min) || 0,
      projectId: null,
      lastOrder: '2026-05-22'
    });
    toast(`Added ${form.name}`, 'success');
    onClose();
  };
  return /*#__PURE__*/React.createElement(FormSheet, {
    title: "Add material",
    onClose: onClose,
    accent: accent,
    onSave: save
  }, /*#__PURE__*/React.createElement(FormInput, {
    label: "Name",
    v: form.name,
    onChange: v => setForm(f => ({
      ...f,
      name: v
    })),
    placeholder: "Plasterboard 12.5mm"
  }), /*#__PURE__*/React.createElement(FormInput, {
    label: "SKU",
    v: form.sku,
    onChange: v => setForm(f => ({
      ...f,
      sku: v
    })),
    placeholder: "PB-12-24"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(FormInput, {
    label: "Stock",
    v: form.stock,
    onChange: v => setForm(f => ({
      ...f,
      stock: v
    })),
    type: "number"
  }), /*#__PURE__*/React.createElement(FormInput, {
    label: "Min",
    v: form.min,
    onChange: v => setForm(f => ({
      ...f,
      min: v
    })),
    type: "number"
  }), /*#__PURE__*/React.createElement(FormSelect, {
    label: "Unit",
    v: form.unit,
    onChange: v => setForm(f => ({
      ...f,
      unit: v
    })),
    options: [{
      v: 'pcs',
      l: 'pcs'
    }, {
      v: 'sheets',
      l: 'sheets'
    }, {
      v: 'bags',
      l: 'bags'
    }, {
      v: 'm²',
      l: 'm²'
    }, {
      v: 'boxes',
      l: 'boxes'
    }, {
      v: 'boards',
      l: 'boards'
    }]
  })));
}

// Sub create
function AddSubSheet({
  onClose,
  accent
}) {
  const [form, setForm] = React.useState({
    name: '',
    trade: '',
    contact: '',
    phone: '',
    insured: true,
    cscs: true
  });
  const save = async () => {
    if (!form.name) {
      toast('Name required', 'error');
      return;
    }
    await Backend.db.subs.create({
      ...form,
      rating: 0,
      jobsDone: 0,
      since: '2026-05'
    });
    toast(`${form.name} added`, 'success');
    onClose();
  };
  return /*#__PURE__*/React.createElement(FormSheet, {
    title: "Add subcontractor",
    onClose: onClose,
    accent: accent,
    onSave: save
  }, /*#__PURE__*/React.createElement(FormInput, {
    label: "Company name",
    v: form.name,
    onChange: v => setForm(f => ({
      ...f,
      name: v
    })),
    placeholder: "Northside Roofing Ltd"
  }), /*#__PURE__*/React.createElement(FormInput, {
    label: "Trade",
    v: form.trade,
    onChange: v => setForm(f => ({
      ...f,
      trade: v
    })),
    placeholder: "Roofing"
  }), /*#__PURE__*/React.createElement(FormInput, {
    label: "Contact",
    v: form.contact,
    onChange: v => setForm(f => ({
      ...f,
      contact: v
    })),
    placeholder: "Mike Doyle"
  }), /*#__PURE__*/React.createElement(FormInput, {
    label: "Phone",
    v: form.phone,
    onChange: v => setForm(f => ({
      ...f,
      phone: v
    })),
    placeholder: "07900 111 222"
  }), /*#__PURE__*/React.createElement(FormToggle, {
    label: "Insured",
    v: form.insured,
    onChange: v => setForm(f => ({
      ...f,
      insured: v
    }))
  }), /*#__PURE__*/React.createElement(FormToggle, {
    label: "CSCS verified",
    v: form.cscs,
    onChange: v => setForm(f => ({
      ...f,
      cscs: v
    }))
  }));
}

// Equipment create
function AddEquipmentSheet({
  onClose,
  accent
}) {
  const [form, setForm] = React.useState({
    name: '',
    serial: '',
    category: 'Power tools',
    status: 'available',
    location: 'Yard'
  });
  const save = async () => {
    if (!form.name) {
      toast('Name required', 'error');
      return;
    }
    await Backend.db.equipment.create({
      ...form,
      nextService: '2026-08-22'
    });
    toast(`${form.name} added`, 'success');
    onClose();
  };
  return /*#__PURE__*/React.createElement(FormSheet, {
    title: "Add equipment",
    onClose: onClose,
    accent: accent,
    onSave: save
  }, /*#__PURE__*/React.createElement(FormInput, {
    label: "Name",
    v: form.name,
    onChange: v => setForm(f => ({
      ...f,
      name: v
    })),
    placeholder: "Hilti SDS drill"
  }), /*#__PURE__*/React.createElement(FormInput, {
    label: "Serial",
    v: form.serial,
    onChange: v => setForm(f => ({
      ...f,
      serial: v
    })),
    placeholder: "HT-3001"
  }), /*#__PURE__*/React.createElement(FormSelect, {
    label: "Category",
    v: form.category,
    onChange: v => setForm(f => ({
      ...f,
      category: v
    })),
    options: [{
      v: 'Power tools',
      l: 'Power tools'
    }, {
      v: 'Hand tools',
      l: 'Hand tools'
    }, {
      v: 'Plant',
      l: 'Plant'
    }, {
      v: 'Access',
      l: 'Access'
    }, {
      v: 'Power',
      l: 'Power'
    }]
  }), /*#__PURE__*/React.createElement(FormInput, {
    label: "Location",
    v: form.location,
    onChange: v => setForm(f => ({
      ...f,
      location: v
    })),
    placeholder: "Yard / site"
  }));
}

// Snag create (with optional AI detect)
function AddSnagSheet({
  onClose,
  accent,
  projectId = 1
}) {
  const [form, setForm] = React.useState({
    title: '',
    area: '',
    priority: 'med',
    assignee: 'Tom'
  });
  const [detecting, setDetecting] = React.useState(false);
  const aiDetect = async () => {
    setDetecting(true);
    const suggestions = await Backend.ai.detectSnags('site photo from a renovation snagging walk-through');
    setDetecting(false);
    if (suggestions.length > 0) {
      setForm(f => ({
        ...f,
        title: suggestions[0].title,
        area: suggestions[0].area,
        priority: suggestions[0].priority
      }));
      toast(`Cortex found ${suggestions.length} likely snag${suggestions.length !== 1 ? 's' : ''}`, 'ai');
    } else {
      toast('No snags detected', 'ai');
    }
  };
  const save = async () => {
    if (!form.title) {
      toast('Title required', 'error');
      return;
    }
    await Backend.db.snags.create({
      ...form,
      projectId,
      status: 'open',
      photos: 0
    });
    toast('Snag logged', 'success');
    onClose();
  };
  return /*#__PURE__*/React.createElement(FormSheet, {
    title: "Log snag",
    onClose: onClose,
    accent: accent,
    onSave: save,
    extraBtn: /*#__PURE__*/React.createElement("button", {
      onClick: aiDetect,
      disabled: detecting,
      style: {
        background: 'transparent',
        color: T.purple,
        border: `0.5px solid ${T.purple}66`,
        borderRadius: 10,
        padding: '8px 12px',
        fontFamily: SF,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 5
      }
    }, React.cloneElement(Ic.spark, {
      size: 12
    }), " ", detecting ? 'Detecting…' : 'AI detect')
  }, /*#__PURE__*/React.createElement(FormInput, {
    label: "What's the issue?",
    v: form.title,
    onChange: v => setForm(f => ({
      ...f,
      title: v
    })),
    placeholder: "Skirting gap at WC threshold"
  }), /*#__PURE__*/React.createElement(FormInput, {
    label: "Where?",
    v: form.area,
    onChange: v => setForm(f => ({
      ...f,
      area: v
    })),
    placeholder: "WC, kitchen, front\u2026"
  }), /*#__PURE__*/React.createElement(FormSelect, {
    label: "Priority",
    v: form.priority,
    onChange: v => setForm(f => ({
      ...f,
      priority: v
    })),
    options: [{
      v: 'low',
      l: 'Low'
    }, {
      v: 'med',
      l: 'Medium'
    }, {
      v: 'high',
      l: 'High'
    }]
  }), /*#__PURE__*/React.createElement(FormInput, {
    label: "Assignee",
    v: form.assignee,
    onChange: v => setForm(f => ({
      ...f,
      assignee: v
    })),
    placeholder: "Tom"
  }));
}

// Change order create
function AddChangeOrderSheet({
  onClose,
  accent
}) {
  const projects = useDB('projects');
  const [form, setForm] = React.useState({
    title: '',
    amount: '',
    reason: '',
    projectId: projects[0]?.id
  });
  const save = async () => {
    if (!form.title) {
      toast('Title required', 'error');
      return;
    }
    const next = (Backend.db.changeOrders.listSync().length + 1).toString().padStart(3, '0');
    await Backend.db.changeOrders.create({
      ...form,
      amount: parseFloat(form.amount) || 0,
      status: 'pending',
      id: 'CO-' + next,
      requested: '2026-05-22'
    });
    toast('Variation submitted', 'success');
    onClose();
  };
  return /*#__PURE__*/React.createElement(FormSheet, {
    title: "New variation",
    onClose: onClose,
    accent: accent,
    onSave: save
  }, /*#__PURE__*/React.createElement(FormSelect, {
    label: "Project",
    v: form.projectId,
    onChange: v => setForm(f => ({
      ...f,
      projectId: parseInt(v)
    })),
    options: projects.map(p => ({
      v: p.id,
      l: p.name
    }))
  }), /*#__PURE__*/React.createElement(FormInput, {
    label: "Title",
    v: form.title,
    onChange: v => setForm(f => ({
      ...f,
      title: v
    })),
    placeholder: "Upgrade kitchen sockets"
  }), /*#__PURE__*/React.createElement(FormInput, {
    label: "Amount (\xA3)",
    v: form.amount,
    onChange: v => setForm(f => ({
      ...f,
      amount: v
    })),
    type: "number",
    placeholder: "1450"
  }), /*#__PURE__*/React.createElement(FormTextarea, {
    label: "Reason / scope",
    v: form.reason,
    onChange: v => setForm(f => ({
      ...f,
      reason: v
    })),
    placeholder: "Client requested USB-C integrated sockets"
  }));
}

// Diary entry create
function AddDiarySheet({
  onClose,
  accent
}) {
  const projects = useDB('projects');
  const [form, setForm] = React.useState({
    projectId: projects[0]?.id,
    present: 4,
    summary: '',
    notes: ''
  });
  const [summarising, setSummarising] = React.useState(false);
  const aiSummarise = async () => {
    setSummarising(true);
    const result = await Backend.ai.summariseDiary({
      date: '2026-05-22',
      weather: {
        temp: 14,
        cond: 'Cloudy'
      },
      present: form.present,
      notes: form.notes || form.summary
    });
    setForm(f => ({
      ...f,
      summary: result
    }));
    setSummarising(false);
    toast('Cortex summarised your notes', 'ai');
  };
  const save = async () => {
    if (!form.summary) {
      toast('Summary required', 'error');
      return;
    }
    await Backend.db.diary.create({
      ...form,
      date: '2026-05-22',
      weather: {
        temp: 14,
        cond: 'Cloudy'
      },
      photos: 0,
      issues: []
    });
    toast('Diary entry saved', 'success');
    onClose();
  };
  return /*#__PURE__*/React.createElement(FormSheet, {
    title: "New diary entry",
    onClose: onClose,
    accent: accent,
    onSave: save,
    extraBtn: /*#__PURE__*/React.createElement("button", {
      onClick: aiSummarise,
      disabled: summarising || !form.notes,
      style: {
        background: 'transparent',
        color: T.purple,
        border: `0.5px solid ${T.purple}66`,
        borderRadius: 10,
        padding: '8px 12px',
        fontFamily: SF,
        fontSize: 12,
        fontWeight: 600,
        cursor: form.notes ? 'pointer' : 'default',
        opacity: form.notes ? 1 : 0.5,
        display: 'flex',
        alignItems: 'center',
        gap: 5
      }
    }, React.cloneElement(Ic.spark, {
      size: 12
    }), " ", summarising ? '…' : 'AI summarise')
  }, /*#__PURE__*/React.createElement(FormSelect, {
    label: "Project",
    v: form.projectId,
    onChange: v => setForm(f => ({
      ...f,
      projectId: parseInt(v)
    })),
    options: projects.map(p => ({
      v: p.id,
      l: p.name
    }))
  }), /*#__PURE__*/React.createElement(FormInput, {
    label: "On site today",
    v: form.present,
    onChange: v => setForm(f => ({
      ...f,
      present: parseInt(v) || 0
    })),
    type: "number"
  }), /*#__PURE__*/React.createElement(FormTextarea, {
    label: "Raw notes",
    v: form.notes,
    onChange: v => setForm(f => ({
      ...f,
      notes: v
    })),
    placeholder: "What happened, who did what, any blockers\u2026"
  }), /*#__PURE__*/React.createElement(FormTextarea, {
    label: "Summary (shown to client)",
    v: form.summary,
    onChange: v => setForm(f => ({
      ...f,
      summary: v
    })),
    placeholder: "Tap 'AI summarise' or write your own"
  }));
}

// ═══════════════════════════════════════════════════════════════════
// FORM PRIMITIVES — used by all add sheets
// ═══════════════════════════════════════════════════════════════════
function FormSheet({
  title,
  children,
  onSave,
  onClose,
  accent,
  extraBtn
}) {
  return /*#__PURE__*/React.createElement(Sheet, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 16px 10px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: accent,
      fontFamily: SF,
      fontSize: 16,
      cursor: 'pointer'
    }
  }, "Cancel"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 600,
      color: T.t1
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onSave,
    style: {
      background: 'none',
      border: 'none',
      color: accent,
      fontFamily: SF,
      fontSize: 16,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, "Save")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '6px 16px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, children, extraBtn && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end'
    }
  }, extraBtn)));
}
function FormInput({
  label,
  v,
  onChange,
  placeholder,
  type = 'text'
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    value: v,
    onChange: e => onChange(e.target.value),
    type: type,
    placeholder: placeholder,
    style: {
      width: '100%',
      boxSizing: 'border-box',
      background: T.bg2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 10,
      padding: '12px 14px',
      color: T.t1,
      fontFamily: SF,
      fontSize: 15,
      outline: 'none'
    }
  }));
}
function FormTextarea({
  label,
  v,
  onChange,
  placeholder
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4
    }
  }, label), /*#__PURE__*/React.createElement("textarea", {
    value: v,
    onChange: e => onChange(e.target.value),
    placeholder: placeholder,
    rows: 3,
    style: {
      width: '100%',
      boxSizing: 'border-box',
      background: T.bg2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 10,
      padding: '12px 14px',
      color: T.t1,
      fontFamily: SF,
      fontSize: 14,
      outline: 'none',
      resize: 'vertical',
      lineHeight: 1.5
    }
  }));
}
function FormSelect({
  label,
  v,
  onChange,
  options
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4
    }
  }, label), /*#__PURE__*/React.createElement("select", {
    value: v,
    onChange: e => onChange(e.target.value),
    style: {
      width: '100%',
      boxSizing: 'border-box',
      background: T.bg2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 10,
      padding: '12px 14px',
      color: T.t1,
      fontFamily: SF,
      fontSize: 15,
      outline: 'none',
      appearance: 'none',
      WebkitAppearance: 'none'
    }
  }, options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.v,
    value: o.v
  }, o.l))));
}
function FormToggle({
  label,
  v,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t1,
      fontWeight: 500
    }
  }, label), /*#__PURE__*/React.createElement(Toggle, {
    on: v,
    onChange: () => onChange(!v),
    accent: T.blue
  }));
}

// Team member create
function AddTeamMemberSheet({
  onClose,
  accent
}) {
  const [form, setForm] = React.useState({
    n: '',
    r: '',
    site: 'Camden Mews',
    cscs: 'Blue',
    color: accent
  });
  const save = async () => {
    if (!form.n) {
      toast('Name required', 'error');
      return;
    }
    await Backend.db.team.create({
      ...form,
      hours: 0,
      status: 'on-site'
    });
    toast(`${form.n} added`, 'success');
    onClose();
  };
  return /*#__PURE__*/React.createElement(FormSheet, {
    title: "Add team member",
    onClose: onClose,
    accent: accent,
    onSave: save
  }, /*#__PURE__*/React.createElement(FormInput, {
    label: "Name",
    v: form.n,
    onChange: v => setForm(f => ({
      ...f,
      n: v
    })),
    placeholder: "Tom Reilly"
  }), /*#__PURE__*/React.createElement(FormInput, {
    label: "Role",
    v: form.r,
    onChange: v => setForm(f => ({
      ...f,
      r: v
    })),
    placeholder: "Foreman / Electrician / Plasterer"
  }), /*#__PURE__*/React.createElement(FormSelect, {
    label: "Site",
    v: form.site,
    onChange: v => setForm(f => ({
      ...f,
      site: v
    })),
    options: [{
      v: 'Camden Mews',
      l: 'Camden Mews'
    }, {
      v: 'Hackney Loft',
      l: 'Hackney Loft'
    }, {
      v: 'Brixton',
      l: 'Brixton'
    }, {
      v: 'Yard',
      l: 'Yard'
    }, {
      v: 'Off',
      l: 'Off site'
    }]
  }), /*#__PURE__*/React.createElement(FormSelect, {
    label: "CSCS",
    v: form.cscs,
    onChange: v => setForm(f => ({
      ...f,
      cscs: v
    })),
    options: [{
      v: 'Green',
      l: 'Green'
    }, {
      v: 'Blue',
      l: 'Blue'
    }, {
      v: 'Gold',
      l: 'Gold'
    }, {
      v: 'Black',
      l: 'Black'
    }]
  }));
}
Object.assign(window, {
  AddTeamMemberSheet
});