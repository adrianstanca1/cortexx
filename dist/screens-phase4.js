// Cortexx — Phase 4: Inspections, CRM, Leads, Photo Gallery, Mileage

// ═══════════════════════════════════════════════════════════════════
// BACKEND EXTENSION
// ═══════════════════════════════════════════════════════════════════
(function () {
  if (!window.Backend) return;
  const snap = Backend.db.snapshot();
  const SEED = {
    inspections: [{
      id: 1,
      kind: 'First-fix electrical',
      projectId: 1,
      inspector: 'Adrian',
      date: '2026-05-22',
      status: 'passed',
      items: [{
        q: 'All circuits tested & dead',
        ok: true,
        note: ''
      }, {
        q: 'Earth bonding verified',
        ok: true,
        note: ''
      }, {
        q: 'Cable runs match drawings v3',
        ok: true,
        note: ''
      }, {
        q: 'Junction boxes accessible',
        ok: true,
        note: ''
      }, {
        q: 'No damage to other trades',
        ok: true,
        note: ''
      }]
    }, {
      id: 2,
      kind: 'Plaster prep',
      projectId: 1,
      inspector: 'Tom',
      date: '2026-05-21',
      status: 'passed',
      items: [{
        q: 'Surfaces clean & dust-free',
        ok: true,
        note: ''
      }, {
        q: 'Beading installed at corners',
        ok: true,
        note: ''
      }, {
        q: 'Joints taped',
        ok: true,
        note: ''
      }, {
        q: 'Adequate drying time scheduled',
        ok: true,
        note: ''
      }]
    }, {
      id: 3,
      kind: 'Pre-handover snag walk',
      projectId: 3,
      inspector: 'Adrian',
      date: '2026-05-19',
      status: 'failed',
      items: [{
        q: 'Paint finish even (all rooms)',
        ok: false,
        note: '2 touch-ups needed in front room'
      }, {
        q: 'Tile grout consistent',
        ok: false,
        note: 'Kitchen needs re-grouting'
      }, {
        q: 'Doors/windows operate',
        ok: true,
        note: ''
      }, {
        q: 'Skirting & architraves snug',
        ok: false,
        note: 'WC threshold gap'
      }]
    }, {
      id: 4,
      kind: 'Plaster prep',
      projectId: 2,
      inspector: 'Marcus',
      date: null,
      status: 'scheduled',
      items: []
    }],
    customers: [{
      id: 1,
      name: 'J. Patterson',
      email: 'j.patterson@email.com',
      phone: '07700 900 111',
      address: '12 Camden Mews, NW1',
      tag: 'Repeat',
      projects: 2,
      totalValue: 222000,
      lastContact: '2026-05-21',
      notes: 'Likes USB-C sockets. High spec finishes. Daughter referred us.'
    }, {
      id: 2,
      name: 'Eve & Mark Lin',
      email: 'e.lin@email.com',
      phone: '07700 900 222',
      address: '8 Mare St, E8',
      tag: 'Active',
      projects: 1,
      totalValue: 42000,
      lastContact: '2026-05-19',
      notes: 'First-time clients. Eve is architect — likes detail.'
    }, {
      id: 3,
      name: 'Tonic Café Ltd',
      email: 'hello@tonic.cafe',
      phone: '07700 900 333',
      address: 'Brixton, SW9',
      tag: 'Commercial',
      projects: 1,
      totalValue: 28000,
      lastContact: '2026-05-15',
      notes: 'Pay on time. Open to expansion.'
    }, {
      id: 4,
      name: 'B. Khoury',
      email: 'b.khoury@email.com',
      phone: '07700 900 444',
      address: 'Islington, N1',
      tag: 'New',
      projects: 0,
      totalValue: 0,
      lastContact: '2026-05-18',
      notes: 'Quote sent for 2-storey extension £96k. Followed up Mon.'
    }, {
      id: 5,
      name: 'Park Towers Mgmt',
      email: 'mgmt@parktowers.co.uk',
      phone: '07700 900 555',
      address: 'Streatham, SW16',
      tag: 'Commercial',
      projects: 1,
      totalValue: 64000,
      lastContact: '2026-04-15',
      notes: '5-block estate. Annual maintenance opportunity.'
    }],
    leads: [{
      id: 1,
      name: 'M. Ortiz',
      inquiry: 'Kitchen refit · Shoreditch',
      value: 22500,
      source: 'Referral',
      stage: 'qualified',
      updated: '2026-05-20'
    }, {
      id: 2,
      name: 'K. Daniels',
      inquiry: 'Loft conversion · Highbury',
      value: 58000,
      source: 'Website',
      stage: 'quoted',
      updated: '2026-05-02'
    }, {
      id: 3,
      name: 'TFG Ltd',
      inquiry: 'Cafe fit-out · Old Street',
      value: 41200,
      source: 'Linkedin',
      stage: 'lost',
      updated: '2026-04-22'
    }, {
      id: 4,
      name: 'Jenny Park',
      inquiry: 'Garden room · Walthamstow',
      value: 18000,
      source: 'Referral',
      stage: 'new',
      updated: '2026-05-22'
    }, {
      id: 5,
      name: 'D. Mensah',
      inquiry: 'Bathroom refit · Crouch End',
      value: 9500,
      source: 'Website',
      stage: 'new',
      updated: '2026-05-21'
    }, {
      id: 6,
      name: 'S. Ahmed',
      inquiry: 'Boundary wall · Walthamstow',
      value: 4200,
      source: 'Walk-in',
      stage: 'qualified',
      updated: '2026-05-19'
    }],
    mileage: [{
      id: 1,
      date: '2026-05-22',
      from: 'Office',
      to: 'Camden Mews',
      miles: 4.2,
      purpose: 'Site visit',
      driver: 'You',
      amount: 1.89
    }, {
      id: 2,
      date: '2026-05-22',
      from: 'Camden Mews',
      to: 'Hackney Loft',
      miles: 3.4,
      purpose: 'Multi-site',
      driver: 'You',
      amount: 1.53
    }, {
      id: 3,
      date: '2026-05-21',
      from: 'Office',
      to: 'Brixton',
      miles: 6.8,
      purpose: 'Snag walk',
      driver: 'You',
      amount: 3.06
    }, {
      id: 4,
      date: '2026-05-20',
      from: 'Office',
      to: 'Islington',
      miles: 5.1,
      purpose: 'Client meeting',
      driver: 'You',
      amount: 2.30
    }, {
      id: 5,
      date: '2026-05-19',
      from: 'Camden Mews',
      to: 'Travis Perkins',
      miles: 1.2,
      purpose: 'Materials',
      driver: 'Tom',
      amount: 0.54
    }]
  };

  // Per-table seed guard (avoids the migration gap where a table added later
  // never seeds because an earlier table already exists).
  let _sd4 = false;
  for (const k of Object.keys(SEED)) {
    if (!snap[k]) {
      snap[k] = SEED[k];
      _sd4 = true;
    }
  }
  if (_sd4) {
    try {
      localStorage.setItem('cortexx_db_v1', JSON.stringify(snap));
    } catch (e) {}
  }
  const arr = name => {
    const s = Backend.db.snapshot();
    if (!Array.isArray(s[name])) s[name] = [];
    return s[name];
  };
  const makeT = name => ({
    listSync: () => [...arr(name)],
    getSync: id => arr(name).find(x => x.id == id),
    list: async () => [...arr(name)],
    get: async id => arr(name).find(x => x.id == id),
    create: async data => {
      const s = Backend.db.snapshot();
      const ids = arr(name).map(x => typeof x.id === 'number' ? x.id : 0);
      const id = data.id ?? Math.max(0, ...ids) + 1;
      const item = {
        ...data,
        id
      };
      s[name] = [item, ...arr(name)];
      try {
        localStorage.setItem('cortexx_db_v1', JSON.stringify(s));
      } catch (e) {}
      Backend.db.user.update({});
      return item;
    },
    update: async (id, patch) => {
      const s = Backend.db.snapshot();
      s[name] = arr(name).map(x => x.id == id ? {
        ...x,
        ...patch
      } : x);
      try {
        localStorage.setItem('cortexx_db_v1', JSON.stringify(s));
      } catch (e) {}
      Backend.db.user.update({});
      return s[name].find(x => x.id == id);
    },
    remove: async id => {
      const s = Backend.db.snapshot();
      s[name] = arr(name).filter(x => x.id != id);
      try {
        localStorage.setItem('cortexx_db_v1', JSON.stringify(s));
      } catch (e) {}
      Backend.db.user.update({});
    }
  });
  Backend.db.inspections = makeT('inspections');
  Backend.db.customers = makeT('customers');
  Backend.db.leads = makeT('leads');
  Backend.db.mileage = makeT('mileage');
  Backend.computed.openInspections = () => (Backend.db.snapshot().inspections || []).filter(i => i.status === 'scheduled').length;
  Backend.computed.failedInspections = () => (Backend.db.snapshot().inspections || []).filter(i => i.status === 'failed').length;
  Backend.computed.newLeads = () => (Backend.db.snapshot().leads || []).filter(l => l.stage === 'new').length;
  Backend.computed.weekMiles = () => (Backend.db.snapshot().mileage || []).reduce((s, m) => s + m.miles, 0);
  Backend.computed.mileageReimburse = () => (Backend.db.snapshot().mileage || []).reduce((s, m) => s + m.amount, 0);

  // AI helpers
  Backend.ai.suggestNextChecklist = async kind => {
    const prompt = `Suggest 5 inspection checklist items for a UK construction "${kind}" inspection. Reply ONLY with JSON array of strings: ["check 1", "check 2", ...]. Items should be specific, action-oriented, UK construction terminology.`;
    try {
      const raw = await window.claude.complete({
        messages: [{
          role: 'user',
          content: prompt
        }]
      });
      const json = raw.match(/\[[\s\S]*\]/)?.[0];
      return JSON.parse(json);
    } catch (e) {
      return [];
    }
  };
  Backend.ai.scoreLead = async lead => {
    const prompt = `Score this construction lead 1-10 for likelihood to convert. Reply ONLY JSON: {"score":N,"reasoning":"1 sentence why"}. Lead: ${lead.name}, inquiry: ${lead.inquiry}, value: £${lead.value}, source: ${lead.source}.`;
    try {
      const raw = await window.claude.complete({
        messages: [{
          role: 'user',
          content: prompt
        }]
      });
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      return JSON.parse(json);
    } catch (e) {
      return {
        score: 5,
        reasoning: 'Unable to score'
      };
    }
  };
})();

