// CortexBuild Admin Console — core layer
// Desktop, multi-tenant SaaS-provider view. Local-first store (localStorage)
// with reactive subscriptions. Seeds realistic platform data: workspaces
// (tenant companies), users across them, projects, billing, audit log.
// All mutations persist + notify subscribers — every action in the UI is real.

(function () {
  'use strict';

  // ── Desktop design tokens ────────────────────────────────
  window.AT = {
    // Surfaces (graphite/navy, consistent with the mobile app brand)
    bg0: '#0a1422',   // app background
    bg1: '#0e1a2c',   // content area
    sidebar: '#081120',
    card: '#13233c',
    card2: '#172a47',
    hover: '#1c3050',
    // Brand + status
    blue: '#2563eb', blueL: '#60a5fa', blueDim: 'rgba(37,99,235,0.14)',
    green: '#10b981', greenDim: 'rgba(16,185,129,0.14)',
    amber: '#f59e0b', amberDim: 'rgba(245,158,11,0.14)',
    red: '#ef4444', redDim: 'rgba(239,68,68,0.14)',
    purple: '#8b5cf6', purpleDim: 'rgba(139,92,246,0.14)',
    cyan: '#06b6d4', cyanDim: 'rgba(6,182,212,0.14)',
    // Text
    t1: '#eef3fa', t2: '#93a8c6', t3: '#5e7characters'.replace('characters','a99'),
    // Lines
    hair: 'rgba(255,255,255,0.07)',
    hairMid: 'rgba(255,255,255,0.12)',
    hairStrong: 'rgba(255,255,255,0.20)',
    // Type
    sans: '-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
    mono: '"SF Mono", "JetBrains Mono", ui-monospace, monospace',
  };
  // fix accidental token above
  window.AT.t3 = '#5e7a99';

  // ── Persisted multi-tenant store ─────────────────────────
  const KEY = 'cortexx_admin_v1';

  function isoDaysAgo(d) {
    const t = new Date('2026-06-08T10:00:00');
    t.setDate(t.getDate() - d);
    return t.toISOString();
  }

  const SEED = {
    workspaces: [
      { id: 'ws_camden', name: 'CortexBuild Ltd', owner: 'Adrian Stanca', plan: 'Pro', seats: 8, seatsUsed: 7, mrr: 392, status: 'active', region: 'UK-London', created: '2026-01-12', projects: 5, storageMB: 1840 },
      { id: 'ws_meridian', name: 'Meridian Construction', owner: 'Priya Nair', plan: 'Business', seats: 25, seatsUsed: 22, mrr: 1225, status: 'active', region: 'UK-Manchester', created: '2025-11-03', projects: 14, storageMB: 7320 },
      { id: 'ws_blackwell', name: 'Blackwell & Sons', owner: 'Derek Blackwell', plan: 'Pro', seats: 12, seatsUsed: 9, mrr: 588, status: 'active', region: 'UK-Leeds', created: '2026-02-20', projects: 8, storageMB: 3110 },
      { id: 'ws_harbour', name: 'Harbour Civils', owner: 'Siobhan Doyle', plan: 'Business', seats: 40, seatsUsed: 38, mrr: 1960, status: 'active', region: 'IE-Dublin', created: '2025-09-14', projects: 21, storageMB: 12480 },
      { id: 'ws_vertex', name: 'Vertex Interiors', owner: 'Marco Ferreira', plan: 'Starter', seats: 3, seatsUsed: 3, mrr: 0, status: 'trial', region: 'UK-Bristol', created: '2026-05-28', projects: 2, storageMB: 410 },
      { id: 'ws_kestrel', name: 'Kestrel Roofing', owner: 'Gary Whitlock', plan: 'Pro', seats: 6, seatsUsed: 4, mrr: 294, status: 'past_due', region: 'UK-Birmingham', created: '2026-03-08', projects: 4, storageMB: 980 },
      { id: 'ws_northgate', name: 'Northgate Developments', owner: 'Helen Carr', plan: 'Business', seats: 30, seatsUsed: 19, mrr: 1470, status: 'active', region: 'UK-Glasgow', created: '2025-12-01', projects: 17, storageMB: 8650 },
      { id: 'ws_oldmill', name: 'Old Mill Joinery', owner: 'Tomasz Kowal', plan: 'Starter', seats: 2, seatsUsed: 2, mrr: 0, status: 'suspended', region: 'UK-Sheffield', created: '2026-04-19', projects: 1, storageMB: 120 },
    ],
    users: [
      { id: 'u1', name: 'Adrian Stanca', email: 'adrian@cortexbuild.app', ws: 'ws_camden', role: 'Owner', status: 'active', lastSeen: isoDaysAgo(0), mfa: true },
      { id: 'u2', name: 'Tom Reilly', email: 'tom@cortexbuild.app', ws: 'ws_camden', role: 'Manager', status: 'active', lastSeen: isoDaysAgo(0), mfa: true },
      { id: 'u3', name: 'Aisha Begum', email: 'aisha@cortexbuild.app', ws: 'ws_camden', role: 'Member', status: 'active', lastSeen: isoDaysAgo(1), mfa: false },
      { id: 'u4', name: 'Priya Nair', email: 'priya@meridian.co', ws: 'ws_meridian', role: 'Owner', status: 'active', lastSeen: isoDaysAgo(0), mfa: true },
      { id: 'u5', name: 'James Okoro', email: 'james@meridian.co', ws: 'ws_meridian', role: 'Admin', status: 'active', lastSeen: isoDaysAgo(2), mfa: true },
      { id: 'u6', name: 'Derek Blackwell', email: 'derek@blackwell.uk', ws: 'ws_blackwell', role: 'Owner', status: 'active', lastSeen: isoDaysAgo(1), mfa: false },
      { id: 'u7', name: 'Siobhan Doyle', email: 'siobhan@harbourcivils.ie', ws: 'ws_harbour', role: 'Owner', status: 'active', lastSeen: isoDaysAgo(0), mfa: true },
      { id: 'u8', name: 'Marco Ferreira', email: 'marco@vertexinteriors.com', ws: 'ws_vertex', role: 'Owner', status: 'active', lastSeen: isoDaysAgo(3), mfa: false },
      { id: 'u9', name: 'Gary Whitlock', email: 'gary@kestrelroofing.uk', ws: 'ws_kestrel', role: 'Owner', status: 'active', lastSeen: isoDaysAgo(6), mfa: false },
      { id: 'u10', name: 'Helen Carr', email: 'helen@northgate.dev', ws: 'ws_northgate', role: 'Owner', status: 'active', lastSeen: isoDaysAgo(1), mfa: true },
      { id: 'u11', name: 'Tomasz Kowal', email: 'tomasz@oldmilljoinery.uk', ws: 'ws_oldmill', role: 'Owner', status: 'disabled', lastSeen: isoDaysAgo(22), mfa: false },
      { id: 'u12', name: 'Lena Fischer', email: 'lena@northgate.dev', ws: 'ws_northgate', role: 'Manager', status: 'active', lastSeen: isoDaysAgo(0), mfa: true },
    ],
    incidents: [
      { id: 'inc1', sev: 'resolved', title: 'Elevated API latency (eu-west-2)', when: isoDaysAgo(4), dur: '23m' },
      { id: 'inc2', sev: 'resolved', title: 'Push delivery delays (APNs)', when: isoDaysAgo(11), dur: '1h 4m' },
    ],
    audit: [
      { id: 'a1', actor: 'system', action: 'billing.invoice.paid', target: 'Meridian Construction', when: isoDaysAgo(0), meta: '£1,225' },
      { id: 'a2', actor: 'adrian@cortexbuild.app', action: 'workspace.seat.added', target: 'CortexBuild Ltd', when: isoDaysAgo(0), meta: '+1 seat' },
      { id: 'a3', actor: 'system', action: 'billing.payment.failed', target: 'Kestrel Roofing', when: isoDaysAgo(1), meta: '£294' },
      { id: 'a4', actor: 'priya@meridian.co', action: 'user.role.changed', target: 'james@meridian.co', when: isoDaysAgo(2), meta: 'Member → Admin' },
      { id: 'a5', actor: 'system', action: 'workspace.trial.started', target: 'Vertex Interiors', when: isoDaysAgo(11), meta: '14-day' },
      { id: 'a6', actor: 'admin@cortexbuild.app', action: 'workspace.suspended', target: 'Old Mill Joinery', when: isoDaysAgo(3), meta: 'non-payment' },
    ],
    mrrHistory: [18200, 19050, 20100, 21340, 22080, 23120, 24300, 25180, 26040, 27200, 28350, 29400],
    signupsHistory: [4, 6, 5, 8, 7, 9, 11, 8, 12, 10, 14, 13],
    invoices: [
      { id: 'in1', ws: 'ws_meridian', number: 'CB-10247', amount: 1225, status: 'paid', issued: '2026-06-01', due: '2026-06-15' },
      { id: 'in2', ws: 'ws_harbour', number: 'CB-10246', amount: 1960, status: 'paid', issued: '2026-06-01', due: '2026-06-15' },
      { id: 'in3', ws: 'ws_northgate', number: 'CB-10245', amount: 1470, status: 'paid', issued: '2026-06-01', due: '2026-06-15' },
      { id: 'in4', ws: 'ws_camden', number: 'CB-10244', amount: 392, status: 'open', issued: '2026-06-01', due: '2026-06-15' },
      { id: 'in5', ws: 'ws_blackwell', number: 'CB-10243', amount: 588, status: 'open', issued: '2026-06-01', due: '2026-06-15' },
      { id: 'in6', ws: 'ws_kestrel', number: 'CB-10242', amount: 294, status: 'overdue', issued: '2026-05-08', due: '2026-05-22' },
      { id: 'in7', ws: 'ws_meridian', number: 'CB-10230', amount: 1225, status: 'paid', issued: '2026-05-01', due: '2026-05-15' },
      { id: 'in8', ws: 'ws_harbour', number: 'CB-10229', amount: 1960, status: 'paid', issued: '2026-05-01', due: '2026-05-15' },
    ],
    events: [
      { id: 'ev1', type: 'deploy', message: 'Deploy succeeded \u2014 web @ v3-1-015', severity: 'info', at: isoDaysAgo(0) },
      { id: 'ev2', type: 'api', message: 'API p95 latency 142ms (eu-west-2)', severity: 'info', at: isoDaysAgo(0) },
      { id: 'ev3', type: 'sync', message: 'Offline sync queue drained (1,204 ops)', severity: 'info', at: isoDaysAgo(0) },
      { id: 'ev4', type: 'billing', message: 'Payment failed \u2014 Kestrel Roofing', severity: 'warn', at: isoDaysAgo(1) },
      { id: 'ev5', type: 'system', message: 'Postgres pool 68% utilised', severity: 'info', at: isoDaysAgo(1) },
      { id: 'ev6', type: 'security', message: 'New device sign-in \u2014 adrian@cortexbuild.app', severity: 'info', at: isoDaysAgo(2) },
      { id: 'ev7', type: 'system', message: 'Ollama model warm-up 2.3s', severity: 'info', at: isoDaysAgo(2) },
      { id: 'ev8', type: 'auth', message: 'MFA enforced \u2014 Harbour Civils', severity: 'info', at: isoDaysAgo(3) },
    ],
    services: [
      { id: 'svc_api', name: 'API (Express)', status: 'operational', uptime: 99.98, p95: 142 },
      { id: 'svc_db', name: 'PostgreSQL', status: 'operational', uptime: 99.99, p95: 8 },
      { id: 'svc_llm', name: 'Local LLM (Ollama)', status: 'operational', uptime: 99.92, p95: 2300 },
      { id: 'svc_sync', name: 'Offline Sync', status: 'operational', uptime: 99.95, p95: 64 },
      { id: 'svc_push', name: 'Push (APNs/FCM)', status: 'degraded', uptime: 99.40, p95: 880 },
      { id: 'svc_cdn', name: 'CDN / Static', status: 'operational', uptime: 100, p95: 24 },
    ],
    flags: [
      { id: 'ai_lead_gen', name: 'AI Lead Generation', desc: 'CEO persona auto-drafts outbound leads', enabled: true, rollout: 100 },
      { id: 'local_llm', name: 'Local LLM (Ollama)', desc: 'On-device inference, no third-party API', enabled: true, rollout: 100 },
      { id: 'retention_ledger', name: 'Retention Ledger', desc: 'Per-invoice retention tracking', enabled: true, rollout: 100 },
      { id: 'bank_rec', name: 'Bank Reconciliation', desc: 'Open Banking auto-match', enabled: true, rollout: 80 },
      { id: 'client_portal', name: 'Branded Client Portal', desc: 'White-label progress feed', enabled: false, rollout: 25 },
      { id: 'nfc_checkin', name: 'NFC Site Check-in', desc: 'Tap-to-clock with NFC tags', enabled: true, rollout: 60 },
    ],
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // ensure new arrays exist
        for (const k of ['workspaces', 'users', 'incidents', 'audit', 'invoices', 'events', 'services', 'flags']) {
          if (!Array.isArray(parsed[k])) parsed[k] = clone(SEED[k]);
        }
        return parsed;
      }
    } catch (e) {}
    return clone(SEED);
  }

  let state = load();
  const subs = new Set();
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    subs.forEach(fn => { try { fn(state); } catch (e) {} });
  }

  function uid(prefix) { return prefix + '_' + Math.random().toString(36).slice(2, 9); }

  // Optional server mirror — set by the app when the live API is reachable.
  // Mutations call mirror(op, payload) fire-and-forget; failures are ignored
  // because the local store remains the authoritative offline copy.
  let mirror = null;
  function setMirror(fn) { mirror = fn; }
  function emit(op, payload) { if (mirror) { try { mirror(op, payload); } catch (e) {} } }

  // Replace collections from an authoritative API payload (live-mode hydrate).
  function hydrate(data) {
    if (!data) return;
    if (Array.isArray(data.workspaces)) state.workspaces = data.workspaces;
    if (Array.isArray(data.users)) state.users = data.users;
    if (Array.isArray(data.audit)) state.audit = data.audit;
    persist();
  }

  function pushAudit(action, target, meta) {
    state.audit.unshift({
      id: uid('a'), actor: 'admin@cortexbuild.app', action, target,
      when: new Date().toISOString(), meta: meta || '',
    });
    if (state.audit.length > 200) state.audit.length = 200;
  }

  // ── Public API ───────────────────────────────────────────
  window.AdminStore = {
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    snapshot() { return state; },
    reset() { state = clone(SEED); persist(); },
    setMirror, hydrate,

    // Derived metrics
    metrics() {
      const ws = state.workspaces;
      const active = ws.filter(w => w.status === 'active');
      const mrr = ws.reduce((s, w) => s + (w.status === 'active' || w.status === 'past_due' ? w.mrr : 0), 0);
      const seats = ws.reduce((s, w) => s + w.seatsUsed, 0);
      const seatCap = ws.reduce((s, w) => s + w.seats, 0);
      const trials = ws.filter(w => w.status === 'trial').length;
      const pastDue = ws.filter(w => w.status === 'past_due').length;
      const storage = ws.reduce((s, w) => s + w.storageMB, 0);
      const projects = ws.reduce((s, w) => s + w.projects, 0);
      return { mrr, arr: mrr * 12, active: active.length, total: ws.length, seats, seatCap, trials, pastDue, storageGB: (storage / 1024), projects, users: state.users.length };
    },

    // Workspace mutations
    setWorkspaceStatus(id, status) {
      const w = state.workspaces.find(x => x.id === id); if (!w) return;
      const prev = w.status; w.status = status;
      pushAudit('workspace.status.changed', w.name, prev + ' → ' + status);
      emit('patchWorkspace', { id, body: { status } });
      persist();
    },
    setWorkspacePlan(id, plan) {
      const w = state.workspaces.find(x => x.id === id); if (!w) return;
      const PLAN_SEAT = { Starter: 0, Pro: 49, Business: 49 };
      const PLAN_CAP = { Starter: 3, Pro: 12, Business: 40 };
      const prev = w.plan; w.plan = plan;
      w.seats = PLAN_CAP[plan]; 
      w.mrr = plan === 'Starter' ? 0 : Math.round(w.seatsUsed * 49);
      pushAudit('workspace.plan.changed', w.name, prev + ' → ' + plan);
      emit('patchWorkspace', { id, body: { plan } });
      persist();
    },
    addSeat(id, n) {
      const w = state.workspaces.find(x => x.id === id); if (!w) return;
      w.seats += (n || 1);
      pushAudit('workspace.seat.added', w.name, '+' + (n || 1) + ' seat');
      emit('patchWorkspace', { id, body: { addSeat: n || 1 } });
      persist();
    },
    createWorkspace(data) {
      const w = {
        id: uid('ws'), name: data.name || 'New Workspace', owner: data.owner || '—',
        plan: data.plan || 'Starter', seats: data.plan === 'Business' ? 40 : data.plan === 'Pro' ? 12 : 3,
        seatsUsed: 1, mrr: data.plan === 'Starter' ? 0 : 49, status: 'trial',
        region: data.region || 'UK-London', created: new Date().toISOString().slice(0, 10),
        projects: 0, storageMB: 0,
      };
      state.workspaces.unshift(w);
      pushAudit('workspace.created', w.name, w.plan);
      emit('createWorkspace', { name: w.name, owner: w.owner, plan: w.plan, region: w.region });
      persist();
      return w;
    },
    deleteWorkspace(id) {
      const w = state.workspaces.find(x => x.id === id);
      state.workspaces = state.workspaces.filter(x => x.id !== id);
      state.users = state.users.filter(u => u.ws !== id);
      if (w) pushAudit('workspace.deleted', w.name, '');
      emit('deleteWorkspace', { id });
      persist();
    },

    // User mutations
    setUserRole(id, role) {
      const u = state.users.find(x => x.id === id); if (!u) return;
      const prev = u.role; u.role = role;
      pushAudit('user.role.changed', u.email, prev + ' → ' + role);
      emit('patchUser', { id, body: { role } });
      persist();
    },
    setUserStatus(id, status) {
      const u = state.users.find(x => x.id === id); if (!u) return;
      u.status = status;
      pushAudit('user.status.changed', u.email, status);
      emit('patchUser', { id, body: { status } });
      persist();
    },
    resetMfa(id) {
      const u = state.users.find(x => x.id === id); if (!u) return;
      u.mfa = false;
      pushAudit('user.mfa.reset', u.email, '');
      emit('patchUser', { id, body: { resetMfa: true } });
      persist();
    },
    inviteUser(data) {
      const u = {
        id: uid('u'), name: data.name || data.email.split('@')[0], email: data.email,
        ws: data.ws, role: data.role || 'Member', status: 'active',
        lastSeen: new Date().toISOString(), mfa: false,
      };
      state.users.unshift(u);
      const w = state.workspaces.find(x => x.id === data.ws);
      if (w) w.seatsUsed = Math.min(w.seats, w.seatsUsed + 1);
      pushAudit('user.invited', u.email, w ? w.name : '');
      persist();
      return u;
    },

    wsName(id) { const w = state.workspaces.find(x => x.id === id); return w ? w.name : '—'; },

    // Billing
    invoices() { return [...state.invoices]; },
    billingTotals() {
      const inv = state.invoices;
      const collected = inv.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
      const open = inv.filter(i => i.status === 'open').reduce((s, i) => s + i.amount, 0);
      const overdue = inv.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
      return { collected, open, overdue, outstanding: open + overdue };
    },
    markInvoicePaid(id) {
      const i = state.invoices.find(x => x.id === id); if (!i || i.status === 'paid') return;
      i.status = 'paid';
      const w = state.workspaces.find(x => x.id === i.ws);
      if (w && w.status === 'past_due') w.status = 'active';
      pushAudit('billing.invoice.paid', this.wsName(i.ws), '£' + i.amount.toLocaleString());
      persist();
    },

    // System health
    services() { return [...state.services]; },
    events() { return [...state.events]; },

    // Feature flags
    flags() { return [...state.flags]; },
    toggleFlag(id) {
      const f = state.flags.find(x => x.id === id); if (!f) return;
      f.enabled = !f.enabled;
      pushAudit('feature_flag.toggled', f.name, f.enabled ? 'on' : 'off');
      persist();
    },
    setFlagRollout(id, pct) {
      const f = state.flags.find(x => x.id === id); if (!f) return;
      f.rollout = Math.max(0, Math.min(100, pct));
      persist();
    },

    // Projects (derived per workspace)
    projectsByWorkspace() {
      return state.workspaces.map(w => ({ id: w.id, name: w.name, projects: w.projects, status: w.status, value: w.mrr * 12 }));
    },

    mrrSeries() { return [...state.mrrHistory]; },
    signupsSeries() { return [...state.signupsHistory]; },
  };
})();
