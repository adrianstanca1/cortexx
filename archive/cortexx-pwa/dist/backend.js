// Cortexx — backend layer
// Local-first store (localStorage) with reactive subscriptions + AI helpers.
// Mimics a real REST/SDK feel so the frontend can be wired to a real backend later
// just by swapping this file.

const Backend = (function() {
  const STORAGE_KEY = 'cortexx_db_v1';
  const subs = new Set();

  // ── Seed data ────────────────────────────────────────────
  const SEED = {
    projects: [
      { id: 1, name: 'Camden Mews Refurb', client: 'J. Patterson', value: 185000, pct: 68, status: 'active', addr: 'Camden, NW1', team: 4, due: '2026-06-19', margin: 24.5, createdAt: '2026-04-02' },
      { id: 2, name: 'Hackney Loft Conversion', client: 'Eve & Mark Lin', value: 42000, pct: 22, status: 'active', addr: 'Hackney, E8', team: 2, due: '2026-07-17', margin: 28.0, createdAt: '2026-03-15' },
      { id: 3, name: 'Brixton Shopfront', client: 'Tonic Café Ltd', value: 28000, pct: 90, status: 'snagging', addr: 'Brixton, SW9', team: 3, due: '2026-05-27', margin: 19.4, createdAt: '2026-02-08' },
      { id: 4, name: 'Islington Extension', client: 'B. Khoury', value: 96000, pct: 0, status: 'quoting', addr: 'Islington, N1', team: 0, due: null, margin: 0, createdAt: '2026-05-18' },
      { id: 5, name: 'Streatham Reroof', client: 'Park Towers Mgmt', value: 64000, pct: 100, status: 'complete', addr: 'Streatham, SW16', team: 0, due: '2026-03-30', margin: 26.2, createdAt: '2026-01-12' },
    ],
    tasks: [
      { id: 1, t: 'Order plasterboard 12.5mm', projectId: 1, assignee: 'Tom', due: '2026-05-22', prio: 'high', done: false },
      { id: 2, t: 'Confirm electrician site visit', projectId: 1, assignee: 'Aisha', due: '2026-05-23', prio: 'med', done: false },
      { id: 3, t: 'Sign Camden RAMS', projectId: 1, assignee: 'You', due: '2026-05-23', prio: 'high', done: false },
      { id: 4, t: "Approve Tom's timesheet", projectId: null, assignee: 'You', due: '2026-05-22', prio: 'med', done: false },
      { id: 5, t: 'Send INV-2042 chase', projectId: 1, assignee: 'You', due: '2026-05-26', prio: 'low', done: false },
      { id: 6, t: 'Skip pickup arranged', projectId: 1, assignee: 'Tom', due: '2026-05-22', prio: 'low', done: true },
      { id: 7, t: 'Photograph first-fix', projectId: 1, assignee: 'Aisha', due: '2026-05-21', prio: 'med', done: true },
      { id: 8, t: 'Brixton snag list signed off', projectId: 3, assignee: 'You', due: '2026-05-19', prio: 'high', done: true },
    ],
    team: [
      { id: 1, n: 'Tom Reilly',     r: 'Foreman',     color: '#2563eb', site: 'Camden Mews',  hours: 42.5, status: 'on-site', cscs: 'Gold' },
      { id: 2, n: 'Aisha Begum',    r: 'Electrician', color: '#f59e0b', site: 'Camden Mews',  hours: 38,   status: 'on-site', cscs: 'Blue' },
      { id: 3, n: 'Jack Mitchell',  r: 'Plasterer',   color: '#10b981', site: 'Camden Mews',  hours: 40,   status: 'on-site', cscs: 'Blue' },
      { id: 4, n: 'Sara Khan',      r: 'Apprentice',  color: '#8b5cf6', site: 'Camden Mews',  hours: 32,   status: 'on-site', cscs: 'Green' },
      { id: 5, n: 'Marcus Webb',    r: 'Carpenter',   color: '#06b6d4', site: 'Hackney Loft', hours: 36,   status: 'on-site', cscs: 'Gold' },
      { id: 6, n: 'Lila Owusu',     r: 'Painter',     color: '#ef4444', site: 'Brixton',      hours: 24,   status: 'off',     cscs: 'Blue' },
      { id: 7, n: 'Dan Pavel',      r: 'Labourer',    color: '#f59e0b', site: 'Hackney Loft', hours: 41,   status: 'on-site', cscs: 'Green' },
    ],
    invoices: [
      { id: 'INV-2038', projectId: 1, client: 'J. Patterson',  amount: 37000, status: 'paid',    issued: '2026-04-02', paid: '2026-04-08' },
      { id: 'INV-2040', projectId: 1, client: 'J. Patterson',  amount: 55000, status: 'paid',    issued: '2026-04-22', paid: '2026-04-28' },
      { id: 'INV-2042', projectId: 1, client: 'J. Patterson',  amount: 8420,  status: 'due',     issued: '2026-05-18', due: '2026-05-25' },
      { id: 'INV-2039', projectId: 3, client: 'Tonic Café Ltd', amount: 3890, status: 'overdue', issued: '2026-05-01', due: '2026-05-08' },
      { id: 'INV-2041', projectId: 2, client: 'Eve & Mark Lin', amount: 1900, status: 'due',     issued: '2026-05-15', due: '2026-06-03' },
    ],
    receipts: [
      { id: 1, vendor: 'Travis Perkins', amount: 342.18, date: '2026-05-21', category: 'materials', projectId: 1, assigned: true },
      { id: 2, vendor: 'Selco',          amount: 89.40,  date: '2026-05-21', category: 'materials', projectId: null, assigned: false },
      { id: 3, vendor: 'B&Q',            amount: 24.50,  date: '2026-05-20', category: 'consumables', projectId: null, assigned: false },
    ],
    activity: [
      { id: 1, who: 'Tom Reilly',    what: 'uploaded 4 photos',         where: 'Camden Mews',           when: '2026-05-22T09:29', icon: 'camera',  color: '#2563eb' },
      { id: 2, who: 'Cortex AI',     what: 'flagged margin slip',       where: 'Brixton · −1.2% vs quote', when: '2026-05-22T08:40', icon: 'spark',   color: '#8b5cf6' },
      { id: 3, who: 'Aisha Begum',   what: 'completed first-fix electrics', where: 'Camden · kitchen',  when: '2026-05-22T07:35', icon: 'check',   color: '#f59e0b' },
      { id: 4, who: 'Tom Reilly',    what: 'checked in',                where: 'Camden Mews',           when: '2026-05-22T07:30', icon: 'pin',     color: '#10b981' },
      { id: 5, who: 'You',           what: 'approved £1,450 plasterer rebooking', where: 'Camden Mews', when: '2026-05-21T16:22', icon: 'check',   color: '#10b981' },
    ],
    user: {
      name: 'Adrian Stanca', role: 'Director', company: 'CortexBuild Ltd',
      email: 'adrian@cortexbuild.app', cscs: 'Gold', safetyScore: 92,
      monthHours: 142, monthSites: 7, plan: 'Pro · £49/mo',
    },
    settings: {
      notifications: { safety: true, money: true, daily: false, mentions: true },
      theme: 'dark', units: 'metric', language: 'en-GB',
    },
  };

  // ── Storage ──────────────────────────────────────────────
  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return JSON.parse(JSON.stringify(SEED));
  };
  let state = load();
  const persist = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    subs.forEach(fn => fn(state));
  };

  // ── Subscribe ────────────────────────────────────────────
  const subscribe = (fn) => {
    subs.add(fn);
    return () => subs.delete(fn);
  };

  // ── Simulated latency for "real backend" feel ─────────────
  const delay = (ms = 80 + Math.random() * 160) => new Promise(r => setTimeout(r, ms));

  // ── Table API factory ────────────────────────────────────
  const makeTable = (name) => ({
    list: async () => { await delay(); return [...state[name]]; },
    listSync: () => [...state[name]],
    get: async (id) => { await delay(); return state[name].find(x => x.id == id); },
    getSync: (id) => state[name].find(x => x.id == id),
    create: async (data) => {
      await delay();
      const ids = state[name].map(x => typeof x.id === 'number' ? x.id : 0);
      const id = data.id ?? (Math.max(0, ...ids) + 1);
      const item = { ...data, id };
      state[name] = [item, ...state[name]];
      persist();
      return item;
    },
    update: async (id, patch) => {
      await delay();
      state[name] = state[name].map(x => x.id == id ? { ...x, ...patch } : x);
      persist();
      return state[name].find(x => x.id == id);
    },
    updateSync: (id, patch) => {
      state[name] = state[name].map(x => x.id == id ? { ...x, ...patch } : x);
      persist();
    },
    remove: async (id) => {
      await delay();
      state[name] = state[name].filter(x => x.id != id);
      persist();
    },
  });

  const db = {
    projects: makeTable('projects'),
    tasks: makeTable('tasks'),
    team: makeTable('team'),
    invoices: makeTable('invoices'),
    receipts: makeTable('receipts'),
    activity: makeTable('activity'),
    user: {
      get: async () => { await delay(); return { ...state.user }; },
      getSync: () => ({ ...state.user }),
      update: async (patch) => { await delay(); state.user = { ...state.user, ...patch }; persist(); return state.user; },
    },
    settings: {
      get: async () => { await delay(); return { ...state.settings }; },
      getSync: () => ({ ...state.settings }),
      update: async (patch) => { await delay(); state.settings = { ...state.settings, ...patch }; persist(); return state.settings; },
    },
    reset: () => { state = JSON.parse(JSON.stringify(SEED)); persist(); },
    subscribe,
    snapshot: () => state,
  };

  // ── Derived selectors ────────────────────────────────────
  const computed = {
    cashBalance: () => {
      const paid = state.invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
      const out = state.receipts.reduce((s, r) => s + r.amount, 0);
      return paid - out;
    },
    outstanding: () => state.invoices.filter(i => ['due', 'overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0),
    overdueCount: () => state.invoices.filter(i => i.status === 'overdue').length,
    activeProjects: () => state.projects.filter(p => ['active', 'snagging'].includes(p.status)).length,
    teamOnSite: () => state.team.filter(t => t.status === 'on-site').length,
    tasksOpen: () => state.tasks.filter(t => !t.done).length,
    tasksHighPrio: () => state.tasks.filter(t => !t.done && t.prio === 'high').length,
    pipelineValue: () => state.projects.filter(p => ['active', 'snagging', 'quoting'].includes(p.status)).reduce((s, p) => s + p.value, 0),
    avgMargin: () => {
      const xs = state.projects.filter(p => p.margin > 0);
      return xs.length ? xs.reduce((s, p) => s + p.margin, 0) / xs.length : 0;
    },
  };

  // ── AI service — wraps window.claude.complete ────────────
  const SYS_BASE = (snap) => `You are Cortex AI, the embedded operations agent for a UK construction company called CortexBuild. Speak in UK English. Be tight — 1–3 short sentences unless asked for detail. Talk like a savvy ops lead, not corporate.

Current business state (live snapshot):
- Projects: ${snap.projects.map(p => `${p.name} (${p.status}, ${p.pct}%, £${(p.value/1000).toFixed(0)}k, margin ${p.margin}%)`).join('; ')}
- Outstanding: £${computed.outstanding().toLocaleString()}; overdue: ${computed.overdueCount()}.
- Cash balance: £${computed.cashBalance().toLocaleString()}.
- Team on site: ${computed.teamOnSite()} of ${snap.team.length}.
- Open tasks: ${computed.tasksOpen()} (${computed.tasksHighPrio()} high-priority).`;

  const ai = {
    // Generic ask — used by the chat sheet
    ask: async (userMsg, opts = {}) => {
      const sys = opts.system || SYS_BASE(state);
      const res = await window.claude.complete({
        messages: [{ role: 'user', content: `${sys}\n\nUser: ${userMsg}` }],
      });
      return res.trim();
    },

    // Morning briefing — 2-3 sentence summary of what to know today
    briefing: async () => {
      const prompt = `${SYS_BASE(state)}\n\nWrite a 2-sentence morning briefing for Adrian. Lead with cashflow direction this week, then the one thing he most needs to act on today. Conversational, friendly, no formatting.`;
      return ai.ask('', { system: prompt });
    },

    // Categorize a receipt — returns { category, projectId, confidence }
    categorizeReceipt: async (receipt) => {
      const projects = state.projects.filter(p => ['active','snagging','quoting'].includes(p.status))
        .map(p => `${p.id}:${p.name}`).join(', ');
      const prompt = `Categorize this receipt for a UK construction company. Reply ONLY with JSON like {"category":"materials","projectId":1,"confidence":0.85}.
Categories: materials, tools, fuel, consumables, subsistence, plant-hire, other.
Active projects: ${projects}.
Receipt: vendor="${receipt.vendor}", amount=£${receipt.amount}, date=${receipt.date}.`;
      try {
        const raw = await window.claude.complete({ messages: [{ role: 'user', content: prompt }] });
        const json = raw.match(/\{[\s\S]*\}/)?.[0];
        return JSON.parse(json);
      } catch (e) {
        return { category: 'materials', projectId: null, confidence: 0.5 };
      }
    },

    // Parse a free-form task description into structured fields
    parseTask: async (text) => {
      const projects = state.projects.map(p => `${p.id}:${p.name}`).join(', ');
      const team = state.team.map(t => t.n.split(' ')[0]).join(', ');
      const prompt = `Parse this task into JSON. Reply ONLY with JSON: {"title":"...","projectId":1|null,"assignee":"Tom"|"You","prio":"high"|"med"|"low","due":"YYYY-MM-DD"|null}.
Today is 2026-05-22.
Projects: ${projects}. Team: ${team}, You.
Task: "${text}"`;
      try {
        const raw = await window.claude.complete({ messages: [{ role: 'user', content: prompt }] });
        const json = raw.match(/\{[\s\S]*\}/)?.[0];
        return JSON.parse(json);
      } catch (e) {
        return { title: text, projectId: null, assignee: 'You', prio: 'med', due: null };
      }
    },

    // Draft an invoice chase email
    draftChase: async (invoiceId) => {
      const inv = state.invoices.find(i => i.id === invoiceId);
      if (!inv) return null;
      const prompt = `Draft a brief polite chase email to ${inv.client} about overdue invoice ${inv.id} for £${inv.amount.toLocaleString()} (issued ${inv.issued}, due ${inv.due}). UK English, professional but warm, 3 short paragraphs, sign as "Adrian Stanca, CortexBuild Ltd". Reply with the email body only, no subject line.`;
      return ai.ask('', { system: prompt });
    },

    // Daily decisions — 2-3 things needing approval
    decisions: async () => {
      const prompt = `${SYS_BASE(state)}\n\nLooking at the live state, surface 3 concrete decisions Adrian should make today. Reply ONLY with JSON array: [{"q":"…short question…","ctx":"…1 sentence why…","approve":"Approve label","reject":"Reject label","kind":"approval|schedule|finance"}]`;
      try {
        const raw = await window.claude.complete({ messages: [{ role: 'user', content: prompt }] });
        const json = raw.match(/\[[\s\S]*\]/)?.[0];
        return JSON.parse(json);
      } catch (e) {
        return [];
      }
    },
  };

  return { db, computed, ai };
})();

// ── React hooks for the backend ──────────────────────────
function useDB(table) {
  const [items, setItems] = React.useState(
    table === 'user' || table === 'settings'
      ? Backend.db[table].getSync()
      : Backend.db[table].listSync()
  );
  React.useEffect(() => {
    const unsub = Backend.db.subscribe(() => {
      setItems(
        table === 'user' || table === 'settings'
          ? Backend.db[table].getSync()
          : Backend.db[table].listSync()
      );
    });
    return unsub;
  }, [table]);
  return items;
}

function useComputed(key) {
  const fn = Backend.computed[key];
  const [val, setVal] = React.useState(fn());
  React.useEffect(() => {
    const unsub = Backend.db.subscribe(() => setVal(fn()));
    return unsub;
  }, [key]);
  return val;
}

Object.assign(window, { Backend, useDB, useComputed });