// ═══════════════════════════════════════════════════════════════════
// INSPECTIONS
// ═══════════════════════════════════════════════════════════════════
const INSP_STATUS_C = {
  passed: T.green,
  failed: T.red,
  scheduled: T.amber
};
const INSP_TEMPLATES = [{
  k: 'first-fix-elec',
  l: 'First-fix electrical',
  i: Ic.zap
}, {
  k: 'plaster-prep',
  l: 'Plaster prep',
  i: Ic.layers
}, {
  k: 'snag-walk',
  l: 'Snag walk',
  i: Ic.list
}, {
  k: 'handover',
  l: 'Handover sign-off',
  i: Ic.check
}, {
  k: 'health-safety',
  l: 'H&S audit',
  i: Ic.shield
}, {
  k: 'pre-pour',
  l: 'Pre-pour concrete',
  i: Ic.box
}];
function InspectionsScreen({
  accent,
  onOpen
}) {
  const inspections = useDB('inspections');
  const projects = useDB('projects');
  const [seg, setSeg] = React.useState('all');
  const [projectFilter, setProjectFilter] = React.useState('all');
  const [showFilter, setShowFilter] = React.useState(false);
  const filtered = (seg === 'all' ? inspections : inspections.filter(i => i.status === seg)).filter(i => projectFilter === 'all' || i.projectId == projectFilter);
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Inspections",
    subtitle: `${inspections.filter(i => i.status === 'passed').length} passed · ${inspections.filter(i => i.status === 'failed').length} failed · ${inspections.filter(i => i.status === 'scheduled').length} scheduled`,
    right: /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.filter,
      onClick: () => setShowFilter(!showFilter)
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => window.cortexxNav('addinspection'),
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
    })))
  }), showFilter && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 12,
      padding: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10,
      color: T.t3,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6
    }
  }, "Filter by project"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setProjectFilter('all'),
    style: {
      background: projectFilter === 'all' ? accent : T.bg3,
      color: projectFilter === 'all' ? '#fff' : T.t1,
      border: 'none',
      borderRadius: 12,
      padding: '5px 10px',
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, "All projects"), projects.map(p => /*#__PURE__*/React.createElement("button", {
    key: p.id,
    onClick: () => setProjectFilter(p.id),
    style: {
      background: projectFilter == p.id ? accent : T.bg3,
      color: projectFilter == p.id ? '#fff' : T.t1,
      border: 'none',
      borderRadius: 12,
      padding: '5px 10px',
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 600,
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    }
  }, p.name.split(' ').slice(0, 2).join(' ')))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
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
  }, "Quick start"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      overflowX: 'auto',
      paddingBottom: 4
    }
  }, INSP_TEMPLATES.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.k,
    onClick: () => {
      toast(`New ${t.l} inspection`, 'success');
      window.cortexxNav('addinspection');
    },
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 12,
      padding: '10px 14px',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: accent
    }
  }, React.cloneElement(t.i, {
    size: 14
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t1,
      fontWeight: 600
    }
  }, t.l))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 14px'
    }
  }, /*#__PURE__*/React.createElement(SegControl, {
    value: seg,
    onChange: setSeg,
    options: [{
      k: 'all',
      l: 'All',
      n: inspections.length
    }, {
      k: 'passed',
      l: 'Passed',
      n: inspections.filter(i => i.status === 'passed').length
    }, {
      k: 'failed',
      l: 'Failed',
      n: inspections.filter(i => i.status === 'failed').length
    }, {
      k: 'scheduled',
      l: 'Due',
      n: inspections.filter(i => i.status === 'scheduled').length
    }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, filtered.map(insp => {
    const proj = projects.find(p => p.id === insp.projectId);
    const passed = insp.items.filter(it => it.ok).length;
    return /*#__PURE__*/React.createElement("div", {
      key: insp.id,
      onClick: () => onOpen && onOpen(insp),
      style: {
        background: T.bg2,
        borderRadius: 14,
        padding: 14,
        border: `0.5px solid ${T.hair}`,
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 14,
        fontWeight: 600,
        color: T.t1
      }
    }, insp.kind), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 12,
        color: T.t2,
        marginTop: 3
      }
    }, proj?.name?.split(' ').slice(0, 2).join(' '), " \xB7 ", insp.inspector, " \xB7 ", _formatRelDate(insp.date))), /*#__PURE__*/React.createElement(Pill, {
      c: INSP_STATUS_C[insp.status]
    }, insp.status)), insp.items.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12,
        paddingTop: 10,
        borderTop: `0.5px solid ${T.hair}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Bar, {
      pct: passed / insp.items.length * 100,
      c: INSP_STATUS_C[insp.status],
      h: 3
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: SFMono,
        fontSize: 11,
        color: T.t2,
        fontWeight: 600
      }
    }, passed, "/", insp.items.length))));
  }))));
}
function InspectionDetailSheet({
  inspection,
  onClose,
  accent
}) {
  const projects = useDB('projects');
  const proj = projects.find(p => p.id === inspection?.projectId);
  const [items, setItems] = React.useState(inspection?.items || []);
  if (!inspection) return null;
  const passed = items.filter(it => it.ok).length;
  const allPass = items.every(it => it.ok);
  const toggleItem = i => setItems(items.map((it, j) => j === i ? {
    ...it,
    ok: !it.ok
  } : it));
  const sign = () => {
    window.cortexxNav('signature', {
      subject: `${inspection.kind} · ${proj?.name || ''}`,
      signerName: inspection.inspector,
      onSigned: async () => {
        await Backend.db.inspections.update(inspection.id, {
          items,
          status: allPass ? 'passed' : 'failed',
          date: '2026-05-22'
        });
        toast(`Inspection ${allPass ? 'passed' : 'failed'} & signed`, allPass ? 'success' : 'error');
        onClose();
      }
    });
  };
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
  }, "Close"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 600,
      color: T.t1
    }
  }, "Inspection"), /*#__PURE__*/React.createElement("button", {
    onClick: sign,
    style: {
      background: 'none',
      border: 'none',
      color: accent,
      fontFamily: SF,
      fontSize: 16,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, "Sign")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 20px 16px'
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    c: INSP_STATUS_C[inspection.status]
  }, inspection.status), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 22,
      fontWeight: 700,
      color: T.t1,
      marginTop: 8,
      letterSpacing: -0.4
    }
  }, inspection.kind), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t2,
      marginTop: 4
    }
  }, proj?.name, " \xB7 Inspector: ", inspection.inspector), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Bar, {
    pct: passed / Math.max(items.length, 1) * 100,
    c: allPass ? T.green : T.amber,
    h: 5
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 13,
      color: T.t1,
      fontWeight: 700
    }
  }, passed, "/", items.length))), /*#__PURE__*/React.createElement(Section, {
    title: "Checklist"
  }, /*#__PURE__*/React.createElement(GroupedList, null, items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => toggleItem(i),
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '12px 14px',
      cursor: 'pointer',
      borderBottom: i === items.length - 1 ? 'none' : `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 24,
      height: 24,
      borderRadius: 6,
      flexShrink: 0,
      background: it.ok ? T.green : T.bg3,
      border: it.ok ? 'none' : `1.5px solid ${T.hairStrong}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2
    }
  }, it.ok && /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#fff'
    }
  }, React.cloneElement(Ic.check, {
    size: 14,
    sw: 3
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t1,
      fontWeight: 500,
      lineHeight: 1.4
    }
  }, it.q), it.note && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.amber,
      marginTop: 4,
      fontStyle: 'italic'
    }
  }, "\u21B3 ", it.note))))))));
}

// ═══════════════════════════════════════════════════════════════════
// CUSTOMERS / CRM
// ═══════════════════════════════════════════════════════════════════
const TAG_C = {
  Active: T.blue,
  Repeat: T.green,
  Commercial: T.purple,
  New: T.amber
};
function CustomersScreen({
  accent,
  onOpen
}) {
  const customers = useDB('customers');
  const [search, setSearch] = React.useState('');
  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const totalValue = customers.reduce((s, c) => s + c.totalValue, 0);
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Customers",
    subtitle: `${customers.length} contacts · £${(totalValue / 1000).toFixed(0)}k lifetime`,
    right: /*#__PURE__*/React.createElement("button", {
      onClick: () => window.cortexxNav('addcustomer'),
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
      padding: '4px 16px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 10,
      padding: '8px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.t3
    }
  }, React.cloneElement(Ic.search, {
    size: 14
  })), /*#__PURE__*/React.createElement("input", {
    value: search,
    onChange: e => setSearch(e.target.value),
    placeholder: "Search customers\u2026",
    style: {
      flex: 1,
      background: 'transparent',
      border: 'none',
      color: T.t1,
      fontFamily: SF,
      fontSize: 13,
      outline: 'none'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, filtered.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    onClick: () => onOpen && onOpen(c),
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 14,
      border: `0.5px solid ${T.hair}`,
      cursor: 'pointer',
      display: 'flex',
      gap: 12,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: c.name,
    size: 44,
    c: TAG_C[c.tag] || accent
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      color: T.t1
    }
  }, c.name), /*#__PURE__*/React.createElement(Pill, {
    c: TAG_C[c.tag] || accent,
    size: "xs"
  }, c.tag)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 2
    }
  }, c.email), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t3,
      marginTop: 3
    }
  }, c.projects, " project", c.projects !== 1 && 's', " \xB7 \xA3", (c.totalValue / 1000).toFixed(0), "k \xB7 last contact ", _formatRelDate(c.lastContact))))))));
}
function CustomerDetailSheet({
  customer,
  onClose,
  accent
}) {
  const projects = useDB('projects');
  const custProjects = projects.filter(p => p.client === customer?.name);
  if (!customer) return null;
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
  }, "Close"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 600,
      color: T.t1
    }
  }, "Customer"), /*#__PURE__*/React.createElement("button", {
    onClick: () => window.cortexxNav('editfield', {
      label: 'Customer',
      current: customer.name,
      onSave: async v => {/* would patch */}
    }),
    style: {
      background: 'none',
      border: 'none',
      color: accent,
      fontFamily: SF,
      fontSize: 16,
      cursor: 'pointer'
    }
  }, "Edit")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 20px 18px',
      display: 'flex',
      gap: 16,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: customer.name,
    size: 64,
    c: TAG_C[customer.tag] || accent
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Pill, {
    c: TAG_C[customer.tag] || accent
  }, customer.tag), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 22,
      fontWeight: 700,
      color: T.t1,
      letterSpacing: -0.4,
      marginTop: 6,
      lineHeight: 1.1
    }
  }, customer.name))), /*#__PURE__*/React.createElement(Section, {
    title: "Contact"
  }, /*#__PURE__*/React.createElement(GroupedList, null, /*#__PURE__*/React.createElement(Row, {
    icon: Ic.mail,
    iconBg: T.blue,
    title: customer.email,
    sub: "Email \u2014 tap to compose",
    onClick: () => window.open(`mailto:${customer.email}?subject=${encodeURIComponent(customer.name + ' — CortexBuild Pro')}`, '_blank')
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.phone,
    iconBg: T.green,
    title: customer.phone,
    sub: "Phone \u2014 tap to call",
    onClick: () => window.open(`tel:${customer.phone.replace(/\s+/g, '')}`, '_blank')
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.pin,
    iconBg: T.amber,
    title: customer.address,
    sub: "Address \u2014 tap for map",
    isLast: true,
    onClick: () => window.open(`https://maps.google.com/?q=${encodeURIComponent(customer.address)}`, '_blank')
  }))), /*#__PURE__*/React.createElement(Section, {
    title: `Projects · ${custProjects.length}`
  }, custProjects.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      fontFamily: SF,
      fontSize: 13,
      color: T.t3,
      textAlign: 'center'
    }
  }, "No projects yet") : /*#__PURE__*/React.createElement(GroupedList, null, custProjects.map((p, i, a) => /*#__PURE__*/React.createElement(Row, {
    key: p.id,
    icon: Ic.projects,
    iconBg: STATUS_C[p.status],
    title: p.name,
    sub: `${fmt(p.value)} · ${p.pct}%`,
    isLast: i === a.length - 1,
    onClick: () => window.cortexxNav('project', p)
  })))), /*#__PURE__*/React.createElement(Section, {
    title: "Notes"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 14,
      padding: 14,
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      lineHeight: 1.6
    }
  }, customer.notes))));
}

