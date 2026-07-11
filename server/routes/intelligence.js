// CortexBuild Pro API — Server-side Intelligence (v1.7)
// Authoritative server-side computation of the seven v1.7 domains. Mirrors
// lib/backend-v17.js computed selectors exactly, but reads from the canonical
// documents_store so dashboards/reports/exports can pull numbers that are
// identical whether computed on-device or on the server.
// Mounted at /api/intelligence/*.

const express = require('express');

const num = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
const money = (n) => Math.round(num(n));

module.exports = function intelligenceRoutes(pool, auth) {
  const router = express.Router();

  // Load every collection for a workspace from documents_store into a map of
  // { collection: [records] }. documents_store is the authoritative overlay.
  async function loadStore(ws) {
    const out = {};
    try {
      const r = await pool.query(
        'SELECT collection, doc_id, data FROM documents_store WHERE workspace_id=$1',
        [ws]
      );
      for (const row of r.rows) {
        (out[row.collection] ||= []).push({ id: row.doc_id, ...row.data });
      }
    } catch (e) { /* empty workspace */ }
    // Overlay a few typed tables as a seed baseline (projects/invoices/quotes)
    for (const [coll, tbl] of [['projects', 'projects'], ['invoices', 'invoices'], ['quotes', 'quotes'], ['tasks', 'tasks']]) {
      if (out[coll]) continue;
      try { const r = await pool.query(`SELECT * FROM ${tbl} WHERE workspace_id=$1`, [ws]); out[coll] = r.rows; }
      catch (e) { out[coll] = []; }
    }
    return out;
  }
  const C = (s, k) => Array.isArray(s[k]) ? s[k] : [];

  // ── Scheduling & resource planning ───────────────────────────
  function scheduling(s) {
    const allocations = C(s, 'allocations');
    const equipment = C(s, 'equipment');
    // Clash detection: same resource double-booked on overlapping dates
    const clashes = [];
    for (let i = 0; i < allocations.length; i++) {
      for (let j = i + 1; j < allocations.length; j++) {
        const a = allocations[i], b = allocations[j];
        if (a.resourceId && a.resourceId === b.resourceId) {
          const as = new Date(a.start), ae = new Date(a.end || a.start);
          const bs = new Date(b.start), be = new Date(b.end || b.start);
          if (as <= be && bs <= ae) clashes.push({ a: a.id, b: b.id, resource: a.resourceName || a.resourceId });
        }
      }
    }
    const utilisation = equipment.length
      ? Math.round((allocations.filter(a => a.kind === 'plant').length / equipment.length) * 100)
      : 0;
    return {
      totalAllocations: allocations.length,
      crewAllocations: allocations.filter(a => a.kind !== 'plant').length,
      plantAllocations: allocations.filter(a => a.kind === 'plant').length,
      clashes: clashes.length,
      clashDetail: clashes.slice(0, 20),
      plantUtilisationPct: utilisation,
    };
  }

  // ── Financial intelligence ───────────────────────────────────
  function financial(s) {
    const invoices = C(s, 'invoices');
    const projects = C(s, 'projects');
    const receiptsArr = C(s, 'receipts');
    const pos = C(s, 'purchaseOrders');

    // Cashflow forecast (8 weeks): expected inflows from unpaid invoices by due date
    const weeks = 8;
    const now = new Date();
    const forecast = [];
    for (let w = 0; w < weeks; w++) {
      const start = new Date(now.getTime() + w * 7 * 86400000);
      const end = new Date(start.getTime() + 7 * 86400000);
      const inflow = invoices
        .filter(i => i.status !== 'paid' && i.due && new Date(i.due) >= start && new Date(i.due) < end)
        .reduce((a, i) => a + num(i.amount), 0);
      forecast.push({ week: w + 1, from: start.toISOString().slice(0, 10), inflow: money(inflow) });
    }
    const projectPnL = (pid) => {
      const inv = invoices.filter(i => i.projectId == pid).reduce((a, i) => a + num(i.amount), 0);
      const labour = num((projects.find(p => p.id == pid) || {}).labourCost);
      const mats = receiptsArr.filter(r => r.projectId == pid).reduce((a, r) => a + num(r.amount), 0)
        + pos.filter(p => p.projectId == pid).reduce((a, p) => a + num(p.total), 0);
      const cost = labour + mats;
      return { projectId: pid, revenue: money(inv), cost: money(cost), profit: money(inv - cost), marginPct: inv ? Math.round(((inv - cost) / inv) * 100) : 0 };
    };
    const pnl = projects.map(p => ({ name: p.name, ...projectPnL(p.id) }));
    const marginAlerts = pnl.filter(p => p.marginPct < 15).sort((a, b) => a.marginPct - b.marginPct);
    const wip = projects.reduce((a, p) => {
      const done = num(p.progressPct || p.progress) / 100;
      const val = num(p.value || p.contractValue);
      const billed = invoices.filter(i => i.projectId == p.id).reduce((x, i) => x + num(i.amount), 0);
      return a + Math.max(0, val * done - billed);
    }, 0);
    return { cashflowForecast: forecast, projectPnL: pnl, marginAlerts, wipValue: money(wip) };
  }

  // ── Tender & bid management ───────────────────────────────────
  function tender(s) {
    const bids = C(s, 'bids');
    const open = bids.filter(b => !['won', 'lost'].includes(b.stage));
    const decided = bids.filter(b => ['won', 'lost'].includes(b.stage));
    const won = decided.filter(b => b.stage === 'won');
    return {
      pipelineValue: money(open.reduce((a, b) => a + num(b.value) * (num(b.probability) / 100), 0)),
      pipelineCount: open.length,
      winRatePct: decided.length ? Math.round((won.length / decided.length) * 100) : 0,
      wonValue: money(won.reduce((a, b) => a + num(b.value), 0)),
      byStage: ['qualifying', 'estimating', 'submitted', 'won', 'lost'].map(st => ({ stage: st, count: bids.filter(b => b.stage === st).length })),
    };
  }

  // ── Procurement & supply chain ───────────────────────────────
  function procurement(s) {
    const pos = C(s, 'purchaseOrders');
    const scores = C(s, 'supplierScores');
    const materials = C(s, 'materials');
    return {
      pendingApproval: pos.filter(p => p.status === 'pending').length,
      inTransit: pos.filter(p => ['approved', 'ordered'].includes(p.status)).length,
      delivered: pos.filter(p => p.status === 'delivered').length,
      avgSupplierRating: scores.length ? +(scores.reduce((a, x) => a + num(x.rating), 0) / scores.length).toFixed(1) : 0,
      lowStock: materials.filter(m => num(m.stock) < num(m.min)).map(m => ({ name: m.name, stock: m.stock, min: m.min, unit: m.unit })),
      supplierScores: scores.map(x => ({ supplier: x.supplier, rating: x.rating, onTimePct: x.onTimePct, qualityPct: x.qualityPct })),
    };
  }

  // ── Quality & handover ───────────────────────────────────────
  function quality(s) {
    const items = C(s, 'handoverItems');
    const snags = C(s, 'snags');
    const readiness = (pid) => {
      const it = items.filter(h => pid == null || h.projectId == pid);
      if (!it.length) return 0;
      return Math.round((it.filter(h => h.status === 'complete' || h.done).length / it.length) * 100);
    };
    const projects = C(s, 'projects');
    return {
      overallReadinessPct: readiness(null),
      openSnags: snags.filter(x => x.status !== 'closed' && !x.resolved).length,
      byProject: projects.map(p => ({ name: p.name, readinessPct: readiness(p.id) })),
      handoverItems: items.length,
    };
  }

  // ── H&S command centre ───────────────────────────────────────
  function hs(s) {
    const incidents = C(s, 'incidents');
    const audits = C(s, 'hsAudits');
    const talks = C(s, 'talkSchedule');
    const weeks = 6, now = new Date(), trend = [];
    for (let w = weeks - 1; w >= 0; w--) {
      const start = new Date(now.getTime() - (w + 1) * 7 * 86400000);
      const end = new Date(now.getTime() - w * 7 * 86400000);
      trend.push({
        weekEnding: end.toISOString().slice(0, 10),
        nearMisses: incidents.filter(i => (i.type === 'near-miss' || i.severity === 'near-miss') && i.date && new Date(i.date) >= start && new Date(i.date) < end).length,
      });
    }
    return {
      nearMissTrend: trend,
      overdueAudits: audits.filter(a => a.status === 'overdue').length,
      scheduledTalks: talks.filter(t => t.status !== 'done').length,
      openIncidents: incidents.filter(i => i.status !== 'closed').length,
    };
  }

  // ── Client experience ────────────────────────────────────────
  function client(s) {
    const sat = C(s, 'satisfaction');
    const feed = C(s, 'progressFeed');
    const cos = C(s, 'changeOrders');
    const avg = sat.length ? +(sat.reduce((a, x) => a + num(x.score), 0) / sat.length).toFixed(1) : 0;
    // NPS: promoters (9-10) − detractors (0-6), scores assumed 0-10
    let promoters = 0, detractors = 0;
    sat.forEach(x => { const v = num(x.score); if (v >= 9) promoters++; else if (v <= 6) detractors++; });
    const nps = sat.length ? Math.round(((promoters - detractors) / sat.length) * 100) : 0;
    return {
      avgSatisfaction: avg,
      nps,
      pendingVariations: cos.filter(c => c.status === 'pending').length,
      feedItems: feed.length,
    };
  }

  const DOMAINS = { scheduling, financial, tender, procurement, quality, hs, client };

  // GET /api/intelligence — every domain at once (the CEO briefing payload)
  router.get('/intelligence', auth, async (req, res) => {
    const s = await loadStore(req.user.ws);
    const out = {};
    for (const [k, fn] of Object.entries(DOMAINS)) {
      try { out[k] = fn(s); } catch (e) { out[k] = { error: e.message }; }
    }
    res.json({ at: new Date().toISOString(), domains: out });
  });

  // GET /api/intelligence/:domain — a single domain
  router.get('/intelligence/:domain', auth, async (req, res) => {
    const fn = DOMAINS[req.params.domain];
    if (!fn) return res.status(404).json({ error: 'unknown_domain', valid: Object.keys(DOMAINS) });
    const s = await loadStore(req.user.ws);
    try { res.json({ at: new Date().toISOString(), domain: req.params.domain, data: fn(s) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
