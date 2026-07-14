// CortexBuild Pro — backend-v17.js
// v1.7 data layer: registers tables + seed + computed selectors for the
// seven new domains (scheduling, financial intelligence, tender/bid,
// procurement, quality/handover, H&S command centre, client experience).
// Self-contained table factory mirroring backend-extras.js.

(function () {
  if (!window.Backend) return;
  const B = window.Backend;

  // ── date helpers (dynamic, never hardcoded) ──────────────────────
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };
  const TODAY = iso(today);

  // ── seed data ────────────────────────────────────────────────────
  const SEED = {
    // 1 · Scheduling & resource planning ----------------------------
    allocations: [
      { id: 1, resourceType: 'crew',  resourceName: 'Groundworks gang',  resourceId: 'C1', projectId: 1, start: addDays(-2), end: addDays(3),  role: 'Foundations',      qty: 4 },
      { id: 2, resourceType: 'crew',  resourceName: 'Bricklaying team',   resourceId: 'C2', projectId: 2, start: addDays(0),  end: addDays(6),  role: 'Superstructure',   qty: 3 },
      { id: 3, resourceType: 'plant', resourceName: '13t Excavator',      resourceId: 'P1', projectId: 1, start: addDays(-1), end: addDays(2),  role: 'Dig & cart',       qty: 1 },
      { id: 4, resourceType: 'crew',  resourceName: 'Groundworks gang',   resourceId: 'C1', projectId: 3, start: addDays(2),  end: addDays(5),  role: 'Drainage',         qty: 4 },
      { id: 5, resourceType: 'plant', resourceName: 'Telehandler',        resourceId: 'P2', projectId: 2, start: addDays(0),  end: addDays(8),  role: 'Material moves',   qty: 1 },
      { id: 6, resourceType: 'crew',  resourceName: '1st-fix carpenters', resourceId: 'C3', projectId: 4, start: addDays(1),  end: addDays(7),  role: '1st fix',          qty: 2 },
    ],
    // 3 · Tender & bid management -----------------------------------
    bids: [
      { id: 1, ref: 'BID-3041', title: 'Hackney school refurbishment',    client: 'LB Hackney',        value: 480000, stage: 'submitted',  due: addDays(9),   probability: 55, submittedOn: addDays(-3), estimator: 'You', notes: 'Two-stage tender, ITT received.' },
      { id: 2, ref: 'BID-3042', title: 'Riverside apartments — fit-out',   client: 'Meridian Homes',    value: 1250000,stage: 'qualifying', due: addDays(21),  probability: 30, submittedOn: null,        estimator: 'You', notes: 'PQQ passed, awaiting ITT.' },
      { id: 3, ref: 'BID-3043', title: 'Office Cat-B fit-out, Shoreditch', client: 'Apex Capital',      value: 340000, stage: 'won',        due: addDays(-10), probability: 100,submittedOn: addDays(-25),estimator: 'You', notes: 'Awarded — convert to project.' },
      { id: 4, ref: 'BID-3044', title: 'Care home extension, Enfield',     client: 'Sunrise Care Group',value: 720000, stage: 'lost',       due: addDays(-18), probability: 0,  submittedOn: addDays(-30),estimator: 'You', notes: 'Lost on price — 6% above winner.' },
      { id: 5, ref: 'BID-3045', title: 'Retail unit strip-out & CAT-A',    client: 'Brookfield AM',     value: 210000, stage: 'identified', due: addDays(28),  probability: 20, submittedOn: null,        estimator: 'You', notes: 'Early lead via agent.' },
    ],
    // takeoff measurements attached to bids
    takeoffs: [
      { id: 1, bidId: 1, item: 'Internal partitions', qty: 420, unit: 'm²', rate: 48,  total: 20160 },
      { id: 2, bidId: 1, item: 'Suspended ceiling',   qty: 380, unit: 'm²', rate: 36,  total: 13680 },
      { id: 3, bidId: 1, item: 'Floor finishes',      qty: 410, unit: 'm²', rate: 42,  total: 17220 },
    ],
    // supplier RFQ comparison rows
    rfqs: [
      { id: 1, bidId: 1, package: 'M&E sub-package', supplier: 'Volt Building Services', price: 92000, lead: '6 wks', rating: 4.5, selected: true },
      { id: 2, bidId: 1, package: 'M&E sub-package', supplier: 'Crown Electrical',       price: 88500, lead: '8 wks', rating: 4.0, selected: false },
      { id: 3, bidId: 1, package: 'M&E sub-package', supplier: 'Pinnacle MEP',           price: 96400, lead: '5 wks', rating: 4.8, selected: false },
    ],
    // 4 · Procurement scorecards ------------------------------------
    supplierScores: [
      { id: 1, supplier: 'Travis Perkins',  onTimePct: 94, qualityPct: 97, priceIndex: 1.02, disputes: 0, spend: 84200,  rating: 4.6 },
      { id: 2, supplier: 'Jewson',          onTimePct: 88, qualityPct: 95, priceIndex: 0.98, disputes: 1, spend: 51800,  rating: 4.2 },
      { id: 3, supplier: 'Volt Building Services', onTimePct: 91, qualityPct: 99, priceIndex: 1.05, disputes: 0, spend: 126500, rating: 4.7 },
      { id: 4, supplier: 'MGN Plant Hire',  onTimePct: 79, qualityPct: 90, priceIndex: 1.10, disputes: 2, spend: 38400,  rating: 3.6 },
    ],
    // 5 · Quality & handover ----------------------------------------
    handoverItems: [
      { id: 1, projectId: 1, category: 'O&M Manual',     title: 'Mechanical services O&M',     status: 'received',   responsible: 'Volt BS',     due: addDays(14) },
      { id: 2, projectId: 1, category: 'As-built',       title: 'As-built drawings (arch)',    status: 'outstanding',responsible: 'Design team', due: addDays(10) },
      { id: 3, projectId: 1, category: 'Certificate',    title: 'Electrical EIC / NICEIC',     status: 'received',   responsible: 'Crown Elec',  due: addDays(5)  },
      { id: 4, projectId: 1, category: 'Test cert',      title: 'Pressure test certificates',  status: 'in-review',  responsible: 'Volt BS',     due: addDays(7)  },
      { id: 5, projectId: 2, category: 'Warranty',       title: 'Roofing 20yr warranty',       status: 'outstanding',responsible: 'Apex Roofing', due: addDays(20) },
      { id: 6, projectId: 1, category: 'H&S File',       title: 'CDM Health & Safety file',    status: 'in-review',  responsible: 'PD',          due: addDays(12) },
    ],
    // 6 · H&S audits / inspections calendar -------------------------
    hsAudits: [
      { id: 1, projectId: 1, type: 'Site safety audit',     scheduled: addDays(2),  status: 'scheduled', auditor: 'H&S Advisor', score: null },
      { id: 2, projectId: 2, type: 'Scaffold inspection',   scheduled: addDays(-1), status: 'overdue',   auditor: 'Scaffold Co', score: null },
      { id: 3, projectId: 1, type: 'PASMA tower check',     scheduled: addDays(-4), status: 'complete',  auditor: 'Site Manager', score: 96 },
      { id: 4, projectId: 3, type: 'Monthly director tour', scheduled: addDays(6),  status: 'scheduled', auditor: 'Director',    score: null },
    ],
    // toolbox-talk schedule (planned, distinct from logged talks in phase111)
    talkSchedule: [
      { id: 1, projectId: 1, topic: 'Working at height', planned: addDays(1), assignedTo: 'Site Manager', done: false },
      { id: 2, projectId: 2, topic: 'Manual handling',   planned: addDays(2), assignedTo: 'Foreman',      done: false },
      { id: 3, projectId: 1, topic: 'COSHH — silica',    planned: addDays(-1),assignedTo: 'Site Manager', done: true  },
    ],
    // 7 · Client experience -----------------------------------------
    satisfaction: [
      { id: 1, projectId: 1, client: 'Oakwood Developments', score: 9, surveyedOn: addDays(-7),  comment: 'Excellent communication, minor delay handled well.' },
      { id: 2, projectId: 2, client: 'Meridian Homes',       score: 7, surveyedOn: addDays(-14), comment: 'Good progress, would like more frequent photo updates.' },
      { id: 3, projectId: 4, client: 'B. Khoury',            score: 10,surveyedOn: addDays(-3),  comment: 'Outstanding work, will recommend.' },
    ],
    progressFeed: [
      { id: 1, projectId: 1, when: addDays(0),  title: 'Foundations poured — Block A',  body: 'Concrete pour completed and signed off by BCO.', photo: null, clientVisible: true },
      { id: 2, projectId: 1, when: addDays(-1), title: 'Steel frame delivered',         body: 'Primary steel delivered to site, offload complete.', photo: null, clientVisible: true },
      { id: 3, projectId: 2, when: addDays(-2), title: 'First-floor slab complete',     body: 'Slab cured, propping to remain 7 days.', photo: null, clientVisible: true },
    ],
  };

  // ── inject seed if missing ───────────────────────────────────────
  const snap = B.db.snapshot();
  let changed = false;
  Object.entries(SEED).forEach(([k, v]) => {
    if (!snap[k]) { snap[k] = v; changed = true; }
  });
  if (changed) { try { localStorage.setItem('cortexx_db_v1', JSON.stringify(snap)); } catch (e) {} }

  // ── table factory (mirrors backend-extras) ───────────────────────
  const makeTable = (name) => ({
    list: async () => { await new Promise(r => setTimeout(r, 40 + Math.random() * 80)); return [...(B.db.snapshot()[name] || [])]; },
    listSync: () => [...(B.db.snapshot()[name] || [])],
    get: async (id) => (B.db.snapshot()[name] || []).find(x => x.id == id),
    getSync: (id) => (B.db.snapshot()[name] || []).find(x => x.id == id),
    create: async (data) => {
      const s = B.db.snapshot(); s[name] = s[name] || [];
      const ids = s[name].map(x => typeof x.id === 'number' ? x.id : 0);
      const id = data.id ?? (Math.max(0, ...ids) + 1);
      const item = { ...data, id, _rev: Date.now() };
      s[name] = [item, ...s[name]];
      try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
      B.db.user.update({});
      if (window.cortexxCloud) window.cortexxCloud.push(name, 'create', id, item);
      return item;
    },
    update: async (id, patch) => {
      const s = B.db.snapshot(); s[name] = s[name] || [];
      s[name] = s[name].map(x => x.id == id ? { ...x, ...patch, _rev: Date.now() } : x);
      try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
      B.db.user.update({});
      const item = s[name].find(x => x.id == id);
      if (window.cortexxCloud) window.cortexxCloud.push(name, 'update', id, item);
      return item;
    },
    updateSync: (id, patch) => {
      const s = B.db.snapshot(); s[name] = s[name] || [];
      s[name] = s[name].map(x => x.id == id ? { ...x, ...patch, _rev: Date.now() } : x);
      try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
      B.db.user.update({});
    },
    remove: async (id) => {
      const s = B.db.snapshot(); s[name] = s[name] || [];
      s[name] = s[name].filter(x => x.id != id);
      try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
      B.db.user.update({});
      if (window.cortexxCloud) window.cortexxCloud.push(name, 'delete', id);
    },
  });
  Object.keys(SEED).forEach(n => { if (!B.db[n]) B.db[n] = makeTable(n); });

  // ── computed intelligence selectors ──────────────────────────────
  const C = B.computed;
  const num = (x) => Number(x) || 0;

  // Financial intelligence
  C.cashflowForecast = (weeks = 8) => {
    const s = B.db.snapshot();
    const invoices = s.invoices || [];
    const pos = s.purchaseOrders || [];
    const out = [];
    for (let w = 0; w < weeks; w++) {
      const wkStart = new Date(today); wkStart.setDate(today.getDate() + w * 7);
      const wkEnd = new Date(wkStart); wkEnd.setDate(wkStart.getDate() + 7);
      const inflow = invoices.filter(i => i.due && new Date(i.due) >= wkStart && new Date(i.due) < wkEnd && i.status !== 'paid')
        .reduce((a, i) => a + num(i.amount), 0);
      const outflow = pos.filter(p => p.deliveryDate && new Date(p.deliveryDate) >= wkStart && new Date(p.deliveryDate) < wkEnd)
        .reduce((a, p) => a + num(p.total), 0);
      out.push({ week: w, label: 'Wk ' + (w + 1), inflow, outflow, net: inflow - outflow });
    }
    return out;
  };
  C.projectPnL = (projectId) => {
    const s = B.db.snapshot();
    const inv = (s.invoices || []).filter(i => i.projectId == projectId).reduce((a, i) => a + num(i.amount), 0);
    const receipts = (s.receipts || []).filter(r => r.projectId == projectId).reduce((a, r) => a + num(r.amount), 0);
    const labour = (s.timesheets || []).filter(t => t.projectId == projectId)
      .reduce((a, t) => a + (num(t.hours) || (num(t.mon) + num(t.tue) + num(t.wed) + num(t.thu) + num(t.fri) + num(t.sat) + num(t.sun))) * num(t.rate || 22), 0);
    const po = (s.purchaseOrders || []).filter(p => p.projectId == projectId).reduce((a, p) => a + num(p.total), 0);
    const cost = receipts + labour + po;
    return { revenue: inv, cost, labour, materials: receipts + po, profit: inv - cost, marginPct: inv ? Math.round(((inv - cost) / inv) * 100) : 0 };
  };
  C.marginAlerts = (threshold = 15) => {
    const s = B.db.snapshot();
    return (s.projects || []).map(p => ({ project: p, pnl: C.projectPnL(p.id) }))
      .filter(x => x.pnl.revenue > 0 && x.pnl.marginPct < threshold)
      .sort((a, b) => a.pnl.marginPct - b.pnl.marginPct);
  };
  C.wipValue = () => {
    const s = B.db.snapshot();
    return (s.projects || []).reduce((a, p) => {
      const pct = num(p.pct) / 100;
      const contract = num(p.value || p.contract || 0);
      const certified = (s.invoices || []).filter(i => i.projectId == p.id).reduce((x, i) => x + num(i.amount), 0);
      return a + Math.max(0, contract * pct - certified);
    }, 0);
  };

  // Tender / bid analytics
  C.bidPipelineValue = () => (B.db.snapshot().bids || []).filter(b => !['won', 'lost'].includes(b.stage))
    .reduce((a, b) => a + num(b.value) * (num(b.probability) / 100), 0);
  C.winRate = () => {
    const bids = B.db.snapshot().bids || [];
    const decided = bids.filter(b => ['won', 'lost'].includes(b.stage));
    const won = decided.filter(b => b.stage === 'won');
    return decided.length ? Math.round((won.length / decided.length) * 100) : 0;
  };

  // Procurement
  C.avgSupplierRating = () => {
    const ss = B.db.snapshot().supplierScores || [];
    return ss.length ? (ss.reduce((a, s) => a + num(s.rating), 0) / ss.length).toFixed(1) : '0.0';
  };
  C.posPendingApproval = () => (B.db.snapshot().purchaseOrders || []).filter(p => p.status === 'pending').length;

  // Quality & handover
  C.handoverReadiness = (projectId) => {
    const items = (B.db.snapshot().handoverItems || []).filter(h => projectId == null || h.projectId == projectId);
    if (!items.length) return 0;
    const done = items.filter(h => h.status === 'received').length;
    return Math.round((done / items.length) * 100);
  };

  // H&S command centre
  C.nearMissTrend = (weeks = 6) => {
    const inc = B.db.snapshot().incidents || [];
    const out = [];
    for (let w = weeks - 1; w >= 0; w--) {
      const start = new Date(today); start.setDate(today.getDate() - (w + 1) * 7);
      const end = new Date(today); end.setDate(today.getDate() - w * 7);
      const count = inc.filter(i => i.date && new Date(i.date) >= start && new Date(i.date) < end).length;
      out.push({ label: 'W-' + w, count });
    }
    return out;
  };
  C.overdueAudits = () => (B.db.snapshot().hsAudits || []).filter(a => a.status === 'overdue').length;

  // Client experience
  C.avgSatisfaction = () => {
    const ss = B.db.snapshot().satisfaction || [];
    return ss.length ? (ss.reduce((a, s) => a + num(s.score), 0) / ss.length).toFixed(1) : '0.0';
  };
  C.npsScore = () => {
    const ss = B.db.snapshot().satisfaction || [];
    if (!ss.length) return 0;
    const prom = ss.filter(s => s.score >= 9).length;
    const det = ss.filter(s => s.score <= 6).length;
    return Math.round(((prom - det) / ss.length) * 100);
  };

  if (window.console) console.log('[backend-v17] registered', Object.keys(SEED).length, 'tables + intelligence selectors');
})();
