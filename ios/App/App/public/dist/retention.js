// CortexBuild Pro — Retention engine (Phase 107, v1.3)
//
// UK construction retention: a percentage of each invoice is held back by
// the client until practical completion (PC), then half released at PC and
// the rest at end of defects-liability period (typically 6-12 months later).
//
// Model:
//   invoice.retentionPct       — e.g. 0.05 (5%)
//   invoice.retentionAmount    — computed: amount * pct
//   invoice.payableNow         — computed: amount - retentionAmount
//   invoice.retentionStatus    — 'held' | 'pc_released' | 'final_released'
//   invoice.retentionReleased  — running total of what's been released
//   invoice.defectsPeriodDays  — typically 365
//   invoice.pcDate             — when first half releases
//   invoice.finalReleaseDate   — pcDate + defectsPeriodDays
//
// Helpers + a ledger that aggregates all held-back amounts across projects.

(function () {
  if (window.CortexRetention) return;

  const DEFAULT_PCT = 0.05;       // 5%
  const DEFAULT_DEFECTS_DAYS = 365;

  function withRetention(inv) {
    const pct = Number(inv.retentionPct || 0);
    const amount = Number(inv.amount || 0);
    const retentionAmount = Math.round(amount * pct * 100) / 100;
    const payableNow = Math.round((amount - retentionAmount) * 100) / 100;
    const released = Number(inv.retentionReleased || 0);
    const outstanding = Math.max(0, retentionAmount - released);
    return Object.assign({}, inv, {
      retentionPct: pct,
      retentionAmount,
      payableNow,
      retentionReleased: released,
      retentionOutstanding: outstanding,
      retentionStatus: inv.retentionStatus || (pct > 0 ? 'held' : 'none'),
    });
  }

  // Returns the ledger: every invoice with retention > 0, plus aggregates
  function ledger(invoices, projects) {
    const rows = (invoices || [])
      .map(withRetention)
      .filter(i => i.retentionAmount > 0);

    // Aggregate by project
    const byProject = {};
    for (const r of rows) {
      const key = r.projectId || 'unassigned';
      if (!byProject[key]) byProject[key] = { projectId: r.projectId, totalHeld: 0, totalReleased: 0, invoiceCount: 0, due: [] };
      byProject[key].totalHeld += r.retentionAmount;
      byProject[key].totalReleased += r.retentionReleased || 0;
      byProject[key].invoiceCount++;
    }
    // Resolve project names
    if (projects) {
      Object.values(byProject).forEach(p => {
        const proj = projects.find(x => x.id === p.projectId);
        p.projectName = (proj && proj.name) || 'Unassigned';
      });
    }

    const totalHeld = rows.reduce((s, r) => s + (r.retentionAmount || 0), 0);
    const totalReleased = rows.reduce((s, r) => s + (r.retentionReleased || 0), 0);
    const totalOutstanding = totalHeld - totalReleased;

    // Upcoming releases (PC dates + final release dates)
    const today = new Date();
    const upcoming = [];
    rows.forEach(r => {
      if (r.pcDate && r.retentionStatus === 'held') {
        upcoming.push({
          invoice: r.id, client: r.client, projectId: r.projectId,
          amount: r.retentionAmount / 2,
          dueDate: r.pcDate,
          kind: 'PC release (50%)',
          overdue: new Date(r.pcDate) < today,
        });
      }
      if (r.finalReleaseDate && r.retentionStatus !== 'final_released') {
        upcoming.push({
          invoice: r.id, client: r.client, projectId: r.projectId,
          amount: r.retentionStatus === 'held' ? r.retentionAmount / 2 : r.retentionAmount - r.retentionReleased,
          dueDate: r.finalReleaseDate,
          kind: 'Final release',
          overdue: new Date(r.finalReleaseDate) < today,
        });
      }
    });
    upcoming.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    return {
      rows, byProject: Object.values(byProject),
      totals: { held: totalHeld, released: totalReleased, outstanding: totalOutstanding },
      upcoming,
    };
  }

  // Apply a retention percentage to an invoice + persist
  async function setPct(invoiceId, pct, opts) {
    if (!window.Backend || !window.Backend.db || !window.Backend.db.invoices) return null;
    const all = await window.Backend.db.invoices.list();
    const inv = all.find(i => i.id === invoiceId);
    if (!inv) return null;
    const patch = Object.assign({ retentionPct: pct, retentionStatus: pct > 0 ? 'held' : 'none' }, opts || {});
    if (opts && opts.pcDate && !patch.finalReleaseDate) {
      const d = new Date(opts.pcDate); d.setDate(d.getDate() + (opts.defectsPeriodDays || DEFAULT_DEFECTS_DAYS));
      patch.finalReleaseDate = d.toISOString().slice(0, 10);
    }
    return window.Backend.db.invoices.update(invoiceId, patch);
  }

  // Release a portion (or all) of retention. amount === null/undefined releases all outstanding.
  async function release(invoiceId, kind, amount) {
    if (!window.Backend || !window.Backend.db || !window.Backend.db.invoices) return null;
    const all = await window.Backend.db.invoices.list();
    const inv = withRetention(all.find(i => i.id === invoiceId) || {});
    if (!inv.retentionAmount) return null;
    const releaseAmount = amount == null ? inv.retentionOutstanding : Math.min(Number(amount), inv.retentionOutstanding);
    const newReleased = (inv.retentionReleased || 0) + releaseAmount;
    const newStatus = newReleased >= inv.retentionAmount - 0.005
      ? 'final_released'
      : (kind === 'pc' || kind === 'PC' ? 'pc_released' : 'partial_released');
    const result = await window.Backend.db.invoices.update(invoiceId, {
      retentionReleased: Math.round(newReleased * 100) / 100,
      retentionStatus: newStatus,
      retentionLastReleased: new Date().toISOString().slice(0, 10),
    });
    // Activity log
    try {
      if (window.Backend.db.activity && window.Backend.db.activity.create) {
        await window.Backend.db.activity.create({
          id: 'act-ret-' + Date.now(),
          t: 'Retention released',
          sub: '£' + releaseAmount.toLocaleString() + ' from ' + invoiceId + ' (' + (kind || 'release') + ')',
          when: 'now', icon: '🔓',
        });
      }
    } catch (e) {}
    return result;
  }

  window.CortexRetention = {
    DEFAULT_PCT, DEFAULT_DEFECTS_DAYS,
    withRetention, ledger, setPct, release,
    // forProject(projectId) — summary used by the invoice lifecycle screen
    forProject: (projectId) => {
      const invs = (Backend.db.snapshot().invoices || []).filter(i => i.projectId == projectId);
      const projs = Backend.db.snapshot().projects || [];
      const result = ledger(invs, projs);
      const held = result.totalHeld || 0;
      const toRelease = (result.upcoming || []).filter(u => u.overdue).reduce((s, u) => s + (u.amount || 0), 0);
      const released = result.totalReleased || 0;
      return { projectId, invoiceCount: invs.length, held, toRelease, released, rows: result.rows || [], upcoming: result.upcoming || [] };
    },
  };
})();
