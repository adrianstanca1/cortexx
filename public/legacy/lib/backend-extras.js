// Cortexx backend — extras
// Adds tables for quotes, timesheets, materials, subs, docs, diary,
// changeOrders, snags, equipment, notifications. Plus AI helpers.

(function() {
  if (!window.Backend) { console.warn('Backend not loaded'); return; }

  // Today reference (matches seed dates)
  const TODAY = '2026-05-22';

  // ── Extra seed data ──────────────────────────────────────
  const EXTRAS = {
    quotes: [
      { id: 'Q-2117', projectId: 4, client: 'B. Khoury', title: 'Islington 2-storey extension', total: 96000, status: 'sent', issued: '2026-05-18', validUntil: '2026-06-18',
        items: [
          { d: 'Strip-out & demolition', qty: 1, unit: 'lot', rate: 4500 },
          { d: 'Foundations & ground works', qty: 1, unit: 'lot', rate: 18000 },
          { d: 'Brick & block work', qty: 240, unit: 'm²', rate: 95 },
          { d: 'Roofing — tiled pitched', qty: 65, unit: 'm²', rate: 180 },
          { d: 'First fix M&E', qty: 1, unit: 'lot', rate: 12500 },
          { d: 'Plastering', qty: 320, unit: 'm²', rate: 28 },
          { d: 'Second fix & finishes', qty: 1, unit: 'lot', rate: 18800 },
        ] },
      { id: 'Q-2118', projectId: null, client: 'M. Ortiz',  title: 'Kitchen refit · Shoreditch',          total: 22500, status: 'draft',   issued: '2026-05-20', validUntil: '2026-06-20', items: [] },
      { id: 'Q-2116', projectId: null, client: 'K. Daniels', title: 'Loft conversion · Highbury',         total: 58000, status: 'accepted', issued: '2026-05-02', validUntil: null, items: [] },
      { id: 'Q-2115', projectId: null, client: 'TFG Ltd',    title: 'Cafe fit-out · Old Street',          total: 41200, status: 'rejected', issued: '2026-04-22', validUntil: null, items: [] },
    ],
    timesheets: [
      { id: 1, userId: 1, name: 'Tom Reilly',    projectId: 1, week: '2026-W21', mon: 8.5, tue: 9,   wed: 8,   thu: 9,   fri: 8,    sat: 0, sun: 0, status: 'pending', cis: true },
      { id: 2, userId: 2, name: 'Aisha Begum',   projectId: 1, week: '2026-W21', mon: 8,   tue: 8,   wed: 7.5, thu: 8,   fri: 6.5,  sat: 0, sun: 0, status: 'pending', cis: false },
      { id: 3, userId: 3, name: 'Jack Mitchell', projectId: 1, week: '2026-W21', mon: 8,   tue: 8,   wed: 8,   thu: 8,   fri: 8,    sat: 0, sun: 0, status: 'approved', cis: true },
      { id: 4, userId: 4, name: 'Sara Khan',     projectId: 1, week: '2026-W21', mon: 6,   tue: 6,   wed: 7,   thu: 7,   fri: 6,    sat: 0, sun: 0, status: 'pending', cis: false },
      { id: 5, userId: 5, name: 'Marcus Webb',   projectId: 2, week: '2026-W21', mon: 7,   tue: 8,   wed: 8,   thu: 7,   fri: 6,    sat: 0, sun: 0, status: 'pending', cis: true },
      { id: 6, userId: 7, name: 'Dan Pavel',     projectId: 2, week: '2026-W21', mon: 8.5, tue: 8.5, wed: 8,   thu: 8,   fri: 8,    sat: 0, sun: 0, status: 'pending', cis: true },
    ],
    materials: [
      { id: 1, name: 'Plasterboard 12.5mm 2.4×1.2m', sku: 'PB-12-24', stock: 18,  unit: 'sheets', min: 12, projectId: 1, lastOrder: '2026-05-15' },
      { id: 2, name: 'Cement 25kg',                  sku: 'CEM-25',    stock: 6,   unit: 'bags',   min: 10, projectId: 1, lastOrder: '2026-05-10' },
      { id: 3, name: 'Insulation 100mm 1200×600',    sku: 'INS-100',   stock: 34,  unit: 'boards', min: 20, projectId: 2, lastOrder: '2026-05-12' },
      { id: 4, name: 'Joist hangers 47mm',           sku: 'JH-47',     stock: 80,  unit: 'pcs',    min: 50, projectId: 2, lastOrder: '2026-05-08' },
      { id: 5, name: 'PIR board 50mm',               sku: 'PIR-50',    stock: 2,   unit: 'boards', min: 8,  projectId: 1, lastOrder: '2026-05-02' },
      { id: 6, name: 'Screws drywall 38mm box',      sku: 'SCD-38',    stock: 12,  unit: 'boxes',  min: 6,  projectId: 1, lastOrder: '2026-05-12' },
    ],
    subs: [
      { id: 1, name: 'Northside Roofing Ltd', trade: 'Roofing',     contact: 'Mike Doyle',  phone: '07900 111 222', insured: true, cscs: true, rating: 4.8, jobsDone: 12, since: '2024-03' },
      { id: 2, name: 'CL Plumbing & Heating', trade: 'Plumbing',    contact: 'Cathy Logan', phone: '07900 333 444', insured: true, cscs: true, rating: 4.5, jobsDone: 18, since: '2023-08' },
      { id: 3, name: 'Spark Electricals',     trade: 'Electrical',  contact: 'Vik Patel',   phone: '07900 555 666', insured: true, cscs: true, rating: 4.9, jobsDone: 24, since: '2023-01' },
      { id: 4, name: 'StoneCraft Masonry',    trade: 'Masonry',     contact: 'Jamal Khan',  phone: '07900 777 888', insured: false, cscs: true, rating: 4.2, jobsDone: 5,  since: '2025-04' },
      { id: 5, name: 'Glass & Glazing Co',    trade: 'Glazing',     contact: 'Pia Romano',  phone: '07900 999 000', insured: true, cscs: true, rating: 4.6, jobsDone: 9,  since: '2024-09' },
    ],
    documents: [
      { id: 1, name: 'RAMS_Camden_v3.pdf',      type: 'pdf', size: 2400, projectId: 1, folder: 'Safety',   uploaded: '2026-05-20', updatedBy: 'Adrian' },
      { id: 2, name: 'Building_Reg_Camden.pdf', type: 'pdf', size: 890,  projectId: 1, folder: 'Permits',  uploaded: '2026-04-12', updatedBy: 'Adrian' },
      { id: 3, name: 'Quote_Final_Signed.pdf',  type: 'pdf', size: 1100, projectId: 1, folder: 'Contracts', uploaded: '2026-04-02', updatedBy: 'Adrian' },
      { id: 4, name: 'Floor_plans_v2.dwg',      type: 'dwg', size: 4200, projectId: 1, folder: 'Drawings', uploaded: '2026-03-28', updatedBy: 'Architect' },
      { id: 5, name: 'Material_W21.xlsx',       type: 'xls', size: 34,   projectId: 1, folder: 'Ordering', uploaded: '2026-05-19', updatedBy: 'Tom' },
      { id: 6, name: 'Hackney_Loft_Plans.pdf',  type: 'pdf', size: 1800, projectId: 2, folder: 'Drawings', uploaded: '2026-03-15', updatedBy: 'Architect' },
      { id: 7, name: 'Brixton_HandoverPack.zip', type: 'zip', size: 12000, projectId: 3, folder: 'Handover', uploaded: '2026-05-18', updatedBy: 'Adrian' },
    ],
    diary: [
      { id: 1, projectId: 1, date: '2026-05-22', weather: { temp: 14, cond: 'Cloudy' }, present: 4, summary: 'First-fix electrical signed off in kitchen. Plasterboard delivery delayed — Tom chasing supplier.', notes: 'Aisha completed kitchen socket runs. Sara assisting Jack with plasterboard prep on ground floor.', photos: 4, issues: ['plasterboard late'] },
      { id: 2, projectId: 1, date: '2026-05-21', weather: { temp: 16, cond: 'Sunny' },  present: 4, summary: 'Strong day. Most of ground floor plasterboard up. Skip swap done at 14:00.', notes: '', photos: 6, issues: [] },
      { id: 3, projectId: 1, date: '2026-05-20', weather: { temp: 13, cond: 'Rain' },   present: 3, summary: 'Wet day — focused on indoor work. Electrical first fix ~80% complete.', notes: '', photos: 2, issues: ['Sara off (sick)'] },
      { id: 4, projectId: 2, date: '2026-05-22', weather: { temp: 14, cond: 'Cloudy' }, present: 2, summary: 'Loft floor joists installed. Marcus measuring up for stair opening tomorrow.', notes: '', photos: 3, issues: [] },
    ],
    changeOrders: [
      { id: 'CO-001', projectId: 1, title: 'Upgrade kitchen sockets to spec',  amount: 1450, status: 'approved', requested: '2026-05-15', approvedBy: 'Adrian', reason: 'Client requested USB-C integrated sockets across kitchen' },
      { id: 'CO-002', projectId: 1, title: 'Additional radiator — utility',     amount: 680,  status: 'pending',  requested: '2026-05-21', reason: 'Client added utility radiator after walk-through' },
      { id: 'CO-003', projectId: 2, title: 'Velux upgrade x2',                  amount: 1200, status: 'approved', requested: '2026-04-28', approvedBy: 'Adrian', reason: 'Upgraded to integra electric units' },
    ],
    snags: [
      { id: 1, projectId: 3, title: 'Skirting gap at WC threshold',       area: 'WC',         priority: 'low',  status: 'open',     assignee: 'Tom',   photos: 1 },
      { id: 2, projectId: 3, title: 'Paint touch-up below window — main', area: 'Front',       priority: 'med',  status: 'open',     assignee: 'Lila',  photos: 1 },
      { id: 3, projectId: 3, title: 'Door handle loose — back room',      area: 'Back room',   priority: 'low',  status: 'fixed',    assignee: 'Tom',   photos: 0 },
      { id: 4, projectId: 3, title: 'Tile grout reset — kitchen',         area: 'Kitchen',     priority: 'med',  status: 'open',     assignee: 'Jack',  photos: 2 },
      { id: 5, projectId: 1, title: 'Floor protection torn — hallway',    area: 'Hall',        priority: 'high', status: 'open',     assignee: 'Tom',   photos: 1 },
    ],
    equipment: [
      { id: 1, name: 'Hilti TE 30-A36 SDS+',   serial: 'HT-3001', category: 'Power tools', status: 'on-site', location: 'Camden Mews',  nextService: '2026-08-15' },
      { id: 2, name: 'Bosch GHO 26-82 D Planer', serial: 'BP-1102', category: 'Power tools', status: 'available', location: 'Yard',      nextService: '2026-09-02' },
      { id: 3, name: 'JCB 8008 mini excavator',  serial: 'EX-2201', category: 'Plant',        status: 'on-site', location: 'Hackney Loft', nextService: '2026-06-10' },
      { id: 4, name: 'Scaffolding tower 4m',     serial: 'ST-5510', category: 'Access',       status: 'on-site', location: 'Brixton',     nextService: '2026-07-22' },
      { id: 5, name: 'Generator 6kVA petrol',    serial: 'GN-7701', category: 'Power',        status: 'service-due', location: 'Yard',     nextService: '2026-05-25' },
    ],
    notifications: [
      { id: 1, kind: 'alert',   t: 'RAMS expires Saturday',          sub: 'Camden Mews — sign-off needed', when: '2026-05-22T09:15', read: false, color: '#f59e0b', action: 'safety' },
      { id: 2, kind: 'money',   t: 'INV-2039 is 14 days overdue',    sub: 'Tonic Café · £3,890',           when: '2026-05-22T08:30', read: false, color: '#ef4444', action: 'chase' },
      { id: 3, kind: 'task',    t: 'Tom uploaded 4 photos',          sub: 'Camden — first-fix kitchen',    when: '2026-05-22T07:35', read: true,  color: '#2563eb', action: 'project' },
      { id: 4, kind: 'ai',      t: 'Cortex flagged margin slip',     sub: 'Brixton −1.2% vs quote',         when: '2026-05-22T07:00', read: true,  color: '#8b5cf6', action: 'project' },
      { id: 5, kind: 'team',    t: 'Sara Khan CSCS expires soon',    sub: 'In 6 weeks · book renewal',     when: '2026-05-21T16:40', read: true,  color: '#06b6d4', action: 'safety' },
      { id: 6, kind: 'quote',   t: 'B. Khoury opened your quote',    sub: 'Q-2117 · Islington Extension',  when: '2026-05-21T11:20', read: true,  color: '#10b981', action: 'quotes' },
    ],
  };

  // ── Inject seed if missing ───────────────────────────────
  const snap = Backend.db.snapshot();
  Object.entries(EXTRAS).forEach(([k, v]) => {
    if (!snap[k]) {
      snap[k] = v;
      try { localStorage.setItem('cortexx_db_v1', JSON.stringify(snap)); } catch (e) {}
    }
  });

  // ── Extend table API ─────────────────────────────────────
  const tableNames = Object.keys(EXTRAS);
  const internalMakeTable = (name) => ({
    list: async () => { await new Promise(r => setTimeout(r, 60 + Math.random()*120)); return [...Backend.db.snapshot()[name]]; },
    listSync: () => [...Backend.db.snapshot()[name]],
    get: async (id) => Backend.db.snapshot()[name].find(x => x.id == id),
    getSync: (id) => Backend.db.snapshot()[name].find(x => x.id == id),
    create: async (data) => {
      const s = Backend.db.snapshot();
      const ids = s[name].map(x => typeof x.id === 'number' ? x.id : 0);
      const id = data.id ?? (Math.max(0, ...ids) + 1);
      const item = { ...data, id };
      s[name] = [item, ...s[name]];
      try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
      // re-trigger subscribers
      Backend.db.user.update({});
      return item;
    },
    update: async (id, patch) => {
      const s = Backend.db.snapshot();
      s[name] = s[name].map(x => x.id == id ? { ...x, ...patch } : x);
      try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
      Backend.db.user.update({});
      return s[name].find(x => x.id == id);
    },
    updateSync: (id, patch) => {
      const s = Backend.db.snapshot();
      s[name] = s[name].map(x => x.id == id ? { ...x, ...patch } : x);
      try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
      Backend.db.user.update({});
    },
    remove: async (id) => {
      const s = Backend.db.snapshot();
      s[name] = s[name].filter(x => x.id != id);
      try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
      Backend.db.user.update({});
    },
  });
  tableNames.forEach(n => { Backend.db[n] = internalMakeTable(n); });

  // ── Extra computed selectors ─────────────────────────────
  Backend.computed.weekHours = () => {
    const ts = Backend.db.snapshot().timesheets || [];
    return ts.reduce((s, t) => s + (t.mon||0) + (t.tue||0) + (t.wed||0) + (t.thu||0) + (t.fri||0) + (t.sat||0) + (t.sun||0), 0);
  };
  Backend.computed.pendingTimesheets = () => (Backend.db.snapshot().timesheets || []).filter(t => t.status === 'pending').length;
  Backend.computed.lowStock = () => (Backend.db.snapshot().materials || []).filter(m => m.stock < m.min).length;
  Backend.computed.openSnags = () => (Backend.db.snapshot().snags || []).filter(s => s.status === 'open').length;
  Backend.computed.pendingChanges = () => (Backend.db.snapshot().changeOrders || []).filter(c => c.status === 'pending').length;
  Backend.computed.unreadNotifications = () => (Backend.db.snapshot().notifications || []).filter(n => !n.read).length;
  Backend.computed.activeQuotesValue = () => (Backend.db.snapshot().quotes || []).filter(q => ['sent','draft'].includes(q.status)).reduce((s,q) => s + q.total, 0);

  // ── AI helpers ──────────────────────────────────────────
  // AI estimator — turns a brief into line items + total
  Backend.ai.estimateQuote = async (brief) => {
    const prompt = `You are a UK construction estimator. Given a job brief, output realistic line items with quantities, units, and rates in GBP for a London-based SMB contractor. Reply ONLY with JSON: {"title":"...","items":[{"d":"description","qty":1,"unit":"m²|lot|hr|pcs","rate":000}],"total":000,"assumptions":["..."]}.
Brief: "${brief}"`;
    try {
      const raw = await window.claude.complete({ messages: [{ role: 'user', content: prompt }] });
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      return JSON.parse(json);
    } catch (e) {
      return { title: 'Estimate', items: [{ d: brief, qty: 1, unit: 'lot', rate: 0 }], total: 0, assumptions: [] };
    }
  };

  // Daily site summary from diary notes/conditions
  Backend.ai.summariseDiary = async (entry) => {
    const prompt = `Summarise this UK construction site daily log into a tight 2-sentence summary suitable for the client. Be honest about delays, but professional. Reply with just the summary text.
Date: ${entry.date}; Weather: ${entry.weather.temp}°C ${entry.weather.cond}; Crew: ${entry.present}; Notes: ${entry.notes || entry.summary}; Issues: ${(entry.issues||[]).join(', ') || 'none'}`;
    return Backend.ai.ask('', { system: prompt });
  };

  // Snag detection from photo (mocked — would call vision in real life)
  Backend.ai.detectSnags = async (description) => {
    const prompt = `Imagine you've just looked at a construction site photo described as: "${description}". List 0-3 likely snags or defects to inspect. Reply ONLY with JSON array: [{"title":"...","area":"...","priority":"low|med|high"}]. If nothing notable, reply with [].`;
    try {
      const raw = await window.claude.complete({ messages: [{ role: 'user', content: prompt }] });
      const json = raw.match(/\[[\s\S]*\]/)?.[0];
      return JSON.parse(json);
    } catch (e) { return []; }
  };

  // Material forecast — what to order
  Backend.ai.forecastMaterials = async () => {
    const mats = Backend.db.snapshot().materials;
    const low = mats.filter(m => m.stock < m.min);
    const prompt = `You're managing materials for a UK contractor. These items are below their minimum stock:
${low.map(m => `${m.name} (have ${m.stock} ${m.unit}, min ${m.min})`).join('\n')}
Recommend a single short paragraph (2-3 sentences max) on what to order now and why. UK English, conversational.`;
    return Backend.ai.ask('', { system: prompt });
  };

  // Schedule suggestion
  Backend.ai.suggestSchedule = async () => {
    const projects = Backend.db.snapshot().projects.filter(p => ['active','snagging'].includes(p.status));
    const team = Backend.db.snapshot().team;
    const prompt = `You're a UK construction ops manager. Given these active projects: ${projects.map(p => `${p.name} (${p.pct}% complete)`).join('; ')} and team: ${team.map(t => `${t.n.split(' ')[0]} (${t.r}, currently at ${t.site})`).join('; ')}, suggest a single tweak to crew allocation tomorrow. 2 sentences max. UK English.`;
    return Backend.ai.ask('', { system: prompt });
  };

  // Onboarding — turn user input about their business into seed projects
  Backend.ai.onboardFromBrief = async (brief) => {
    const prompt = `A UK construction SMB owner just described their business: "${brief}". Generate 2-3 plausible active projects with realistic UK addresses, client names, and values for them to start with. Reply ONLY with JSON array: [{"name":"...","client":"...","addr":"District, postcode","value":000,"pct":0-90,"status":"active|snagging|quoting"}].`;
    try {
      const raw = await window.claude.complete({ messages: [{ role: 'user', content: prompt }] });
      const json = raw.match(/\[[\s\S]*\]/)?.[0];
      return JSON.parse(json);
    } catch (e) { return []; }
  };
})();

// ── Date helpers ────────────────────────────────────────────
const _formatRelDate = (iso) => {
  if (!iso) return '—';
  const today = new Date('2026-05-22');
  const d = new Date(iso);
  const days = Math.round((d - today) / (24*60*60*1000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 0 && days < 7) return d.toLocaleDateString('en-GB', { weekday: 'long' });
  if (days < 0 && days > -7) return `${-days}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

Object.assign(window, { _formatRelDate });