// ═══════════════════════════════════════════════════════════════════
// LEAD PIPELINE
// ═══════════════════════════════════════════════════════════════════
const STAGES = [{
  k: 'new',
  l: 'New',
  c: T.cyan
}, {
  k: 'qualified',
  l: 'Qualified',
  c: T.amber
}, {
  k: 'quoted',
  l: 'Quoted',
  c: T.purple
}, {
  k: 'won',
  l: 'Won',
  c: T.green
}, {
  k: 'lost',
  l: 'Lost',
  c: T.t3
}];
function LeadsScreen({
  accent
}) {
  const leads = useDB('leads');
  const [activeStage, setActiveStage] = React.useState('new');
  const inStage = leads.filter(l => l.stage === activeStage);
  const totalValue = leads.filter(l => !['lost'].includes(l.stage)).reduce((s, l) => s + l.value, 0);
  const advance = async lead => {
    const idx = STAGES.findIndex(s => s.k === lead.stage);
    if (idx < STAGES.length - 2) {
      // don't advance past won
      const newStage = STAGES[idx + 1].k;
      await Backend.db.leads.update(lead.id, {
        stage: newStage
      });
      toast(`${lead.name} → ${STAGES[idx + 1].l}`, 'success');
    }
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
    title: "Lead pipeline",
    subtitle: `${leads.filter(l => l.stage !== 'lost').length} active · £${(totalValue / 1000).toFixed(0)}k pipeline`,
    right: /*#__PURE__*/React.createElement("button", {
      onClick: () => window.cortexxNav('addlead'),
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
      padding: '4px 16px 14px',
      display: 'flex',
      gap: 6,
      overflowX: 'auto'
    }
  }, STAGES.map(s => {
    const n = leads.filter(l => l.stage === s.k).length;
    return /*#__PURE__*/React.createElement("button", {
      key: s.k,
      onClick: () => setActiveStage(s.k),
      style: {
        flexShrink: 0,
        background: activeStage === s.k ? `${s.c}33` : 'transparent',
        border: `0.5px solid ${activeStage === s.k ? s.c + '66' : T.hairMid}`,
        color: activeStage === s.k ? T.t1 : T.t2,
        fontFamily: SF,
        fontSize: 12,
        fontWeight: 600,
        padding: '8px 12px',
        borderRadius: 14,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: 3,
        background: s.c
      }
    }), s.l, /*#__PURE__*/React.createElement("span", {
      style: {
        color: T.t3
      }
    }, n));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, inStage.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 30,
      fontFamily: SF,
      fontSize: 13,
      color: T.t3,
      textAlign: 'center'
    }
  }, "No leads in ", STAGES.find(s => s.k === activeStage)?.l) : inStage.map(l => {
    const stage = STAGES.find(s => s.k === l.stage);
    return /*#__PURE__*/React.createElement("div", {
      key: l.id,
      style: {
        background: T.bg2,
        borderRadius: 12,
        padding: 12,
        border: `0.5px solid ${T.hair}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 14,
        fontWeight: 600,
        color: T.t1
      }
    }, l.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 12,
        color: T.t2,
        marginTop: 3,
        lineHeight: 1.3
      }
    }, l.inquiry), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 5,
        marginTop: 6
      }
    }, /*#__PURE__*/React.createElement(Pill, {
      c: T.cyan,
      size: "xs"
    }, l.source), /*#__PURE__*/React.createElement(Pill, {
      c: T.t3,
      size: "xs"
    }, _formatRelDate(l.updated)))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 16,
        color: T.t1,
        fontWeight: 700
      }
    }, "\xA3", (l.value / 1000).toFixed(0), "k")), !['won', 'lost'].includes(l.stage) && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => advance(l),
      style: {
        flex: 1,
        background: stage.c,
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        padding: '8px',
        fontFamily: SF,
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer'
      }
    }, "Advance \u2192"), l.stage === 'qualified' && /*#__PURE__*/React.createElement("button", {
      onClick: () => window.cortexxNav('estimator'),
      style: {
        background: 'transparent',
        color: T.purple,
        border: `0.5px solid ${T.purple}66`,
        borderRadius: 8,
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
    }), " Quote"), /*#__PURE__*/React.createElement("button", {
      onClick: () => Backend.db.leads.update(l.id, {
        stage: 'lost'
      }),
      style: {
        background: 'transparent',
        color: T.t2,
        border: `0.5px solid ${T.hairMid}`,
        borderRadius: 8,
        padding: '8px 10px',
        fontFamily: SF,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer'
      }
    }, "Lost")));
  }))));
}

// ═══════════════════════════════════════════════════════════════════
// PHOTO GALLERY
// ═══════════════════════════════════════════════════════════════════
function PhotosScreen({
  accent
}) {
  const projects = useDB('projects');
  const [activeProject, setActiveProject] = React.useState(null);
  const totalPhotos = 64; // mock
  const grid = activeProject ? 12 : totalPhotos > 24 ? 24 : totalPhotos;
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Photos",
    subtitle: `${grid} of ${totalPhotos} site photos`,
    right: /*#__PURE__*/React.createElement("button", {
      onClick: async () => {
        await Backend.db.activity.create({
          who: 'You',
          what: 'opened camera',
          where: 'Photos',
          when: new Date().toISOString().slice(0, 16),
          icon: 'camera',
          color: '#8b5cf6'
        });
        toast('Photo captured & uploaded', 'success');
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
    }, React.cloneElement(Ic.camera, {
      size: 18
    }))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 14px',
      display: 'flex',
      gap: 6,
      overflowX: 'auto'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveProject(null),
    style: {
      background: !activeProject ? T.bg3 : 'transparent',
      border: `0.5px solid ${T.hairMid}`,
      color: !activeProject ? T.t1 : T.t2,
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600,
      padding: '6px 12px',
      borderRadius: 12,
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    }
  }, "All"), projects.filter(p => ['active', 'snagging'].includes(p.status)).map(p => /*#__PURE__*/React.createElement("button", {
    key: p.id,
    onClick: () => setActiveProject(p.id),
    style: {
      background: activeProject === p.id ? T.bg3 : 'transparent',
      border: `0.5px solid ${T.hairMid}`,
      color: activeProject === p.id ? T.t1 : T.t2,
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600,
      padding: '6px 12px',
      borderRadius: 12,
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    }
  }, p.name.split(' ').slice(0, 2).join(' ')))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 4
    }
  }, Array.from({
    length: grid
  }).map((_, i) => {
    const palette = ['#1a3a5c', '#2c4a3e', '#3a2c5c', '#5c3a2c', '#2c3a5c', '#3a5c2c', '#4a3a5c', '#5c4a2c'];
    const tag = i < 3 ? 'NEW' : null;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      onClick: () => toast(`Photo ${i + 1} opened`, 'info'),
      style: {
        aspectRatio: '1',
        background: `linear-gradient(${135 + i * 30}deg, ${palette[i % palette.length]}, ${T.bg2})`,
        borderRadius: 8,
        border: `0.5px solid ${T.hair}`,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: "100%",
      height: "100%",
      viewBox: "0 0 60 60",
      style: {
        opacity: 0.25
      }
    }, /*#__PURE__*/React.createElement("rect", {
      x: "6",
      y: "14",
      width: "48",
      height: "36",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "0.5"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "6",
      y1: "32",
      x2: "54",
      y2: "32",
      stroke: "#fff",
      strokeWidth: "0.5"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "30",
      y1: "14",
      x2: "30",
      y2: "50",
      stroke: "#fff",
      strokeWidth: "0.3",
      strokeDasharray: "2 2"
    })), tag && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 4,
        left: 4,
        background: accent,
        color: '#fff',
        fontFamily: SF,
        fontSize: 8,
        fontWeight: 700,
        padding: '2px 5px',
        borderRadius: 3,
        letterSpacing: 0.3
      }
    }, tag), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        background: 'rgba(0,0,0,0.6)',
        color: '#fff',
        fontFamily: SFMono,
        fontSize: 8,
        padding: '1px 4px',
        borderRadius: 3
      }
    }, Math.floor(i / 3) + 7, ":", i * 7 % 60 < 10 ? '0' : '', i * 7 % 60));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '20px 0',
      fontFamily: SF,
      fontSize: 12,
      color: T.t3
    }
  }, grid < totalPhotos && `Showing ${grid} of ${totalPhotos} · scroll for more`))));
}

// ═══════════════════════════════════════════════════════════════════
// MILEAGE
// ═══════════════════════════════════════════════════════════════════
function MileageScreen({
  accent
}) {
  const trips = useDB('mileage');
  const totalMiles = useComputed('weekMiles');
  const reimburse = useComputed('mileageReimburse');
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Mileage",
    subtitle: `${trips.length} trips logged this week`,
    right: /*#__PURE__*/React.createElement("button", {
      onClick: () => window.cortexxNav('starttrip'),
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
      padding: '4px 16px 14px',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      borderRadius: 12,
      padding: 12,
      border: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10,
      color: T.t2,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    }
  }, "This week"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 24,
      color: T.t1,
      fontWeight: 700,
      marginTop: 4,
      letterSpacing: -0.5
    }
  }, totalMiles.toFixed(1), " mi")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      borderRadius: 12,
      padding: 12,
      border: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10,
      color: T.t2,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    }
  }, "Reimburse @ 45p"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 24,
      color: T.green,
      fontWeight: 700,
      marginTop: 4,
      letterSpacing: -0.5
    }
  }, "\xA3", reimburse.toFixed(2)))), /*#__PURE__*/React.createElement(Section, {
    title: "Trips"
  }, /*#__PURE__*/React.createElement(GroupedList, null, trips.map((t, i, a) => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      borderBottom: i === a.length - 1 ? 'none' : `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 8,
      background: `${accent}22`,
      color: accent,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, React.cloneElement(Ic.pin, {
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      color: T.t1
    }
  }, t.from, " \u2192 ", t.to), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 2
    }
  }, t.purpose, " \xB7 ", t.driver, " \xB7 ", _formatRelDate(t.date))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 13,
      color: T.t1,
      fontWeight: 700
    }
  }, t.miles, "mi"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 10,
      color: T.green,
      marginTop: 1
    }
  }, "\xA3", t.amount.toFixed(2)))))))));
}
Object.assign(window, {
  InspectionsScreen,
  InspectionDetailSheet,
  CustomersScreen,
  CustomerDetailSheet,
  LeadsScreen,
  PhotosScreen,
  MileageScreen
});